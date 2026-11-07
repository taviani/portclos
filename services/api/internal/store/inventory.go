package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	InventoryKindStock  = "stock"
	InventoryKindNeeded = "needed"
)

type InventoryItem struct {
	ID        string    `json:"id"`
	HouseID   string    `json:"house_id"`
	Label     string    `json:"label"`
	Kind      string    `json:"kind"`
	Priority  bool      `json:"priority"`
	Note      string    `json:"note"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *Store) migrateInventory(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('stock', 'needed')),
  priority BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_items_house_kind_idx
  ON inventory_items (house_id, kind, priority DESC, label);
`)
	return err
}

func (s *Store) ListInventoryItems(ctx context.Context, houseID string) ([]InventoryItem, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, label, kind, priority, note, created_by, created_at, updated_at
FROM inventory_items
WHERE house_id = $1
ORDER BY kind ASC, priority DESC, lower(label) ASC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []InventoryItem
	for rows.Next() {
		var it InventoryItem
		if err := rows.Scan(
			&it.ID, &it.HouseID, &it.Label, &it.Kind, &it.Priority, &it.Note,
			&it.CreatedBy, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	if out == nil {
		out = []InventoryItem{}
	}
	return out, rows.Err()
}

func (s *Store) CreateInventoryItem(
	ctx context.Context, houseID, createdBy, label, kind, note string, priority bool,
) (InventoryItem, error) {
	if kind != InventoryKindStock && kind != InventoryKindNeeded {
		return InventoryItem{}, fmt.Errorf("invalid_inventory_kind")
	}
	if kind == InventoryKindStock {
		priority = false
	}
	id := uuid.NewString()
	var it InventoryItem
	err := s.pool.QueryRow(ctx, `
INSERT INTO inventory_items (id, house_id, label, kind, priority, note, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id::text, house_id::text, label, kind, priority, note, created_by, created_at, updated_at`,
		id, houseID, label, kind, priority, note, createdBy,
	).Scan(
		&it.ID, &it.HouseID, &it.Label, &it.Kind, &it.Priority, &it.Note,
		&it.CreatedBy, &it.CreatedAt, &it.UpdatedAt,
	)
	return it, err
}

func (s *Store) GetInventoryHouseID(ctx context.Context, itemID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `SELECT house_id::text FROM inventory_items WHERE id = $1`, itemID).Scan(&houseID)
	return houseID, err
}

func (s *Store) UpdateInventoryItem(
	ctx context.Context, itemID, label, kind, note string, priority bool,
) (InventoryItem, error) {
	if kind != InventoryKindStock && kind != InventoryKindNeeded {
		return InventoryItem{}, fmt.Errorf("invalid_inventory_kind")
	}
	if kind == InventoryKindStock {
		priority = false
	}
	var it InventoryItem
	err := s.pool.QueryRow(ctx, `
UPDATE inventory_items
SET label = $2, kind = $3, priority = $4, note = $5, updated_at = now()
WHERE id = $1
RETURNING id::text, house_id::text, label, kind, priority, note, created_by, created_at, updated_at`,
		itemID, label, kind, priority, note,
	).Scan(
		&it.ID, &it.HouseID, &it.Label, &it.Kind, &it.Priority, &it.Note,
		&it.CreatedBy, &it.CreatedAt, &it.UpdatedAt,
	)
	return it, err
}

func (s *Store) DeleteInventoryItem(ctx context.Context, itemID string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM inventory_items WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
