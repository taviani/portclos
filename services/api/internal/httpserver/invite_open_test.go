package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAndroidHouseInviteIntentURL(t *testing.T) {
	t.Parallel()
	got, err := androidHouseInviteIntentURL("portclos://house-invite?token=abc", "com.portclos.app")
	if err != nil {
		t.Fatal(err)
	}
	want := "intent://house-invite?token=abc#Intent;scheme=portclos;package=com.portclos.app;end"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPublicInviteOpenHTMLAndroid(t *testing.T) {
	t.Parallel()
	r := &chiGet{}
	mountPublicInviteOpen(r, "com.portclos.app")

	req := httptest.NewRequest(http.MethodGet, "/house-invite?token=tok", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile")
	rec := httptest.NewRecorder()
	r.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "intent://house-invite?token=tok") {
		t.Fatalf("expected intent link in body: %s", body)
	}
	if !strings.Contains(body, "Ouvrir Portclos") {
		t.Fatalf("expected CTA: %s", body)
	}
}

func TestPublicInviteOpenHTMLiOS(t *testing.T) {
	t.Parallel()
	r := &chiGet{}
	mountPublicInviteOpen(r, "com.portclos.app")

	req := httptest.NewRequest(http.MethodGet, "/house-invite?token=tok", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
	rec := httptest.NewRecorder()
	r.handler.ServeHTTP(rec, req)
	body := rec.Body.String()
	if strings.Contains(body, "intent://") {
		t.Fatalf("ios should not use intent: %s", body)
	}
	if !strings.Contains(body, "portclos://house-invite?token=tok") {
		t.Fatalf("expected deep link: %s", body)
	}
}

type chiGet struct {
	handler http.Handler
}

func (c *chiGet) Get(_ string, h http.HandlerFunc) {
	c.handler = h
}
