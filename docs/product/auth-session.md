# Session durable (refresh token)

## Face ID / biométrie

- **Face ID** = nom Apple (iOS uniquement).
- Sur **Android** : empreinte / déverrouillage facial via **BiometricPrompt**.
- Une seule API Expo pour les deux : `expo-local-authentication` (pas encore branché dans Portclos).

## Refresh token (implémenté côté app Portclos)

1. Login demande le scope `offline_access` (`AUTH_SCOPES` dans `lib/auth.ts`).
2. `access_token` + `refresh_token` dans SecureStore.
3. Au boot / retour foreground / 401 API : refresh silencieux ; login navigateur seulement si refresh échoue.

## Companion: kde-auth (issuer)

`offline_access` is already on kde-auth `main`. Remaining issuer hardening (ticketed `/register`, login rate-limit, `/admin` 404, user delete, `GET /` 404) lives in:

[`patches/0002-harden-issuer-ticketed-registration.patch`](patches/0002-harden-issuer-ticketed-registration.patch)

```bash
cd /path/to/kde-auth
git checkout -b feat/issuer-fortress
git am /path/to/portclos/docs/product/patches/0002-harden-issuer-ticketed-registration.patch
git push -u origin HEAD
```

After deploy: Turnstile keys are required in production. Invite-only Portclos is unchanged. Leftover accounts with no app can be suspended or deleted in `/admin/users` (log in first, then open `/admin`).

### Client OAuth `portclos` (admin auth)

- `token_endpoint_auth_method=none` (public + PKCE)
- Redirect : `portclos://auth/callback`
- Mode invite_only
- After deploy auth + merge Portclos : **one** TestFlight login to store the refresh token
