package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	ChantierStatusPlanned    = "planned"
	ChantierStatusInProgress = "in_progress"
	ChantierStatusDone       = "done"
)

type Chantier struct {
	ID          string    `json:"id"`
	HouseID     string    `json:"house_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (s *Store) migrateChantier(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS chantiers (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chantiers_house_status_idx
  ON chantiers (house_id, status, updated_at DESC);
`)
	return err
}

func validChantierStatus(status string) bool {
	switch status {
	case ChantierStatusPlanned, ChantierStatusInProgress, ChantierStatusDone:
		return true
	default:
		return false
	}
}

func (s *Store) ListChantiers(ctx context.Context, houseID string) ([]Chantier, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, title, description, status, created_by, created_at, updated_at
FROM chantiers
WHERE house_id = $1
ORDER BY
  CASE status
    WHEN 'in_progress' THEN 0
    WHEN 'planned' THEN 1
    ELSE 2
  END,
  updated_at DESC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Chantier
	for rows.Next() {
		var c Chantier
		if err := rows.Scan(
			&c.ID, &c.HouseID, &c.Title, &c.Description, &c.Status,
			&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if out == nil {
		out = []Chantier{}
	}
	return out, rows.Err()
}

func (s *Store) CreateChantier(
	ctx context.Context, houseID, createdBy, title, description, status string,
) (Chantier, error) {
	if status == "" {
		status = ChantierStatusPlanned
	}
	if !validChantierStatus(status) {
		return Chantier{}, fmt.Errorf("invalid_chantier_status")
	}
	id := uuid.NewString()
	var c Chantier
	err := s.pool.QueryRow(ctx, `
INSERT INTO chantiers (id, house_id, title, description, status, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, house_id::text, title, description, status, created_by, created_at, updated_at`,
		id, houseID, title, description, status, createdBy,
	).Scan(
		&c.ID, &c.HouseID, &c.Title, &c.Description, &c.Status,
		&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func (s *Store) GetChantierHouseID(ctx context.Context, chantierID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `SELECT house_id::text FROM chantiers WHERE id = $1`, chantierID).Scan(&houseID)
	return houseID, err
}

func (s *Store) UpdateChantier(
	ctx context.Context, chantierID, title, description, status string,
) (Chantier, error) {
	if !validChantierStatus(status) {
		return Chantier{}, fmt.Errorf("invalid_chantier_status")
	}
	var c Chantier
	err := s.pool.QueryRow(ctx, `
UPDATE chantiers
SET title = $2, description = $3, status = $4, updated_at = now()
WHERE id = $1
RETURNING id::text, house_id::text, title, description, status, created_by, created_at, updated_at`,
		chantierID, title, description, status,
	).Scan(
		&c.ID, &c.HouseID, &c.Title, &c.Description, &c.Status,
		&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func (s *Store) DeleteChantier(ctx context.Context, chantierID string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM chantiers WHERE id = $1`, chantierID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
