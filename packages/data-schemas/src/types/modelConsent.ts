import type { Document, Types } from 'mongoose';

export interface IModelConsent extends Document {
  userId: Types.ObjectId;
  modelName: string;
  modelLabel?: string;
  acceptedAt: Date;
  revokedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelConsentInput {
  modelName: string;
  modelLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelConsentFilterOptions {
  userId?: Types.ObjectId | string;
  modelName?: string;
  includeRevoked?: boolean;
}

