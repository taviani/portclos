package store

import (
	"context"
	"strings"
	"unicode/utf8"
)

type SearchHit struct {
	Type    string  `json:"type"` // help | blog | closing | occupation
	ID      string  `json:"id"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Rank    float64 `json:"rank"`
}

func (s *Store) migrateSearch(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION portclos_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE INDEX IF NOT EXISTS help_articles_fts_idx ON help_articles
  USING GIN (
    (
      setweight(to_tsvector('french', portclos_unaccent(coalesce(title,''))), 'A') ||
      setweight(to_tsvector('french', portclos_unaccent(coalesce(body,''))), 'B')
    )
  );
CREATE INDEX IF NOT EXISTS help_articles_trgm_title_idx ON help_articles
  USING GIN (portclos_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS help_articles_trgm_body_idx ON help_articles
  USING GIN (portclos_unaccent(lower(body)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS blog_posts_fts_idx ON blog_posts
  USING GIN (
    (
      setweight(to_tsvector('french', portclos_unaccent(coalesce(title,''))), 'A') ||
      setweight(to_tsvector('french', portclos_unaccent(coalesce(body,''))), 'B')
    )
  );
CREATE INDEX IF NOT EXISTS blog_posts_trgm_title_idx ON blog_posts
  USING GIN (portclos_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS blog_posts_trgm_body_idx ON blog_posts
  USING GIN (portclos_unaccent(lower(body)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS blog_comments_fts_idx ON blog_comments
  USING GIN (to_tsvector('french', portclos_unaccent(coalesce(body,''))));
CREATE INDEX IF NOT EXISTS blog_comments_trgm_idx ON blog_comments
  USING GIN (portclos_unaccent(lower(body)) gin_trgm_ops);

DROP INDEX IF EXISTS closing_checklist_items_fts_idx;
DROP INDEX IF EXISTS closing_checklist_items_trgm_idx;
CREATE INDEX IF NOT EXISTS closing_checklist_items_fts_idx ON closing_checklist_items
  USING GIN (to_tsvector('french', portclos_unaccent(coalesce(label,'') || ' ' || coalesce(description,''))));
CREATE INDEX IF NOT EXISTS closing_checklist_items_trgm_idx ON closing_checklist_items
  USING GIN (portclos_unaccent(lower(coalesce(label,'') || ' ' || coalesce(description,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS occupations_note_trgm_idx ON occupations
  USING GIN (portclos_unaccent(lower(note)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS occupation_guests_name_trgm_idx ON occupation_guests
  USING GIN (portclos_unaccent(lower(first_name)) gin_trgm_ops);
`)
	return err
}

