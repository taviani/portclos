package httpserver

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/store"
)

func mountChantierRoutes(pr chi.Router, db *store.Store) {
	pr.Get("/houses/{id}/chantiers", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListChantiers(r.Context(), houseID)
		if err != nil {
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/chantiers", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Status      string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title_required"}`, http.StatusBadRequest)
			return
		}
		c, err := db.CreateChantier(
			r.Context(),
			houseID,
			user.Subject,
			title,
			strings.TrimSpace(body.Description),
			strings.TrimSpace(body.Status),
		)
		if err != nil {
			if err.Error() == "invalid_chantier_status" {
				http.Error(w, `{"error":"invalid_chantier_status"}`, http.StatusBadRequest)
				return
			}
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		writeJSON(w, http.StatusCreated, c)
	})

	pr.Patch("/chantiers/{chantierId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireChantierMember(w, r, db); !ok {
			return
		}
		var body struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Status      string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title_required"}`, http.StatusBadRequest)
			return
		}
		status := strings.TrimSpace(body.Status)
		if status == "" {
			status = store.ChantierStatusPlanned
		}
		c, err := db.UpdateChantier(
			r.Context(),
			chi.URLParam(r, "chantierId"),
			title,
			strings.TrimSpace(body.Description),
			status,
		)
		if err != nil {
			if err.Error() == "invalid_chantier_status" {
				http.Error(w, `{"error":"invalid_chantier_status"}`, http.StatusBadRequest)
				return
			}
			writeStoreErr(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, c)
	})

	pr.Delete("/chantiers/{chantierId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireChantierMember(w, r, db); !ok {
			return
		}
		if err := db.DeleteChantier(r.Context(), chi.URLParam(r, "chantierId")); err != nil {
			writeStoreErr(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func requireChantierMember(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return auth.User{}, false
	}
	houseID, err := db.GetChantierHouseID(r.Context(), chi.URLParam(r, "chantierId"))
	if err != nil {
		writeStoreErr(w, r, err)
		return auth.User{}, false
	}
	if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
		writeStoreErr(w, r, err)
		return auth.User{}, false
	}
	return user, true
}
