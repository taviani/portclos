# Nom d’affichage (identité dans la maison)

## Décision

- Chaque membre a un **nom d’affichage** obligatoire (prénom ou surnom).
- C’est l’étiquette humaine dans le blog, les mentions, les listes membres, etc.
- L’**email** reste l’identifiant de compte (connexion, invites, écran Compte) — pas le libellé social.

## Comportement app

1. Après login / cold start, si `display_name` est vide → atterrissage direct sur
   « Comment t’appellent les autres ? » (`app/display-name.tsx`) — **pas** de flash Maison.
   Entrée unique via `appEntryHref` / `resetToAppEntry` ; gate de secours dans `_layout.tsx`.
2. Splash attend le profil (`/me`) quand une session existe, pour éviter le rebond.
3. Suggestion préremplie depuis la partie locale de l’email (éditable, `selectTextOnFocus`).
4. Compte : impossible d’enregistrer un nom vide ; nudge si encore vide.
5. Fallback UI (`memberLabel`) : nom → email → « Membre » (edge cases / données legacy).
6. API `PATCH /me` : refuse un nom vide (`display_name_required`) ou > 80 caractères.

## Hors scope

- Username / handle côté issuer auth (volontairement non — identité sociale = Portclos).
- Unicité du nom dans la maison.
- Changement de nom soumis à approbation.
