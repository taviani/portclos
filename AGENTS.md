# Portclos — règles de travail

Ces règles s’appliquent à tout le dépôt, dans Codex comme dans Cursor.

- Lire `docs/development/workflow.md` avant de commencer.
- Les décisions produit vivent dans `docs/product/`, jamais uniquement dans un chat.
- Pour une demande de conception : écrire ou mettre à jour la spec SDD, consigner
  les questions ouvertes, puis préparer un plan par tranches dans `docs/plans/`.
  Ne pas commencer l’implémentation d’une nouvelle spec tant qu’elle n’est pas validée.
- Une demande de correction précise autorise sa mise en œuvre ; synchroniser la spec
  si elle modifie une règle produit déjà documentée.
- Implémenter uniquement la tranche convenue et vérifier ses critères d’acceptation.
- À la fin d’une tranche : vérifier le diff, exécuter les contrôles pertinents,
  créer un commit, pousser la branche et ouvrir une PR. Ne pas s’arrêter à des
  modifications locales. Les exceptions explicites de l’utilisateur priment.
- Séparer les PR de conception des PR de mise en œuvre ; relier spec, plan et PR.
- Utiliser des branches `codex/…` et une PR par tranche cohérente.
- Ne pas fusionner ni déployer sans instruction. Ne jamais commiter de secrets,
  de `.env` ou de configuration privée du serveur.
- Produit : une maison en indivision n’a que des membres, sans propriétaire ni
  action permettant d’exclure un membre. Tous ses membres peuvent inviter et
  modifier les informations communes ; les non-membres restent exclus.
