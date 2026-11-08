import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createChantier,
  deleteChantier,
  fetchChantiers,
  updateChantier,
  type ChantierStatus,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useChantiers(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.chantiers(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchChantiers(token, houseId);
    },
  });
}

export function useCreateChantier(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      status?: ChantierStatus;
    }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createChantier(token, houseId, input);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.chantiers(houseId) });
      }
    },
  });
}

export function useUpdateChantier(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      chantierId: string;
      title: string;
      description?: string;
      status: ChantierStatus;
    }) => {
      if (!token) throw new Error('unauthorized');
      const { chantierId, ...body } = input;
      return updateChantier(token, chantierId, body);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.chantiers(houseId) });
      }
    },
  });
}

export function useDeleteChantier(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chantierId: string) => {
      if (!token) throw new Error('unauthorized');
      await deleteChantier(token, chantierId);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.chantiers(houseId) });
      }
    },
  });
}
