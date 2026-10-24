package store

import "testing"

func TestNormalizeInviteEmail(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"  Alice@Example.COM ", "alice@example.com", false},
		{"", "", true},
		{"no-at", "", true},
		{"@missing-local", "", true},
		{"missing-domain@", "", true},
		{"has space@ex.com", "", true},
	}
	for _, tc := range cases {
		got, err := NormalizeInviteEmail(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Fatalf("%q: expected error", tc.in)
			}
			continue
		}
		if err != nil {
			t.Fatalf("%q: unexpected error: %v", tc.in, err)
		}
		if got != tc.want {
			t.Fatalf("%q: got %q want %q", tc.in, got, tc.want)
		}
	}
}

func TestHashInviteTokenStable(t *testing.T) {
	t.Parallel()
	a := hashInviteToken("abc")
	b := hashInviteToken("abc")
	if a != b || a == "" {
		t.Fatalf("hash not stable: %q %q", a, b)
	}
	if hashInviteToken("abc") == hashInviteToken("abd") {
		t.Fatal("different tokens must not collide")
	}
}
