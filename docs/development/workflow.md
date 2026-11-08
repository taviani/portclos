# Conception et mise en œuvre

## Conception — SDD (Spec-Driven Development)

Une demande de specs produit un document dans `docs/product/` : problème,
comportements attendus, règles métier, droits d’accès, exclusions, cas limites et
critères d’acceptation vérifiables. Indiquer son statut : proposition, validée,
ou remplacée. Attribuer des identifiants aux exigences importantes.

Consigner les décisions confirmées et les questions ouvertes séparément. Ne pas
inventer de décisions antérieures à partir d’un souvenir de chat. Une précision
explicite de l’utilisateur prévaut ; la reporter dans la source de vérité.

Préparer ensuite `docs/plans/<sujet>.md` : tranches ordonnées et, pour chacune,
objectif, périmètre, dépendances, critères couverts, validation et livraison.
Une tranche doit pouvoir être revue et validée séparément. Ouvrir une PR de
conception contenant spec et plan, sans code produit. La validation du contenu
par l’utilisateur autorise l’implémentation de la tranche convenue.

## Mise en œuvre

1. Lire la spec et le plan ; choisir la tranche autorisée.
2. Partir de la base appropriée sur une branche `codex/<sujet>`.
3. Implémenter le périmètre convenu et ajouter les tests nécessaires aux risques.
4. Vérifier le diff et exécuter les contrôles pertinents. Distinguer les résultats
   observés des validations encore nécessaires, notamment sur données migrées.
5. Créer un commit, pousser et ouvrir une PR décrivant problème, comportement,
   lien vers la spec et tranche, validations et limites.
6. Rendre le lien de PR et mettre à jour le statut du plan. Attendre les
   instructions pour une fusion, un déploiement ou une tranche suivante.

Une correction précise peut être traitée directement : les demandes explicites
ne nécessitent pas une nouvelle phase d’approbation. Toute exception telle que
« ne pas commiter » s’applique au périmètre demandé. La configuration CORS privée
du serveur reste hors git. Une spec étendue ou ambiguë reste en conception.

## Clôture d’une tranche

Le code, les specs et le plan concordent ; les validations sont rapportées ;
le commit est poussé et la PR ouverte. Un changement local seul n’est pas livré.
Une validation impossible est consignée ; ouvrir la PR en brouillon si elle
empêche de conclure que la tranche est prête.
