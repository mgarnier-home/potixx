import { BIRTH_YEAR, EYE_COLORS, PREDICTION_LIMITS, SEXES } from "../prediction-content";

export type Sex = "girl" | "boy";
export type EyeColor = "blue" | "green" | "brown" | "grey" | "hazel";

/** Pronostic tel qu'envoyé au serveur. La date reste une chaîne AAAA-MM-JJ (pas de fuseau). */
export interface PredictionInput {
  name: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  eyeColor: EyeColor;
  firstName: string;
}

/** Pronostic enregistré, renvoyé par le serveur. */
export interface Prediction extends PredictionInput {
  id: string;
  createdAt: string;
}

/** Valeur brute du formulaire, avant validation. */
export interface PredictionFormValue {
  name: string;
  sex: string;
  birthDate: string;
  heightCm: number | null;
  weightKg: number | null;
  eyeColor: string;
  firstName: string;
}

export type PredictionErrors = Partial<Record<keyof PredictionInput, string>>;

const REQUIRED = "Champ obligatoire.";

/** Erreurs par champ ; un objet vide signifie que le pronostic peut être envoyé. */
export function validatePrediction(value: PredictionFormValue): PredictionErrors {
  const limits = PREDICTION_LIMITS;
  const errors: PredictionErrors = {};
  const set = (key: keyof PredictionInput, message: string | null) => {
    if (message) errors[key] = message;
  };
  set("name", textError(value.name, limits.nameMaxLength));
  set("sex", SEXES.some((s) => s.value === value.sex) ? null : "Choisissez fille ou garçon.");
  set("birthDate", dateError(value.birthDate));
  set(
    "heightCm",
    rangeError(
      value.heightCm,
      limits.heightCm,
      `Entre ${limits.heightCm.min} et ${limits.heightCm.max} cm.`,
    ),
  );
  set(
    "weightKg",
    rangeError(
      value.weightKg,
      limits.weightKg,
      `Entre ${limits.weightKg.min} et ${limits.weightKg.max} kg.`,
    ) ?? (oneDecimal(value.weightKg as number) ? null : "Une décimale au plus (ex. 3,4)."),
  );
  set(
    "eyeColor",
    EYE_COLORS.some((c) => c.value === value.eyeColor) ? null : "Choisissez une couleur.",
  );
  set("firstName", textError(value.firstName, limits.firstNameMaxLength));
  return errors;
}

function textError(text: string, maxLength: number): string | null {
  // Longueur en caractères (code points) et non en unités UTF-16, comme côté serveur.
  const length = [...text.trim()].length;
  if (length === 0) return REQUIRED;
  return length > maxLength ? `${maxLength} caractères au plus.` : null;
}

function dateError(date: string): string | null {
  if (!date) return REQUIRED;
  const { min, max } = PREDICTION_LIMITS.birthDate;
  if (!isRealDate(date)) return "Cette date n'existe pas.";
  return date >= min && date <= max ? null : "Entre le 1er janvier et le 31 juillet.";
}

/** Date AAAA-MM-JJ envoyée au serveur à partir du jour et du mois choisis (année implicite). */
export function birthDateOf(day: string, month: string): string {
  return day && month ? `${BIRTH_YEAR}-${month}-${day}` : "";
}

/** Vérifie AAAA-MM-JJ sans passer par l'heure locale : `Date.UTC` ne dépend d'aucun fuseau. */
function isRealDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function rangeError(
  value: number | null,
  range: { min: number; max: number },
  message: string,
): string | null {
  if (value === null || Number.isNaN(value)) return REQUIRED;
  return value < range.min || value > range.max ? message : null;
}

/** Tolère l'erreur d'arrondi flottant : 3.4 * 10 vaut 34.000000000000004. */
function oneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

/** En-tête Basic Auth (utilisateur vide). `btoa` seul échoue sur les caractères non ASCII. */
export function basicAuthHeader(password: string): string {
  const bytes = new TextEncoder().encode(`:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}
