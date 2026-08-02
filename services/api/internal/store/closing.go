package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrClosingAlreadyOpen = errors.New("closing already open")
	ErrClosingNotOpen     = errors.New("closing not open")
	ErrRequiredPending    = errors.New("required items pending")
	ErrSkipRequired       = errors.New("cannot skip required item")
	ErrPhotoRequired      = errors.New("photo required")
)

type ChecklistItem struct {
	ID            string    `json:"id"`
	HouseID       string    `json:"house_id"`
	Label         string    `json:"label"`
	Optional      bool      `json:"optional"`
	RequiresPhoto bool      `json:"requires_photo"`
	SortOrder     int       `json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
}

type Closing struct {
	ID          string     `json:"id"`
	HouseID     string     `json:"house_id"`
	StartedBy   string     `json:"started_by"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type ClosingItemPhoto struct {
	ID            string    `json:"id"`
	ClosingItemID string    `json:"closing_item_id"`
	ContentType   string    `json:"content_type"`
	CreatedBy     string    `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}

type ClosingItem struct {
	ID            string             `json:"id"`
	ClosingID     string             `json:"closing_id"`
	Label         string             `json:"label"`
	Optional      bool               `json:"optional"`
	RequiresPhoto bool               `json:"requires_photo"`
	SortOrder     int                `json:"sort_order"`
	Status        string             `json:"status"`
	UpdatedAt     time.Time          `json:"updated_at"`
	Photos        []ClosingItemPhoto `json:"photos"`
}

type ClosingDetail struct {
	Closing
	Items []ClosingItem `json:"items"`
}

type ClosingPhotoFile struct {
	ID          string
	HouseID     string
	StorageKey  string
	ContentType string
	CreatedAt   time.Time
}

func defaultChecklistSeed() []struct {
	Label         string
	Optional      bool
	RequiresPhoto bool
} {
	return []struct {
		Label         string
		Optional      bool
		RequiresPhoto bool
	}{
		{Label: "Couper l’eau", Optional: false, RequiresPhoto: false},
		{Label: "Couper le gaz", Optional: false, RequiresPhoto: false},
		{Label: "Éteindre le chauffe-eau", Optional: true, RequiresPhoto: false},
		{Label: "Vider le frigo / congélateur", Optional: false, RequiresPhoto: false},
		{Label: "Fermer volets et fenêtres", Optional: false, RequiresPhoto: false},
		{Label: "Sortir les poubelles", Optional: true, RequiresPhoto: false},
		{Label: "Photo du compteur électrique", Optional: false, RequiresPhoto: true},
	}
}

func (s *Store) migrateClosing(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS closing_checklist_items (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  optional BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS closing_checklist_items_house_idx
  ON closing_checklist_items (house_id, sort_order);

CREATE TABLE IF NOT EXISTS closings (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  started_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS closings_house_started_idx
  ON closings (house_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS closings_one_open_per_house
  ON closings (house_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS closing_items (
  id UUID PRIMARY KEY,
  closing_id UUID NOT NULL REFERENCES closings (id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES closing_checklist_items (id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  optional BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('todo', 'done', 'skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS closing_items_closing_idx
  ON closing_items (closing_id, sort_order);

CREATE TABLE IF NOT EXISTS closing_item_photos (
  id UUID PRIMARY KEY,
  closing_item_id UUID NOT NULL REFERENCES closing_items (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS closing_item_photos_item_idx
  ON closing_item_photos (closing_item_id);
`)
	return err
}

