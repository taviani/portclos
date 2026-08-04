# Dépenses courantes & compta maison

Plan produit (2026-08-04). Objectif : suivre eau, électricité, entretien, impôts, assurances — **compta maison simple**, pas un Splitwise complet ni une compta d’entreprise.

## Objectif

Enregistrer ce qui est dû / payé, qui a avancé, et l’équilibre entre membres — scoped **maison**.

## Périmètre v1

**Inclure**

- Catégories seed : eau, électricité, entretien, impôts, assurances, autre
- Dépenses ponctuelles et récurrentes (mensuel / trimestriel / annuel)
- Qui a payé (membre) + montant (EUR) + période concernée
- Solde par membre (« X doit / est dû »)
- Justificatif photo (facture)

**Reporter**

- Répartition au prorata des nuits / présences
- Export comptable / FEC
- Multi-devises
- Rapprochement bancaire
- Paiements in-app

## Modèle (v1)

- `expense_categories` — seed fixe
- `expenses` — maison, catégorie, titre, montant, date/période, payeur, note, récurrence optionnelle
- `expense_shares` — parts égales par défaut entre membres actifs (éditable)
- `expense_settlements` (v1.1) — « A a remboursé B de X € »

Règle v1 : **parts égales** entre membres de la maison ; le payeur avance.

## UX

Onglet **Dépenses** (ou section sous Maison) :

1. Soldes — résumé qui doit quoi
2. Liste — filtres catégorie / année
3. Ajouter — montant, catégorie, payeur, période
4. Détail — parts + photo facture

Permissions : owner peut supprimer/corriger ; member peut ajouter une dépense qu’il a payée.

## Étapes d’implémentation

1. API + schéma expenses / shares (CRUD + solde agrégé)
2. UI mobile liste + création + soldes
3. Photos justificatifs (réutiliser le pattern blog/aide)
4. Récurrences (prochaine occurrence ou rappel)
5. Règlements entre membres (v1.1)
6. Plus tard : répartition liée aux présences (nuits) si besoin

## Prérequis

Gestion des **membres** (invite / retrait) indispensable pour une compta à plusieurs réelle — à faire en parallèle ou juste avant.
