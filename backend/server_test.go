package main

import (
	"net/http"
	"testing"
)

func TestNewHTTPServerTimeouts(t *testing.T) {
	s := newHTTPServer(":0", http.NotFoundHandler())
	if s.ReadHeaderTimeout == 0 || s.ReadTimeout == 0 || s.WriteTimeout == 0 || s.IdleTimeout == 0 {
		t.Fatalf("tous les timeouts doivent être posés (client lent) : %+v", s)
	}
}
