import { queryOptions } from '@tanstack/react-query';
import { meResponseSchema, publicConfigSchema } from '@freenem/shared';
import { api, ApiError } from './api';

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => api('/api/v1/config', { schema: publicConfigSchema }),
  staleTime: 5 * 60_000,
});

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    try {
      return await api('/api/v1/me', { schema: meResponseSchema });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  staleTime: 60_000,
});
