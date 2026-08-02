package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type HelpPhoto struct {
	ID          string    `json:"id"`
	ArticleID   string    `json:"article_id"`
	ContentType string    `json:"content_type"`
	CreatedAt   time.Time `json:"created_at"`
}

type HelpArticle struct {
	ID         string      `json:"id"`
	HouseID    string      `json:"house_id"`
	Title      string      `json:"title"`
	Body       string      `json:"body"`
	SortOrder  int         `json:"sort_order"`
	CreatedBy  string      `json:"created_by"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
	Photos     []HelpPhoto `json:"photos"`
}

type HelpPhotoFile struct {
	ID          string
	HouseID     string
	StorageKey  string
	ContentType string
	CreatedAt   time.Time
}

func (s *Store) migrateHelp(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS help_articles_house_idx ON help_articles (house_id, sort_order, title);

CREATE TABLE IF NOT EXISTS help_article_photos (
  id UUID PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES help_articles (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`)
	return err
}

func defaultHelpSeed() []struct{ Title, Body string } {
	return []struct{ Title, Body string }{
		{
			Title: "Entretien du jardin",
			Body:  "Noter ici la tonte, l’arrosage, les plantes sensibles et le matériel (tondeuse, tuyaux).",
		},
		{
			Title: "Wifi et routeurs",
			Body:  "Où sont les box / routeurs, le nom du réseau principal, et quoi redémarrer en cas de panne.",
		},
		{
			Title: "Pompe de relevage",
			Body:  "Emplacement, signes d’alerte (bruit, alarme), et qui appeler en cas de panne.",
		},
	}
}

func (s *Store) EnsureDefaultHelp(ctx context.Context, houseID, createdBy string) error {
	var n int
	if err := s.pool.QueryRow(ctx, `
SELECT COUNT(*) FROM help_articles WHERE house_id = $1`, houseID).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	for i, a := range defaultHelpSeed() {
		if _, err := s.CreateHelpArticle(ctx, houseID, createdBy, a.Title, a.Body, i); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) ListHelpArticles(ctx context.Context, houseID, userSub string) ([]HelpArticle, error) {
	if err := s.EnsureDefaultHelp(ctx, houseID, userSub); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, title, body, sort_order, created_by, created_at, updated_at
FROM help_articles WHERE house_id = $1
ORDER BY sort_order ASC, title ASC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []HelpArticle
	ids := make([]string, 0)
	for rows.Next() {
		var a HelpArticle
		if err := rows.Scan(&a.ID, &a.HouseID, &a.Title, &a.Body, &a.SortOrder, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Photos = []HelpPhoto{}
		out = append(out, a)
		ids = append(ids, a.ID)
	}
	if out == nil {
		return []HelpArticle{}, rows.Err()
	}
	photos, err := s.loadHelpPhotos(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if ph, ok := photos[out[i].ID]; ok {
			out[i].Photos = ph
		}
	}
	return out, rows.Err()
}

func (s *Store) CreateHelpArticle(ctx context.Context, houseID, createdBy, title, body string, sortOrder int) (HelpArticle, error) {
	id := uuid.NewString()
	var a HelpArticle
	err := s.pool.QueryRow(ctx, `
INSERT INTO help_articles (id, house_id, title, body, sort_order, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, house_id::text, title, body, sort_order, created_by, created_at, updated_at`,
		id, houseID, title, body, sortOrder, createdBy,
	).Scan(&a.ID, &a.HouseID, &a.Title, &a.Body, &a.SortOrder, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	a.Photos = []HelpPhoto{}
	return a, err
}

func (s *Store) NextHelpSortOrder(ctx context.Context, houseID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
SELECT COALESCE(MAX(sort_order), -1) + 1 FROM help_articles WHERE house_id = $1`, houseID).Scan(&n)
	return n, err
}

func (s *Store) GetHelpHouseID(ctx context.Context, articleID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `SELECT house_id::text FROM help_articles WHERE id = $1`, articleID).Scan(&houseID)
	return houseID, err
}

func (s *Store) GetHelpArticle(ctx context.Context, articleID string) (HelpArticle, error) {
	var a HelpArticle
	err := s.pool.QueryRow(ctx, `
SELECT id::text, house_id::text, title, body, sort_order, created_by, created_at, updated_at
FROM help_articles WHERE id = $1`, articleID,
	).Scan(&a.ID, &a.HouseID, &a.Title, &a.Body, &a.SortOrder, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return HelpArticle{}, err
	}
	photos, err := s.loadHelpPhotos(ctx, []string{a.ID})
	if err != nil {
		return HelpArticle{}, err
	}
	a.Photos = photos[a.ID]
	if a.Photos == nil {
		a.Photos = []HelpPhoto{}
	}
	return a, nil
}

func (s *Store) UpdateHelpArticle(ctx context.Context, articleID, title, body string) (HelpArticle, error) {
	var a HelpArticle
	err := s.pool.QueryRow(ctx, `
UPDATE help_articles SET title = $2, body = $3, updated_at = now()
WHERE id = $1
RETURNING id::text, house_id::text, title, body, sort_order, created_by, created_at, updated_at`,
		articleID, title, body,
	).Scan(&a.ID, &a.HouseID, &a.Title, &a.Body, &a.SortOrder, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return HelpArticle{}, err
	}
	return s.GetHelpArticle(ctx, articleID)
}

func (s *Store) DeleteHelpArticle(ctx context.Context, articleID string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM help_articles WHERE id = $1`, articleID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) loadHelpPhotos(ctx context.Context, ids []string) (map[string][]HelpPhoto, error) {
	out := map[string][]HelpPhoto{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, article_id::text, content_type, created_at
FROM help_article_photos WHERE article_id = ANY($1::uuid[])
ORDER BY created_at ASC`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var ph HelpPhoto
		if err := rows.Scan(&ph.ID, &ph.ArticleID, &ph.ContentType, &ph.CreatedAt); err != nil {
			return nil, err
		}
		out[ph.ArticleID] = append(out[ph.ArticleID], ph)
	}
	return out, rows.Err()
}

func (s *Store) AddHelpPhoto(ctx context.Context, articleID, userSub, key, contentType string) (HelpPhoto, error) {
	id := uuid.NewString()
	var ph HelpPhoto
	err := s.pool.QueryRow(ctx, `
INSERT INTO help_article_photos (id, article_id, storage_key, content_type, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, article_id::text, content_type, created_at`,
		id, articleID, key, contentType, userSub,
	).Scan(&ph.ID, &ph.ArticleID, &ph.ContentType, &ph.CreatedAt)
	return ph, err
}

func (s *Store) GetHelpPhotoFile(ctx context.Context, photoID string) (HelpPhotoFile, error) {
	var f HelpPhotoFile
	err := s.pool.QueryRow(ctx, `
SELECT ph.id::text, a.house_id::text, ph.storage_key, ph.content_type, ph.created_at
FROM help_article_photos ph
JOIN help_articles a ON a.id = ph.article_id
WHERE ph.id = $1`, photoID,
	).Scan(&f.ID, &f.HouseID, &f.StorageKey, &f.ContentType, &f.CreatedAt)
	return f, err
}

func (s *Store) DeleteHelpPhoto(ctx context.Context, photoID string) (HelpPhotoFile, error) {
	f, err := s.GetHelpPhotoFile(ctx, photoID)
	if err != nil {
		return HelpPhotoFile{}, err
	}
	_, err = s.pool.Exec(ctx, `DELETE FROM help_article_photos WHERE id = $1`, photoID)
	return f, err
}
