package httpserver

import (
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"
)

const androidPackageDefault = "com.portclos.app"

// mountPublicInviteOpen serves an HTTPS landing page so email clients (esp. Android)
// can open the app via intent:// instead of a bare portclos:// deep link.
func mountPublicInviteOpen(r chiRouter, androidPackage string) {
	if androidPackage == "" {
		androidPackage = androidPackageDefault
	}
	pkg := androidPackage
	r.Get("/house-invite", func(w http.ResponseWriter, req *http.Request) {
		token := strings.TrimSpace(req.URL.Query().Get("token"))
		if token == "" {
			http.Error(w, "missing token", http.StatusBadRequest)
			return
		}
		deep := "portclos://house-invite?token=" + url.QueryEscape(token)
		openURL := deep
		if isAndroidUserAgent(req.UserAgent()) {
			if intent, err := androidHouseInviteIntentURL(deep, pkg); err == nil {
				openURL = intent
			}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, inviteOpenHTML,
			html.EscapeString(openURL),
			html.EscapeString(deep),
		)
	})
}

// chiRouter is the tiny surface we need from chi (avoids importing twice in tests).
type chiRouter interface {
	Get(pattern string, handlerFn http.HandlerFunc)
}

func isAndroidUserAgent(userAgent string) bool {
	return strings.Contains(strings.ToLower(userAgent), "android")
}

// androidHouseInviteIntentURL turns portclos://house-invite?… into an intent:// link.
func androidHouseInviteIntentURL(customRedirect, androidPackage string) (string, error) {
	if androidPackage == "" {
		return customRedirect, nil
	}
	u, err := url.Parse(customRedirect)
	if err != nil {
		return "", err
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme == "" || scheme == "http" || scheme == "https" {
		return customRedirect, nil
	}
	var target strings.Builder
	target.WriteString("intent://")
	if u.Host != "" {
		target.WriteString(u.Host)
	}
	target.WriteString(u.Path)
	if u.RawQuery != "" {
		target.WriteString("?")
		target.WriteString(u.RawQuery)
	}
	target.WriteString(fmt.Sprintf("#Intent;scheme=%s;package=%s;end", u.Scheme, androidPackage))
	return target.String(), nil
}

const inviteOpenHTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Portclos — invitation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #555; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
    a.btn {
      display: inline-block;
      padding: 0.75rem 1.25rem;
      background: #0b3d5c;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
    }
    a.btn:active { opacity: 0.9; }
    .alt { margin-top: 1.5rem; font-size: 0.85rem; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Invitation Portclos</h1>
  <p>Ouvre l’application pour accepter l’invitation à la maison.</p>
  <p><a class="btn" href="%s">Ouvrir Portclos</a></p>
  <p class="alt">Si le bouton ne marche pas, ouvre Portclos puis le lien&nbsp;:<br>%s</p>
</body>
</html>
`
