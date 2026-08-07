package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var ErrNotAuthor = errors.New("not author")

type BlogPhoto struct {
	ID          string    `json:"id"`
	PostID      string    `json:"post_id"`
	ContentType string    `json:"content_type"`
	CreatedAt   time.Time `json:"created_at"`
}

type BlogReaction struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Mine  bool   `json:"mine"`
}

type BlogComment struct {
	ID          string    `json:"id"`
	PostID      string    `json:"post_id"`
	AuthorSub   string    `json:"author_sub"`
	AuthorName  string    `json:"author_name"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}

type BlogMention struct {
	UserSub     string `json:"user_sub"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

type BlogPost struct {
	ID         string         `json:"id"`
	HouseID    string         `json:"house_id"`
	AuthorSub  string         `json:"author_sub"`
	AuthorName string         `json:"author_name"`
	Title      string         `json:"title"`
	Body       string         `json:"body"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	Tags       []string       `json:"tags"`
	Mentions   []BlogMention  `json:"mentions"`
	Photos     []BlogPhoto    `json:"photos"`
	Reactions  []BlogReaction `json:"reactions"`
	Comments   []BlogComment  `json:"comments,omitempty"`
}

type BlogPhotoFile struct {
	ID          string
	HouseID     string
	StorageKey  string
	ContentType string
	CreatedAt   time.Time
}

func (s *Store) migrateBlog(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  author_sub TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_posts_house_idx ON blog_posts (house_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blog_post_photos (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  author_sub TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_comments_post_idx ON blog_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS blog_reactions (
  post_id UUID NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  user_sub TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_sub)
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id UUID NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS blog_post_tags_tag_idx ON blog_post_tags (tag);

CREATE TABLE IF NOT EXISTS blog_post_mentions (
  post_id UUID NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  user_sub TEXT NOT NULL,
  PRIMARY KEY (post_id, user_sub)
);
CREATE INDEX IF NOT EXISTS blog_post_mentions_user_idx ON blog_post_mentions (user_sub);
`)
	return err
}

