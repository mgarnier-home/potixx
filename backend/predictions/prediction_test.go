package predictions

import (
	"strings"
	"testing"
)

func validInput() Input {
	return Input{
		Name:      "Mamie",
		Sex:       "girl",
		BirthDate: "2027-04-12",
		HeightCm:  50,
		WeightKg:  3.4,
		EyeColor:  "blue",
		FirstName: "Zoé",
	}
}

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		edit    func(*Input)
		wantErr bool
	}{
		{"référence", func(*Input) {}, false},
		{"nom vide", func(in *Input) { in.Name = "" }, true},
		{"nom en espaces", func(in *Input) { in.Name = "   " }, true},
		{"nom de 60 é", func(in *Input) { in.Name = strings.Repeat("é", 60) }, false},
		{"nom de 61 é", func(in *Input) { in.Name = strings.Repeat("é", 61) }, true},
		{"prénom vide", func(in *Input) { in.FirstName = " " }, true},
		{"prénom de 40 ï", func(in *Input) { in.FirstName = strings.Repeat("ï", 40) }, false},
		{"prénom de 41 ï", func(in *Input) { in.FirstName = strings.Repeat("ï", 41) }, true},
		{"sexe vide", func(in *Input) { in.Sex = "" }, true},
		{"sexe inconnu", func(in *Input) { in.Sex = "other" }, true},
		{"garçon", func(in *Input) { in.Sex = "boy" }, false},
		{"date avant", func(in *Input) { in.BirthDate = "2026-12-31" }, true},
		{"date après", func(in *Input) { in.BirthDate = "2027-08-01" }, true},
		{"date impossible", func(in *Input) { in.BirthDate = "2027-02-30" }, true},
		{"date au format français", func(in *Input) { in.BirthDate = "30/03/2027" }, true},
		{"date première borne", func(in *Input) { in.BirthDate = "2027-01-01" }, false},
		{"date dernière borne", func(in *Input) { in.BirthDate = "2027-07-31" }, false},
		{"taille trop petite", func(in *Input) { in.HeightCm = 29.9 }, true},
		{"taille trop grande", func(in *Input) { in.HeightCm = 70.1 }, true},
		{"taille minimale", func(in *Input) { in.HeightCm = 30 }, false},
		{"taille maximale", func(in *Input) { in.HeightCm = 70 }, false},
		{"poids trop petit", func(in *Input) { in.WeightKg = 0.9 }, true},
		{"poids trop grand", func(in *Input) { in.WeightKg = 7.1 }, true},
		{"poids à deux décimales", func(in *Input) { in.WeightKg = 3.45 }, true},
		{"poids minimal", func(in *Input) { in.WeightKg = 1 }, false},
		{"poids maximal", func(in *Input) { in.WeightKg = 7 }, false},
		{"poids 6,9", func(in *Input) { in.WeightKg = 6.9 }, false},
		{"poids 1,1", func(in *Input) { in.WeightKg = 1.1 }, false},
		{"couleur inconnue", func(in *Input) { in.EyeColor = "red" }, true},
		{"yeux verts", func(in *Input) { in.EyeColor = "green" }, false},
		{"yeux marron", func(in *Input) { in.EyeColor = "brown" }, false},
		{"yeux gris", func(in *Input) { in.EyeColor = "grey" }, false},
		{"yeux noisette", func(in *Input) { in.EyeColor = "hazel" }, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := validInput()
			tc.edit(&in)
			err := in.Normalize().Validate()
			if (err != nil) != tc.wantErr {
				t.Fatalf("Validate() = %v, erreur attendue : %v", err, tc.wantErr)
			}
			if err != nil && err.Error() == "" {
				t.Fatal("le message d'erreur ne doit pas être vide")
			}
		})
	}
}

func TestNormalizeTrims(t *testing.T) {
	in := validInput()
	in.Name, in.FirstName = "  Mamie ", "\tZoé\n"
	got := in.Normalize()
	if got.Name != "Mamie" || got.FirstName != "Zoé" {
		t.Fatalf("Normalize() = %q, %q", got.Name, got.FirstName)
	}
}
