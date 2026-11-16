package predictions

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

// maxBodyBytes borne le corps d'un envoi : un pronostic valide tient largement dans 4 Ko.
const maxBodyBytes = 4096

// Handlers expose l'API des pronostics.
type Handlers struct {
	Store         *Store
	AdminPassword string
	Now           func() time.Time
}

// Register monte les routes /api sur mux, avec un repli JSON pour toute route /api inconnue.
func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/predictions", h.create)
	mux.HandleFunc("GET /api/admin/predictions", h.requireAdmin(h.list))
	mux.HandleFunc("DELETE /api/admin/predictions/{id}", h.requireAdmin(h.remove))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "Route inconnue.")
	})
}

func (h *Handlers) create(w http.ResponseWriter, r *http.Request) {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	var in Input
	if err := dec.Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "Pronostic invalide.")
		return
	}
	in = in.Normalize()
	if err := in.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	p, err := h.Store.Add(in, h.Now())
	switch {
	case errors.Is(err, ErrFull):
		writeError(w, http.StatusInsufficientStorage, "Trop de pronostics enregistrés.")
	case err != nil:
		slog.Error("enregistrement d'un pronostic", "err", err)
		writeError(w, http.StatusInternalServerError, "Enregistrement impossible.")
	default:
		writeJSON(w, http.StatusCreated, p)
	}
}

func (h *Handlers) list(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.Store.List())
}

func (h *Handlers) remove(w http.ResponseWriter, r *http.Request) {
	err := h.Store.Delete(r.PathValue("id"))
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "Pronostic introuvable.")
	case err != nil:
		slog.Error("suppression d'un pronostic", "err", err)
		writeError(w, http.StatusInternalServerError, "Suppression impossible.")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// requireAdmin vérifie le mot de passe Basic Auth (utilisateur ignoré). Pas d'en-tête
// WWW-Authenticate : la page admin gère elle-même la saisie, sans fenêtre native du navigateur.
func (h *Handlers) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.AdminPassword == "" {
			writeError(w, http.StatusServiceUnavailable, "Administration non configurée.")
			return
		}
		_, password, ok := r.BasicAuth()
		if !ok || subtle.ConstantTimeCompare([]byte(password), []byte(h.AdminPassword)) != 1 {
			writeError(w, http.StatusUnauthorized, "Mot de passe incorrect.")
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
