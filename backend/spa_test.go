package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

var front = fstest.MapFS{
	"index.html":      {Data: []byte("<html>index</html>")},
	"main-abc.js":     {Data: []byte("console.log(1)")},
	"assets/map.webp": {Data: []byte("webp")},
}

func get(h http.Handler, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestSPACacheHeaders(t *testing.T) {
	h := spaHandler(front)
	cases := []struct{ path, body, cache string }{
		{"/", "<html>index</html>", "no-cache"},
		{"/pronostics", "<html>index</html>", "no-cache"},
		{"/main-abc.js", "console.log(1)", "public, max-age=31536000, immutable"},
		{"/assets/map.webp", "webp", "public, max-age=3600"},
	}
	for _, tc := range cases {
		rec := get(h, tc.path)
		if rec.Code != http.StatusOK || rec.Body.String() != tc.body {
			t.Errorf("%s : statut %d, corps %q", tc.path, rec.Code, rec.Body)
		}
		if got := rec.Header().Get("Cache-Control"); got != tc.cache {
			t.Errorf("%s : Cache-Control %q, attendu %q", tc.path, got, tc.cache)
		}
	}
}

func TestSecurityHeaders(t *testing.T) {
	h := securityHeaders(http.NotFoundHandler())
	rec := get(h, "/api/inconnu")
	want := map[string]string{
		"X-Robots-Tag":           "noindex, nofollow",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}
	for k, v := range want {
		if got := rec.Header().Get(k); got != v {
			t.Errorf("%s = %q, attendu %q", k, got, v)
		}
	}
}
