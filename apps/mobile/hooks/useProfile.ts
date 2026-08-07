import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  changePassword,
  deleteAvatar,
  updateDisplayName,
  uploadAvatar,
} from '@/lib/api';
import { normalizeDisplayName } from '@/lib/displayName';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useUpdateDisplayName() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!token) throw new Error('unauthorized');
      const name = normalizeDisplayName(displayName);
      if (!name) throw new Error('display_name_required');
      return updateDisplayName(token, name);
    },
    onSuccess: async (profile) => {
      await qc.setQueryData(queryKeys.me, profile);
      await qc.invalidateQueries({ queryKey: ['houseMembers'] });
      await qc.invalidateQueries({ queryKey: ['blogPosts'] });
      await qc.invalidateQueries({ queryKey: ['blogPost'] });
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
