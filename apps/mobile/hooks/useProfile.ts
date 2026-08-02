import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  changePassword,
  deleteAvatar,
  updateDisplayName,
  uploadAvatar,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useUpdateDisplayName() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!token) throw new Error('unauthorized');
      return updateDisplayName(token, displayName);
    },
    onSuccess: async (profile) => {
      await qc.setQueryData(queryKeys.me, profile);
    },
  });
}

export function useUploadAvatar() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { uri: string; mimeType?: string | null }) => {
      if (!token) throw new Error('unauthorized');
      return uploadAvatar(token, input.uri, input.mimeType);
    },
    onSuccess: async (profile) => {
      await qc.setQueryData(queryKeys.me, profile);
      await qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useDeleteAvatar() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('unauthorized');
      return deleteAvatar(token);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useChangePassword() {
  const { token } = useSession();
  return useMutation({
    mutationFn: async (input: {
      current_password: string;
      new_password: string;
      new_password_confirm: string;
    }) => {
      if (!token) throw new Error('unauthorized');
      return changePassword(token, input);
    },
  });
}
