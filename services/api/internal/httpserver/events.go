package httpserver

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/store"
)

var allowedClientKinds = map[string]bool{
	"error":  true,
	"screen": true,
	"action": true,
}

func mountEventRoutes(pr chi.Router, db *store.Store) {
	pr.Post("/client-events", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
			return
		}
		var body struct {
			Kind       string          `json:"kind"`
			Name       string          `json:"name"`
			Message    string          `json:"message"`
			Meta       json.RawMessage `json:"meta"`
			AppVersion string          `json:"app_version"`
			Platform   string          `json:"platform"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		kind := strings.ToLower(strings.TrimSpace(body.Kind))
		if !allowedClientKinds[kind] {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_kind", nil)
			return
		}
		name := strings.TrimSpace(body.Name)
		if name == "" || utf8.RuneCountInString(name) > 120 {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_name", nil)
			return
		}
		msg := strings.TrimSpace(body.Message)
		if utf8.RuneCountInString(msg) > 2000 {
			msg = string([]rune(msg)[:2000])
		}
		meta := body.Meta
		if len(meta) == 0 {
			meta = json.RawMessage(`{}`)
		} else if !json.Valid(meta) {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_meta", nil)
			return
		} else if len(meta) > 4096 {
			writeAPIError(w, r, http.StatusBadRequest, "meta_too_large", nil)
			return
		}
		appVersion := strings.TrimSpace(body.AppVersion)
		if utf8.RuneCountInString(appVersion) > 64 {
			appVersion = string([]rune(appVersion)[:64])
		}
		platform := strings.TrimSpace(body.Platform)
		if utf8.RuneCountInString(platform) > 32 {
			platform = string([]rune(platform)[:32])
		}

		ev, err := db.InsertClientEvent(r.Context(), store.ClientEvent{
			UserSub:    user.Subject,
			Kind:       kind,
			Name:       name,
			Message:    msg,
			Meta:       meta,
			AppVersion: appVersion,
			Platform:   platform,
		})
		if err != nil {
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":         ev.ID,
			"created_at": ev.CreatedAt,
		})
	})
}
