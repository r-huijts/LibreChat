const express = require('express');
const EditController = require('~/server/controllers/EditController');
const { initializeClient } = require('~/server/services/Endpoints/custom');
const { addTitle } = require('~/server/services/Endpoints/openAI');
const {
  handleAbort,
  setHeaders,
  validateModel,
  validateEndpoint,
  buildEndpointOption,
} = require('~/server/middleware');
const handleImageGenerationMiddleware = require('~/server/middleware/handleImageGeneration');

const router = express.Router();

router.post(
  '/',
  validateEndpoint,
  validateModel,
  handleImageGenerationMiddleware, // Intercept image generation requests before building endpoint option
  buildEndpointOption,
  setHeaders,
  async (req, res, next) => {
    await EditController(req, res, next, initializeClient, addTitle);
  },
);

module.exports = router;