func (s *Store) ListBlogPosts(ctx context.Context, houseID, viewerSub string) ([]BlogPost, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, author_sub, title, body, created_at, updated_at
FROM blog_posts WHERE house_id = $1
ORDER BY created_at DESC LIMIT 100`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []BlogPost
	ids := make([]string, 0)
	subs := make([]string, 0)
	for rows.Next() {
		var p BlogPost
		if err := rows.Scan(&p.ID, &p.HouseID, &p.AuthorSub, &p.Title, &p.Body, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.Photos = []BlogPhoto{}
		p.Reactions = []BlogReaction{}
		p.Tags = []string{}
		p.Mentions = []BlogMention{}
		posts = append(posts, p)
		ids = append(ids, p.ID)
		subs = append(subs, p.AuthorSub)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if posts == nil {
		return []BlogPost{}, nil
	}

	names, err := s.DisplayNames(ctx, subs)
	if err != nil {
		return nil, err
	}
	photos, err := s.loadBlogPhotos(ctx, ids)
	if err != nil {
		return nil, err
	}
	reactions, err := s.loadBlogReactions(ctx, ids, viewerSub)
	if err != nil {
		return nil, err
	}
	tags, err := s.loadBlogTags(ctx, ids)
	if err != nil {
		return nil, err
	}
	mentions, err := s.loadBlogMentions(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range posts {
		posts[i].AuthorName = displayLabel(names[posts[i].AuthorSub])
		if ph, ok := photos[posts[i].ID]; ok {
			posts[i].Photos = ph
		}
		if re, ok := reactions[posts[i].ID]; ok {
			posts[i].Reactions = re
		}
		if t, ok := tags[posts[i].ID]; ok {
			posts[i].Tags = t
		}
		if m, ok := mentions[posts[i].ID]; ok {
			posts[i].Mentions = m
		}
	}
	return posts, nil
}

func (s *Store) CreateBlogPost(
	ctx context.Context,
	houseID, authorSub, title, body string,
	tags []string,
	mentionSubs []string,
) (BlogPost, error) {
	id := uuid.NewString()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BlogPost{}, err
	}
	defer tx.Rollback(ctx)

	var p BlogPost
	err = tx.QueryRow(ctx, `
INSERT INTO blog_posts (id, house_id, author_sub, title, body)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, house_id::text, author_sub, title, body, created_at, updated_at`,
		id, houseID, authorSub, title, body,
	).Scan(&p.ID, &p.HouseID, &p.AuthorSub, &p.Title, &p.Body, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return BlogPost{}, err
	}
	for _, tag := range tags {
		if _, err := tx.Exec(ctx, `
INSERT INTO blog_post_tags (post_id, tag) VALUES ($1, $2)
ON CONFLICT DO NOTHING`, id, tag); err != nil {
			return BlogPost{}, err
		}
	}
	for _, sub := range mentionSubs {
		if _, err := tx.Exec(ctx, `
INSERT INTO blog_post_mentions (post_id, user_sub) VALUES ($1, $2)
ON CONFLICT DO NOTHING`, id, sub); err != nil {
			return BlogPost{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return BlogPost{}, err
	}

	p.Photos = []BlogPhoto{}
	p.Reactions = []BlogReaction{}
	p.Comments = []BlogComment{}
	p.Tags = tags
	if p.Tags == nil {
		p.Tags = []string{}
	}
	mentions, _ := s.loadBlogMentions(ctx, []string{id})
	p.Mentions = mentions[id]
	if p.Mentions == nil {
		p.Mentions = []BlogMention{}
	}
	names, _ := s.DisplayNames(ctx, []string{authorSub})
	p.AuthorName = names[authorSub]
	if p.AuthorName == "" {
		p.AuthorName = authorSub
	}
	return p, nil
}

func (s *Store) GetBlogPostHouseID(ctx context.Context, postID string) (string, error) {
	var houseID string
	err := s.pool.QueryRow(ctx, `SELECT house_id::text FROM blog_posts WHERE id = $1`, postID).Scan(&houseID)
	return houseID, err
}

func (s *Store) GetBlogPost(ctx context.Context, postID, viewerSub string) (BlogPost, error) {
	var p BlogPost
	err := s.pool.QueryRow(ctx, `
SELECT id::text, house_id::text, author_sub, title, body, created_at, updated_at
FROM blog_posts WHERE id = $1`, postID,
	).Scan(&p.ID, &p.HouseID, &p.AuthorSub, &p.Title, &p.Body, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return BlogPost{}, err
	}
	names, err := s.DisplayNames(ctx, []string{p.AuthorSub})
	if err != nil {
		return BlogPost{}, err
	}
	p.AuthorName = names[p.AuthorSub]
	if p.AuthorName == "" {
		p.AuthorName = p.AuthorSub
	}
	photos, err := s.loadBlogPhotos(ctx, []string{p.ID})
	if err != nil {
		return BlogPost{}, err
	}
	p.Photos = photos[p.ID]
	if p.Photos == nil {
		p.Photos = []BlogPhoto{}
	}
	reactions, err := s.loadBlogReactions(ctx, []string{p.ID}, viewerSub)
	if err != nil {
		return BlogPost{}, err
	}
	p.Reactions = reactions[p.ID]
	if p.Reactions == nil {
		p.Reactions = []BlogReaction{}
	}
	tags, err := s.loadBlogTags(ctx, []string{p.ID})
	if err != nil {
		return BlogPost{}, err
	}
	p.Tags = tags[p.ID]
	if p.Tags == nil {
		p.Tags = []string{}
	}
	mentions, err := s.loadBlogMentions(ctx, []string{p.ID})
	if err != nil {
		return BlogPost{}, err
	}
	p.Mentions = mentions[p.ID]
	if p.Mentions == nil {
		p.Mentions = []BlogMention{}
	}
	comments, err := s.ListBlogComments(ctx, p.ID)
	if err != nil {
		return BlogPost{}, err
	}
	p.Comments = comments
	return p, nil
}

func (s *Store) loadBlogTags(ctx context.Context, postIDs []string) (map[string][]string, error) {
	out := map[string][]string{}
	if len(postIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT post_id::text, tag FROM blog_post_tags
WHERE post_id = ANY($1::uuid[])
ORDER BY tag ASC`, postIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID, tag string
		if err := rows.Scan(&postID, &tag); err != nil {
			return nil, err
		}
		out[postID] = append(out[postID], tag)
	}
	return out, rows.Err()
}

func (s *Store) loadBlogMentions(ctx context.Context, postIDs []string) (map[string][]BlogMention, error) {
	out := map[string][]BlogMention{}
	if len(postIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT m.post_id::text, m.user_sub, COALESCE(p.display_name, ''), COALESCE(p.email, '')
FROM blog_post_mentions m
LEFT JOIN user_profiles p ON p.user_sub = m.user_sub
WHERE m.post_id = ANY($1::uuid[])
ORDER BY COALESCE(NULLIF(p.display_name, ''), NULLIF(p.email, ''), m.user_sub) ASC`, postIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID string
		var m BlogMention
		if err := rows.Scan(&postID, &m.UserSub, &m.DisplayName, &m.Email); err != nil {
			return nil, err
		}
		out[postID] = append(out[postID], m)
	}
	return out, rows.Err()
}

func (s *Store) DeleteBlogPost(ctx context.Context, postID, userSub string) error {
	tag, err := s.pool.Exec(ctx, `
DELETE FROM blog_posts WHERE id = $1 AND author_sub = $2`, postID, userSub)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) loadBlogPhotos(ctx context.Context, postIDs []string) (map[string][]BlogPhoto, error) {
	out := map[string][]BlogPhoto{}
	if len(postIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, post_id::text, content_type, created_at
FROM blog_post_photos WHERE post_id = ANY($1::uuid[])
ORDER BY created_at ASC`, postIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var ph BlogPhoto
		if err := rows.Scan(&ph.ID, &ph.PostID, &ph.ContentType, &ph.CreatedAt); err != nil {
			return nil, err
		}
		out[ph.PostID] = append(out[ph.PostID], ph)
	}
	return out, rows.Err()
}

