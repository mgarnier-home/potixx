import { basicAuthHeader, birthDateOf, validatePrediction } from "./prediction";
import type { PredictionFormValue } from "./prediction";

function valid(): PredictionFormValue {
  return {
    name: "Mamie",
    sex: "girl",
    birthDate: "2027-04-12",
    heightCm: 50,
    weightKg: 3.4,
    eyeColor: "blue",
    firstName: "Zoé",
  };
}

function errorsFor(edit: Partial<PredictionFormValue>) {
  return validatePrediction({ ...valid(), ...edit });
}

describe("validatePrediction", () => {
  it("accepte un pronostic complet", () => {
    expect(validatePrediction(valid())).toEqual({});
  });

  it("marque chaque champ manquant comme obligatoire", () => {
    const errors = validatePrediction({
      name: "",
      sex: "",
      birthDate: "",
      heightCm: null,
      weightKg: null,
      eyeColor: "",
      firstName: " ",
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["birthDate", "eyeColor", "firstName", "heightCm", "name", "sex", "weightKg"].sort(),
    );
    expect(errors.heightCm).toBe("Champ obligatoire.");
    expect(errors.name).toBe("Champ obligatoire.");
  });

  it("compte les longueurs en caractères accentués", () => {
    expect(errorsFor({ name: "é".repeat(60) })).toEqual({});
    expect(errorsFor({ name: "é".repeat(61) }).name).toBeDefined();
    expect(errorsFor({ firstName: "ï".repeat(40) })).toEqual({});
    expect(errorsFor({ firstName: "ï".repeat(41) }).firstName).toBeDefined();
  });

  it("borne la date et refuse les dates impossibles", () => {
    expect(errorsFor({ birthDate: "2027-01-01" })).toEqual({});
    expect(errorsFor({ birthDate: "2027-07-31" })).toEqual({});
    expect(errorsFor({ birthDate: "2026-12-31" }).birthDate).toBeDefined();
    expect(errorsFor({ birthDate: "2027-08-01" }).birthDate).toBeDefined();
    expect(errorsFor({ birthDate: "2027-02-30" }).birthDate).toBe("Cette date n'existe pas.");
    expect(errorsFor({ birthDate: "30/03/2027" }).birthDate).toBeDefined();
  });

  it("borne la taille", () => {
    expect(errorsFor({ heightCm: 30 })).toEqual({});
    expect(errorsFor({ heightCm: 70 })).toEqual({});
    expect(errorsFor({ heightCm: 29.9 }).heightCm).toBeDefined();
    expect(errorsFor({ heightCm: 70.1 }).heightCm).toBeDefined();
  });

  it("borne le poids à une décimale malgré l'arrondi flottant", () => {
    for (const weightKg of [1, 7, 3.4, 6.9, 1.1]) {
      expect(errorsFor({ weightKg })).toEqual({});
    }
    for (const weightKg of [0.9, 7.1, 3.45]) {
      expect(errorsFor({ weightKg }).weightKg).toBeDefined();
    }
  });

  it("refuse un sexe ou une couleur inconnus", () => {
    expect(errorsFor({ sex: "other" }).sex).toBeDefined();
    expect(errorsFor({ eyeColor: "red" }).eyeColor).toBeDefined();
    for (const eyeColor of ["blue", "green", "brown", "grey", "hazel"]) {
      expect(errorsFor({ eyeColor })).toEqual({});
    }
  });
});

describe("birthDateOf", () => {
  it("ajoute l'année 2027 au jour et au mois choisis", () => {
    expect(birthDateOf("12", "04")).toBe("2027-04-12");
  });

  it("reste vide tant que le jour ou le mois manque", () => {
    expect(birthDateOf("", "04")).toBe("");
    expect(birthDateOf("12", "")).toBe("");
  });
});

describe("basicAuthHeader", () => {
  it("encode le mot de passe en UTF-8, deux-points compris", () => {
    expect(basicAuthHeader("pa:ss-é")).toBe("Basic OnBhOnNzLcOp");
  });
});
