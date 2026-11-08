package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSPreflightAllowedOrigin(t *testing.T) {
	t.Parallel()
	h := corsMiddleware([]string{"http://localhost:8082"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodOptions, "/houses", nil)
	req.Header.Set("Origin", "http://localhost:8082")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:8082" {
		t.Fatalf("ACA-Origin %q", got)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	t.Parallel()
	h := corsMiddleware([]string{"http://localhost:8082"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/houses", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("should not reflect unknown origin")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
}
