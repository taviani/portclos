import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptHouseInvite,
  createHouseInvite,
  fetchHouseInvites,
  removeHouseMember,
  revokeHouseInvite,
} from '@/lib/api';
import { setCurrentHouseId } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useHouseInvites(houseId: string | undefined, enabled = true) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.houseInvites(houseId ?? ''),
    enabled: !!token && !!houseId && enabled,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchHouseInvites(token, houseId);
    },
  });
}

export function useCreateHouseInvite(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createHouseInvite(token, houseId, email);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.houseInvites(houseId) });
    },
  });
}

export function useRevokeHouseInvite(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      if (!token || !houseId) throw new Error('unauthorized');
      await revokeHouseInvite(token, houseId, inviteId);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.houseInvites(houseId) });
    },
  });
}

export function useAcceptHouseInvite() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteToken: string) => {
      if (!token) throw new Error('unauthorized');
      return acceptHouseInvite(token, inviteToken);
    },
    onSuccess: async (house) => {
      await setCurrentHouseId(house.id);
      await qc.invalidateQueries({ queryKey: queryKeys.houses });
      await qc.invalidateQueries({ queryKey: queryKeys.currentHouseId });
      await qc.invalidateQueries({ queryKey: queryKeys.houseMembers(house.id) });
    },
  });
}

export function useRemoveHouseMember(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userSub: string) => {
      if (!token || !houseId) throw new Error('unauthorized');
      await removeHouseMember(token, houseId, userSub);
    },
    onSuccess: async () => {
      if (!houseId) return;
      await qc.invalidateQueries({ queryKey: queryKeys.houseMembers(houseId) });
      await qc.invalidateQueries({ queryKey: queryKeys.houses });
    },
  });
}
