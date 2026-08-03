package store

import (
	"context"
	"strings"
	"time"
)

type Profile struct {
	Sub         string    `json:"sub"`
	Email       string    `json:"email,omitempty"`
	DisplayName string    `json:"display_name"`
	HasAvatar   bool      `json:"has_avatar"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}

type AvatarFile struct {
	UserSub     string
	StorageKey  string
	ContentType string
	UpdatedAt   time.Time
}

func (s *Store) migrateProfile(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS user_profiles (
  user_sub TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_key TEXT NOT NULL DEFAULT '',
  avatar_content_type TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
`)
	return err
}

func (s *Store) GetOrCreateProfile(ctx context.Context, userSub string) (Profile, error) {
	var p Profile
	err := s.pool.QueryRow(ctx, `
INSERT INTO user_profiles (user_sub)
VALUES ($1)
ON CONFLICT (user_sub) DO UPDATE SET user_sub = EXCLUDED.user_sub
RETURNING user_sub, display_name, email, avatar_key <> '', updated_at`, userSub,
	).Scan(&p.Sub, &p.DisplayName, &p.Email, &p.HasAvatar, &p.UpdatedAt)
	return p, err
}

func (s *Store) UpsertProfileEmail(ctx context.Context, userSub, email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO user_profiles (user_sub, email, updated_at)
VALUES ($1, $2, now())
ON CONFLICT (user_sub) DO UPDATE
SET email = EXCLUDED.email, updated_at = now()
WHERE user_profiles.email IS DISTINCT FROM EXCLUDED.email`, userSub, email)
	return err
}

func (s *Store) UpdateDisplayName(ctx context.Context, userSub, name string) (Profile, error) {
	var p Profile
	err := s.pool.QueryRow(ctx, `
INSERT INTO user_profiles (user_sub, display_name, updated_at)
VALUES ($1, $2, now())
ON CONFLICT (user_sub) DO UPDATE
SET display_name = EXCLUDED.display_name, updated_at = now()
RETURNING user_sub, display_name, email, avatar_key <> '', updated_at`, userSub, name,
	).Scan(&p.Sub, &p.DisplayName, &p.Email, &p.HasAvatar, &p.UpdatedAt)
	return p, err
}

func (s *Store) SetAvatar(ctx context.Context, userSub, key, contentType string) (AvatarFile, Profile, error) {
	var old AvatarFile
	_ = s.pool.QueryRow(ctx, `
SELECT user_sub, avatar_key, avatar_content_type, updated_at
FROM user_profiles WHERE user_sub = $1 AND avatar_key <> ''`, userSub,
	).Scan(&old.UserSub, &old.StorageKey, &old.ContentType, &old.UpdatedAt)

	var p Profile
	err := s.pool.QueryRow(ctx, `
INSERT INTO user_profiles (user_sub, avatar_key, avatar_content_type, updated_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (user_sub) DO UPDATE
SET avatar_key = EXCLUDED.avatar_key,
    avatar_content_type = EXCLUDED.avatar_content_type,
    updated_at = now()
RETURNING user_sub, display_name, email, avatar_key <> '', updated_at`, userSub, key, contentType,
	).Scan(&p.Sub, &p.DisplayName, &p.Email, &p.HasAvatar, &p.UpdatedAt)
	return old, p, err
}

func (s *Store) GetAvatarFile(ctx context.Context, userSub string) (AvatarFile, error) {
	var f AvatarFile
	err := s.pool.QueryRow(ctx, `
SELECT user_sub, avatar_key, avatar_content_type, updated_at
FROM user_profiles WHERE user_sub = $1 AND avatar_key <> ''`, userSub,
	).Scan(&f.UserSub, &f.StorageKey, &f.ContentType, &f.UpdatedAt)
	return f, err
}

func (s *Store) DeleteAvatar(ctx context.Context, userSub string) (AvatarFile, error) {
	f, err := s.GetAvatarFile(ctx, userSub)
	if err != nil {
		return AvatarFile{}, err
	}
	_, err = s.pool.Exec(ctx, `
UPDATE user_profiles
SET avatar_key = '', avatar_content_type = '', updated_at = now()
WHERE user_sub = $1`, userSub)
	return f, err
}

func (s *Store) DisplayNames(ctx context.Context, subs []string) (map[string]string, error) {
	out := map[string]string{}
	if len(subs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT user_sub, display_name FROM user_profiles
WHERE user_sub = ANY($1::text[])`, subs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sub, name string
		if err := rows.Scan(&sub, &name); err != nil {
			return nil, err
		}
		out[sub] = name
	}
	return out, rows.Err()
}
