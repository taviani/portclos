package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userKey contextKey = "auth.user"

type User struct {
	Subject string
	Email   string
}

type Validator struct {
	issuer   string
	disabled bool
	jwks     keyfunc.Keyfunc
}

func NewValidator(ctx context.Context, issuer string, disabled bool) (*Validator, error) {
	v := &Validator{issuer: issuer, disabled: disabled}
	if disabled {
		return v, nil
	}
	jwksURL := strings.TrimRight(issuer, "/") + "/jwks"
	jwks, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("jwks: %w", err)
	}
	v.jwks = jwks
	return v, nil
}

func (v *Validator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if v.disabled {
			ctx := context.WithValue(r.Context(), userKey, User{
				Subject: "dev-user",
				Email:   "dev@localhost",
			})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		raw := bearerToken(r.Header.Get("Authorization"))
		if raw == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		token, err := jwt.Parse(raw, v.jwks.Keyfunc,
			jwt.WithIssuer(v.issuer),
			jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
			jwt.WithExpirationRequired(),
			jwt.WithLeeway(30*time.Second),
		)
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		sub, _ := claims.GetSubject()
		if sub == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		email, _ := claims["email"].(string)
		ctx := context.WithValue(r.Context(), userKey, User{Subject: sub, Email: email})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(userKey).(User)
	return u, ok
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(header[len(prefix):])
}
