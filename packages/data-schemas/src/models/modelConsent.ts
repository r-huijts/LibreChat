import modelConsentSchema from '~/schema/modelConsent';
import type { IModelConsent } from '~/types';

/**
 * Creates or returns the ModelConsent model using the provided mongoose instance and schema
 */
export function createModelConsentModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.ModelConsent ||
    mongoose.model<IModelConsent>('ModelConsent', modelConsentSchema)
  );
}

