package httpserver

import (
	"net/url"
	"testing"
)

func TestBuildHouseInviteURL(t *testing.T) {
	t.Parallel()
	got := buildHouseInviteURL("portclos://house-invite", "tok123")
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme != "portclos" || u.Host != "house-invite" {
		t.Fatalf("unexpected url: %q", got)
	}
	if u.Query().Get("token") != "tok123" {
		t.Fatalf("token missing: %q", got)
	}

	got = buildHouseInviteURL("", "raw")
	u, err = url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("token") != "raw" {
		t.Fatalf("empty base: %q", got)
	}
}
