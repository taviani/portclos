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
- `GET|POST /houses` — multi-house membership (JWT `sub`)
- `GET /houses/{id}` — member-only
- `GET|POST /houses/{id}/occupations` — occupation ranges (`from`/`to` or body `start_date`/`end_date`)
- `DELETE /occupations/{id}` — delete own occupation

## Local mobile

```bash
cd apps/mobile
cp .env.example .env
# Set EXPO_PUBLIC_AUTH_ISSUER to your OIDC issuer (local .env only — never commit real hosts)
# Create OIDC client `portclos` as public+PKCE+invite_only on the auth server
npm install
npm start
```

Auth: Expo AuthSession + PKCE against the shared issuer. Current house id is stored on-device (SecureStore).

Client data: **TanStack Query** (`QueryClientProvider` + `queryKeys`) for server state; session token via `SessionProvider`. Creating / selecting a house invalidates `houses` / `currentHouseId` so the Accueil tab updates without remounting. Future calendar keys: `occupations(houseId, month)`.

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

Workflow: [`.github/workflows/mobile.yml`](.github/workflows/mobile.yml) — **manual only** (`Actions → Mobile → Run workflow`). No EAS build on push to `main` (saves free-plan quota; prefer local simulator: `cd apps/mobile && npx expo start --ios`).

Optional: set **submit = true** to auto-submit iOS to TestFlight after the build. Android/Play stays paused until a physical device + Play service account.

### One-time Expo / store setup

1. Locally: `cd apps/mobile && npx eas-cli@latest login && npx eas-cli@latest init` — **do not commit** `owner` / `projectId` if the CLI writes them into `app.json`.
2. Create the app in App Store Connect and Google Play Console (bundle / package id from `app.json`).
3. Configure signing credentials in EAS only (not in git):

   ```bash
   cd apps/mobile
   npx eas-cli@latest credentials
   ```

4. **Android store submit (optional later)** — link a Google Play service account JSON via EAS (interactive; cannot be done by CI alone):

   ```bash
   npx eas-cli@latest credentials -p android
   ```

5. GitHub secret `EXPO_ASC_APP_ID` for iOS TestFlight submit when using `submit=true`.

### GitHub secrets (mobile)

| Secret | Purpose |
|--------|---------|
| `EXPO_TOKEN` | Expo access token |
| `EXPO_PUBLIC_API_URL` | Public HTTPS API base URL baked into the binary |
| `EXPO_PUBLIC_AUTH_ISSUER` | OIDC issuer URL baked into the binary |
| `EXPO_PUBLIC_AUTH_CLIENT_ID` | (Optional) OIDC client id; defaults to `portclos` |
| `EXPO_PROJECT_ID` | EAS project id (injected into `app.json` at build time) |
| `EXPO_OWNER` | (Optional) Expo account / org slug for EAS |
| `EXPO_ASC_APP_ID` | (Optional) App Store Connect numeric app id for submit |

Apple/Google signing credentials and account identifiers live in **EAS / GitHub Secrets**, never in git.

## Safety

- Never commit `.env`, private keys, PEM files, or service-account JSON.
- Never commit real domain names, EAS `owner` / `projectId`, Apple Team / ASC ids, or Play account ids.
- CI `rsync` excludes `.env`, `.env.*`, and `secrets/`.
- Postgres is published on `127.0.0.1` only in compose.
- Docs and examples use placeholders (`auth.example.com`, etc.).
