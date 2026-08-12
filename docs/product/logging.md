# Logging & usage (Portclos)

Self-hosted observability: structured API logs + Postgres event tables. No SaaS analytics.

## Goals

1. **Errors** — correlate a client failure with a server `request_id` and the underlying cause in Docker logs.
2. **Usage** — see which routes and screens are used (per `user_sub`, optional `house_id`).

## API

### Structured logs (`slog` JSON → stdout)

Each request emits `http_request` with: `request_id`, `method`, `path`, `route`, `status`, `duration_ms`, `user_sub` (when authed), `house_id` (when present in path).

5xx handlers also emit `api_error` with the real Go error (never returned to the client).

JSON error bodies:

```json
{ "error": "internal", "request_id": "…" }
```

`LOG_LEVEL` env: `debug` | `info` (default) | `warn` | `error`. `/health` access lines are `debug`.

### `usage_events` (Postgres)

Filled by middleware for every authenticated/public API call except `/health`.

Useful queries:

```sql
-- Recent 5xx
SELECT created_at, status, method, path, user_sub, request_id, duration_ms
FROM usage_events
WHERE status >= 500
ORDER BY created_at DESC
LIMIT 50;

-- Top routes (7 days)
SELECT route, count(*) AS n, avg(duration_ms)::int AS avg_ms
FROM usage_events
WHERE created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY n DESC
LIMIT 30;
```

### `POST /client-events` (authed)

Mobile reports:

| `kind`   | Meaning                          |
|----------|----------------------------------|
| `error`  | API failure, ErrorBoundary, etc. |
| `screen` | Route / pathname view            |
| `action` | Optional product action (future) |

Body: `{ kind, name, message?, meta?, app_version?, platform? }`.

Stored in `client_events`. No tokens/PII beyond `user_sub` and short messages.

## Mobile

- `lib/telemetry.ts` — fire-and-forget reporter (deduped).
- `TelemetryProvider` — screen views when session is ready.
- `lib/api/http.ts` — reports failed API calls with `request_id` when present.
- Root `ErrorBoundary` — reports fatal render errors, shows retry.

## Ops

### Explore events — Metabase

Compose includes **Metabase** (localhost only) to browse `usage_events` / `client_events` and build simple dashboards.

```bash
docker-compose up -d metabase
# On the VPS, from your laptop:
ssh -L 3000:127.0.0.1:3000 deploy@YOUR_VPS
# then open http://127.0.0.1:3000
```

First-run wizard: create an admin user, then add a database:

| Field | Value |
|-------|--------|
| Database type | PostgreSQL |
| Host | `db` |
| Port | `5432` |
| Database name | same as `POSTGRES_DB` (default `portclos`) |
| Username / password | `POSTGRES_USER` / `POSTGRES_PASSWORD` |

Useful saved questions: recent 5xx from `usage_events`, screens by day from `client_events` (`kind = 'screen'`), errors with `meta → request_id`.

Metabase is **not** exposed on the public internet (bound to `127.0.0.1`). No alerting built-in — optional later.

### Raw logs

On the VPS: `docker-compose logs -f api` for JSON lines. Keep Postgres backups as today; prune old events if the table grows:

```sql
DELETE FROM usage_events WHERE created_at < now() - interval '90 days';
DELETE FROM client_events WHERE created_at < now() - interval '90 days';
```

## Out of scope (for now)

Sentry / PostHog / OpenTelemetry collectors, Slack/PagerDuty alerts. Revisit only if native crash symbolication, cross-service tracing, or on-call alerting becomes necessary.
