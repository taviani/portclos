package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type House struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Occupation struct {
	ID        string    `json:"id"`
	HouseID   string    `json:"house_id"`
	UserSub   string    `json:"user_sub"`
	StartDate string    `json:"start_date"`
	EndDate   string    `json:"end_date"`
	Note      string    `json:"note"`
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
CREATE TABLE IF NOT EXISTS occupations (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  user_sub TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS occupations_house_range_idx
  ON occupations (house_id, start_date, end_date);
`)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	if err := s.migrateClosing(ctx); err != nil {
		return fmt.Errorf("migrate closing: %w", err)
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

func formatDate(t time.Time) string {
	return t.Format("2006-01-02")
}

func (s *Store) ListOccupations(ctx context.Context, houseID string, from, to time.Time) ([]Occupation, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, user_sub, start_date, end_date, note, created_at
FROM occupations
WHERE house_id = $1
  AND start_date <= $3::date
  AND end_date >= $2::date
ORDER BY start_date ASC, created_at ASC`, houseID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Occupation
	for rows.Next() {
		var o Occupation
		var start, end time.Time
		if err := rows.Scan(&o.ID, &o.HouseID, &o.UserSub, &start, &end, &o.Note, &o.CreatedAt); err != nil {
			return nil, err
		}
		o.StartDate = formatDate(start)
		o.EndDate = formatDate(end)
		out = append(out, o)
	}
	if out == nil {
		out = []Occupation{}
	}
	return out, rows.Err()
}

func (s *Store) CreateOccupation(ctx context.Context, houseID, userSub string, start, end time.Time, note string) (Occupation, error) {
	id := uuid.NewString()
	var o Occupation
	var startOut, endOut time.Time
	err := s.pool.QueryRow(ctx, `
INSERT INTO occupations (id, house_id, user_sub, start_date, end_date, note)
VALUES ($1, $2, $3, $4::date, $5::date, $6)
RETURNING id::text, house_id::text, user_sub, start_date, end_date, note, created_at`,
		id, houseID, userSub, start, end, note,
	).Scan(&o.ID, &o.HouseID, &o.UserSub, &startOut, &endOut, &o.Note, &o.CreatedAt)
	if err != nil {
		return Occupation{}, err
	}
	o.StartDate = formatDate(startOut)
	o.EndDate = formatDate(endOut)
	return o, nil
}

func (s *Store) DeleteOccupation(ctx context.Context, occupationID, userSub string) error {
	tag, err := s.pool.Exec(ctx, `
DELETE FROM occupations
WHERE id = $1 AND user_sub = $2`, occupationID, userSub)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
