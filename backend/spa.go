package main

import (
	"compress/gzip"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

// compressible reprend la liste gzip de l'ancien nginx.conf : texte uniquement, les images et
// polices étant déjà compressées.
var compressible = map[string]bool{
	".html": true, ".js": true, ".css": true, ".svg": true, ".json": true, ".txt": true, ".xml": true,
}

// spaHandler sert les fichiers du front, et index.html pour toute autre route afin que le
// routeur Angular gère les URL profondes (/pronostics). Les en-têtes de cache reprennent
// l'ancienne configuration nginx.
func spaHandler(fsys fs.FS) http.Handler {
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if info, err := fs.Stat(fsys, name); name != "" && err == nil && !info.IsDir() {
			w.Header().Set("Cache-Control", cacheControl(name))
			if !serveGzip(w, r, fsys, name) {
				files.ServeHTTP(w, r)
			}
			return
		}
		// index.html référence les fichiers hashés : jamais en cache, sinon un visiteur déjà
		// venu ne verrait pas un déploiement.
		w.Header().Set("Cache-Control", "no-cache")
		if !serveGzip(w, r, fsys, "index.html") {
			http.ServeFileFS(w, r, fsys, "index.html")
		}
	})
}

// serveGzip envoie un fichier texte compressé si le client l'accepte ; false sinon, pour laisser
// le serveur de fichiers standard répondre. shortcut: pas de Range ni d'ETag sur les réponses
// compressées, inutiles pour des fichiers de quelques centaines de Ko.
func serveGzip(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) bool {
	ext := path.Ext(name)
	if !compressible[ext] || !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		return false
	}
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		return false
	}
	h := w.Header()
	h.Set("Content-Type", mime.TypeByExtension(ext))
	h.Set("Content-Encoding", "gzip")
	h.Set("Vary", "Accept-Encoding")
	zw := gzip.NewWriter(w)
	_, _ = zw.Write(data)
	_ = zw.Close()
	return true
}

func cacheControl(name string) string {
	switch {
	case strings.HasPrefix(name, "assets/"):
		// Images et carte sans hash dans leur nom : cache modéré.
		return "public, max-age=3600"
	case path.Ext(name) == ".js" || path.Ext(name) == ".css":
		// Fichiers générés avec un hash dans leur nom (outputHashing: all) : immuables.
		return "public, max-age=31536000, immutable"
	default:
		return "no-cache"
	}
}

// securityHeaders pose sur toutes les réponses les en-têtes du site privé : jamais indexé
// (ne pas retirer, voir CLAUDE.md), pas de devinette de type MIME, referrer limité.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Robots-Tag", "noindex, nofollow")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}