func (s *Store) EnsureDefaultChecklist(ctx context.Context, houseID string) error {
	var n int
	if err := s.pool.QueryRow(ctx, `
SELECT COUNT(*) FROM closing_checklist_items WHERE house_id = $1`, houseID).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	for i, item := range defaultChecklistSeed() {
		if _, err := s.CreateChecklistItem(ctx, houseID, item.Label, item.Optional, item.RequiresPhoto, i); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) ListChecklistItems(ctx context.Context, houseID string) ([]ChecklistItem, error) {
	if err := s.EnsureDefaultChecklist(ctx, houseID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, label, optional, requires_photo, sort_order, created_at
FROM closing_checklist_items
WHERE house_id = $1
ORDER BY sort_order ASC, created_at ASC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ChecklistItem
	for rows.Next() {
		var it ChecklistItem
		if err := rows.Scan(&it.ID, &it.HouseID, &it.Label, &it.Optional, &it.RequiresPhoto, &it.SortOrder, &it.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	if out == nil {
		out = []ChecklistItem{}
	}
	return out, rows.Err()
}

func (s *Store) CreateChecklistItem(ctx context.Context, houseID, label string, optional, requiresPhoto bool, sortOrder int) (ChecklistItem, error) {
	id := uuid.NewString()
	var it ChecklistItem
	err := s.pool.QueryRow(ctx, `
INSERT INTO closing_checklist_items (id, house_id, label, optional, requires_photo, sort_order)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, house_id::text, label, optional, requires_photo, sort_order, created_at`,
		id, houseID, label, optional, requiresPhoto, sortOrder,
	).Scan(&it.ID, &it.HouseID, &it.Label, &it.Optional, &it.RequiresPhoto, &it.SortOrder, &it.CreatedAt)
	return it, err
}

func (s *Store) NextChecklistSortOrder(ctx context.Context, houseID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
SELECT COALESCE(MAX(sort_order), -1) + 1
FROM closing_checklist_items WHERE house_id = $1`, houseID).Scan(&n)
	return n, err
}

func (s *Store) UpdateChecklistItem(ctx context.Context, itemID, houseID, label string, optional, requiresPhoto bool) (ChecklistItem, error) {
	var it ChecklistItem
	err := s.pool.QueryRow(ctx, `
UPDATE closing_checklist_items
SET label = $3, optional = $4, requires_photo = $5
WHERE id = $1 AND house_id = $2
RETURNING id::text, house_id::text, label, optional, requires_photo, sort_order, created_at`,
		itemID, houseID, label, optional, requiresPhoto,
	).Scan(&it.ID, &it.HouseID, &it.Label, &it.Optional, &it.RequiresPhoto, &it.SortOrder, &it.CreatedAt)
	return it, err
}

func (s *Store) DeleteChecklistItem(ctx context.Context, itemID, houseID string) error {
	tag, err := s.pool.Exec(ctx, `
DELETE FROM closing_checklist_items WHERE id = $1 AND house_id = $2`, itemID, houseID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) GetChecklistItemHouseID(ctx context.Context, itemID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `
SELECT house_id::text FROM closing_checklist_items WHERE id = $1`, itemID).Scan(&houseID)
	return houseID, err
}

func (s *Store) ListClosings(ctx context.Context, houseID string) ([]Closing, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, started_by, status, started_at, completed_at
FROM closings
WHERE house_id = $1
ORDER BY started_at DESC
LIMIT 50`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Closing
	for rows.Next() {
		var c Closing
		if err := rows.Scan(&c.ID, &c.HouseID, &c.StartedBy, &c.Status, &c.StartedAt, &c.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if out == nil {
		out = []Closing{}
	}
	return out, rows.Err()
}

func (s *Store) GetOpenClosing(ctx context.Context, houseID string) (Closing, error) {
	var c Closing
	err := s.pool.QueryRow(ctx, `
SELECT id::text, house_id::text, started_by, status, started_at, completed_at
FROM closings
WHERE house_id = $1 AND status = 'open'`, houseID,
	).Scan(&c.ID, &c.HouseID, &c.StartedBy, &c.Status, &c.StartedAt, &c.CompletedAt)
	return c, err
}

func (s *Store) StartClosing(ctx context.Context, houseID, userSub string) (ClosingDetail, error) {
	if err := s.EnsureDefaultChecklist(ctx, houseID); err != nil {
		return ClosingDetail{}, err
	}
	template, err := s.ListChecklistItems(ctx, houseID)
	if err != nil {
		return ClosingDetail{}, err
	}
	if len(template) == 0 {
		return ClosingDetail{}, fmt.Errorf("empty checklist")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ClosingDetail{}, err
	}
	defer tx.Rollback(ctx)

	var openCount int
	if err := tx.QueryRow(ctx, `
SELECT COUNT(*) FROM closings WHERE house_id = $1 AND status = 'open'`, houseID).Scan(&openCount); err != nil {
		return ClosingDetail{}, err
	}
	if openCount > 0 {
		return ClosingDetail{}, ErrClosingAlreadyOpen
	}

	closingID := uuid.NewString()
	var c Closing
	if err := tx.QueryRow(ctx, `
INSERT INTO closings (id, house_id, started_by, status)
VALUES ($1, $2, $3, 'open')
RETURNING id::text, house_id::text, started_by, status, started_at, completed_at`,
		closingID, houseID, userSub,
	).Scan(&c.ID, &c.HouseID, &c.StartedBy, &c.Status, &c.StartedAt, &c.CompletedAt); err != nil {
		return ClosingDetail{}, err
	}

	for _, t := range template {
		itemID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
INSERT INTO closing_items (
  id, closing_id, template_item_id, label, optional, requires_photo, sort_order, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')`,
			itemID, closingID, t.ID, t.Label, t.Optional, t.RequiresPhoto, t.SortOrder,
		); err != nil {
			return ClosingDetail{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ClosingDetail{}, err
	}
	return s.GetClosingDetail(ctx, closingID)
}

func (s *Store) GetClosingHouseID(ctx context.Context, closingID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `
SELECT house_id::text FROM closings WHERE id = $1`, closingID).Scan(&houseID)
	return houseID, err
}

func (s *Store) GetClosingDetail(ctx context.Context, closingID string) (ClosingDetail, error) {
	var c Closing
	err := s.pool.QueryRow(ctx, `
SELECT id::text, house_id::text, started_by, status, started_at, completed_at
FROM closings WHERE id = $1`, closingID,
	).Scan(&c.ID, &c.HouseID, &c.StartedBy, &c.Status, &c.StartedAt, &c.CompletedAt)
	if err != nil {
		return ClosingDetail{}, err
	}

	rows, err := s.pool.Query(ctx, `
SELECT id::text, closing_id::text, label, optional, requires_photo, sort_order, status, updated_at
FROM closing_items
WHERE closing_id = $1
ORDER BY sort_order ASC, label ASC`, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	defer rows.Close()

	var items []ClosingItem
	itemIDs := make([]string, 0)
	for rows.Next() {
		var it ClosingItem
		if err := rows.Scan(&it.ID, &it.ClosingID, &it.Label, &it.Optional, &it.RequiresPhoto, &it.SortOrder, &it.Status, &it.UpdatedAt); err != nil {
			return ClosingDetail{}, err
		}
		it.Photos = []ClosingItemPhoto{}
		items = append(items, it)
		itemIDs = append(itemIDs, it.ID)
	}
	if err := rows.Err(); err != nil {
		return ClosingDetail{}, err
	}
	if items == nil {
		items = []ClosingItem{}
	}

	if len(itemIDs) > 0 {
		photoRows, err := s.pool.Query(ctx, `
SELECT id::text, closing_item_id::text, content_type, created_by, created_at
FROM closing_item_photos
WHERE closing_item_id = ANY($1::uuid[])
ORDER BY created_at ASC`, itemIDs)
		if err != nil {
			return ClosingDetail{}, err
		}
		defer photoRows.Close()

		byItem := map[string][]ClosingItemPhoto{}
		for photoRows.Next() {
			var p ClosingItemPhoto
			if err := photoRows.Scan(&p.ID, &p.ClosingItemID, &p.ContentType, &p.CreatedBy, &p.CreatedAt); err != nil {
				return ClosingDetail{}, err
			}
			byItem[p.ClosingItemID] = append(byItem[p.ClosingItemID], p)
		}
		if err := photoRows.Err(); err != nil {
			return ClosingDetail{}, err
		}
		for i := range items {
			if photos, ok := byItem[items[i].ID]; ok {
				items[i].Photos = photos
			}
		}
	}

	return ClosingDetail{Closing: c, Items: items}, nil
}

func (s *Store) UpdateClosingItemStatus(ctx context.Context, closingID, itemID, status string) (ClosingItem, error) {
	var c Closing
	err := s.pool.QueryRow(ctx, `
SELECT id::text, house_id::text, started_by, status, started_at, completed_at
FROM closings WHERE id = $1`, closingID,
	).Scan(&c.ID, &c.HouseID, &c.StartedBy, &c.Status, &c.StartedAt, &c.CompletedAt)
	if err != nil {
		return ClosingItem{}, err
	}
	if c.Status != "open" {
		return ClosingItem{}, ErrClosingNotOpen
	}

	var optional, requiresPhoto bool
	var photoCount int
	err = s.pool.QueryRow(ctx, `
SELECT optional, requires_photo,
  (SELECT COUNT(*) FROM closing_item_photos p WHERE p.closing_item_id = i.id)
FROM closing_items i
WHERE i.id = $1 AND i.closing_id = $2`, itemID, closingID,
	).Scan(&optional, &requiresPhoto, &photoCount)
	if err != nil {
		return ClosingItem{}, err
	}

	switch status {
	case "todo", "done", "skipped":
	default:
		return ClosingItem{}, fmt.Errorf("invalid status")
	}
	if status == "skipped" && !optional {
		return ClosingItem{}, ErrSkipRequired
	}
	if status == "done" && requiresPhoto && photoCount == 0 {
		return ClosingItem{}, ErrPhotoRequired
	}

	var it ClosingItem
	err = s.pool.QueryRow(ctx, `
UPDATE closing_items
SET status = $3, updated_at = now()
WHERE id = $1 AND closing_id = $2
RETURNING id::text, closing_id::text, label, optional, requires_photo, sort_order, status, updated_at`,
		itemID, closingID, status,
	).Scan(&it.ID, &it.ClosingID, &it.Label, &it.Optional, &it.RequiresPhoto, &it.SortOrder, &it.Status, &it.UpdatedAt)
	if err != nil {
		return ClosingItem{}, err
	}
	it.Photos = []ClosingItemPhoto{}
	detail, err := s.GetClosingDetail(ctx, closingID)
	if err != nil {
		return it, nil
	}
	for _, d := range detail.Items {
		if d.ID == itemID {
			return d, nil
		}
	}
	return it, nil
}

func (s *Store) CompleteClosing(ctx context.Context, closingID string) (ClosingDetail, error) {
	detail, err := s.GetClosingDetail(ctx, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	if detail.Status != "open" {
		return ClosingDetail{}, ErrClosingNotOpen
	}
	for _, it := range detail.Items {
		if it.Optional {
			continue
		}
		if it.Status != "done" {
			return ClosingDetail{}, ErrRequiredPending
		}
		if it.RequiresPhoto && len(it.Photos) == 0 {
			return ClosingDetail{}, ErrPhotoRequired
		}
	}

	_, err = s.pool.Exec(ctx, `
UPDATE closings
SET status = 'completed', completed_at = now()
WHERE id = $1 AND status = 'open'`, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	return s.GetClosingDetail(ctx, closingID)
}

func (s *Store) GetClosingItemMeta(ctx context.Context, closingID, itemID string) (houseID string, closingStatus string, err error) {
	err = s.pool.QueryRow(ctx, `
SELECT c.house_id::text, c.status
FROM closing_items i
JOIN closings c ON c.id = i.closing_id
WHERE i.id = $1 AND i.closing_id = $2`, itemID, closingID,
	).Scan(&houseID, &closingStatus)
	return houseID, closingStatus, err
}

func (s *Store) AddClosingItemPhoto(ctx context.Context, closingID, itemID, userSub, storageKey, contentType string) (ClosingItemPhoto, error) {
	houseID, status, err := s.GetClosingItemMeta(ctx, closingID, itemID)
	if err != nil {
		return ClosingItemPhoto{}, err
	}
	_ = houseID
	if status != "open" {
		return ClosingItemPhoto{}, ErrClosingNotOpen
	}

	id := uuid.NewString()
	var p ClosingItemPhoto
	err = s.pool.QueryRow(ctx, `
INSERT INTO closing_item_photos (id, closing_item_id, storage_key, content_type, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, closing_item_id::text, content_type, created_by, created_at`,
		id, itemID, storageKey, contentType, userSub,
	).Scan(&p.ID, &p.ClosingItemID, &p.ContentType, &p.CreatedBy, &p.CreatedAt)
	return p, err
}

func (s *Store) GetClosingPhotoFile(ctx context.Context, photoID string) (ClosingPhotoFile, error) {
	var f ClosingPhotoFile
	err := s.pool.QueryRow(ctx, `
SELECT p.id::text, c.house_id::text, p.storage_key, p.content_type, p.created_at
FROM closing_item_photos p
JOIN closing_items i ON i.id = p.closing_item_id
JOIN closings c ON c.id = i.closing_id
WHERE p.id = $1`, photoID,
	).Scan(&f.ID, &f.HouseID, &f.StorageKey, &f.ContentType, &f.CreatedAt)
	return f, err
}

func (s *Store) DeleteClosingPhoto(ctx context.Context, photoID string) (ClosingPhotoFile, error) {
	f, err := s.GetClosingPhotoFile(ctx, photoID)
	if err != nil {
		return ClosingPhotoFile{}, err
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM closing_item_photos WHERE id = $1`, photoID)
	if err != nil {
		return ClosingPhotoFile{}, err
	}
	if tag.RowsAffected() == 0 {
		return ClosingPhotoFile{}, pgx.ErrNoRows
	}
	return f, nil
}
