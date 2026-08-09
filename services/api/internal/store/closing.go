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
)

type ChecklistItemPhoto struct {
	ID              string    `json:"id"`
	ChecklistItemID string    `json:"checklist_item_id"`
	ContentType     string    `json:"content_type"`
	CreatedBy       string    `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
}

type ChecklistItem struct {
	ID          string               `json:"id"`
	HouseID     string               `json:"house_id"`
	Label       string               `json:"label"`
	Description string               `json:"description"`
	Optional    bool                 `json:"optional"`
	SortOrder   int                  `json:"sort_order"`
	CreatedAt   time.Time            `json:"created_at"`
	Photos      []ChecklistItemPhoto `json:"photos"`
}

type Closing struct {
	ID          string     `json:"id"`
	HouseID     string     `json:"house_id"`
	StartedBy   string     `json:"started_by"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type ClosingItem struct {
	ID          string               `json:"id"`
	ClosingID   string               `json:"closing_id"`
	Label       string               `json:"label"`
	Description string               `json:"description"`
	Optional    bool                 `json:"optional"`
	SortOrder   int                  `json:"sort_order"`
	Status      string               `json:"status"`
	UpdatedAt   time.Time            `json:"updated_at"`
	Photos      []ChecklistItemPhoto `json:"photos"`
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
	Label    string
	Optional bool
} {
	return []struct {
		Label    string
		Optional bool
	}{
		{Label: "Couper l’eau", Optional: false},
		{Label: "Couper le gaz", Optional: false},
		{Label: "Éteindre le chauffe-eau", Optional: true},
		{Label: "Vider le frigo / congélateur", Optional: false},
		{Label: "Fermer volets et fenêtres", Optional: false},
		{Label: "Sortir les poubelles", Optional: true},
		{Label: "Relever le compteur électrique", Optional: false},
	}
}

func (s *Store) migrateClosing(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS closing_checklist_items (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  optional BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE closing_checklist_items
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS closing_checklist_items_house_idx
  ON closing_checklist_items (house_id, sort_order);

CREATE TABLE IF NOT EXISTS closing_checklist_item_photos (
  id UUID PRIMARY KEY,
  checklist_item_id UUID NOT NULL REFERENCES closing_checklist_items (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS closing_checklist_item_photos_item_idx
  ON closing_checklist_item_photos (checklist_item_id);

CREATE TABLE IF NOT EXISTS closings (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  started_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
-- Existing DBs created with open|completed only.
ALTER TABLE closings DROP CONSTRAINT IF EXISTS closings_status_check;
ALTER TABLE closings
  ADD CONSTRAINT closings_status_check
  CHECK (status IN ('open', 'completed', 'cancelled'));
CREATE INDEX IF NOT EXISTS closings_house_started_idx
  ON closings (house_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS closings_one_open_per_house
  ON closings (house_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS closing_items (
  id UUID PRIMARY KEY,
  closing_id UUID NOT NULL REFERENCES closings (id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES closing_checklist_items (id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  optional BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('todo', 'done', 'skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE closing_items
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS closing_items_closing_idx
  ON closing_items (closing_id, sort_order);
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
		if _, err := s.CreateChecklistItem(ctx, houseID, item.Label, "", item.Optional, i); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) loadChecklistPhotos(ctx context.Context, itemIDs []string) (map[string][]ChecklistItemPhoto, error) {
	out := map[string][]ChecklistItemPhoto{}
	if len(itemIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, checklist_item_id::text, content_type, created_by, created_at
FROM closing_checklist_item_photos
WHERE checklist_item_id = ANY($1::uuid[])
ORDER BY created_at ASC`, itemIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p ChecklistItemPhoto
		if err := rows.Scan(&p.ID, &p.ChecklistItemID, &p.ContentType, &p.CreatedBy, &p.CreatedAt); err != nil {
			return nil, err
		}
		out[p.ChecklistItemID] = append(out[p.ChecklistItemID], p)
	}
	return out, rows.Err()
}

func (s *Store) ListChecklistItems(ctx context.Context, houseID string) ([]ChecklistItem, error) {
	if err := s.EnsureDefaultChecklist(ctx, houseID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, label, description, optional, sort_order, created_at
FROM closing_checklist_items
WHERE house_id = $1
ORDER BY sort_order ASC, created_at ASC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ChecklistItem
	ids := make([]string, 0)
	for rows.Next() {
		var it ChecklistItem
		if err := rows.Scan(&it.ID, &it.HouseID, &it.Label, &it.Description, &it.Optional, &it.SortOrder, &it.CreatedAt); err != nil {
			return nil, err
		}
		it.Photos = []ChecklistItemPhoto{}
		out = append(out, it)
		ids = append(ids, it.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []ChecklistItem{}
	}
	photos, err := s.loadChecklistPhotos(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if p, ok := photos[out[i].ID]; ok {
			out[i].Photos = p
		}
	}
	return out, nil
}

func (s *Store) CreateChecklistItem(ctx context.Context, houseID, label, description string, optional bool, sortOrder int) (ChecklistItem, error) {
	id := uuid.NewString()
	var it ChecklistItem
	err := s.pool.QueryRow(ctx, `
INSERT INTO closing_checklist_items (id, house_id, label, description, optional, sort_order)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, house_id::text, label, description, optional, sort_order, created_at`,
		id, houseID, label, description, optional, sortOrder,
	).Scan(&it.ID, &it.HouseID, &it.Label, &it.Description, &it.Optional, &it.SortOrder, &it.CreatedAt)
	it.Photos = []ChecklistItemPhoto{}
	return it, err
}

func (s *Store) NextChecklistSortOrder(ctx context.Context, houseID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
SELECT COALESCE(MAX(sort_order), -1) + 1
FROM closing_checklist_items WHERE house_id = $1`, houseID).Scan(&n)
	return n, err
}

func (s *Store) UpdateChecklistItem(ctx context.Context, itemID, houseID, label, description string, optional bool) (ChecklistItem, error) {
	var it ChecklistItem
	err := s.pool.QueryRow(ctx, `
UPDATE closing_checklist_items
SET label = $3, description = $4, optional = $5
WHERE id = $1 AND house_id = $2
RETURNING id::text, house_id::text, label, description, optional, sort_order, created_at`,
		itemID, houseID, label, description, optional,
	).Scan(&it.ID, &it.HouseID, &it.Label, &it.Description, &it.Optional, &it.SortOrder, &it.CreatedAt)
	if err != nil {
		return ChecklistItem{}, err
	}
	photos, err := s.loadChecklistPhotos(ctx, []string{it.ID})
	if err != nil {
		return ChecklistItem{}, err
	}
	it.Photos = photos[it.ID]
	if it.Photos == nil {
		it.Photos = []ChecklistItemPhoto{}
	}
	return it, nil
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
  id, closing_id, template_item_id, label, description, optional, sort_order, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')`,
			itemID, closingID, t.ID, t.Label, t.Description, t.Optional, t.SortOrder,
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
SELECT id::text, closing_id::text, label, description, optional, sort_order, status, updated_at,
       template_item_id::text
FROM closing_items
WHERE closing_id = $1
ORDER BY sort_order ASC, label ASC`, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	defer rows.Close()

	type rowItem struct {
		item       ClosingItem
		templateID *string
	}
	var rowsOut []rowItem
	templateIDs := make([]string, 0)
	for rows.Next() {
		var it ClosingItem
		var templateID *string
		if err := rows.Scan(
			&it.ID, &it.ClosingID, &it.Label, &it.Description, &it.Optional, &it.SortOrder, &it.Status, &it.UpdatedAt, &templateID,
		); err != nil {
			return ClosingDetail{}, err
		}
		it.Photos = []ChecklistItemPhoto{}
		rowsOut = append(rowsOut, rowItem{item: it, templateID: templateID})
		if templateID != nil && *templateID != "" {
			templateIDs = append(templateIDs, *templateID)
		}
	}
	if err := rows.Err(); err != nil {
		return ClosingDetail{}, err
	}

	photos, err := s.loadChecklistPhotos(ctx, templateIDs)
	if err != nil {
		return ClosingDetail{}, err
	}

	items := make([]ClosingItem, 0, len(rowsOut))
	for _, r := range rowsOut {
		if r.templateID != nil {
			if p, ok := photos[*r.templateID]; ok {
				r.item.Photos = p
			}
		}
		items = append(items, r.item)
	}
	if items == nil {
		items = []ClosingItem{}
	}

	return ClosingDetail{Closing: c, Items: items}, nil
}

func (s *Store) UpdateClosingItemStatus(ctx context.Context, closingID, itemID, status string) (ClosingItem, error) {
	var closingStatus string
	err := s.pool.QueryRow(ctx, `
SELECT status FROM closings WHERE id = $1`, closingID).Scan(&closingStatus)
	if err != nil {
		return ClosingItem{}, err
	}
	if closingStatus != "open" {
		return ClosingItem{}, ErrClosingNotOpen
	}

	var optional bool
	err = s.pool.QueryRow(ctx, `
SELECT optional FROM closing_items
WHERE id = $1 AND closing_id = $2`, itemID, closingID).Scan(&optional)
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

	_, err = s.pool.Exec(ctx, `
UPDATE closing_items
SET status = $3, updated_at = now()
WHERE id = $1 AND closing_id = $2`, itemID, closingID, status)
	if err != nil {
		return ClosingItem{}, err
	}

	detail, err := s.GetClosingDetail(ctx, closingID)
	if err != nil {
		return ClosingItem{}, err
	}
	for _, d := range detail.Items {
		if d.ID == itemID {
			return d, nil
		}
	}
	return ClosingItem{}, pgx.ErrNoRows
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

// CancelClosing abandons an in-progress closing so a new one can start.
func (s *Store) CancelClosing(ctx context.Context, closingID string) (ClosingDetail, error) {
	detail, err := s.GetClosingDetail(ctx, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	if detail.Status != "open" {
		return ClosingDetail{}, ErrClosingNotOpen
	}
	tag, err := s.pool.Exec(ctx, `
UPDATE closings
SET status = 'cancelled'
WHERE id = $1 AND status = 'open'`, closingID)
	if err != nil {
		return ClosingDetail{}, err
	}
	if tag.RowsAffected() == 0 {
		return ClosingDetail{}, ErrClosingNotOpen
	}
	return s.GetClosingDetail(ctx, closingID)
}

func (s *Store) AddChecklistItemPhoto(ctx context.Context, itemID, userSub, storageKey, contentType string) (ChecklistItemPhoto, error) {
	id := uuid.NewString()
	var p ChecklistItemPhoto
	err := s.pool.QueryRow(ctx, `
INSERT INTO closing_checklist_item_photos (id, checklist_item_id, storage_key, content_type, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, checklist_item_id::text, content_type, created_by, created_at`,
		id, itemID, storageKey, contentType, userSub,
	).Scan(&p.ID, &p.ChecklistItemID, &p.ContentType, &p.CreatedBy, &p.CreatedAt)
	return p, err
}

func (s *Store) GetClosingPhotoFile(ctx context.Context, photoID string) (ClosingPhotoFile, error) {
	var f ClosingPhotoFile
	err := s.pool.QueryRow(ctx, `
SELECT p.id::text, i.house_id::text, p.storage_key, p.content_type, p.created_at
FROM closing_checklist_item_photos p
JOIN closing_checklist_items i ON i.id = p.checklist_item_id
WHERE p.id = $1`, photoID,
	).Scan(&f.ID, &f.HouseID, &f.StorageKey, &f.ContentType, &f.CreatedAt)
	return f, err
}

func (s *Store) DeleteClosingPhoto(ctx context.Context, photoID string) (ClosingPhotoFile, error) {
	f, err := s.GetClosingPhotoFile(ctx, photoID)
	if err != nil {
		return ClosingPhotoFile{}, err
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM closing_checklist_item_photos WHERE id = $1`, photoID)
	if err != nil {
		return ClosingPhotoFile{}, err
	}
	if tag.RowsAffected() == 0 {
		return ClosingPhotoFile{}, pgx.ErrNoRows
	}
	return f, nil
}
