import Constants from 'expo-constants';

export type ClientEventKind = 'error' | 'screen' | 'action';

export type ClientEventInput = {
  kind: ClientEventKind;
  name: string;
  message?: string;
  meta?: Record<string, unknown>;
  app_version?: string;
  platform?: string;
};

export type ClientEventCreated = {
  id: string;
  created_at: string;
};

type Extra = {
  apiUrl?: string;
};

function eventsBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.apiUrl ?? 'http://localhost:8080').replace(/\/$/, '');
}

/**
 * Posts a client event with raw fetch.
 * Intentionally does not use getJSON to avoid import cycles and error feedback loops.
 */
export async function postClientEvent(
  accessToken: string,
  event: ClientEventInput,
): Promise<ClientEventCreated> {
  const res = await fetch(`${eventsBaseUrl()}/client-events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: event.kind,
      name: event.name,
      message: event.message ?? '',
      meta: event.meta ?? {},
      app_version: event.app_version ?? '',
      platform: event.platform ?? '',
    }),
  });
  if (!res.ok) {
    throw new Error(`client_event_http_${res.status}`);
  }
  return res.json() as Promise<ClientEventCreated>;
}
