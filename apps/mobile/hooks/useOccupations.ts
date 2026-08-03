import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createOccupation,
  deleteOccupation,
  fetchOccupations,
  type OccupationGuest,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${month}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

export function useOccupations(houseId: string | undefined, month: string) {
  const { token } = useSession();
  const { from, to } = monthRange(month);
  return useQuery({
    queryKey: queryKeys.occupations(houseId ?? '', month),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchOccupations(token, houseId, from, to);
    },
  });
}

export function useCreateOccupation(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      start_date: string;
      end_date: string;
      note?: string;
      guests?: OccupationGuest[];
    }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createOccupation(token, houseId, input);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({
        queryKey: ['occupations', houseId],
      });
    },
  });
}

export function useDeleteOccupation(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (occupationId: string) => {
      if (!token) throw new Error('unauthorized');
      await deleteOccupation(token, occupationId);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({
        queryKey: ['occupations', houseId],
      });
    },
  });
}
