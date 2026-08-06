# Session durable (refresh token)

## Face ID / biométrie

- **Face ID** = nom Apple (iOS uniquement).
- Sur **Android** : empreinte / déverrouillage facial via **BiometricPrompt**.
- Une seule API Expo pour les deux : `expo-local-authentication` (pas encore branché dans Portclos).

## Refresh token (implémenté côté app)

1. Login demande le scope `offline_access` (`AUTH_SCOPES` dans `lib/auth.ts`).
2. `access_token` + `refresh_token` dans SecureStore.
3. Au boot / retour foreground / 401 API : refresh silencieux ; login navigateur seulement si refresh échoue.

## Config issuer (obligatoire)

Sur le client OIDC `portclos` (public + PKCE) :

- Autoriser le scope **`offline_access`** (ou équivalent « refresh tokens »)
- TTL refresh long (ex. 30–90 jours) ; access court (ex. 15–60 min)
- Rotation du refresh token recommandée

Sans ça, l’app ne reçoit pas de `refresh_token` et retombe sur une reconnexion à l’expiration de l’access token.
