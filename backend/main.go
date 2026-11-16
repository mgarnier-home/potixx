package main

import (
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/mgarnier-home/utils/buildinfo"
	"github.com/mgarnier-home/utils/version"

	"github.com/mgarnier-home/potixx/backend/predictions"
)

//go:embed all:web/browser
var web embed.FS

func main() {
	cfg := loadConfig(os.Getenv)
	front, err := fs.Sub(web, "web/browser")
	if err != nil {
		slog.Error("front embarqué introuvable", "err", err)
		os.Exit(1)
	}
	store, err := predictions.Open(cfg.DataPath)
	if err != nil {
		slog.Error("lecture des pronostics", "path", cfg.DataPath, "err", err)
		os.Exit(1)
	}
	if cfg.AdminPassword == "" {
		slog.Warn("POTIXX_ADMIN_PASSWORD vide : la page admin est désactivée")
	}

	mux := http.NewServeMux()
	mux.Handle("GET /version", version.Handler())
	(&predictions.Handlers{Store: store, AdminPassword: cfg.AdminPassword, Now: time.Now}).Register(mux)
	mux.Handle("/", spaHandler(front))

	slog.Info("écoute", "port", cfg.Port, "version", buildinfo.Get().Version)
	if err := newHTTPServer(":"+cfg.Port, securityHeaders(mux)).ListenAndServe(); err != nil {
		slog.Error("serveur arrêté", "err", err)
		os.Exit(1)
	}
}

// newHTTPServer borne chaque étape d'une connexion : un client lent (corps envoyé octet par
// octet) ne peut pas garder des connexions ouvertes indéfiniment.
func newHTTPServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
