package predictions

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const adminPassword = "pa:ss-é"

func newServer(t *testing.T, password string) (*http.ServeMux, *Store) {
	t.Helper()
	store, err := Open(filepath.Join(t.TempDir(), "predictions.json"))
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	(&Handlers{Store: store, AdminPassword: password, Now: func() time.Time { return t0 }}).Register(mux)
	return mux, store
}

func do(mux http.Handler, r *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	return rec
}

func validBody() string {
	b, _ := json.Marshal(validInput())
	return string(b)
}

func post(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/api/predictions", strings.NewReader(body))
}

func admin(method, path, password string) *http.Request {
	r := httptest.NewRequest(method, path, nil)
	if password != "" {
		r.SetBasicAuth("", password)
	}
	return r
}

// assertError vérifie le statut et la présence d'un message JSON {"error": "..."}.
func assertError(t *testing.T, rec *httptest.ResponseRecorder, status int) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("statut %d, attendu %d (%s)", rec.Code, status, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type %q", ct)
	}
	var body struct{ Error string }
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Error == "" {
		t.Fatalf("corps d'erreur inattendu : %s", rec.Body)
	}
}

func TestPostValid(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	rec := do(mux, post(validBody()))
	if rec.Code != http.StatusCreated {
		t.Fatalf("statut %d : %s", rec.Code, rec.Body)
	}
	var p Prediction
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil || p.ID == "" || !p.CreatedAt.Equal(t0) {
		t.Fatalf("corps inattendu : %s", rec.Body)
	}
	if len(store.List()) != 1 {
		t.Fatal("le pronostic doit être enregistré")
	}
}

func TestPostTrimsBeforeSaving(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	body := strings.Replace(validBody(), `"Mamie"`, `"  Mamie  "`, 1)
	if rec := do(mux, post(body)); rec.Code != http.StatusCreated {
		t.Fatalf("statut %d", rec.Code)
	}
	if got := store.List()[0].Name; got != "Mamie" {
		t.Fatalf("nom enregistré %q", got)
	}
}

func TestPostRejected(t *testing.T) {
	cases := map[string]string{
		"nom vide":        strings.Replace(validBody(), `"Mamie"`, `""`, 1),
		"champ inconnu":   strings.Replace(validBody(), `{`, `{"foo":1,`, 1),
		"corps trop gros": strings.Replace(validBody(), `"Mamie"`, `"`+strings.Repeat("a", 5000)+`"`, 1),
		"json invalide":   `{"name":`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			mux, store := newServer(t, adminPassword)
			assertError(t, do(mux, post(body)), http.StatusBadRequest)
			if len(store.List()) != 0 {
				t.Fatal("rien ne doit être enregistré")
			}
		})
	}
}

func TestPostFull(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	store.items = make([]Prediction, MaxPredictions)
	assertError(t, do(mux, post(validBody())), http.StatusInsufficientStorage)
}

func TestAdminAuth(t *testing.T) {
	mux, _ := newServer(t, adminPassword)
	for name, password := range map[string]string{"sans en-tête": "", "mauvais mot de passe": "faux"} {
		t.Run(name, func(t *testing.T) {
			rec := do(mux, admin(http.MethodGet, "/api/admin/predictions", password))
			assertError(t, rec, http.StatusUnauthorized)
			if rec.Header().Get("WWW-Authenticate") != "" {
				t.Fatal("pas de WWW-Authenticate : le navigateur ouvrirait sa fenêtre native")
			}
		})
	}
}

func TestAdminNotConfigured(t *testing.T) {
	mux, _ := newServer(t, "")
	assertError(t, do(mux, admin(http.MethodGet, "/api/admin/predictions", "")), http.StatusServiceUnavailable)
}

func TestAdminList(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	if _, err := store.Add(validInput(), t0); err != nil {
		t.Fatal(err)
	}
	rec := do(mux, admin(http.MethodGet, "/api/admin/predictions", adminPassword))
	var got []Prediction
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &got) != nil || len(got) != 1 {
		t.Fatalf("statut %d : %s", rec.Code, rec.Body)
	}
}

func TestAdminListEmptyIsArray(t *testing.T) {
	mux, _ := newServer(t, adminPassword)
	rec := do(mux, admin(http.MethodGet, "/api/admin/predictions", adminPassword))
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("liste vide attendue sous forme [], obtenu %s", rec.Body)
	}
}

func TestAdminDelete(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	p, _ := store.Add(validInput(), t0)
	rec := do(mux, admin(http.MethodDelete, "/api/admin/predictions/"+p.ID, adminPassword))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("statut %d", rec.Code)
	}
	assertError(t, do(mux, admin(http.MethodDelete, "/api/admin/predictions/"+p.ID, adminPassword)), http.StatusNotFound)
}

func TestAdminDeleteRequiresAuth(t *testing.T) {
	mux, store := newServer(t, adminPassword)
	p, _ := store.Add(validInput(), t0)
	assertError(t, do(mux, admin(http.MethodDelete, "/api/admin/predictions/"+p.ID, "faux")), http.StatusUnauthorized)
	if len(store.List()) != 1 {
		t.Fatal("rien ne doit être supprimé")
	}
}

func TestUnknownAPIRoute(t *testing.T) {
	mux, _ := newServer(t, adminPassword)
	assertError(t, do(mux, httptest.NewRequest(http.MethodGet, "/api/inconnu", nil)), http.StatusNotFound)
}
