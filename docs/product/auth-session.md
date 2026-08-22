# Session durable (refresh token)

## Connexion Android (« Found »)

Chrome Custom Tabs **ne suit pas** un HTTP 302 vers `portclos://auth/callback`. Go rend alors le corps par défaut du 302 : un tout petit lien dont le texte est **Found**. iOS (ASWebAuthenticationSession) n’a pas ce problème.

Côté app Portclos (ce repo) :

- Route `auth/callback` + PKCE persisté, pour terminer le login quand l’utilisatrice touche le lien.
- `createTask: false` pour que l’intent revienne sur la même Activity.
- Intent filter Android `portclos://auth/callback`.

Côté issuer kde-auth (à déployer, sinon la page reste « Found ») :

- Issue tracker : à ouvrir sur kde-auth (« HTML return page for custom-scheme OAuth redirects »)
- Patch : [`patches/0002-Html-return-page-for-native-oauth-redirects.patch`](patches/0002-Html-return-page-for-native-oauth-redirects.patch)

```bash
cd /path/to/kde-auth
git checkout -b feat/native-oauth-return-page
git am /path/to/portclos/docs/product/patches/0002-Html-return-page-for-native-oauth-redirects.patch
git push -u origin HEAD
gh pr create --base main --title "HTML return page for native OAuth redirects (Android Found)"
```

Sans ce patch, demander à l’utilisatrice **d’appuyer sur le mot « Found »** après login.

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
