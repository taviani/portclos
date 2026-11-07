package httpserver

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/store"
)

func mountInventoryRoutes(pr chi.Router, db *store.Store) {
	pr.Get("/houses/{id}/inventory", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListInventoryItems(r.Context(), houseID)
		if err != nil {
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/inventory", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Label    string `json:"label"`
			Kind     string `json:"kind"`
			Priority bool   `json:"priority"`
			Note     string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		label := strings.TrimSpace(body.Label)
		if label == "" {
			http.Error(w, `{"error":"label_required"}`, http.StatusBadRequest)
			return
		}
		kind := strings.TrimSpace(body.Kind)
		if kind == "" {
			kind = store.InventoryKindStock
		}
		it, err := db.CreateInventoryItem(
			r.Context(), houseID, user.Subject, label, kind, strings.TrimSpace(body.Note), body.Priority,
		)
		if err != nil {
			if err.Error() == "invalid_inventory_kind" {
				http.Error(w, `{"error":"invalid_inventory_kind"}`, http.StatusBadRequest)
				return
			}
			writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
			return
		}
		writeJSON(w, http.StatusCreated, it)
	})

	pr.Patch("/inventory/{itemId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireInventoryMember(w, r, db); !ok {
			return
		}
		var body struct {
			Label    string `json:"label"`
			Kind     string `json:"kind"`
			Priority bool   `json:"priority"`
			Note     string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAPIError(w, r, http.StatusBadRequest, "invalid_json", nil)
			return
		}
		label := strings.TrimSpace(body.Label)
		if label == "" {
			http.Error(w, `{"error":"label_required"}`, http.StatusBadRequest)
			return
		}
		kind := strings.TrimSpace(body.Kind)
		if kind == "" {
			kind = store.InventoryKindStock
		}
		it, err := db.UpdateInventoryItem(
			r.Context(), chi.URLParam(r, "itemId"), label, kind, strings.TrimSpace(body.Note), body.Priority,
		)
		if err != nil {
			if err.Error() == "invalid_inventory_kind" {
				http.Error(w, `{"error":"invalid_inventory_kind"}`, http.StatusBadRequest)
				return
			}
			writeStoreErr(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, it)
	})

	pr.Delete("/inventory/{itemId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireInventoryMember(w, r, db); !ok {
			return
		}
		if err := db.DeleteInventoryItem(r.Context(), chi.URLParam(r, "itemId")); err != nil {
			writeStoreErr(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func requireInventoryMember(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeAPIError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return auth.User{}, false
	}
	houseID, err := db.GetInventoryHouseID(r.Context(), chi.URLParam(r, "itemId"))
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
