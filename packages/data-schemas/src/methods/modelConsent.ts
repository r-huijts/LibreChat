import type { ModelConsentInput, ModelConsentFilterOptions, IModelConsent } from '~/types';

/**
 * Creates methods for managing model consents
 */
export function createModelConsentMethods(mongoose: typeof import('mongoose')) {
  // Lazy-load models to ensure they're initialized
  const getModelConsent = () => {
    if (!mongoose.models.ModelConsent) {
      throw new Error('ModelConsent model not initialized');
    }
    return mongoose.models.ModelConsent as ReturnType<
      typeof import('~/models/modelConsent').createModelConsentModel
    >;
  };
  
  const getUser = () => {
    if (!mongoose.models.User) {
      throw new Error('User model not initialized');
    }
    return mongoose.models.User as ReturnType<typeof import('~/models/user').createUserModel>;
  };

  /**
   * Get model consents for a user
   */
  const getUserConsents = async (
    userId: string,
    options: { includeRevoked?: boolean } = {},
  ): Promise<IModelConsent[]> => {
    const ModelConsent = getModelConsent();
    const query: Record<string, unknown> = { userId };
    if (!options.includeRevoked) {
      query.revokedAt = null;
    }
    return ModelConsent.find(query).sort({ acceptedAt: -1 }).lean();
  };

  /**
   * Accept consent for a model (idempotent)
   */
  const acceptModelConsent = async (
    userId: string,
    input: ModelConsentInput,
  ): Promise<IModelConsent> => {
    const ModelConsent = getModelConsent();
    const User = getUser();
    
    // First, ensure the consent exists in the collection
    const consent = await ModelConsent.findOneAndUpdate(
      {
        userId,
        modelName: input.modelName,
      },
      {
        $set: {
          modelLabel: input.modelLabel || '',
          acceptedAt: new Date(),
          revokedAt: null,
          metadata: input.metadata || null,
        },
        $setOnInsert: {
          userId,
          modelName: input.modelName,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    // Also update the user's embedded consents
    await User.updateOne(
      { _id: userId },
      {
        $pull: {
          modelConsents: { modelName: input.modelName },
        },
      },
    );

    await User.updateOne(
      { _id: userId },
      {
        $push: {
          modelConsents: {
            modelName: input.modelName,
            modelLabel: input.modelLabel || '',
            acceptedAt: consent.acceptedAt,
            revokedAt: null,
          },
        },
      },
    );

    return consent;
  };

  /**
   * Revoke consent for a model (idempotent)
   */
  const revokeModelConsent = async (userId: string, modelName: string): Promise<boolean> => {
    const ModelConsent = getModelConsent();
    const User = getUser();
    const now = new Date();

    // Update the collection
    const result = await ModelConsent.updateOne(
      {
        userId,
        modelName,
        revokedAt: null,
      },
      {
        $set: { revokedAt: now },
      },
    );

    // Update the user's embedded consents
    await User.updateOne(
      { _id: userId, 'modelConsents.modelName': modelName },
      {
        $set: { 'modelConsents.$.revokedAt': now },
      },
    );

    return result.modifiedCount > 0;
  };

  /**
   * Get all consents for a specific model (admin function)
   */
  const getModelConsents = async (
    modelName: string,
    options: { includeRevoked?: boolean } = {},
  ): Promise<IModelConsent[]> => {
    const ModelConsent = getModelConsent();
    const query: Record<string, unknown> = { modelName };
    if (!options.includeRevoked) {
      query.revokedAt = null;
    }
    return ModelConsent.find(query).sort({ acceptedAt: -1 }).lean();
  };

  /**
   * Check if a user has active consent for a model
   */
  const hasModelConsent = async (userId: string, modelName: string): Promise<boolean> => {
    const ModelConsent = getModelConsent();
    const count = await ModelConsent.countDocuments({
      userId,
      modelName,
      revokedAt: null,
    });
    return count > 0;
  };

  return {
    getUserConsents,
    acceptModelConsent,
    revokeModelConsent,
    getModelConsents,
    hasModelConsent,
  };
}

