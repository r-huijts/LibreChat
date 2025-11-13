import { Schema } from 'mongoose';
import type { IModelConsent } from '~/types';

const modelConsentSchema = new Schema<IModelConsent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      index: true,
    },
    modelLabel: {
      type: String,
      default: '',
    },
    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient lookups
modelConsentSchema.index({ userId: 1, modelName: 1 });
modelConsentSchema.index({ modelName: 1, revokedAt: 1 });

export default modelConsentSchema;

