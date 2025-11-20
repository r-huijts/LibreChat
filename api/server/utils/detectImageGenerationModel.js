const { logger } = require('@librechat/data-schemas');

/**
 * Detects if a model should use image generation endpoint based on modelSpecs
 * @param {string} model - Model name
 * @param {string} endpoint - Endpoint name
 * @param {AppConfig} appConfig - Application configuration
 * @returns {boolean} True if model should use image generation endpoint
 */
function isImageGenerationModel(model, endpoint, appConfig) {
  if (!appConfig?.modelSpecs?.list) {
    return false;
  }

  // Find model spec that matches the model and endpoint
  const modelSpec = appConfig.modelSpecs.list.find((spec) => {
    return (
      spec.preset?.model === model &&
      spec.preset?.endpoint === endpoint &&
      spec.imageGeneration === true
    );
  });

  if (modelSpec) {
    logger.debug(
      `[detectImageGenerationModel] Found image generation model: ${model} on endpoint: ${endpoint}`,
    );
    return true;
  }

  return false;
}

/**
 * Gets the model spec for a given model and endpoint
 * @param {string} model - Model name
 * @param {string} endpoint - Endpoint name
 * @param {AppConfig} appConfig - Application configuration
 * @returns {TModelSpec | undefined} The model spec if found
 */
function getModelSpec(model, endpoint, appConfig) {
  if (!appConfig?.modelSpecs?.list) {
    return undefined;
  }

  return appConfig.modelSpecs.list.find(
    (spec) => spec.preset?.model === model && spec.preset?.endpoint === endpoint,
  );
}

module.exports = {
  isImageGenerationModel,
  getModelSpec,
};

