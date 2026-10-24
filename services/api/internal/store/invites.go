package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const houseInviteTTL = 7 * 24 * time.Hour

var (
	ErrForbidden             = errors.New("forbidden")
	ErrAlreadyMember         = errors.New("already_member")
	ErrInvitePending         = errors.New("invite_pending")
	ErrInviteInvalid         = errors.New("invite_invalid")
	ErrEmailMismatch         = errors.New("email_mismatch")
	ErrCannotRemoveLastOwner = errors.New("cannot_remove_last_owner")
	ErrInvalidEmail          = errors.New("invalid_email")
)

type HouseInvite struct {
	ID         string     `json:"id"`
	HouseID    string     `json:"house_id"`
	Email      string     `json:"email"`
	Role       string     `json:"role"`
	InvitedBy  string     `json:"invited_by"`
	ExpiresAt  time.Time  `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
}

func (s *Store) migrateInvites(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS house_invites (
  id UUID PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member')),
  token_hash TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS house_invites_token_hash_idx
  ON house_invites (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS house_invites_pending_house_email_idx
  ON house_invites (house_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS house_invites_house_pending_idx
  ON house_invites (house_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
`)
	if err != nil {
		return fmt.Errorf("migrate invites: %w", err)
	}
	return nil
}

// NormalizeInviteEmail lowercases and trims. Basic shape check only.
func NormalizeInviteEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" || !strings.Contains(email, "@") || strings.Contains(email, " ") {
		return "", ErrInvalidEmail
	}
	at := strings.IndexByte(email, '@')
	if at < 1 || at == len(email)-1 {
		return "", ErrInvalidEmail
	}
	if len(email) > 254 {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func randomInviteToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func hashInviteToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Store) requireHouseOwner(ctx context.Context, houseID, userSub string) error {
	var role string
	err := s.pool.QueryRow(ctx, `
SELECT role FROM house_members WHERE house_id = $1 AND user_sub = $2`, houseID, userSub,
	).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}
	if role != "owner" {
		return ErrForbidden
	}
	return nil
}

func (s *Store) HouseName(ctx context.Context, houseID string) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx, `SELECT name FROM houses WHERE id = $1`, houseID).Scan(&name)
	return name, err
}

