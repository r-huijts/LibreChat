const { logger } = require('@librechat/data-schemas');
const {
  getUserConsents,
  acceptModelConsent,
  revokeModelConsent,
  getModelConsents,
} = require('~/models');

/**
 * Get current user's model consents
 */
const getUserConsentsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const includeRevoked = req.query.includeRevoked === 'true';
    const consents = await getUserConsents(userId, { includeRevoked });
    res.status(200).json({ consents });
  } catch (error) {
    logger.error('[getUserConsentsController]', error);
    res.status(500).json({ message: 'Error fetching model consents' });
  }
};

/**
 * Accept/grant consent for a model
 */
const acceptConsentController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { modelName, modelLabel, metadata } = req.body;

    if (!modelName) {
      return res.status(400).json({ message: 'modelName is required' });
    }

    const consent = await acceptModelConsent(userId, {
      modelName,
      modelLabel,
      metadata,
    });

    res.status(200).json({ consent });
  } catch (error) {
    logger.error('[acceptConsentController]', error);
    res.status(500).json({ message: 'Error accepting model consent' });
  }
};

/**
 * Revoke consent for a model
 */
const revokeConsentController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { modelName } = req.params;

    if (!modelName) {
      return res.status(400).json({ message: 'modelName is required' });
    }

    const revoked = await revokeModelConsent(userId, modelName);

    if (!revoked) {
      return res.status(404).json({ message: 'No active consent found to revoke' });
    }

    res.status(200).json({ message: 'Consent revoked successfully' });
  } catch (error) {
    logger.error('[revokeConsentController]', error);
    res.status(500).json({ message: 'Error revoking model consent' });
  }
};

/**
 * Get all consents for a specific model (admin only)
 */
const getModelConsentsController = async (req, res) => {
  try {
    const { modelName } = req.params;
    const includeRevoked = req.query.includeRevoked === 'true';

    if (!modelName) {
      return res.status(400).json({ message: 'modelName is required' });
    }

    const consents = await getModelConsents(modelName, { includeRevoked });
    res.status(200).json({ consents });
  } catch (error) {
    logger.error('[getModelConsentsController]', error);
    res.status(500).json({ message: 'Error fetching model consents' });
  }
};

module.exports = {
  getUserConsentsController,
  acceptConsentController,
  revokeConsentController,
  getModelConsentsController,
};

