package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type House struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Store struct {
	pool *pgxpool.Pool
}

func Connect(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("pgx: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	s := &Store{pool: pool}
	if err := s.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS houses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS house_members (
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  user_sub TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (house_id, user_sub)
);
CREATE INDEX IF NOT EXISTS house_members_user_sub_idx ON house_members (user_sub);
`)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

func (s *Store) ListHouses(ctx context.Context, userSub string) ([]House, error) {
	rows, err := s.pool.Query(ctx, `
SELECT h.id::text, h.name, m.role, h.created_at
FROM houses h
JOIN house_members m ON m.house_id = h.id
WHERE m.user_sub = $1
ORDER BY h.created_at ASC`, userSub)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []House
	for rows.Next() {
		var h House
		if err := rows.Scan(&h.ID, &h.Name, &h.Role, &h.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if out == nil {
		out = []House{}
	}
	return out, rows.Err()
}

func (s *Store) CreateHouse(ctx context.Context, userSub, name string) (House, error) {
	id := uuid.NewString()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return House{}, err
	}
	defer tx.Rollback(ctx)

	var h House
	err = tx.QueryRow(ctx, `
INSERT INTO houses (id, name, created_by)
VALUES ($1, $2, $3)
RETURNING id::text, name, created_at`, id, name, userSub,
	).Scan(&h.ID, &h.Name, &h.CreatedAt)
	if err != nil {
		return House{}, err
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO house_members (house_id, user_sub, role)
VALUES ($1, $2, 'owner')`, id, userSub); err != nil {
		return House{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return House{}, err
	}
	h.Role = "owner"
	return h, nil
}

func (s *Store) GetHouseForMember(ctx context.Context, houseID, userSub string) (House, error) {
	var h House
	err := s.pool.QueryRow(ctx, `
SELECT h.id::text, h.name, m.role, h.created_at
FROM houses h
JOIN house_members m ON m.house_id = h.id
WHERE h.id = $1 AND m.user_sub = $2`, houseID, userSub,
	).Scan(&h.ID, &h.Name, &h.Role, &h.CreatedAt)
	return h, err
}