func (s *Store) loadBlogReactions(ctx context.Context, postIDs []string, viewerSub string) (map[string][]BlogReaction, error) {
	out := map[string][]BlogReaction{}
	if len(postIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT post_id::text, emoji, COUNT(*)::int,
  BOOL_OR(user_sub = $2) AS mine
FROM blog_reactions
WHERE post_id = ANY($1::uuid[])
GROUP BY post_id, emoji
ORDER BY emoji`, postIDs, viewerSub)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID string
		var r BlogReaction
		if err := rows.Scan(&postID, &r.Emoji, &r.Count, &r.Mine); err != nil {
			return nil, err
		}
		out[postID] = append(out[postID], r)
	}
	return out, rows.Err()
}

func (s *Store) AddBlogPhoto(ctx context.Context, postID, userSub, key, contentType string) (BlogPhoto, error) {
	id := uuid.NewString()
	var ph BlogPhoto
	err := s.pool.QueryRow(ctx, `
INSERT INTO blog_post_photos (id, post_id, storage_key, content_type, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, post_id::text, content_type, created_at`,
		id, postID, key, contentType, userSub,
	).Scan(&ph.ID, &ph.PostID, &ph.ContentType, &ph.CreatedAt)
	return ph, err
}

func (s *Store) GetBlogPhotoFile(ctx context.Context, photoID string) (BlogPhotoFile, error) {
	var f BlogPhotoFile
	err := s.pool.QueryRow(ctx, `
SELECT ph.id::text, p.house_id::text, ph.storage_key, ph.content_type, ph.created_at
FROM blog_post_photos ph
JOIN blog_posts p ON p.id = ph.post_id
WHERE ph.id = $1`, photoID,
	).Scan(&f.ID, &f.HouseID, &f.StorageKey, &f.ContentType, &f.CreatedAt)
	return f, err
}

func (s *Store) DeleteBlogPhoto(ctx context.Context, photoID, userSub string) (BlogPhotoFile, error) {
	f, err := s.GetBlogPhotoFile(ctx, photoID)
	if err != nil {
		return BlogPhotoFile{}, err
	}
	var author string
	err = s.pool.QueryRow(ctx, `
SELECT p.author_sub FROM blog_post_photos ph
JOIN blog_posts p ON p.id = ph.post_id WHERE ph.id = $1`, photoID).Scan(&author)
	if err != nil {
		return BlogPhotoFile{}, err
	}
	if author != userSub {
		return BlogPhotoFile{}, ErrNotAuthor
	}
	_, err = s.pool.Exec(ctx, `DELETE FROM blog_post_photos WHERE id = $1`, photoID)
	return f, err
}

func (s *Store) ListBlogComments(ctx context.Context, postID string) ([]BlogComment, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, post_id::text, author_sub, body, created_at
FROM blog_comments WHERE post_id = $1
ORDER BY created_at ASC`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BlogComment
	subs := make([]string, 0)
	for rows.Next() {
		var c BlogComment
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorSub, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
		subs = append(subs, c.AuthorSub)
	}
	if out == nil {
		return []BlogComment{}, rows.Err()
	}
	names, err := s.DisplayNames(ctx, subs)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].AuthorName = names[out[i].AuthorSub]
		if out[i].AuthorName == "" {
			out[i].AuthorName = out[i].AuthorSub
		}
	}
	return out, rows.Err()
}

func (s *Store) AddBlogComment(ctx context.Context, postID, authorSub, body string) (BlogComment, error) {
	id := uuid.NewString()
	var c BlogComment
	err := s.pool.QueryRow(ctx, `
INSERT INTO blog_comments (id, post_id, author_sub, body)
VALUES ($1, $2, $3, $4)
RETURNING id::text, post_id::text, author_sub, body, created_at`,
		id, postID, authorSub, body,
	).Scan(&c.ID, &c.PostID, &c.AuthorSub, &c.Body, &c.CreatedAt)
	names, _ := s.DisplayNames(ctx, []string{authorSub})
	c.AuthorName = names[authorSub]
	if c.AuthorName == "" {
		c.AuthorName = authorSub
	}
	return c, err
}

func (s *Store) DeleteBlogComment(ctx context.Context, commentID, userSub string) error {
	tag, err := s.pool.Exec(ctx, `
DELETE FROM blog_comments WHERE id = $1 AND author_sub = $2`, commentID, userSub)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) SetBlogReaction(ctx context.Context, postID, userSub, emoji string) error {
	_, err := s.pool.Exec(ctx, `
INSERT INTO blog_reactions (post_id, user_sub, emoji)
VALUES ($1, $2, $3)
ON CONFLICT (post_id, user_sub) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now()`,
		postID, userSub, emoji)
	return err
}

func (s *Store) ClearBlogReaction(ctx context.Context, postID, userSub string) error {
	_, err := s.pool.Exec(ctx, `
DELETE FROM blog_reactions WHERE post_id = $1 AND user_sub = $2`, postID, userSub)
	return err
}
