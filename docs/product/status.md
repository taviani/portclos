# État produit Portclos

Dernière mise à jour : 2026-08-04 (discussion agent cloud « État du build »).

## Surface actuelle

- Auth OIDC, multi-maisons, compte
- Présences (calendrier, invités, capacité lits)
- Checklist de fermeture (+ modèle éditable)
- Blog (photos, tags, mentions)
- Aide (fiches + photos)
- Recherche globale

## Distribution mobile

- CI Mobile : **iOS only** (Android / Play en pause jusqu’à appareil + service account)
- Builds via workflow manuel ; auto-submit TestFlight possible (`submit=true`)
- Actions vert avec `--no-wait` ≠ build Expo finished ≠ app sur TestFlight
- Vérifier le statut final sur Expo / App Store Connect / TestFlight

## Prochaines étapes produit (ordre suggéré)

1. **Inviter / gérer les membres** — bloquant pour une maison vraiment partagée
2. **Dépenses / compta maison** — voir [expenses.md](expenses.md)
3. Boucler fermeture (abandon, éventuellement ouverture, preuve photo)
4. Édition blog + DELETE photos HTTP
5. Aligner le pitch README (todos / open-close) sur le réel
6. TestFlight stable pour testeurs, puis reprendre Android

## Notes

- Pas d’issues GitHub ouvertes au moment de la rédaction ; ce dossier fait office de mémoire produit.
