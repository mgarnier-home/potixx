package predictions

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"
)

// MaxPredictions borne le fichier : un robot ne peut pas remplir le disque.
const MaxPredictions = 1000

var (
	ErrFull     = errors.New("nombre maximal de pronostics atteint")
	ErrNotFound = errors.New("pronostic introuvable")
)

// Store garde les pronostics en mémoire et les réécrit en entier dans un fichier JSON à chaque
// changement. Suffisant pour quelques dizaines de pronostics familiaux.
type Store struct {
	mu    sync.Mutex
	path  string
	items []Prediction
}

// Open charge le fichier ; un fichier absent donne une liste vide.
func Open(path string) (*Store, error) {
	s := &Store{path: path}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &s.items); err != nil {
		return nil, err
	}
	return s, nil
}

// Add enregistre un pronostic déjà validé.
func (s *Store) Add(in Input, now time.Time) (Prediction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.items) >= MaxPredictions {
		return Prediction{}, ErrFull
	}
	id := make([]byte, 16)
	_, _ = rand.Read(id) // crypto/rand.Read ne renvoie jamais d'erreur
	p := Prediction{ID: hex.EncodeToString(id), Input: in, CreatedAt: now.UTC()}
	if err := s.save(append(slices.Clone(s.items), p)); err != nil {
		return Prediction{}, err
	}
	return p, nil
}

// List renvoie une copie, du plus récent au plus ancien.
func (s *Store) List() []Prediction {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := append([]Prediction{}, s.items...) // jamais nil : l'API renvoie [] et non null
	slices.SortStableFunc(out, func(a, b Prediction) int { return b.CreatedAt.Compare(a.CreatedAt) })
	return out
}

// Delete retire un pronostic par son id.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := slices.IndexFunc(s.items, func(p Prediction) bool { return p.ID == id })
	if i < 0 {
		return ErrNotFound
	}
	return s.save(slices.Delete(slices.Clone(s.items), i, i+1))
}

// save écrit dans un fichier temporaire puis le renomme : une coupure ne laisse jamais un
// fichier tronqué. L'état en mémoire ne change qu'après une écriture réussie.
func (s *Store) save(items []Prediction) error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".predictions-*.json")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(f.Name()) }() // sans effet après un Rename réussi
	if err := json.NewEncoder(f).Encode(items); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), s.path); err != nil {
		return err
	}
	s.items = items
	return nil
}
