const {
  getUserConsentsController,
  acceptConsentController,
  revokeConsentController,
} = require('../ModelConsentController');
const {
  getUserConsents,
  acceptModelConsent,
  revokeModelConsent,
} = require('~/models');

jest.mock('~/models');

describe('ModelConsentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 'user123' },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('getUserConsentsController', () => {
    it('should return user consents', async () => {
      const mockConsents = [
        { modelName: 'model1', acceptedAt: new Date(), revokedAt: null },
      ];
      getUserConsents.mockResolvedValue(mockConsents);

      await getUserConsentsController(req, res);

      expect(getUserConsents).toHaveBeenCalledWith('user123', { includeRevoked: false });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ consents: mockConsents });
    });

    it('should handle includeRevoked query parameter', async () => {
      req.query.includeRevoked = 'true';
      getUserConsents.mockResolvedValue([]);

      await getUserConsentsController(req, res);

      expect(getUserConsents).toHaveBeenCalledWith('user123', { includeRevoked: true });
    });

    it('should handle errors', async () => {
      getUserConsents.mockRejectedValue(new Error('DB error'));

      await getUserConsentsController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching model consents' });
    });
  });

  describe('acceptConsentController', () => {
    it('should accept model consent', async () => {
      req.body = {
        modelName: 'model1',
        modelLabel: 'Model 1',
      };
      const mockConsent = {
        modelName: 'model1',
        modelLabel: 'Model 1',
        acceptedAt: new Date(),
      };
      acceptModelConsent.mockResolvedValue(mockConsent);

      await acceptConsentController(req, res);

      expect(acceptModelConsent).toHaveBeenCalledWith('user123', {
        modelName: 'model1',
        modelLabel: 'Model 1',
        metadata: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ consent: mockConsent });
    });

    it('should return 400 if modelName is missing', async () => {
      req.body = {};

      await acceptConsentController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'modelName is required' });
    });

    it('should handle errors', async () => {
      req.body = { modelName: 'model1' };
      acceptModelConsent.mockRejectedValue(new Error('DB error'));

      await acceptConsentController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error accepting model consent' });
    });
  });

  describe('revokeConsentController', () => {
    it('should revoke model consent', async () => {
      req.params.modelName = 'model1';
      revokeModelConsent.mockResolvedValue(true);

      await revokeConsentController(req, res);

      expect(revokeModelConsent).toHaveBeenCalledWith('user123', 'model1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Consent revoked successfully' });
    });

    it('should return 404 if no consent found', async () => {
      req.params.modelName = 'model1';
      revokeModelConsent.mockResolvedValue(false);

      await revokeConsentController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No active consent found to revoke' });
    });

    it('should return 400 if modelName is missing', async () => {
      req.params = {};

      await revokeConsentController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'modelName is required' });
    });

    it('should handle errors', async () => {
      req.params.modelName = 'model1';
      revokeModelConsent.mockRejectedValue(new Error('DB error'));

      await revokeConsentController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error revoking model consent' });
    });
  });
});

