package mail

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"html"
	"log/slog"
	"net"
	"net/smtp"
	"strings"
)

type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

// Mailer sends transactional messages.
type Mailer interface {
	SendHouseInvite(ctx context.Context, to, houseName, acceptURL string) error
}

// NewFromConfig returns a log mailer when SMTP_HOST is empty, otherwise SMTP.
func NewFromConfig(cfg Config) (Mailer, error) {
	if strings.TrimSpace(cfg.Host) == "" {
		return LogMailer{}, nil
	}
	return NewSMTPMailer(cfg)
}

// LogMailer writes invites to the process log (local / CI without SMTP).
type LogMailer struct{}

func (LogMailer) SendHouseInvite(_ context.Context, to, houseName, acceptURL string) error {
	slog.Info("house_invite_mail",
		"to", to,
		"house", houseName,
		"accept_url", acceptURL,
	)
	return nil
}

type SMTPMailer struct {
	cfg Config
}

func NewSMTPMailer(cfg Config) (*SMTPMailer, error) {
	if strings.TrimSpace(cfg.Host) == "" {
		return nil, fmt.Errorf("SMTP host is required")
	}
	if strings.TrimSpace(cfg.From) == "" {
		return nil, fmt.Errorf("SMTP from is required")
	}
	if cfg.Port <= 0 {
		cfg.Port = 587
	}
	return &SMTPMailer{cfg: cfg}, nil
}

func (m *SMTPMailer) SendHouseInvite(ctx context.Context, to, houseName, acceptURL string) error {
	subject := fmt.Sprintf("Invitation à la maison %s — Portclos", houseName)
	plain := fmt.Sprintf(
		"Bonjour,\n\n"+
			"Tu es invité(e) à rejoindre la maison « %s » sur Portclos.\n\n"+
			"Ouvre ce lien sur ton téléphone (app Portclos installée) :\n\n%s\n\n"+
			"Puis appuie sur « Ouvrir Portclos » si une page s’affiche.\n\n"+
			"Si tu n’as pas encore de compte, connecte-toi ou crée ton compte Portclos, puis rouvre ce lien.\n\n"+
			"Si tu n’attendais pas cette invitation, ignore ce message. Le lien expire sous 7 jours.\n",
		houseName, acceptURL,
	)
	safeName := html.EscapeString(houseName)
	safeURL := html.EscapeString(acceptURL)
	htmlBody := fmt.Sprintf(
		`<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">`+
			`<p>Bonjour,</p>`+
			`<p>Tu es invité(e) à rejoindre la maison « <strong>%s</strong> » sur Portclos.</p>`+
			`<p><a href="%s" style="display:inline-block;padding:12px 18px;background:#0b3d5c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">`+
			`Ouvrir l’invitation</a></p>`+
			`<p style="color:#555;font-size:14px">Ou copie ce lien&nbsp;:<br><a href="%s">%s</a></p>`+
			`<p style="color:#555;font-size:14px">Si tu n’as pas encore de compte Portclos, connecte-toi ou crée ton compte, puis rouvre ce lien. Expire sous 7 jours.</p>`+
			`</body></html>`,
		safeName, safeURL, safeURL, safeURL,
	)
	return m.send(ctx, to, subject, plain, htmlBody)
}

func (m *SMTPMailer) send(ctx context.Context, to, subject, plain, htmlBody string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	msg := buildMultipartMessage(m.cfg.From, to, subject, plain, htmlBody)
	addr := net.JoinHostPort(m.cfg.Host, fmt.Sprintf("%d", m.cfg.Port))

	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	}

	if m.cfg.Port == 465 {
		return m.sendImplicitTLS(addr, auth, to, msg)
	}
	return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, msg)
}

func (m *SMTPMailer) sendImplicitTLS(addr string, auth smtp.Auth, to string, msg []byte) error {
	tlsCfg := &tls.Config{ServerName: m.cfg.Host}
	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return fmt.Errorf("smtp tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := client.Mail(m.cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func buildMultipartMessage(from, to, subject, plain, htmlBody string) []byte {
	boundary := "portclos_" + randomBoundary()
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + subject + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n")
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(plain)
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(htmlBody)
	b.WriteString("\r\n")
	b.WriteString("--" + boundary + "--\r\n")
	return []byte(b.String())
}

func randomBoundary() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "boundary"
	}
	return hex.EncodeToString(buf)
}
