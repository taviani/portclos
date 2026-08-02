package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port         int
	AuthIssuer   string
	AuthDisabled bool
	DatabaseURL  string
	UploadDir    string
}

func Load() (Config, error) {
	port := 8080
	if raw := os.Getenv("PORT"); raw != "" {
		p, err := strconv.Atoi(raw)
		if err != nil {
			return Config{}, fmt.Errorf("PORT: %w", err)
		}
		port = p
	}
	disabled := os.Getenv("AUTH_DISABLED") == "true" || os.Getenv("AUTH_DISABLED") == "1"
	issuer := os.Getenv("AUTH_ISSUER")
	if !disabled && issuer == "" {
		return Config{}, fmt.Errorf("AUTH_ISSUER is required (or set AUTH_DISABLED=true for local only)")
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./data/uploads"
	}
	return Config{
		Port:         port,
		AuthIssuer:   issuer,
		AuthDisabled: disabled,
		DatabaseURL:  dbURL,
		UploadDir:    uploadDir,
	}, nil
}
