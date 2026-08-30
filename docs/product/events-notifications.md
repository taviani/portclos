# Événements métier et notifications

## Décision

- L’API reste **CRUD synchrone** (handler → Postgres). On n’event-source pas les maisons ni les checklists.
- `usage_events` / `client_events` restent de la **télémétrie** (logs, Metabase). Ce n’est pas le bus métier.
- Quand une action maison doit **entraîner d’autres effets**, on écrit un **événement métier** après le `COMMIT` (même transaction = outbox Postgres).
- Le **premier consommateur** est un système de notifications. D’autres modules (plus tard) s’abonnent au même outbox, sans que le store source les importe.

## Notifications

- Un événement ≠ une notification. L’événement dit *ce qui s’est passé* ; un worker décide *qui* prévenir (les autres membres de la maison, pas l’auteur) et *comment*.
- Ne pas envoyer la notif depuis le handler HTTP.
- In-app d’abord (`GET /notifications`, TanStack Query). Push ensuite. Pas de WebSocket « pour l’archi ».

Premières notifs qui valent le code :

1. Présence créée ou annulée
2. Fermeture terminée
3. (optionnel) Nouveau billet blog

## Hors scope (pour maintenant)

- Broker (Kafka, etc.) tant qu’il n’y a qu’un service API.
- Event sourcing.
- Réutiliser `client_events` comme file de notifs.
