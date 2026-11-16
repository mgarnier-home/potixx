package main

import (
	"compress/gzip"
	"io"
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

func getGzip(h http.Handler, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, path, nil)
	r.Header.Set("Accept-Encoding", "gzip, deflate, br")
	h.ServeHTTP(rec, r)
	return rec
}

func TestSPAGzipsText(t *testing.T) {
	h := spaHandler(front)
	for path, want := range map[string]string{"/main-abc.js": "console.log(1)", "/pronostics": "<html>index</html>"} {
		rec := getGzip(h, path)
		if rec.Header().Get("Content-Encoding") != "gzip" || rec.Header().Get("Vary") != "Accept-Encoding" {
			t.Fatalf("%s : en-têtes %v", path, rec.Header())
		}
		zr, err := gzip.NewReader(rec.Body)
		if err != nil {
			t.Fatalf("%s : %v", path, err)
		}
		if got, _ := io.ReadAll(zr); string(got) != want {
			t.Fatalf("%s : contenu décompressé %q", path, got)
		}
	}
}

func TestSPANoGzip(t *testing.T) {
	h := spaHandler(front)
	if rec := get(h, "/main-abc.js"); rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != "console.log(1)" {
		t.Fatal("sans Accept-Encoding: gzip, la réponse doit rester en clair")
	}
	if rec := getGzip(h, "/assets/map.webp"); rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != "webp" {
		t.Fatal("une image déjà compressée ne doit pas être regzippée")
	}
}
