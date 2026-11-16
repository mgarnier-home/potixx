// Package predictions gère les pronostics sur le bébé : validation, stockage et API HTTP.
package predictions

import (
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

// Bornes des champs : les mêmes valeurs vivent côté front dans prediction-content.ts, mais
// c'est le serveur qui fait foi.
const (
	maxNameLength      = 60
	maxFirstNameLength = 40
	minBirthDate       = "2027-01-01"
	maxBirthDate       = "2027-07-31"
	minHeightCm        = 30
	maxHeightCm        = 70
	minWeightKg        = 1
	maxWeightKg        = 7
)

var (
	sexes     = map[string]bool{"girl": true, "boy": true}
	eyeColors = map[string]bool{"blue": true, "green": true, "brown": true, "grey": true, "hazel": true}
)

// Input est ce que le visiteur saisit.
type Input struct {
	Name      string  `json:"name"`
	Sex       string  `json:"sex"`
	BirthDate string  `json:"birthDate"`
	HeightCm  float64 `json:"heightCm"`
	WeightKg  float64 `json:"weightKg"`
	EyeColor  string  `json:"eyeColor"`
	FirstName string  `json:"firstName"`
}

// Prediction est un pronostic enregistré.
type Prediction struct {
	ID string `json:"id"`
	Input
	CreatedAt time.Time `json:"createdAt"`
}

// Normalize retire les espaces autour des champs texte libres.
func (in Input) Normalize() Input {
	in.Name = strings.TrimSpace(in.Name)
	in.FirstName = strings.TrimSpace(in.FirstName)
	return in
}

// Validate renvoie nil, ou une erreur dont le message s'affiche tel quel au visiteur.
func (in Input) Validate() error {
	switch {
	case !validText(in.Name, maxNameLength):
		return invalid("Votre nom doit faire entre 1 et %d caractères.", maxNameLength)
	case !sexes[in.Sex]:
		return ValidationError("Choisissez fille ou garçon.")
	case !validDate(in.BirthDate):
		return ValidationError("La date de naissance doit être comprise entre le 1er janvier et le 31 juillet 2027.")
	case in.HeightCm < minHeightCm || in.HeightCm > maxHeightCm:
		return invalid("La taille doit être comprise entre %d et %d cm.", minHeightCm, maxHeightCm)
	case in.WeightKg < minWeightKg || in.WeightKg > maxWeightKg || !oneDecimal(in.WeightKg):
		return invalid("Le poids doit être compris entre %d et %d kg, avec au plus une décimale.", minWeightKg, maxWeightKg)
	case !eyeColors[in.EyeColor]:
		return ValidationError("Choisissez une couleur d'yeux.")
	case !validText(in.FirstName, maxFirstNameLength):
		return invalid("Le prénom doit faire entre 1 et %d caractères.", maxFirstNameLength)
	}
	return nil
}

// ValidationError porte le message français affiché au visiteur.
type ValidationError string

func (e ValidationError) Error() string { return string(e) }

func invalid(format string, args ...any) error {
	return ValidationError(fmt.Sprintf(format, args...))
}

// validText compte en caractères (runes) et non en octets : « Zoé » fait 3 caractères.
func validText(s string, maxLength int) bool {
	n := utf8.RuneCountInString(s)
	return n >= 1 && n <= maxLength
}

// validDate refuse les dates impossibles (2027-02-30) et hors bornes ; la comparaison de
// chaînes AAAA-MM-JJ suit l'ordre chronologique.
func validDate(s string) bool {
	if _, err := time.Parse(time.DateOnly, s); err != nil {
		return false
	}
	return s >= minBirthDate && s <= maxBirthDate
}

// oneDecimal tolère l'erreur d'arrondi flottant : 3.4*10 vaut 34.000000000000004.
func oneDecimal(w float64) bool {
	return math.Abs(w*10-math.Round(w*10)) < 1e-9
}