func (s *Store) SearchHouse(ctx context.Context, houseID, query string, limit int) ([]SearchHit, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return []SearchHit{}, nil
	}
	if utf8.RuneCountInString(q) > 200 {
		q = string([]rune(q)[:200])
	}
	if limit <= 0 || limit > 40 {
		limit = 20
	}

	rows, err := s.pool.Query(ctx, `
WITH q AS (
  SELECT
    portclos_unaccent(lower($2)) AS q_plain,
    websearch_to_tsquery('french', portclos_unaccent($2)) AS tsq
),
help_hits AS (
  SELECT
    'help'::text AS type,
    a.id::text AS id,
    a.title,
    left(a.body, 160) AS snippet,
    (
      ts_rank(
        setweight(to_tsvector('french', portclos_unaccent(coalesce(a.title,''))), 'A') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(a.body,''))), 'B'),
        (SELECT tsq FROM q)
      )
      + GREATEST(
          similarity(portclos_unaccent(lower(a.title)), (SELECT q_plain FROM q)),
          similarity(portclos_unaccent(lower(left(a.body, 400))), (SELECT q_plain FROM q)) * 0.5
        )
    )::float8 AS rank
  FROM help_articles a, q
  WHERE a.house_id = $1
    AND (
      (
        setweight(to_tsvector('french', portclos_unaccent(coalesce(a.title,''))), 'A') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(a.body,''))), 'B')
      ) @@ q.tsq
      OR similarity(portclos_unaccent(lower(a.title)), q.q_plain) > 0.2
      OR portclos_unaccent(lower(a.title)) % q.q_plain
      OR portclos_unaccent(lower(a.body)) % q.q_plain
      OR portclos_unaccent(lower(a.title)) LIKE '%' || q.q_plain || '%'
      OR portclos_unaccent(lower(a.body)) LIKE '%' || q.q_plain || '%'
    )
),
blog_post_hits AS (
  SELECT
    'blog'::text AS type,
    p.id::text AS id,
    p.title,
    left(p.body, 160) AS snippet,
    (
      ts_rank(
        setweight(to_tsvector('french', portclos_unaccent(coalesce(p.title,''))), 'A') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(p.body,''))), 'B') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(tags.tags_text,''))), 'B') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(author.display_name,''))), 'B'),
        (SELECT tsq FROM q)
      )
      + GREATEST(
          similarity(portclos_unaccent(lower(p.title)), (SELECT q_plain FROM q)),
          similarity(portclos_unaccent(lower(coalesce(tags.tags_text,''))), (SELECT q_plain FROM q)),
          similarity(portclos_unaccent(lower(coalesce(author.display_name,''))), (SELECT q_plain FROM q)),
          similarity(portclos_unaccent(lower(left(p.body, 400))), (SELECT q_plain FROM q)) * 0.5
        )
    )::float8 AS rank
  FROM blog_posts p
  CROSS JOIN q
  LEFT JOIN LATERAL (
    SELECT string_agg(t.tag, ' ') AS tags_text
    FROM blog_post_tags t
    WHERE t.post_id = p.id
  ) tags ON true
  LEFT JOIN user_profiles author ON author.user_sub = p.author_sub
  WHERE p.house_id = $1
    AND (
      (
        setweight(to_tsvector('french', portclos_unaccent(coalesce(p.title,''))), 'A') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(p.body,''))), 'B') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(tags.tags_text,''))), 'B') ||
        setweight(to_tsvector('french', portclos_unaccent(coalesce(author.display_name,''))), 'B')
      ) @@ q.tsq
      OR similarity(portclos_unaccent(lower(p.title)), q.q_plain) > 0.2
      OR portclos_unaccent(lower(p.title)) % q.q_plain
      OR portclos_unaccent(lower(p.body)) % q.q_plain
      OR portclos_unaccent(lower(coalesce(tags.tags_text,''))) % q.q_plain
      OR portclos_unaccent(lower(coalesce(author.display_name,''))) % q.q_plain
      OR portclos_unaccent(lower(p.title)) LIKE '%' || q.q_plain || '%'
      OR portclos_unaccent(lower(p.body)) LIKE '%' || q.q_plain || '%'
      OR portclos_unaccent(lower(coalesce(tags.tags_text,''))) LIKE '%' || q.q_plain || '%'
      OR portclos_unaccent(lower(coalesce(author.display_name,''))) LIKE '%' || q.q_plain || '%'
    )
),
blog_comment_hits AS (
  SELECT
    'blog'::text AS type,
    p.id::text AS id,
    p.title,
    left(c.body, 160) AS snippet,
    (
      ts_rank(to_tsvector('french', portclos_unaccent(coalesce(c.body,''))), (SELECT tsq FROM q))
      + similarity(portclos_unaccent(lower(c.body)), (SELECT q_plain FROM q))
    )::float8 AS rank
  FROM blog_comments c
  JOIN blog_posts p ON p.id = c.post_id
  CROSS JOIN q
  WHERE p.house_id = $1
    AND (
      to_tsvector('french', portclos_unaccent(coalesce(c.body,''))) @@ q.tsq
      OR similarity(portclos_unaccent(lower(c.body)), q.q_plain) > 0.2
      OR portclos_unaccent(lower(c.body)) % q.q_plain
      OR portclos_unaccent(lower(c.body)) LIKE '%' || q.q_plain || '%'
    )
),
closing_hits AS (
  SELECT
    'closing'::text AS type,
    c.id::text AS id,
    c.label AS title,
    CASE
      WHEN nullif(trim(c.description), '') IS NOT NULL THEN left(c.description, 120)
      WHEN c.optional THEN 'Étape optionnelle'::text
      ELSE 'Étape de fermeture'::text
    END AS snippet,
    (
      ts_rank(to_tsvector('french', portclos_unaccent(coalesce(c.label,'') || ' ' || coalesce(c.description,''))), (SELECT tsq FROM q))
      + similarity(portclos_unaccent(lower(coalesce(c.label,'') || ' ' || coalesce(c.description,''))), (SELECT q_plain FROM q))
    )::float8 AS rank
  FROM closing_checklist_items c, q
  WHERE c.house_id = $1
    AND (
      to_tsvector('french', portclos_unaccent(coalesce(c.label,'') || ' ' || coalesce(c.description,''))) @@ q.tsq
      OR similarity(portclos_unaccent(lower(coalesce(c.label,'') || ' ' || coalesce(c.description,''))), q.q_plain) > 0.2
      OR portclos_unaccent(lower(coalesce(c.label,'') || ' ' || coalesce(c.description,''))) % q.q_plain
      OR portclos_unaccent(lower(coalesce(c.label,'') || ' ' || coalesce(c.description,''))) LIKE '%' || q.q_plain || '%'
    )
),
occupation_hits AS (
  SELECT
    'occupation'::text AS type,
    o.id::text AS id,
    CASE
      WHEN nullif(trim(o.note), '') IS NOT NULL THEN o.note
      ELSE to_char(o.start_date, 'DD/MM/YYYY') || ' → ' || to_char(o.end_date, 'DD/MM/YYYY')
    END AS title,
    COALESCE(
      nullif(guests.names, ''),
      to_char(o.start_date, 'DD/MM/YYYY') || ' → ' || to_char(o.end_date, 'DD/MM/YYYY')
    ) AS snippet,
    (
      GREATEST(
        similarity(portclos_unaccent(lower(coalesce(o.note,''))), (SELECT q_plain FROM q)),
        similarity(portclos_unaccent(lower(coalesce(guests.names,''))), (SELECT q_plain FROM q))
      )
      + CASE
          WHEN to_tsvector('french', portclos_unaccent(coalesce(o.note,'') || ' ' || coalesce(guests.names,''))) @@ (SELECT tsq FROM q)
          THEN 0.5 ELSE 0
        END
    )::float8 AS rank
  FROM occupations o
  CROSS JOIN q
  LEFT JOIN LATERAL (
    SELECT string_agg(g.first_name, ', ' ORDER BY g.created_at) AS names
    FROM occupation_guests g
    WHERE g.occupation_id = o.id
  ) guests ON true
  WHERE o.house_id = $1
    AND (
      to_tsvector('french', portclos_unaccent(coalesce(o.note,'') || ' ' || coalesce(guests.names,''))) @@ q.tsq
      OR similarity(portclos_unaccent(lower(coalesce(o.note,''))), q.q_plain) > 0.2
      OR similarity(portclos_unaccent(lower(coalesce(guests.names,''))), q.q_plain) > 0.2
      OR portclos_unaccent(lower(coalesce(o.note,''))) % q.q_plain
      OR portclos_unaccent(lower(coalesce(guests.names,''))) % q.q_plain
      OR portclos_unaccent(lower(coalesce(o.note,''))) LIKE '%' || q.q_plain || '%'
      OR portclos_unaccent(lower(coalesce(guests.names,''))) LIKE '%' || q.q_plain || '%'
    )
)
SELECT type, id, title, snippet, rank
FROM (
  SELECT * FROM help_hits
  UNION ALL
  SELECT * FROM blog_post_hits
  UNION ALL
  SELECT * FROM blog_comment_hits
  UNION ALL
  SELECT * FROM closing_hits
  UNION ALL
  SELECT * FROM occupation_hits
) u
ORDER BY rank DESC, title ASC
LIMIT $3`, houseID, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SearchHit
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.Type, &h.ID, &h.Title, &h.Snippet, &h.Rank); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if out == nil {
		out = []SearchHit{}
	}
	return out, rows.Err()
}
