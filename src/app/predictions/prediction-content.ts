import type { EyeColor, Sex } from "./core/prediction";

/**
 * Contenu éditable de l'onglet Pronostics. Les bornes sont dupliquées côté serveur
 * (`backend/predictions/prediction.go`), qui fait foi : changer l'une impose de changer l'autre.
 */
export const PREDICTION_LIMITS = {
  nameMaxLength: 60,
  firstNameMaxLength: 40,
  birthDate: { min: "2027-01-01", max: "2027-07-31" },
  heightCm: { min: 30, max: 70 },
  weightKg: { min: 1, max: 7 },
} as const;

/** Année de naissance, implicite : le visiteur ne choisit que le jour et le mois. */
export const BIRTH_YEAR = 2027;

/** Mois proposés, bornés par `PREDICTION_LIMITS.birthDate` (janvier à juillet). */
export const BIRTH_MONTHS: readonly { value: string; label: string }[] = [
  { value: "01", label: "janvier" },
  { value: "02", label: "février" },
  { value: "03", label: "mars" },
  { value: "04", label: "avril" },
  { value: "05", label: "mai" },
  { value: "06", label: "juin" },
  { value: "07", label: "juillet" },
];

export const SEXES: readonly { value: Sex; label: string }[] = [
  { value: "girl", label: "Fille" },
  { value: "boy", label: "Garçon" },
];

export const EYE_COLORS: readonly { value: EyeColor; label: string }[] = [
  { value: "blue", label: "Bleus" },
  { value: "green", label: "Verts" },
  { value: "brown", label: "Marron" },
  { value: "grey", label: "Gris" },
  { value: "hazel", label: "Noisette" },
];
