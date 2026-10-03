import type { CrosswordDefinition } from "./core/crossword";

/** Identifiant d'une étape de la chasse, dans l'ordre où elle doit être résolue. */
export type StepId = "padlock" | "password" | "crossword" | "wordSearch" | "treasure";

/** Ordre imposé des étapes (spec §4.1 : les étapes se débloquent strictement dans l'ordre). */
export const STEP_ORDER: readonly StepId[] = [
  "padlock",
  "password",
  "crossword",
  "wordSearch",
  "treasure",
];

/** Seuil d'échecs à partir duquel le bouton « Passer l'énigme » apparaît (spec §4.2). */
export const MAX_FAILURES_BEFORE_SKIP = 3;

/** Les quatre mini-énigmes du cadenas, dans leur ordre d'affichage (spec §4.3). */
export const PADLOCK_RIDDLES: readonly { question: string; answer: string }[] = [
  { question: "Je représente le rien", answer: "0" },
  { question: "Je suis le nombre de saisons dans une année", answer: "4" },
  { question: "Je suis le seul chiffre pair et premier", answer: "2" },
  { question: "Je corresponds au nombre de jours dans une semaine", answer: "7" },
];

/**
 * Un indice de l'énigme du mot de passe, affiché progressivement (spec §4.4). L'indice « rébus »
 * est dessiné (portée + clé de sol + note) par le composant à partir de `note` (ex. `'F4'`, voir
 * `core/music-staff.ts`) ; `suffix` est le texte affiché à côté (ex. « + 1000 ») et `alt` le texte
 * alternatif du rébus complet.
 */
export type PasswordClue =
  | { kind: "image"; src: string; alt: string }
  | { kind: "text"; text: string }
  | { kind: "rebus"; note: string; suffix: string; alt: string };

/** Énigme du mot de passe : réponse et indices affichés un par un (spec §4.4). */
export const PASSWORD: { answer: string; clues: readonly PasswordClue[] } = {
  answer: "famille",
  clues: [
    { kind: "image", src: "/assets/photo-us.jpg", alt: "Photo de nous" },
    {
      kind: "text",
      text: "L'équipage que l'on ne choisit pas toujours, mais que l'on garde toute sa vie.",
    },
    {
      kind: "rebus",
      note: "F4",
      suffix: "+ 1000",
      alt: "Rébus : une note de musique sur une portée, plus 1000",
    },
  ],
};

/**
 * Grille des mots croisés (spec §4.5), identique à `activity.png` : 10 colonnes × 14 lignes.
 * Coordonnées (ligne, colonne), origine en haut à gauche, à partir de 0. Les mots sont écrits
 * sans accents ; le '-' de GRAND-MERE / GRAND-PERE est une case pré-remplie et non modifiable.
 */
export const CROSSWORD: CrosswordDefinition = {
  rows: 14,
  cols: 10,
  entries: [
    {
      number: 1,
      answer: "COUSIN",
      orientation: "down",
      start: { row: 0, col: 1 },
      clue: "L'enfant de ton oncle ou de ta tante",
    },
    {
      number: 2,
      answer: "GRAND-PERE",
      orientation: "down",
      start: { row: 2, col: 5 },
      clue: "Le papa de papa ou de maman",
    },
    {
      number: 3,
      answer: "SOEUR",
      orientation: "across",
      start: { row: 3, col: 1 },
      clue: "Fille des mêmes parents que toi",
    },
    {
      number: 4,
      answer: "ONCLE",
      orientation: "across",
      start: { row: 5, col: 4 },
      clue: "Le frère de papa ou de maman",
    },
    {
      number: 5,
      answer: "MARRAINE",
      orientation: "down",
      start: { row: 6, col: 2 },
      clue: "Elle veille sur toi depuis ton baptême",
    },
    {
      number: 6,
      answer: "GRAND-MERE",
      orientation: "across",
      start: { row: 7, col: 0 },
      clue: "La maman de papa ou de maman",
    },
    {
      number: 7,
      answer: "FRERE",
      orientation: "across",
      start: { row: 9, col: 1 },
      clue: "Garçon des mêmes parents que toi",
    },
    {
      number: 8,
      answer: "TATA",
      orientation: "down",
      start: { row: 10, col: 0 },
      clue: "Ta tante, comme l'appellent les petits",
    },
    {
      number: 9,
      answer: "AMIS",
      orientation: "across",
      start: { row: 11, col: 0 },
      clue: "La famille que l'on choisit",
    },
  ],
  // Cases du mot caché AGRANDIRA, dans l'ordre d'illumination (spec §4.5).
  highlight: [
    { row: 10, col: 2 }, // A — MARRAINE (2e A)
    { row: 7, col: 0 }, // G — GRAND-MERE (G initial)
    { row: 9, col: 4 }, // R — FRERE (2e R)
    { row: 13, col: 0 }, // A — TATA (dernier A)
    { row: 5, col: 5 }, // N — ONCLE
    { row: 6, col: 5 }, // D — GRAND-PERE
    { row: 4, col: 1 }, // I — COUSIN
    { row: 3, col: 5 }, // R — SOEUR
    { row: 11, col: 0 }, // A — AMIS
  ],
  hiddenWord: "AGRANDIRA",
};

/** Mots à retrouver dans la grille de mots mêlés, sans accents (spec §4.6). */
export const WORD_SEARCH: { size: number; words: readonly string[] } = {
  size: 10,
  words: [
    "BEBE",
    "FAMILLE",
    "AMOUR",
    "NAISSANCE",
    "FOYER",
    "JEUX",
    "BIBERON",
    "COUCHES",
    "DOUDOUS",
    "PARENTS",
  ],
};

/** Contenu de l'écran final du trésor (spec §4.7). */
export const TREASURE: { videoSrc: string; posterSrc: string; message: string } = {
  videoSrc: "/assets/treasure.mp4",
  posterSrc: "/assets/treasure-poster.jpg",
  message: "Notre famille s'agrandira en Avril 2027",
};

/**
 * Carte de la chasse (spec §4.1) : positions du centre de chaque étape, en pourcentage de
 * l'image (0 = bord gauche/haut, 100 = bord droit/bas). Elles suivent le chemin dessiné dans
 * `assets/map.svg` (600 × 800) ; le trésor est posé sur la croix rouge. Si l'image change, ces
 * positions doivent être ajustées.
 */
export const MAP: {
  imageSrc: string;
  steps: Record<StepId, { x: number; y: number; label: string }>;
} = {
  imageSrc: "/assets/map.svg",
  steps: {
    padlock: { x: 29.2, y: 18.75, label: "Le cadenas" },
    password: { x: 71.7, y: 31.25, label: "Le mot de passe" },
    crossword: { x: 28.3, y: 50, label: "Les mots croisés" },
    wordSearch: { x: 70, y: 67.5, label: "Les mots mêlés" },
    treasure: { x: 45, y: 85, label: "Le trésor" },
  },
};
