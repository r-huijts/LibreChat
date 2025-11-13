import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { QueryKeys, dataService, TModelConsentsResponse } from 'librechat-data-provider';

export const useGetModelConsentsQuery = (
  includeRevoked = false,
  config?: UseQueryOptions<TModelConsentsResponse>,
) => {
  return useQuery<TModelConsentsResponse>(
    [QueryKeys.modelConsents, includeRevoked],
    () => dataService.getModelConsents(includeRevoked),
    {
      ...config,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  );
};

