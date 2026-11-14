package predictions

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"testing"
	"time"
)

var t0 = time.Date(2026, 11, 14, 10, 0, 0, 0, time.UTC)

func openTemp(t *testing.T) (*Store, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "data", "predictions.json")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	return s, path
}

func TestOpenMissingFile(t *testing.T) {
	s, path := openTemp(t)
	if got := s.List(); len(got) != 0 {
		t.Fatalf("liste attendue vide, obtenu %d", len(got))
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("aucun fichier ne doit être créé à l'ouverture : %v", err)
	}
}

func TestAddPersists(t *testing.T) {
	s, path := openTemp(t)
	p, err := s.Add(validInput(), t0)
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(p.ID) {
		t.Fatalf("id inattendu %q", p.ID)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	got := reopened.List()
	if len(got) != 1 || got[0].ID != p.ID || got[0].Input != validInput() || !got[0].CreatedAt.Equal(t0) {
		t.Fatalf("rechargement inattendu : %+v", got)
	}
}

func TestListNewestFirst(t *testing.T) {
	s, _ := openTemp(t)
	first, _ := s.Add(validInput(), t0)
	second, _ := s.Add(validInput(), t0.Add(time.Hour))
	got := s.List()
	if got[0].ID != second.ID || got[1].ID != first.ID {
		t.Fatal("le plus récent doit venir en premier")
	}
}

func TestDelete(t *testing.T) {
	s, path := openTemp(t)
	p, _ := s.Add(validInput(), t0)
	if err := s.Delete(p.ID); err != nil {
		t.Fatal(err)
	}
	reopened, _ := Open(path)
	if len(reopened.List()) != 0 {
		t.Fatal("le pronostic supprimé ne doit plus être dans le fichier")
	}
	if err := s.Delete(p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second Delete = %v, attendu ErrNotFound", err)
	}
}

func TestFull(t *testing.T) {
	s, path := openTemp(t)
	for i := range MaxPredictions {
		if _, err := s.Add(validInput(), t0); err != nil {
			t.Fatalf("Add n°%d : %v", i, err)
		}
	}
	before, _ := os.ReadFile(path)
	if _, err := s.Add(validInput(), t0); !errors.Is(err, ErrFull) {
		t.Fatalf("Add au-delà du plafond = %v, attendu ErrFull", err)
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("le fichier ne doit pas changer quand le plafond est atteint")
	}
}

func TestOpenCorruptFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "predictions.json")
	if err := os.WriteFile(path, []byte("{pas du json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path); err == nil {
		t.Fatal("un fichier corrompu doit faire échouer Open")
	}
}

func TestConcurrentAdd(t *testing.T) {
	s, path := openTemp(t)
	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			if _, err := s.Add(validInput(), t0); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if n := len(reopened.List()); n != 50 {
		t.Fatalf("%d pronostics relus, 50 attendus", n)
	}
}
