# Tranches — membres et navigation

Spec : [invitation et appartenance](../product/house-invite.md).
Les décisions produit ont été confirmées le 9 novembre 2026. Le code déjà
préparé dans le chat doit être livré par PR ; aucune fusion ni migration de
production n’est autorisée par ce plan seul.

## Tranche 1 — cohérence visuelle et modèle de membres

- Objectif : supprimer la distinction propriétaire/membre et les bandeaux blancs.
- Périmètre mobile : thème de navigation issu du même thème que Paper ; en-têtes
  Compte et Inviter lisibles en clair/sombre ; liste uniforme « Membre » ; aucun
  bouton Retirer ; invitations et informations accessibles à tous les membres.
- Périmètre API : contrôles d’appartenance, suppression de la route d’exclusion,
  création et normalisation des appartenances avec le rôle `member`.
- Critères : MEM-01 à MEM-04 ; conservation des appartenances existantes.
- Validation : TypeScript, tests Go, revue des contrôles d’appartenance et contrôle
  visuel local. Avant déploiement, vérifier la migration et les droits avec des
  comptes membre/non-membre sur une base de test isolée.
- Livraison : PR de code distincte de la conception ; ne pas déployer automatiquement.
- Statut : code préparé ; livraison et validations à consigner dans la PR.

## Tranche 2 — robustesse du démarrage Web

- Objectif : éviter un écran de démarrage permanent si le profil ne charge pas.
- Périmètre : supprimer la boucle synchrone de navigation ; conserver les écrans
  montés sous le splash ; proposer Réessayer / Se déconnecter sur erreur profil.
- Dépendance opérationnelle : l’origine Web doit être autorisée par l’API.
  Le réglage CORS privé déjà autorisé reste hors git.
- Validation : démarrage sans session, session existante, API inaccessible,
  récupération après rétablissement du réseau ; vérifications dans le navigateur.
- Statut : correction préparée pendant le diagnostic ; à livrer avec son historique
  de validation dans la PR de correctifs en cours.

Les sujets futurs passent d’abord par une spec et un nouveau plan ; ne pas les
ajouter implicitement à ces tranches.
