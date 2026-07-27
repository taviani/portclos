# Portclos

Shared house app: occupation calendar, open/close checklists, todos, posts & photos.

## Layout

```
apps/mobile/       Expo (React Native) — primary client
services/api/      Go API — house domain + JWT auth against the shared OIDC issuer
docker-compose.yml Postgres + API
```

## Prerequisites

- Node 22+
- Go 1.25+
- Docker + `docker-compose` (hyphen)

## Local API

```bash
cp .env.example .env
docker-compose up -d --build
curl -fsS http://localhost:8080/health
```

Or run the API on the host:

```bash
cd services/api
cp .env.example .env   # AUTH_DISABLED=true for local without JWKS
go run ./cmd/server
```

- `GET /health` — public
- `GET /me` — requires `Authorization: Bearer <access_token>` (unless `AUTH_DISABLED=true`)

## Local mobile

```bash
cd apps/mobile
cp .env.example .env   # EXPO_PUBLIC_API_URL=http://localhost:8080
npm start
```

## Deploy — API (GitHub Actions → VPS)

On each push to `main`, CI runs checks + smoke, then deploys via SSH/`rsync` + `docker-compose up -d --build`.

### GitHub secrets (repo Settings → Secrets)

| Secret | Purpose |
|--------|---------|
| `DEPLOY_SSH_KEY` | Private SSH key for the deploy user |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_HOST` | Server hostname |
| `DEPLOY_PATH` | Absolute deploy directory on the server |

Never put hostnames, paths, or passwords in the repository.

### Server one-time setup (on the VPS only)

1. Create `DEPLOY_PATH` (owned by the deploy user).
2. Copy `.env.example` → `DEPLOY_PATH/.env` and set **production** values:
   - `AUTH_ISSUER` — your OIDC issuer URL
   - `AUTH_DISABLED=false` (or omit)
   - Strong `POSTGRES_*` credentials
3. Do **not** commit or rsync that `.env` (CI excludes it).
4. Ensure `docker-compose` is available to the deploy user.
5. TLS / reverse proxy for the API stays in your host nginx config (not in this repo).

## Deploy — mobile (EAS → TestFlight + Play Internal)

Workflow: [`.github/workflows/mobile.yml`](.github/workflows/mobile.yml) on changes under `apps/mobile/` (or manual dispatch).

### One-time Expo / store setup

1. `cd apps/mobile && npx eas-cli@latest login && npx eas-cli@latest init`  
   Replace `owner` and `extra.eas.projectId` in `app.json` with the values EAS writes.
2. Create the app in App Store Connect and Google Play Console (`com.portclos.app`).
3. Configure credentials once (stored by Expo, not in git):

   ```bash
   cd apps/mobile
   npx eas-cli@latest credentials
   ```

4. Link Play service account for **internal** testing; ensure ASC app exists for TestFlight.

### GitHub secrets (mobile)

| Secret | Purpose |
|--------|---------|
| `EXPO_TOKEN` | Expo access token ([expo.dev](https://expo.dev) → Access tokens) |
| `EXPO_PUBLIC_API_URL` | Public HTTPS API base URL baked into the binary |
| `EXPO_ASC_APP_ID` | (Optional) App Store Connect numeric app id for submit |

Apple/Google signing credentials should live in **EAS credentials**, not in git.

## Safety

- Never commit `.env`, private keys, PEM files, or service-account JSON.
- CI `rsync` excludes `.env`, `.env.*`, and `secrets/`.
- Postgres is published on `127.0.0.1` only in compose.
- Docs and examples use placeholders (`auth.example.com`, etc.).
