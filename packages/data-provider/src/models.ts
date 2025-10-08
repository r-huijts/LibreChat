import { z } from 'zod';
import type { TPreset } from './schemas';
import {
  EModelEndpoint,
  tPresetSchema,
  eModelEndpointSchema,
  AuthType,
  authTypeSchema,
} from './schemas';

export type TModelWarning = {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  acknowledgment: string;
};

export type TModelCostInfo = {
  description: string;
  acknowledgment: string;
};

export type TModelModalInfo = {
  intendedUse?: string;
  warnings?: TModelWarning[];
  costInfo?: TModelCostInfo;
  modelCardUrl?: string;
  requireAcknowledgment?: boolean;
};

export type TModelSpec = {
  name: string;
  label: string;
  preset: TPreset;
  order?: number;
  default?: boolean;
  description?: string;
  showIconInMenu?: boolean;
  showIconInHeader?: boolean;
  iconURL?: string | EModelEndpoint; // Allow using project-included icons
  authType?: AuthType;
  modalInfo?: TModelModalInfo;
};

const modelWarningSchema = z.object({
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  acknowledgment: z.string(),
});

const modelCostInfoSchema = z.object({
  description: z.string(),
  acknowledgment: z.string(),
});

const modelModalInfoSchema = z.object({
  intendedUse: z.string().optional(),
  warnings: z.array(modelWarningSchema).optional(),
  costInfo: modelCostInfoSchema.optional(),
  modelCardUrl: z.string().optional(),
  requireAcknowledgment: z.boolean().optional(),
});

export const tModelSpecSchema = z.object({
  name: z.string(),
  label: z.string(),
  preset: tPresetSchema,
  order: z.number().optional(),
  default: z.boolean().optional(),
  description: z.string().optional(),
  showIconInMenu: z.boolean().optional(),
  showIconInHeader: z.boolean().optional(),
  iconURL: z.union([z.string(), eModelEndpointSchema]).optional(),
  authType: authTypeSchema.optional(),
  modalInfo: modelModalInfoSchema.optional(),
});

export const specsConfigSchema = z.object({
  enforce: z.boolean().default(false),
  prioritize: z.boolean().default(true),
  list: z.array(tModelSpecSchema).min(1),
  addedEndpoints: z.array(z.union([z.string(), eModelEndpointSchema])).optional(),
});

export type TSpecsConfig = z.infer<typeof specsConfigSchema>;
