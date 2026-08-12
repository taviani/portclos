import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { postClientEvent, type ClientEventKind } from '@/lib/api/events';
import { setApiErrorReporter } from '@/lib/api/http';
import { ensureFreshAccessToken } from '@/lib/auth';

let wired = false;

/** Call once from TelemetryProvider — wires API error reporting without cycles. */
export function wireApiErrorReporting(): void {
  if (wired) return;
  wired = true;
  setApiErrorReporter(reportApiError);
}

type ReportInput = {
  kind: ClientEventKind;
  name: string;
  message?: string;
  meta?: Record<string, unknown>;
};

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 15_000;

function appVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'unknown'
  );
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  const prev = recentKeys.get(key) ?? 0;
  if (now - prev < DEDUPE_MS) {
    return false;
  }
  recentKeys.set(key, now);
  // Bound map size for long sessions.
  if (recentKeys.size > 200) {
    for (const [k, at] of recentKeys) {
      if (now - at > DEDUPE_MS) recentKeys.delete(k);
    }
  }
  return true;
}

/** Fire-and-forget client signal. Never throws; never blocks UI. */
export function reportClientEvent(input: ReportInput): void {
  const name = input.name.trim().slice(0, 120);
  if (!name) return;
  const message = (input.message ?? '').trim().slice(0, 2000);
  const key = `${input.kind}:${name}:${message.slice(0, 80)}`;
  if (!shouldSend(key)) return;

  void (async () => {
    try {
      const token = await ensureFreshAccessToken();
      if (!token) return;
      await postClientEvent(token, {
        kind: input.kind,
        name,
        message,
        meta: input.meta,
        app_version: appVersion(),
        platform: Platform.OS,
      });
    } catch {
      // Never surface telemetry failures to the user.
    }
  })();
}

export function reportApiError(opts: {
  path: string;
  status?: number;
  code: string;
  requestId?: string;
}): void {
  if (opts.code === 'unauthorized') return;
  reportClientEvent({
    kind: 'error',
    name: 'api',
    message: opts.code,
    meta: {
      path: opts.path,
      status: opts.status ?? 0,
      request_id: opts.requestId ?? '',
    },
  });
}

export function reportScreen(pathname: string): void {
  const name = pathname.trim() || '/';
  reportClientEvent({ kind: 'screen', name });
}
