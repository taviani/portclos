package mail

import (
	"strings"
	"testing"
)

func TestBuildMultipartMessageHasClickableHTML(t *testing.T) {
	t.Parallel()
	msg := string(buildMultipartMessage(
		"noreply@example.com",
		"soeur@example.com",
		"Invitation",
		"plain https://api.example.com/house-invite?token=abc",
		`<a href="https://api.example.com/house-invite?token=abc">Ouvrir l’invitation</a>`,
	))
	if !strings.Contains(msg, "Content-Type: multipart/alternative") {
		t.Fatal("expected multipart")
	}
	if !strings.Contains(msg, `href="https://api.example.com/house-invite?token=abc"`) {
		t.Fatalf("expected clickable href: %s", msg)
	}
	if !strings.Contains(msg, "text/html") {
		t.Fatal("expected html part")
	}
}
