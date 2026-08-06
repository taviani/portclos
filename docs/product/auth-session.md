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

Le service auth émet déjà des `refresh_token` et gère `grant_type=refresh_token`, mais **rejette** le scope `offline_access` → le login Portclos échoue tant que ce n’est pas mergé.

- Issue tracker : https://github.com/taviani/kde-auth/issues/22  
- Patch à appliquer : [`patches/0001-Accept-offline_access-scope-for-native-refresh-sessi.patch`](patches/0001-Accept-offline_access-scope-for-native-refresh-sessi.patch)

```bash
cd /path/to/kde-auth
git checkout -b feat/offline-access-scope
git am /path/to/portclos/docs/product/patches/0001-Accept-offline_access-scope-for-native-refresh-sessi.patch
git push -u origin HEAD
gh pr create --base main --title "Accept offline_access scope for native refresh sessions"
```

### Client OAuth `portclos` (admin auth)

- `token_endpoint_auth_method=none` (public + PKCE)
- Redirect : `portclos://auth/callback`
- Mode invite_only si besoin
- Après deploy auth + merge Portclos : **une** connexion TestFlight pour stocker le refresh
