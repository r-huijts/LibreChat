const axios = require('axios');
const { v4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { ContentTypes, FileContext, getResponseSender } = require('librechat-data-provider');
const {
  getCustomEndpointConfig,
  resolveHeaders,
  isUserProvided,
  sendEvent,
} = require('@librechat/api');
const { extractEnvVariable, envVarRegex } = require('librechat-data-provider');
const { getUserKeyValues, checkUserKeyExpiry } = require('~/server/services/UserService');
const { saveBase64Image } = require('~/server/services/Files/process');
const { saveMessage, saveConvo } = require('~/models');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Handles image generation requests for custom endpoints
 * @param {ServerRequest} req - Express request object
 * @param {ServerResponse} res - Express response object
 */
const handleImageGeneration = async (req, res) => {
  const { model, endpoint, text } = req.body;
  const appConfig = req.config;

  try {
    // Get endpoint configuration
    const endpointConfig = getCustomEndpointConfig({
      endpoint,
      appConfig,
    });

    if (!endpointConfig) {
      return res.status(400).json({ message: `Config not found for the ${endpoint} custom endpoint.` });
    }

    // Extract API key and base URL
    const CUSTOM_API_KEY = extractEnvVariable(endpointConfig.apiKey);
    const CUSTOM_BASE_URL = extractEnvVariable(endpointConfig.baseURL);

    if (CUSTOM_API_KEY.match(envVarRegex)) {
      return res.status(400).json({ message: `Missing API Key for ${endpoint}.` });
    }

    if (CUSTOM_BASE_URL.match(envVarRegex)) {
      return res.status(400).json({ message: `Missing Base URL for ${endpoint}.` });
    }

    // Resolve headers
    let resolvedHeaders = resolveHeaders({
      headers: endpointConfig.headers,
      user: req.user,
    });

    // Handle user-provided keys
    const userProvidesKey = isUserProvided(CUSTOM_API_KEY);
    const userProvidesURL = isUserProvided(CUSTOM_BASE_URL);
    const { key: expiresAt } = req.body;

    let apiKey = CUSTOM_API_KEY;
    let baseURL = CUSTOM_BASE_URL;

    if (expiresAt && (userProvidesKey || userProvidesURL)) {
      checkUserKeyExpiry(expiresAt, endpoint);
      const userValues = await getUserKeyValues({ userId: req.user.id, name: endpoint });
      apiKey = userProvidesKey ? userValues?.apiKey : CUSTOM_API_KEY;
      baseURL = userProvidesURL ? userValues?.baseURL : CUSTOM_BASE_URL;
    }

    // Extract prompt from text (first message content)
    let prompt = text;
    if (!prompt && req.body.messages && req.body.messages.length > 0) {
      const lastMessage = req.body.messages[req.body.messages.length - 1];
      if (lastMessage.content) {
        if (typeof lastMessage.content === 'string') {
          prompt = lastMessage.content;
        } else if (Array.isArray(lastMessage.content)) {
          const textPart = lastMessage.content.find((part) => part.type === 'text');
          prompt = textPart?.text || '';
        }
      }
    }

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required for image generation.' });
    }

    // Prepare Portkey image generation request
    const imageGenUrl = `${baseURL}/images/generations`;
    const requestBody = {
      model: model || 'gpt-image-1',
      prompt: prompt.trim(),
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json', // Get base64 for easier handling
    };

    logger.debug('[handleImageGeneration] Request to Portkey:', {
      url: imageGenUrl,
      model: requestBody.model,
      promptLength: prompt.length,
    });

    // Configure axios with proxy if needed
    const axiosConfig = {
      method: 'POST',
      url: imageGenUrl,
      headers: {
        'Content-Type': 'application/json',
        ...resolvedHeaders,
      },
      data: requestBody,
    };

    if (process.env.PROXY) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(process.env.PROXY);
    }

    // Call Portkey image generation endpoint
    const response = await axios(axiosConfig);

    if (!response.data || !response.data.data || !response.data.data.length) {
      return res.status(500).json({ message: 'No image data returned from image generation API.' });
    }

    const imageData = response.data.data[0];
    const base64Image = imageData.b64_json;

    if (!base64Image) {
      return res.status(500).json({ message: 'No base64 image data in response.' });
    }

    // Save the image
    const file_id = v4();
    const filename = `img-${file_id}.png`;

    const savedFile = await saveBase64Image(`data:image/png;base64,${base64Image}`, {
      req,
      file_id,
      filename,
      endpoint,
      context: FileContext.image_generation,
    });

    // Format response for LibreChat (matching EditController format)
    const imageUrl = savedFile.filepath;
    const responseMessageId = v4();
    const conversationId = req.body.conversationId || null;
    const parentMessageId = req.body.parentMessageId || null;
    const model = req.body.model || 'gpt-image';
    const modelDisplayLabel = endpointConfig.modelDisplayLabel || 'Portkey';

    const sender = getResponseSender({
      endpoint,
      model,
      modelDisplayLabel,
    });

    // Create response message
    const responseMessage = {
      messageId: responseMessageId,
      conversationId,
      parentMessageId,
      isCreatedByUser: false,
      model,
      sender,
      text: `![generated image](${imageUrl})`,
      finish_reason: 'stop',
      endpoint,
      files: [
        {
          file_id: savedFile.file_id,
          filepath: savedFile.filepath,
          filename: savedFile.filename,
          type: savedFile.type,
          bytes: savedFile.bytes,
          width: savedFile.width,
          height: savedFile.height,
        },
      ],
    };

    // Save user message if provided
    let userMessage = null;
    if (req.body.text) {
      const userMessageId = parentMessageId || v4();
      userMessage = {
        messageId: userMessageId,
        conversationId,
        parentMessageId: req.body.overrideParentMessageId || null,
        isCreatedByUser: true,
        text: req.body.text,
        sender: 'User',
      };
    }

    // Save messages to database
    if (userMessage) {
      await saveMessage(req, { ...userMessage, user: req.user.id }, {
        context: 'handleImageGeneration - user message',
      });
    }

    await saveMessage(req, { ...responseMessage, user: req.user.id }, {
      context: 'handleImageGeneration - response message',
    });

    // Save conversation
    await saveConvo(req, responseMessage, {
      context: 'handleImageGeneration - save conversation',
    });

    // Send final event (matching EditController format)
    sendEvent(res, {
      final: true,
      conversation: {
        conversationId,
        title: null,
        model,
      },
      title: null,
      requestMessage: userMessage,
      responseMessage,
    });

    res.end();
  } catch (error) {
    logger.error('[handleImageGeneration] Error generating image:', error);
    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Failed to generate image. Please try again.';
    res.status(error.response?.status || 500).json({ message: errorMessage });
  }
};

module.exports = handleImageGeneration;

