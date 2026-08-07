# Nom d’affichage (identité dans la maison)

## Décision

- Chaque membre a un **nom d’affichage** obligatoire (prénom ou surnom).
- C’est l’étiquette humaine dans le blog, les mentions, les listes membres, etc.
- L’**email** reste l’identifiant de compte (connexion, invites, écran Compte) — pas le libellé social.

## Comportement app

1. Après login, si `display_name` est vide → écran non skippable  
   « Comment t’appellent les autres ? » (`app/display-name.tsx`), gate dans `app/_layout.tsx`.
2. Compte : impossible d’enregistrer un nom vide ; nudge si encore vide.
3. Fallback UI (`memberLabel`) : nom → email → « Membre » (edge cases / données legacy).
4. API `PATCH /me` : refuse un nom vide (`display_name_required`) ou > 80 caractères.

## Hors scope

- Unicité du nom dans la maison.
- Changement de nom soumis à approbation.
