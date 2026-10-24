# Portclos — inviter dans une maison

Source de vérité. On n’implémente une tranche qu’une fois cette spec validée, et seulement cette tranche.

## Produit

Aujourd’hui, l’**invitation kde-auth** (client Portclos) permet de **créer / activer un compte** et de se connecter à l’app. Elle ne rattache **pas** à une maison déjà créée. Seul le créateur d’une maison est membre (`house_members`). Résultat typique : quelqu’un se connecte → « Aucune maison ».

Cette feature ajoute une **invitation à une maison précise** (ex. Ker Gisèle) : le titulaire (owner) invite une personne ; une fois acceptée, elle apparaît dans `house_members` et voit cette maison dans l’app.

Deux couches restent distinctes :

| Couche | Rôle |
|--------|------|
| Invite kde-auth | Compte / login app (invite_only) |
| Invite maison Portclos | Appartenance à **une** maison |

## Processus

1. Un **owner** de la maison, authentifié, ouvre Compte (ou le roster membres) → « Inviter ».
2. Il saisit un **email** (et éventuellement un message court). Le rôle invité est **`member`** (v1).
3. Portclos crée une invite maison (token one-shot, expiration) et envoie un **mail** avec un lien d’acceptation (deep link app + fallback web/HTTPS si disponible).
4. La personne ouvre le lien :
   - **déjà connectée** dans l’app avec un compte → l’app appelle l’API d’acceptation → insertion `house_members` → maison visible ;
   - **pas encore connectée** → login / acceptation invite kde-auth d’abord, puis retour sur le lien d’invite maison (token encore valide) → même acceptation.
5. Invite consommée (ou expirée / révoquée) : lien inutilisable.
6. L’owner peut **révoquer** une invite en attente ou **retirer** un membre (hors dernier owner).

Sans être owner de **cette** maison : pas d’invitation.

## Règles

- Seul un **`owner`** peut créer / révoquer des invites et retirer des membres (v1). Les `member` voient le roster en lecture seule (déjà le cas).
- Une invite cible **une** `house_id` + un email + rôle `member`.
- Email normalisé (lower/trim) ; pas d’invite en double **en attente** pour le même couple maison+email.
- Si l’email est **déjà membre** de la maison : refus explicite.
- Token d’invite : secret, hashé en base (comme kde-auth), TTL proposé **7 jours**.
- Acceptation : utilisateur authentifié (Bearer). On rattache le **`sub` JWT** courant à la maison ; on ne demande pas de « code maison » magique.
- **Correspondance email (v1)** : l’email du profil / userinfo doit matcher l’email de l’invite (évite qu’un lien fuité ajoute le mauvais compte). Si mismatch → message clair.
- kde-auth : **hors scope** de cette tranche. Si la personne n’a pas de compte Portclos, elle a toujours besoin d’une invite issuer (ou d’un compte déjà actif). Le mail d’invite maison le rappelle si besoin (« connecte-toi ou crée ton compte Portclos, puis rouvre ce lien »).
- « Ajouter une maison » dans Compte **reste** création d’une **nouvelle** maison (owner) — ce n’est pas un join. L’UI doit séparer clairement **Inviter à cette maison** vs **Créer une maison**.

## Données

Nouvelle table (noms au plan d’implémentation) du type `house_invites` :

- `id`, `house_id`, `email`, `role` (`member`), `token_hash`, `invited_by` (`user_sub`), `expires_at`, `accepted_at`, `revoked_at`, `created_at`
- Index unique partiel : une invite **pending** par `(house_id, lower(email))`

`house_members` inchangé (`owner` | `member`).

## API (Portclos)

Authentifié Bearer sauf éventuellement une preview publique minimale du token (hors v1 si inutile).

| Méthode | Chemin (proposé) | Effet |
|---------|------------------|--------|
| `POST` | `/houses/{id}/invites` | Owner : créer invite + envoyer mail (`email`) |
| `GET` | `/houses/{id}/invites` | Owner : liste des invites pending |
| `POST` | `/houses/{id}/invites/{inviteId}/revoke` | Owner : révoquer |
| `POST` | `/house-invites/accept` | Body `{ "token": "..." }` : accepter → `house_members` |
| `GET` | `/houses/{id}/members` | Inchangé (lecture) |
| `DELETE` | `/houses/{id}/members/{userSub}` | Owner : retirer un membre (pas soi-même si dernier owner) |

Deep link proposé : `portclos://house-invite?token=…` (exact au plan mobile).

## Clients (mobile)

- Depuis Compte / hub maison (maison **courante**) : CTA **Inviter** (owner only).
- Écran ou sheet : email + envoi ; liste invites pending + révoquer.
- Au cold start / callback : si deep link invite maison → accept API → sélectionner cette maison comme courante.
- Empty state « Aucune maison » : texte du type « Demande une invitation à un propriétaire » (pas seulement « crée une maison »).

## Hors scope (cette version)

- Inviter en tant qu’`owner` / transfert de propriété.
- Invites par lien sans email.
- Members qui invitent.
- Auto-création d’invite kde-auth depuis Portclos.
- UI admin kde-auth pour les maisons.
- Groupes / familles multi-maisons en un clic.

## Critères d’acceptation

- Owner de Ker Gisèle invite `soeur@…` → mail reçu avec lien.
- Compte déjà actif, email matching → accept → Ker Gisèle dans `GET /houses` ; plus « Aucune maison ».
- Token rejoué / expiré / révoqué → refus.
- Non-owner ne peut pas créer d’invite.
- Membre déjà présent → refus à la création d’invite.
- Email JWT ≠ email invite → refus à l’acceptation.
- Créer une maison via Compte ne remplace pas ce flux et ne joint pas Ker Gisèle.
