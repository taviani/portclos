package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/mail"
	"github.com/taviani/portclos/services/api/internal/store"
)

func mountInviteRoutes(pr chi.Router, db *store.Store, mailer mail.Mailer, inviteLinkBase string) {
	pr.Post("/houses/{id}/invites", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		houseID := chi.URLParam(r, "id")
		var body struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		inv, raw, err := db.CreateHouseInvite(r.Context(), houseID, user.Subject, body.Email)
		if err != nil {
			writeInviteErr(w, r, err)
			return
		}
		houseName, err := db.HouseName(r.Context(), houseID)
		if err != nil {
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		acceptURL := buildHouseInviteURL(inviteLinkBase, raw)
		if err := mailer.SendHouseInvite(r.Context(), inv.Email, houseName, acceptURL); err != nil {
			writeAPIError(w, r, http.StatusInternalServerError, "mail_failed", err)
			return
		}
		writeJSON(w, http.StatusCreated, inv)
	})

	pr.Get("/houses/{id}/invites", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		list, err := db.ListPendingHouseInvites(r.Context(), chi.URLParam(r, "id"), user.Subject)
		if err != nil {
			writeInviteErr(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/invites/{inviteId}/revoke", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		err := db.RevokeHouseInvite(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "inviteId"), user.Subject)
		if err != nil {
			writeInviteErr(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Post("/house-invites/accept", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		var body struct {
			Token string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		email := user.Email
		if email == "" {
			if p, err := db.GetOrCreateProfile(r.Context(), user.Subject); err == nil {
				email = p.Email
			}
		}
		h, err := db.AcceptHouseInvite(r.Context(), body.Token, user.Subject, email)
		if err != nil {
			writeInviteErr(w, r, err)
			return
		}
		if user.Email != "" {
			_ = db.UpsertProfileEmail(r.Context(), user.Subject, user.Email)
		}
		writeJSON(w, http.StatusOK, h)
	})

	pr.Delete("/houses/{id}/members/{userSub}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		target := chi.URLParam(r, "userSub")
		// Chi may decode once; keep raw path segment if needed.
		if decoded, err := url.PathUnescape(target); err == nil {
			target = decoded
		}
		err := db.RemoveHouseMember(r.Context(), chi.URLParam(r, "id"), user.Subject, target)
		if err != nil {
			writeInviteErr(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func buildHouseInviteURL(base, rawToken string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		base = "portclos://house-invite"
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" {
		return "portclos://house-invite?token=" + url.QueryEscape(rawToken)
	}
	q := u.Query()
	q.Set("token", rawToken)
	u.RawQuery = q.Encode()
	return u.String()
}

func writeInviteErr(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, store.ErrForbidden):
		writeAPIError(w, r, http.StatusForbidden, "forbidden", nil)
	case errors.Is(err, store.ErrInvalidEmail):
		http.Error(w, `{"error":"invalid_email"}`, http.StatusBadRequest)
	case errors.Is(err, store.ErrAlreadyMember):
		http.Error(w, `{"error":"already_member"}`, http.StatusConflict)
	case errors.Is(err, store.ErrInvitePending):
		http.Error(w, `{"error":"invite_pending"}`, http.StatusConflict)
	case errors.Is(err, store.ErrInviteInvalid):
		http.Error(w, `{"error":"invite_invalid"}`, http.StatusBadRequest)
	case errors.Is(err, store.ErrEmailMismatch):
		http.Error(w, `{"error":"email_mismatch"}`, http.StatusForbidden)
	case errors.Is(err, store.ErrCannotRemoveLastOwner):
		http.Error(w, `{"error":"cannot_remove_last_owner"}`, http.StatusBadRequest)
	case errors.Is(err, pgx.ErrNoRows):
		writeAPIError(w, r, http.StatusNotFound, "not_found", nil)
	default:
		writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
	}
}
