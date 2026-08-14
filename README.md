# Portclos

Shared house app: occupation calendar, open/close checklists, todos, posts & photos.

## Layout

```
apps/mobile/                 Expo client
  app/                       routes (screens stay thin)
  components/                UI (brand/, blog/, …)
  hooks/                     TanStack Query by domain
  lib/api/                   HTTP clients split by domain (houses, blog, …)
  theme/                     brand tokens (lighthouse.ts) → Paper (paper.tsx)
services/api/internal/
  httpserver/                HTTP adapters only
  store/                     SQL + domain rules (blog tags, membership, …)
  media/                     file storage
docker-compose.yml
```

Visual / brand changes: edit `apps/mobile/theme/lighthouse.ts` first, then Paper mappings. Avoid one-off hex in screens.

## Prerequisites

- Node 22+
- Go 1.25+
- Docker + `docker-compose` (hyphen)

## Local API

```bash
cp .env.example .env
docker-compose up -d --build          # api + db
# optional: docker-compose --profile metabase up -d
curl -fsS http://localhost:8080/health
```

Or run the API on the host:

```bash
cd services/api
cp .env.example .env   # AUTH_DISABLED=true for local without JWKS
go run ./cmd/server
```

- `GET /health` — public
- `POST /client-events` — mobile error/usage signals (`kind`: error|screen|action); requires Bearer JWT
- `GET|PATCH /me` — profile (`display_name`); requires Bearer JWT (unless `AUTH_DISABLED=true`)
- `POST|DELETE /me/avatar` · `GET /avatars/{userSub}` — avatar image
- `GET|POST /houses` — multi-house membership (JWT `sub`)
- `GET /houses/{id}` — member-only
- `PATCH /houses/{id}` — owner: `{ "single_beds"?, "double_beds"?, "address"? }` (`bed_capacity` legacy → lits simples)
- `GET /houses/{id}/search?q=` — recherche maison (Postgres FTS français + trigram)
- `GET /houses/{id}/occupations` — `{ occupations, single_beds, double_beds, bed_capacity, day_loads }` (`from`/`to`)
- `POST /houses/{id}/occupations` — `{ start_date, end_date, note?, guests? }` → `{ occupation, capacity_warning? }`
  - guests: `{ first_name, relation?, room?: alone|shared, share_with?: host|guest:<i> }` (lit double avec hôte ou autre invité ; soft warn si pics > chambres/places)
- `PATCH /occupations/{id}` — update own occupation (`start_date`, `end_date`, `note` ; `guests` optional replace)
- `DELETE /occupations/{id}` — delete own occupation
- `GET /houses/{id}/members` — house roster (display names)
- `GET|POST /houses/{id}/posts` · `GET|DELETE /posts/{id}` — house blog (`tags`, `mentions` on create)
- `POST /posts/{id}/photos` · `GET /blog-photos/{id}` · `POST /posts/{id}/comments` · `PUT|DELETE /posts/{id}/reactions`
- `GET|POST /houses/{id}/help` · `GET|PATCH|DELETE /help/{id}` · `POST /help/{id}/photos` · `GET|DELETE /help-photos/{id}` · `POST /help/{id}/documents` · `GET|DELETE /help-documents/{id}`
- `GET|POST /houses/{id}/closing-checklist/items` — template (`label`, `description?`, `optional`) + hint photos
- `PATCH|DELETE /closing-checklist/items/{itemId}` — update `label` / `description` / `optional`
- `POST /closing-checklist/items/{itemId}/photos` — indication photo (multipart `photo`) · `GET|DELETE /closing-photos/{id}`
- `GET|POST /houses/{id}/closings` — list / start a closing run (one open per house)
- `GET /closings/{id}` · `PATCH /closings/{id}/items/{itemId}` · `POST /closings/{id}/complete`

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

Observability (self-hosted): JSON `slog` access logs + Postgres `usage_events` / `client_events`, explored via **Metabase** (compose profile `metabase`, SSH tunnel). See [docs/product/logging.md](docs/product/logging.md).

## Deploy — API (GitHub Actions → VPS)

On each push to `main`, CI runs API checks + smoke (in parallel), then deploys via SSH/`rsync` + `docker-compose --profile metabase up -d --build`. Mobile-only PRs skip API jobs.

Photo uploads land in the `portclos_uploads` Docker volume (`UPLOAD_DIR=/data/uploads`). The API entrypoint chowns that dir to `nobody` on start so multipart saves succeed.

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

Optional: set **submit = true** to auto-submit iOS to TestFlight after the build. Android internal track uses `releaseStatus: completed` in `eas.json` so submits are rolled out to testers (not left as Play Console drafts).

### One-time Expo / store setup

1. Locally, one-time link (then stop using `eas init`):

   ```bash
   cd apps/mobile
   cp .env.example .env   # if needed
   npx eas-cli@latest login
   npx eas-cli@latest init   # prints owner + project id; may dirty app.json
   ```

   Put `EXPO_OWNER` and `EXPO_PROJECT_ID` in gitignored `apps/mobile/.env` (see `.env.example`). **Discard** any `app.json` changes — `app.config.js` reads those env vars so you never commit them. Do not re-run `eas init`.
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
| `EXPO_PROJECT_ID` | EAS project id (`app.config.js` / CI env — not in git) |
| `EXPO_OWNER` | (Optional) Expo account / org slug for EAS |
| `EXPO_ASC_APP_ID` | (Optional) App Store Connect numeric app id for submit |

Apple/Google signing credentials and account identifiers live in **EAS / GitHub Secrets**, never in git.

## Safety

- Never commit `.env`, private keys, PEM files, or service-account JSON.
- Never commit real domain names, EAS `owner` / `projectId`, Apple Team / ASC ids, or Play account ids.
- CI `rsync` excludes `.env`, `.env.*`, and `secrets/`.
- Postgres is published on `127.0.0.1` only in compose.
- Docs and examples use placeholders (`auth.example.com`, etc.).
