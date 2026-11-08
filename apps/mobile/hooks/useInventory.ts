import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createInventoryItem,
  deleteInventoryItem,
  fetchInventory,
  updateInventoryItem,
  type InventoryKind,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useInventory(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.inventory(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchInventory(token, houseId);
    },
  });
}

export function useCreateInventoryItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      kind: InventoryKind;
      priority?: boolean;
      note?: string;
    }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createInventoryItem(token, houseId, input);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.inventory(houseId) });
      }
    },
  });
}

export function useUpdateInventoryItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      label: string;
      kind: InventoryKind;
      priority?: boolean;
      note?: string;
    }) => {
      if (!token) throw new Error('unauthorized');
      const { itemId, ...body } = input;
      return updateInventoryItem(token, itemId, body);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.inventory(houseId) });
      }
    },
  });
}

export function useDeleteInventoryItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!token) throw new Error('unauthorized');
      await deleteInventoryItem(token, itemId);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.inventory(houseId) });
      }
    },
  });
}
