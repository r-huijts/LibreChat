const express = require('express');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const {
  getUserConsentsController,
  acceptConsentController,
  revokeConsentController,
  getModelConsentsController,
} = require('~/server/controllers/ModelConsentController');

const router = express.Router();

// All routes require authentication
router.use(requireJwtAuth);

// Get current user's consents
router.get('/', getUserConsentsController);

// Accept/grant consent for a model
router.post('/', acceptConsentController);

// Revoke consent for a model
router.delete('/:modelName', revokeConsentController);

// Admin: Get all consents for a specific model
router.get('/model/:modelName', checkAdmin, getModelConsentsController);

module.exports = router;

