package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/media"
	"github.com/taviani/portclos/services/api/internal/store"
)

func NewRouter(validator *auth.Validator, db *store.Store, files *media.Store) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Group(func(pr chi.Router) {
		pr.Use(validator.Middleware)
		mountCommunityRoutes(pr, db, files)

		pr.Get("/houses", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			list, err := db.ListHouses(r.Context(), user.Subject)
			if err != nil {
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, list)
		})

		pr.Post("/houses", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			var body struct {
				Name string `json:"name"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
				return
			}
			name := strings.TrimSpace(body.Name)
			if name == "" {
				http.Error(w, `{"error":"name_required"}`, http.StatusBadRequest)
				return
			}
			h, err := db.CreateHouse(r.Context(), user.Subject, name)
			if err != nil {
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusCreated, h)
		})

		pr.Get("/houses/{id}", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			id := chi.URLParam(r, "id")
			h, err := db.GetHouseForMember(r.Context(), id, user.Subject)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, h)
		})

		pr.Patch("/houses/{id}", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			houseID := chi.URLParam(r, "id")
			var body struct {
				BedCapacity *int    `json:"bed_capacity"`
				SingleBeds  *int    `json:"single_beds"`
				DoubleBeds  *int    `json:"double_beds"`
				Address     *string `json:"address"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
				return
			}
			if body.BedCapacity == nil && body.Address == nil && body.SingleBeds == nil && body.DoubleBeds == nil {
				http.Error(w, `{"error":"empty_patch"}`, http.StatusBadRequest)
				return
			}
			h, err := db.UpdateHouse(r.Context(), houseID, user.Subject, store.HousePatch{
				BedCapacity: body.BedCapacity,
				SingleBeds:  body.SingleBeds,
				DoubleBeds:  body.DoubleBeds,
				Address:     body.Address,
			})
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				if err.Error() == "forbidden" {
					http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
					return
				}
				if err.Error() == "capacity_too_high" {
					http.Error(w, `{"error":"capacity_too_high"}`, http.StatusBadRequest)
					return
				}
				if err.Error() == "address_too_long" {
					http.Error(w, `{"error":"address_too_long"}`, http.StatusBadRequest)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, h)
		})

		pr.Get("/houses/{id}/search", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			houseID := chi.URLParam(r, "id")
			if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			q := strings.TrimSpace(r.URL.Query().Get("q"))
			hits, err := db.SearchHouse(r.Context(), houseID, q, 20)
			if err != nil {
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, hits)
		})

		pr.Get("/houses/{id}/occupations", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			houseID := chi.URLParam(r, "id")
			house, err := db.GetHouseForMember(r.Context(), houseID, user.Subject)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			from, to, err := parseDateRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
			if err != nil {
				http.Error(w, `{"error":"invalid_range"}`, http.StatusBadRequest)
				return
			}
			list, err := db.ListOccupations(r.Context(), houseID, from, to)
			if err != nil {
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			loads, err := db.DayLoads(r.Context(), houseID, from, to)
			if err != nil {
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"occupations":   list,
				"bed_capacity":  house.BedCapacity,
				"single_beds":   house.SingleBeds,
				"double_beds":   house.DoubleBeds,
				"day_loads":     loads,
			})
		})

		pr.Post("/houses/{id}/occupations", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			houseID := chi.URLParam(r, "id")
			if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			var body struct {
				StartDate string `json:"start_date"`
				EndDate   string `json:"end_date"`
				Note      string `json:"note"`
				Guests    []struct {
					FirstName string `json:"first_name"`
					Relation  string `json:"relation"`
					Room      string `json:"room"`
					ShareWith string `json:"share_with"`
				} `json:"guests"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
				return
			}
			start, end, err := parseDateRange(body.StartDate, body.EndDate)
			if err != nil {
				http.Error(w, `{"error":"invalid_range"}`, http.StatusBadRequest)
				return
			}
			guests := make([]store.OccupationGuest, 0, len(body.Guests))
			for _, g := range body.Guests {
				name := strings.TrimSpace(g.FirstName)
				if name == "" {
					http.Error(w, `{"error":"guest_name_required"}`, http.StatusBadRequest)
					return
				}
				rel, err := store.NormalizeGuestRelation(strings.TrimSpace(g.Relation))
				if err != nil {
					http.Error(w, `{"error":"invalid_relation"}`, http.StatusBadRequest)
					return
				}
				guests = append(guests, store.OccupationGuest{
					FirstName: name,
					Relation:  rel,
					Room:      g.Room,
					ShareWith: g.ShareWith,
				})
			}
			if len(guests) > 30 {
				http.Error(w, `{"error":"too_many_guests"}`, http.StatusBadRequest)
				return
			}
			o, warning, err := db.CreateOccupationWithGuests(
				r.Context(), houseID, user.Subject, start, end, strings.TrimSpace(body.Note), guests,
			)
			if err != nil {
				switch err.Error() {
				case "too_many_host_shares", "too_many_double_shares":
					http.Error(w, `{"error":"too_many_host_shares"}`, http.StatusBadRequest)
					return
				case "invalid_guest_pair", "invalid_share_with", "invalid_room":
					http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{
				"occupation":       o,
				"capacity_warning": warning,
			})
		})

		pr.Delete("/occupations/{id}", func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			id := chi.URLParam(r, "id")
			if err := db.DeleteOccupation(r.Context(), id, user.Subject); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
					return
				}
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		})

		mountClosingRoutes(pr, db, files)
	})

	return r
}

func parseDateRange(fromRaw, toRaw string) (time.Time, time.Time, error) {
	fromRaw = strings.TrimSpace(fromRaw)
	toRaw = strings.TrimSpace(toRaw)
	if fromRaw == "" || toRaw == "" {
		return time.Time{}, time.Time{}, errInvalidRange
	}
	from, err := time.Parse("2006-01-02", fromRaw)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to, err := time.Parse("2006-01-02", toRaw)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, errInvalidRange
	}
	return from, to, nil
}

var errInvalidRange = errors.New("invalid range")

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
