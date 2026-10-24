import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { type Href, router } from 'expo-router';

import { useAcceptHouseInvite } from '@/hooks/useHouseInvites';
import {
  isHouseInviteUrl,
  parseHouseInviteToken,
  peekPendingHouseInviteToken,
  setPendingHouseInviteToken,
} from '@/lib/houseInviteLink';
import { useSession } from '@/providers/SessionProvider';

function acceptErrorLabel(raw: string): string {
  switch (raw) {
    case 'invite_invalid':
      return 'Cette invitation est invalide, expirée ou déjà utilisée.';
    case 'email_mismatch':
      return 'Connecte-toi avec l’e-mail qui a reçu l’invitation.';
    default:
      return raw;
  }
}

/** Listens for portclos://house-invite?token=… and accepts once the session is ready. */
export function HouseInviteLinkProvider({ children }: { children: ReactNode }) {
  const { token, ready } = useSession();
  const accept = useAcceptHouseInvite();
  const acceptRef = useRef(accept.mutateAsync);
  acceptRef.current = accept.mutateAsync;
  const busy = useRef(false);

  const runAccept = useCallback(async (inviteToken: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const house = await acceptRef.current(inviteToken);
      await setPendingHouseInviteToken(null);
      Alert.alert('Maison rejointe', `Tu fais partie de « ${house.name} ».`, [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/maison' as Href),
        },
      ]);
    } catch (e) {
      const msg = acceptErrorLabel(e instanceof Error ? e.message : 'échec');
      Alert.alert('Invitation', msg);
    } finally {
      busy.current = false;
    }
  }, []);

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (!url || !isHouseInviteUrl(url)) return;
      const inviteToken = parseHouseInviteToken(url);
      if (!inviteToken) return;
      if (!token) {
        await setPendingHouseInviteToken(inviteToken);
        return;
      }
      await runAccept(inviteToken);
    },
    [token, runAccept],
  );

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      void handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });
    return () => sub.remove();
  }, [handleUrl]);

  useEffect(() => {
    if (!ready || !token) return;
    void (async () => {
      const pending = await peekPendingHouseInviteToken();
      if (pending) {
        await runAccept(pending);
      }
    })();
  }, [ready, token, runAccept]);

  return <>{children}</>;
}