func (s *Store) IsEmailHouseMember(ctx context.Context, houseID, email string) (bool, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
SELECT COUNT(*)::int
FROM house_members m
JOIN user_profiles p ON p.user_sub = m.user_sub
WHERE m.house_id = $1 AND lower(p.email) = $2`, houseID, email,
	).Scan(&n)
	return n > 0, err
}

// CreateHouseInvite creates a pending member invite. Returns the invite (without
// secrets) and the raw one-shot token for the mail / deep link.
func (s *Store) CreateHouseInvite(ctx context.Context, houseID, invitedBy, rawEmail string) (HouseInvite, string, error) {
	email, err := NormalizeInviteEmail(rawEmail)
	if err != nil {
		return HouseInvite{}, "", err
	}
	if err := s.requireHouseOwner(ctx, houseID, invitedBy); err != nil {
		return HouseInvite{}, "", err
	}
	already, err := s.IsEmailHouseMember(ctx, houseID, email)
	if err != nil {
		return HouseInvite{}, "", err
	}
	if already {
		return HouseInvite{}, "", ErrAlreadyMember
	}

	// Free the unique pending slot if a prior invite expired unused.
	_, _ = s.pool.Exec(ctx, `
UPDATE house_invites
SET revoked_at = now()
WHERE house_id = $1
  AND lower(email) = $2
  AND accepted_at IS NULL
  AND revoked_at IS NULL
  AND expires_at <= now()`, houseID, email)

	raw, err := randomInviteToken()
	if err != nil {
		return HouseInvite{}, "", err
	}
	id := uuid.NewString()
	now := time.Now().UTC()
	expires := now.Add(houseInviteTTL)

	var inv HouseInvite
	err = s.pool.QueryRow(ctx, `
INSERT INTO house_invites (id, house_id, email, role, token_hash, invited_by, expires_at, created_at)
VALUES ($1, $2, $3, 'member', $4, $5, $6, $7)
RETURNING id::text, house_id::text, email, role, invited_by, expires_at, created_at`,
		id, houseID, email, hashInviteToken(raw), invitedBy, expires, now,
	).Scan(&inv.ID, &inv.HouseID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return HouseInvite{}, "", ErrInvitePending
		}
		return HouseInvite{}, "", err
	}
	return inv, raw, nil
}

func (s *Store) ListPendingHouseInvites(ctx context.Context, houseID, userSub string) ([]HouseInvite, error) {
	if err := s.requireHouseOwner(ctx, houseID, userSub); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, house_id::text, email, role, invited_by, expires_at, created_at
FROM house_invites
WHERE house_id = $1
  AND accepted_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > now()
ORDER BY created_at DESC`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []HouseInvite
	for rows.Next() {
		var inv HouseInvite
		if err := rows.Scan(&inv.ID, &inv.HouseID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	if out == nil {
		out = []HouseInvite{}
	}
	return out, rows.Err()
}

func (s *Store) RevokeHouseInvite(ctx context.Context, houseID, inviteID, userSub string) error {
	if err := s.requireHouseOwner(ctx, houseID, userSub); err != nil {
		return err
	}
	tag, err := s.pool.Exec(ctx, `
UPDATE house_invites
SET revoked_at = now()
WHERE id = $1
  AND house_id = $2
  AND accepted_at IS NULL
  AND revoked_at IS NULL`, inviteID, houseID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// AcceptHouseInvite attaches the authenticated user to the house. acceptorEmail
// must match the invite email (JWT / profile).
func (s *Store) AcceptHouseInvite(ctx context.Context, rawToken, userSub, acceptorEmail string) (House, error) {
	email, err := NormalizeInviteEmail(acceptorEmail)
	if err != nil {
		return House{}, ErrEmailMismatch
	}
	token := strings.TrimSpace(rawToken)
	if token == "" {
		return House{}, ErrInviteInvalid
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return House{}, err
	}
	defer tx.Rollback(ctx)

	var inv struct {
		ID       string
		HouseID  string
		Email    string
		Expired  bool
		Revoked  bool
		Accepted bool
	}
	err = tx.QueryRow(ctx, `
SELECT id::text, house_id::text, email,
  expires_at <= now(),
  revoked_at IS NOT NULL,
  accepted_at IS NOT NULL
FROM house_invites
WHERE token_hash = $1
FOR UPDATE`, hashInviteToken(token),
	).Scan(&inv.ID, &inv.HouseID, &inv.Email, &inv.Expired, &inv.Revoked, &inv.Accepted)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return House{}, ErrInviteInvalid
		}
		return House{}, err
	}
	if inv.Expired || inv.Revoked || inv.Accepted {
		return House{}, ErrInviteInvalid
	}
	if inv.Email != email {
		return House{}, ErrEmailMismatch
	}

	var already bool
	err = tx.QueryRow(ctx, `
SELECT EXISTS(
  SELECT 1 FROM house_members WHERE house_id = $1 AND user_sub = $2
)`, inv.HouseID, userSub).Scan(&already)
	if err != nil {
		return House{}, err
	}
	if already {
		_, _ = tx.Exec(ctx, `
UPDATE house_invites SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL`, inv.ID)
		if err := tx.Commit(ctx); err != nil {
			return House{}, err
		}
		return s.GetHouseForMember(ctx, inv.HouseID, userSub)
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO house_members (house_id, user_sub, role)
VALUES ($1, $2, 'member')`, inv.HouseID, userSub); err != nil {
		return House{}, err
	}
	if _, err := tx.Exec(ctx, `
UPDATE house_invites SET accepted_at = now() WHERE id = $1`, inv.ID); err != nil {
		return House{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return House{}, err
	}
	return s.GetHouseForMember(ctx, inv.HouseID, userSub)
}

func (s *Store) RemoveHouseMember(ctx context.Context, houseID, actorSub, targetSub string) error {
	if err := s.requireHouseOwner(ctx, houseID, actorSub); err != nil {
		return err
	}
	var targetRole string
	err := s.pool.QueryRow(ctx, `
SELECT role FROM house_members WHERE house_id = $1 AND user_sub = $2`, houseID, targetSub,
	).Scan(&targetRole)
	if err != nil {
		return err
	}
	if targetRole == "owner" {
		var owners int
		if err := s.pool.QueryRow(ctx, `
SELECT COUNT(*)::int FROM house_members
WHERE house_id = $1 AND role = 'owner'`, houseID).Scan(&owners); err != nil {
			return err
		}
		if owners <= 1 {
			return ErrCannotRemoveLastOwner
		}
	}
	tag, err := s.pool.Exec(ctx, `
DELETE FROM house_members WHERE house_id = $1 AND user_sub = $2`, houseID, targetSub)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}
