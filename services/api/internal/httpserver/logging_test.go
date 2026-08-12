package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func TestWriteAPIErrorIncludesRequestID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/houses", nil)
	ctx := context.WithValue(req.Context(), middleware.RequestIDKey, "req-test-1")
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	writeAPIError(rr, req, http.StatusBadRequest, "invalid_json", nil)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", rr.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "invalid_json" {
		t.Fatalf("error=%q", body["error"])
	}
	if body["request_id"] != "req-test-1" {
		t.Fatalf("request_id=%q", body["request_id"])
	}
}

func TestExtractHouseID(t *testing.T) {
	got := extractHouseID("/houses/11111111-1111-1111-1111-111111111111/posts")
	want := "11111111-1111-1111-1111-111111111111"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if extractHouseID("/me") != "" {
		t.Fatal("expected empty")
	}
}
