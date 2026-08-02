import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeClosing,
  createChecklistItem,
  deleteChecklistItem,
  deleteChecklistPhoto,
  fetchChecklistItems,
  fetchClosing,
  fetchClosings,
  startClosing,
  updateChecklistItem,
  updateClosingItemStatus,
  uploadChecklistPhoto,
  type ClosingItem,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useChecklistItems(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.checklistItems(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchChecklistItems(token, houseId);
    },
  });
}

export function useClosings(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.closings(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchClosings(token, houseId);
    },
  });
}

export function useClosing(closingId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.closing(closingId ?? ''),
    enabled: !!token && !!closingId,
    queryFn: async () => {
      if (!token || !closingId) throw new Error('unauthorized');
      return fetchClosing(token, closingId);
    },
  });
}

export function useStartClosing(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return startClosing(token, houseId);
    },
    onSuccess: async (detail) => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.closings(houseId) });
      await qc.setQueryData(queryKeys.closing(detail.id), detail);
    },
  });
}

export function useUpdateClosingItem(closingId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; status: ClosingItem['status'] }) => {
      if (!token || !closingId) throw new Error('unauthorized');
      return updateClosingItemStatus(token, closingId, input.itemId, input.status);
    },
    onSuccess: async () => {
      if (!closingId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.closing(closingId) });
    },
  });
}

export function useCompleteClosing(closingId: string | undefined, houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!token || !closingId) throw new Error('unauthorized');
      return completeClosing(token, closingId);
    },
    onSuccess: async (detail) => {
      await qc.setQueryData(queryKeys.closing(detail.id), detail);
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.closings(houseId) });
      }
    },
  });
}

export function useCreateChecklistItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; optional?: boolean }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createChecklistItem(token, houseId, input);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.checklistItems(houseId) });
    },
  });
}

export function useUpdateChecklistItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; label: string; optional: boolean }) => {
      if (!token) throw new Error('unauthorized');
      return updateChecklistItem(token, input.itemId, {
        label: input.label,
        optional: input.optional,
      });
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.checklistItems(houseId) });
    },
  });
}

export function useDeleteChecklistItem(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!token) throw new Error('unauthorized');
      await deleteChecklistItem(token, itemId);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.checklistItems(houseId) });
    },
  });
}

export function useUploadChecklistPhoto(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; uri: string; mimeType?: string | null }) => {
      if (!token) throw new Error('unauthorized');
      return uploadChecklistPhoto(token, input.itemId, input.uri, input.mimeType);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.checklistItems(houseId) });
    },
  });
}

export function useDeleteChecklistPhoto(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      if (!token) throw new Error('unauthorized');
      await deleteChecklistPhoto(token, photoId);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.checklistItems(houseId) });
    },
  });
}
