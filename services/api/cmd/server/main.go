package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/taviani/portclos/services/api/internal/applog"
	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/config"
	"github.com/taviani/portclos/services/api/internal/httpserver"
	"github.com/taviani/portclos/services/api/internal/media"
	"github.com/taviani/portclos/services/api/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// Logger not ready yet — stderr is fine for fatal boot errors.
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}
	applog.Setup(cfg.LogLevel)

	ctx := context.Background()
	validator, err := auth.NewValidator(ctx, cfg.AuthIssuer, cfg.AuthDisabled)
	if err != nil {
		slog.Error("auth_init_failed", "error", err)
		os.Exit(1)
	}
	if cfg.AuthDisabled {
		slog.Warn("auth_disabled", "msg", "JWT checks are off")
	}

	db, err := store.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("store_init_failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	files, err := media.New(cfg.UploadDir)
	if err != nil {
		slog.Error("media_init_failed", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      httpserver.NewRouter(validator, db, files),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server_failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown_failed", "error", err)
		os.Exit(1)
	}
	slog.Info("shutdown_complete")
}
