# Portclos

Shared house app: occupation calendar, open/close checklists, todos, posts & photos.

## Layout

```
apps/mobile/       Expo (React Native) — primary client
services/api/      Go API — house domain + JWT auth against the shared OIDC issuer
docker-compose.yml Postgres + API for local/dev
```

## Prerequisites

- Node 22+
- Go 1.25+
- Docker + `docker-compose` (hyphen)

## API

```bash
cd services/api
cp .env.example .env   # set AUTH_ISSUER, or AUTH_DISABLED=true locally
go run ./cmd/server
```

- `GET /health` — public
- `GET /me` — requires `Authorization: Bearer <access_token>` (OIDC access token from the auth server)

## Mobile

```bash
cd apps/mobile
npm start
```

## Compose

```bash
AUTH_DISABLED=true docker-compose up --build
```

Issuer URL and secrets live in env / server config only — never commit production values.
