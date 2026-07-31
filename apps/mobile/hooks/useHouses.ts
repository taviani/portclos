import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHouse, fetchHouses, fetchMe, type House } from '@/lib/api';
import { getCurrentHouseId, setCurrentHouseId } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useMe() {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.me,
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error('unauthorized');
      return fetchMe(token);
    },
  });
}

export function useHouses() {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.houses,
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error('unauthorized');
      return fetchHouses(token);
    },
  });
}

export function useCurrentHouseId() {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.currentHouseId,
    enabled: !!token,
    queryFn: getCurrentHouseId,
  });
}

export function useCurrentHouse(): {
  house: House | null;
  isLoading: boolean;
  error: Error | null;
} {
  const houses = useHouses();
  const currentId = useCurrentHouseId();
  const isLoading = houses.isLoading || currentId.isLoading;
  const list = houses.data ?? [];
  const id = currentId.data;
  const house =
    list.find((h) => h.id === id) ?? (list.length > 0 ? list[0] : null);
  const error =
    (houses.error instanceof Error ? houses.error : null) ||
    (currentId.error instanceof Error ? currentId.error : null);
  return { house, isLoading, error };
}

export function useCreateHouse() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!token) throw new Error('unauthorized');
      return createHouse(token, name);
    },
    onSuccess: async (house) => {
      await setCurrentHouseId(house.id);
      await qc.invalidateQueries({ queryKey: queryKeys.houses });
      await qc.invalidateQueries({ queryKey: queryKeys.currentHouseId });
    },
  });
}

export function useSelectHouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await setCurrentHouseId(id);
      return id;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.currentHouseId });
      // Future domain caches keyed by houseId can be left warm or cleared selectively.
    },
  });
}
