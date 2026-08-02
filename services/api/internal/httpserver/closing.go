package httpserver

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/media"
	"github.com/taviani/portclos/services/api/internal/store"
)

const maxPhotoBytes = 8 << 20

func mountClosingRoutes(pr chi.Router, db *store.Store, files *media.Store) {
	pr.Get("/houses/{id}/closing-checklist/items", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListChecklistItems(r.Context(), houseID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/closing-checklist/items", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Label         string `json:"label"`
			Optional      bool   `json:"optional"`
			RequiresPhoto bool   `json:"requires_photo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		label := strings.TrimSpace(body.Label)
		if label == "" {
			http.Error(w, `{"error":"label_required"}`, http.StatusBadRequest)
			return
		}
		order, err := db.NextChecklistSortOrder(r.Context(), houseID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		it, err := db.CreateChecklistItem(r.Context(), houseID, label, body.Optional, body.RequiresPhoto, order)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, it)
	})

	pr.Patch("/closing-checklist/items/{itemId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		itemID := chi.URLParam(r, "itemId")
		houseID, err := db.GetChecklistItemHouseID(r.Context(), itemID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		var body struct {
			Label         string `json:"label"`
			Optional      bool   `json:"optional"`
			RequiresPhoto bool   `json:"requires_photo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		label := strings.TrimSpace(body.Label)
		if label == "" {
			http.Error(w, `{"error":"label_required"}`, http.StatusBadRequest)
			return
		}
		it, err := db.UpdateChecklistItem(r.Context(), itemID, houseID, label, body.Optional, body.RequiresPhoto)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, it)
	})

	pr.Delete("/closing-checklist/items/{itemId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		itemID := chi.URLParam(r, "itemId")
		houseID, err := db.GetChecklistItemHouseID(r.Context(), itemID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		if err := db.DeleteChecklistItem(r.Context(), itemID, houseID); err != nil {
			writeStoreErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Get("/houses/{id}/closings", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListClosings(r.Context(), houseID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/closings", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		detail, err := db.StartClosing(r.Context(), houseID, user.Subject)
		if err != nil {
			if errors.Is(err, store.ErrClosingAlreadyOpen) {
				http.Error(w, `{"error":"closing_already_open"}`, http.StatusConflict)
				return
			}
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, detail)
	})

	pr.Get("/closings/{closingId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireClosingMember(w, r, db); !ok {
			return
		}
		detail, err := db.GetClosingDetail(r.Context(), chi.URLParam(r, "closingId"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	pr.Patch("/closings/{closingId}/items/{itemId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireClosingMember(w, r, db); !ok {
			return
		}
		var body struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		it, err := db.UpdateClosingItemStatus(
			r.Context(),
			chi.URLParam(r, "closingId"),
			chi.URLParam(r, "itemId"),
			strings.TrimSpace(body.Status),
		)
		if err != nil {
			writeClosingItemErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, it)
	})

	pr.Post("/closings/{closingId}/complete", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireClosingMember(w, r, db); !ok {
			return
		}
		detail, err := db.CompleteClosing(r.Context(), chi.URLParam(r, "closingId"))
		if err != nil {
			writeClosingItemErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	pr.Post("/closings/{closingId}/items/{itemId}/photos", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireClosingMember(w, r, db)
		if !ok {
			return
		}
		closingID := chi.URLParam(r, "closingId")
		itemID := chi.URLParam(r, "itemId")
		_, status, err := db.GetClosingItemMeta(r.Context(), closingID, itemID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if status != "open" {
			http.Error(w, `{"error":"closing_not_open"}`, http.StatusConflict)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxPhotoBytes+1024)
		if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
			http.Error(w, `{"error":"invalid_multipart"}`, http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("photo")
		if err != nil {
			http.Error(w, `{"error":"photo_required"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		contentType := header.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		if !strings.HasPrefix(contentType, "image/") {
			http.Error(w, `{"error":"invalid_content_type"}`, http.StatusBadRequest)
			return
		}

		buf, err := io.ReadAll(io.LimitReader(file, maxPhotoBytes+1))
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		if len(buf) > maxPhotoBytes {
			http.Error(w, `{"error":"photo_too_large"}`, http.StatusRequestEntityTooLarge)
			return
		}

		photoID := uuid.NewString()
		key := "closings/" + photoID + media.ExtForContentType(contentType)
		if err := files.Save(key, bytes.NewReader(buf)); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		p, err := db.AddClosingItemPhoto(r.Context(), closingID, itemID, user.Subject, key, contentType)
		if err != nil {
			_ = files.Remove(key)
			writeClosingItemErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, p)
	})

	pr.Get("/closing-photos/{photoId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		photoID := chi.URLParam(r, "photoId")
		meta, err := db.GetClosingPhotoFile(r.Context(), photoID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), meta.HouseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		f, err := files.Open(meta.StorageKey)
		if err != nil {
			http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", meta.ContentType)
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeContent(w, r, photoID, meta.CreatedAt, f)
	})

	pr.Delete("/closing-photos/{photoId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		photoID := chi.URLParam(r, "photoId")
		meta, err := db.GetClosingPhotoFile(r.Context(), photoID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), meta.HouseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		deleted, err := db.DeleteClosingPhoto(r.Context(), photoID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		_ = files.Remove(deleted.StorageKey)
		w.WriteHeader(http.StatusNoContent)
	})
}

func memberHouse(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, string, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return auth.User{}, "", false
	}
	houseID := chi.URLParam(r, "id")
	if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
		writeStoreErr(w, err)
		return auth.User{}, "", false
	}
	return user, houseID, true
}

func requireClosingMember(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return auth.User{}, false
	}
	houseID, err := db.GetClosingHouseID(r.Context(), chi.URLParam(r, "closingId"))
	if err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	return user, true
}

func writeStoreErr(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
}

func writeClosingItemErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
	case errors.Is(err, store.ErrClosingNotOpen):
		http.Error(w, `{"error":"closing_not_open"}`, http.StatusConflict)
	case errors.Is(err, store.ErrSkipRequired):
		http.Error(w, `{"error":"cannot_skip_required"}`, http.StatusBadRequest)
	case errors.Is(err, store.ErrPhotoRequired):
		http.Error(w, `{"error":"photo_required"}`, http.StatusBadRequest)
	case errors.Is(err, store.ErrRequiredPending):
		http.Error(w, `{"error":"required_pending"}`, http.StatusBadRequest)
	case err != nil && err.Error() == "invalid status":
		http.Error(w, `{"error":"invalid_status"}`, http.StatusBadRequest)
	default:
		http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
	}
}
