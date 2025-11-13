import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QueryKeys,
  dataService,
  TAcceptModelConsent,
  TModelConsentResponse,
} from 'librechat-data-provider';

export const useAcceptModelConsentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TAcceptModelConsent) => dataService.acceptModelConsent(payload),
    onSuccess: (data: TModelConsentResponse) => {
      // Invalidate the consents list to refetch
      queryClient.invalidateQueries([QueryKeys.modelConsents]);
      // Also invalidate the user query to update embedded consents
      queryClient.invalidateQueries([QueryKeys.user]);
    },
  });
};

export const useRevokeModelConsentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelName: string) => dataService.revokeModelConsent(modelName),
    onSuccess: () => {
      // Invalidate the consents list to refetch
      queryClient.invalidateQueries([QueryKeys.modelConsents]);
      // Also invalidate the user query to update embedded consents
      queryClient.invalidateQueries([QueryKeys.user]);
    },
  });
};

