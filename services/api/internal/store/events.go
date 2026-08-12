package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// UsageEvent is one HTTP request observed by the access middleware.
type UsageEvent struct {
	ID         string
	RequestID  string
	UserSub    string
	Method     string
	Path       string
	Route      string
	Status     int
	DurationMs int
	HouseID    string
}

// ClientEvent is a mobile-reported error or usage signal.
type ClientEvent struct {
	ID         string          `json:"id"`
	CreatedAt  time.Time       `json:"created_at"`
	UserSub    string          `json:"user_sub"`
	Kind       string          `json:"kind"`
	Name       string          `json:"name"`
	Message    string          `json:"message"`
	Meta       json.RawMessage `json:"meta,omitempty"`
	AppVersion string          `json:"app_version"`
	Platform   string          `json:"platform"`
}

func (s *Store) migrateEvents(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id TEXT NOT NULL DEFAULT '',
  user_sub TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT '',
  status INT NOT NULL,
  duration_ms INT NOT NULL,
  house_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS usage_events_created_idx ON usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_user_idx ON usage_events (user_sub, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_status_idx ON usage_events (status, created_at DESC);

CREATE TABLE IF NOT EXISTS client_events (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_sub TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  app_version TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS client_events_created_idx ON client_events (created_at DESC);
CREATE INDEX IF NOT EXISTS client_events_user_idx ON client_events (user_sub, created_at DESC);
CREATE INDEX IF NOT EXISTS client_events_kind_idx ON client_events (kind, created_at DESC);
`)
	if err != nil {
		return fmt.Errorf("migrate events: %w", err)
	}
	return nil
}

func (s *Store) InsertUsageEvent(ctx context.Context, e UsageEvent) error {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO usage_events (
  id, request_id, user_sub, method, path, route, status, duration_ms, house_id
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		e.ID, e.RequestID, e.UserSub, e.Method, e.Path, e.Route, e.Status, e.DurationMs, e.HouseID,
	)
	if err != nil {
		return fmt.Errorf("insert usage_event: %w", err)
	}
	return nil
}

func (s *Store) InsertClientEvent(ctx context.Context, e ClientEvent) (ClientEvent, error) {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if len(e.Meta) == 0 {
		e.Meta = json.RawMessage(`{}`)
	}
	err := s.pool.QueryRow(ctx, `
INSERT INTO client_events (
  id, user_sub, kind, name, message, meta, app_version, platform
) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
RETURNING created_at`,
		e.ID, e.UserSub, e.Kind, e.Name, e.Message, string(e.Meta), e.AppVersion, e.Platform,
	).Scan(&e.CreatedAt)
	if err != nil {
		return ClientEvent{}, fmt.Errorf("insert client_event: %w", err)
	}
	return e, nil
}
