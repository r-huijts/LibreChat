const { logger } = require('@librechat/data-schemas');
const { isImageGenerationModel } = require('~/server/utils/detectImageGenerationModel');
const handleImageGeneration = require('~/server/controllers/imageGeneration');

/**
 * Middleware to intercept and route image generation requests
 * Checks if the model is configured for image generation and routes to image generation handler
 * @param {ServerRequest} req - Express request object
 * @param {ServerResponse} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleImageGenerationMiddleware = async (req, res, next) => {
  const { model, endpoint } = req.body;
  const appConfig = req.config;

  // Only process if we have model and endpoint
  if (!model || !endpoint) {
    return next();
  }

  // Check if this is an image generation model
  const isImageGen = isImageGenerationModel(model, endpoint, appConfig);

  if (!isImageGen) {
    // Not an image generation model, continue to normal flow
    return next();
  }

  logger.debug(
    `[handleImageGenerationMiddleware] Intercepting image generation request for model: ${model} on endpoint: ${endpoint}`,
  );

  // Route to image generation handler
  return handleImageGeneration(req, res);
};

module.exports = handleImageGenerationMiddleware;

