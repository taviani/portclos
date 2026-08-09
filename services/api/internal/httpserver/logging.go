package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/store"
)

var houseIDInPath = regexp.MustCompile(`(?i)/houses/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`)

// accessAndUsage logs structured access lines and persists usage_events (best-effort).
func accessAndUsage(db *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)

			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}
			dur := time.Since(start)
			reqID := middleware.GetReqID(r.Context())
			userSub := ""
			if u, ok := auth.UserFromContext(r.Context()); ok {
				userSub = u.Subject
			}
			route := ""
			if rc := chi.RouteContext(r.Context()); rc != nil {
				route = rc.RoutePattern()
			}
			path := r.URL.Path
			houseID := extractHouseID(path)

			attrs := []any{
				"request_id", reqID,
				"method", r.Method,
				"path", path,
				"route", route,
				"status", status,
				"duration_ms", dur.Milliseconds(),
				"bytes", ww.BytesWritten(),
			}
			if userSub != "" {
				attrs = append(attrs, "user_sub", userSub)
			}
			if houseID != "" {
				attrs = append(attrs, "house_id", houseID)
			}

			switch {
			case status >= 500:
				slog.Error("http_request", attrs...)
			case status >= 400:
				slog.Warn("http_request", attrs...)
			case path == "/health":
				slog.Debug("http_request", attrs...)
			default:
				slog.Info("http_request", attrs...)
			}

			if db == nil || path == "/health" {
				return
			}
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				if err := db.InsertUsageEvent(ctx, store.UsageEvent{
					RequestID:  reqID,
					UserSub:    userSub,
					Method:     r.Method,
					Path:       path,
					Route:      route,
					Status:     status,
					DurationMs: int(dur.Milliseconds()),
					HouseID:    houseID,
				}); err != nil {
					slog.Warn("usage_event_persist_failed", "error", err, "request_id", reqID)
				}
			}()
		})
	}
}

func extractHouseID(path string) string {
	m := houseIDInPath.FindStringSubmatch(path)
	if len(m) < 2 {
		return ""
	}
	return m[1]
}

func recoverJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic",
					"recover", rec,
					"request_id", middleware.GetReqID(r.Context()),
					"method", r.Method,
					"path", r.URL.Path,
				)
				writeAPIError(w, r, http.StatusInternalServerError, "internal", nil)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// writeAPIError returns {"error":"<code>","request_id":"..."} and logs 5xx causes.
func writeAPIError(w http.ResponseWriter, r *http.Request, status int, code string, cause error) {
	reqID := ""
	if r != nil {
		reqID = middleware.GetReqID(r.Context())
	}
	if status >= 500 {
		attrs := []any{
			"code", code,
			"request_id", reqID,
		}
		if r != nil {
			attrs = append(attrs, "method", r.Method, "path", r.URL.Path)
		}
		if cause != nil {
			attrs = append(attrs, "error", cause.Error())
		}
		slog.Error("api_error", attrs...)
	}
	body := map[string]string{"error": code}
	if reqID != "" {
		body["request_id"] = reqID
	}
	writeJSON(w, status, body)
}

func writeStoreErr(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		writeAPIError(w, r, http.StatusNotFound, "not_found", nil)
		return
	}
	writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
}

func writeClosingItemErr(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeAPIError(w, r, http.StatusNotFound, "not_found", nil)
	case errors.Is(err, store.ErrClosingNotOpen):
		writeAPIError(w, r, http.StatusConflict, "closing_not_open", nil)
	case errors.Is(err, store.ErrSkipRequired):
		writeAPIError(w, r, http.StatusBadRequest, "cannot_skip_required", nil)
	case errors.Is(err, store.ErrRequiredPending):
		writeAPIError(w, r, http.StatusBadRequest, "required_pending", nil)
	case err != nil && err.Error() == "invalid status":
		writeAPIError(w, r, http.StatusBadRequest, "invalid_status", nil)
	default:
		writeAPIError(w, r, http.StatusInternalServerError, "internal", err)
	}
}
