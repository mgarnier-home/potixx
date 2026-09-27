import type { Cell } from './cell';
import { createSeededRandom } from './seeded-random';

/** Direction de placement d'un mot dans la grille (pas entre deux cases consécutives). */
export type Direction =
  'right' | 'left' | 'down' | 'up' | 'down-right' | 'down-left' | 'up-right' | 'up-left';

/** Mot placé dans la grille, avec ses cases dans l'ordre (première lettre en premier). */
export interface PlacedWord {
  word: string;
  cells: Cell[];
}

/** Grille de mots mêlés générée : lettres, mots placés, et graine réellement utilisée. */
export interface WordSearchGrid {
  size: number;
  seed: number;
  letters: string[][];
  words: PlacedWord[];
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const MAX_ATTEMPTS = 50;

// Constante de dispersion utilisée pour dériver une graine différente à chaque tentative.
const ATTEMPT_SEED_INCREMENT = 0x9e3779b9;

// Pas (deltaRow, deltaCol) associés à chacune des 8 directions autorisées (spec §4.6 : toutes les
// directions, y compris à l'envers).
const DIRECTION_STEPS: Record<Direction, { rowStep: number; colStep: number }> = {
  right: { rowStep: 0, colStep: 1 },
  left: { rowStep: 0, colStep: -1 },
  down: { rowStep: 1, colStep: 0 },
  up: { rowStep: -1, colStep: 0 },
  'down-right': { rowStep: 1, colStep: 1 },
  'up-left': { rowStep: -1, colStep: -1 },
  'down-left': { rowStep: 1, colStep: -1 },
  'up-right': { rowStep: -1, colStep: 1 },
};

// Mêmes pas que DIRECTION_STEPS, utilisés pour détecter après coup qu'un mot de la liste
// apparaît visiblement ailleurs que sur ses cases placées.
const ALL_SEARCH_STEPS: readonly { rowStep: number; colStep: number }[] =
  Object.values(DIRECTION_STEPS);

// Nombre minimum de mots en diagonale, resp. à l'envers, exigé sur chaque grille générée (spec
// §4.6).
const MIN_DIAGONAL_WORDS = 3;
const MIN_REVERSED_WORDS = 2;

/**
 * Génère une grille de mots mêlés déterministe : à graine égale, le résultat est identique.
 * Place les mots du plus long au plus court, en retentant jusqu'à 50 fois avec des graines
 * dérivées si un placement échoue, si la grille ne compte pas assez de mots en diagonale ou à
 * l'envers (spec §4.6), ou si les lettres de remplissage reforment par accident un mot de la
 * liste ailleurs que sur ses cases placées (dans l'une des 8 directions, y compris à l'envers) :
 * un visiteur pourrait sélectionner cette copie visible et se voir compter un échec.
 * Lève une Error si aucune tentative n'aboutit.
 */
export function generateWordSearch(
  words: readonly string[],
  size: number,
  seed: number,
): WordSearchGrid {
  const sortedWords = [...words].sort((a, b) => b.length - a.length);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = (seed + attempt * ATTEMPT_SEED_INCREMENT) >>> 0;
    const rand = createSeededRandom(attemptSeed);
    const attempted = tryPlaceAllWords(sortedWords, size, rand);

    if (attempted === null) {
      continue;
    }

    if (!meetsDirectionConstraints(attempted.placedWords)) {
      continue;
    }

    const letters = fillEmptyCells(attempted, size, rand);
    if (hasVisibleDuplicate(letters, size, attempted.placedWords)) {
      continue;
    }

    return { size, seed: attemptSeed, letters, words: attempted.placedWords };
  }

  throw new Error('Impossible de générer la grille de mots mêlés après 50 tentatives.');
}

/** Pas (deltaRow, deltaCol) réduit à -1/0/1 entre les deux premières cases d'un mot placé. */
function stepOf(cells: readonly Cell[]): { rowStep: number; colStep: number } {
  return {
    rowStep: Math.sign(cells[1].row - cells[0].row),
    colStep: Math.sign(cells[1].col - cells[0].col),
  };
}

/** Vrai si les deux composantes du pas sont non nulles (mot en diagonale). */
function isDiagonalStep(step: { rowStep: number; colStep: number }): boolean {
  return step.rowStep !== 0 && step.colStep !== 0;
}

// Décision retenue (spec §4.6) : un mot est « à l'envers » si sa direction a une composante
// gauche (colStep -1) ou haut (rowStep -1) — soit les directions left, up, up-left, up-right et
// down-left. Simple à vérifier, et couvre bien « le mot ne se lit pas de gauche à droite ni de
// haut en bas ».
function isReversedStep(step: { rowStep: number; colStep: number }): boolean {
  return step.rowStep === -1 || step.colStep === -1;
}

/**
 * Vrai si la tentative compte au moins `MIN_DIAGONAL_WORDS` mots en diagonale et au moins
 * `MIN_REVERSED_WORDS` mots à l'envers (spec §4.6).
 */
function meetsDirectionConstraints(placedWords: readonly PlacedWord[]): boolean {
  let diagonalCount = 0;
  let reversedCount = 0;

  for (const placed of placedWords) {
    const step = stepOf(placed.cells);
    if (isDiagonalStep(step)) {
      diagonalCount++;
    }
    if (isReversedStep(step)) {
      reversedCount++;
    }
  }

  return diagonalCount >= MIN_DIAGONAL_WORDS && reversedCount >= MIN_REVERSED_WORDS;
}

interface Attempt {
  letters: (string | null)[][];
  placedWords: PlacedWord[];
}

/** Tente de placer tous les mots sur une grille vide ; renvoie null si un mot ne trouve pas de place. */
function tryPlaceAllWords(
  sortedWords: readonly string[],
  size: number,
  rand: () => number,
): Attempt | null {
  const letters: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const placedWords: PlacedWord[] = [];

  for (const word of sortedWords) {
    const candidates = listCandidatePositions(letters, word, size);
    shuffle(candidates, rand);

    if (candidates.length === 0) {
      return null;
    }

    const cells = candidates[0];
    cells.forEach((cell, index) => {
      letters[cell.row][cell.col] = word[index];
    });
    placedWords.push({ word, cells });
  }

  return { letters, placedWords };
}

/** Liste toutes les positions (case de départ × direction) où `word` tient et ne heurte aucune lettre différente. */
function listCandidatePositions(
  letters: readonly (string | null)[][],
  word: string,
  size: number,
): Cell[][] {
  const candidates: Cell[][] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const step of Object.values(DIRECTION_STEPS)) {
        const cells = buildWordCells(row, col, step, word.length, size);
        if (cells !== null && fitsExistingLetters(letters, cells, word)) {
          candidates.push(cells);
        }
      }
    }
  }

  return candidates;
}

/** Construit les cases d'un mot depuis une case de départ et un pas, ou null si ça dépasse la grille. */
function buildWordCells(
  startRow: number,
  startCol: number,
  step: { rowStep: number; colStep: number },
  length: number,
  size: number,
): Cell[] | null {
  const cells: Cell[] = [];

  for (let i = 0; i < length; i++) {
    const row = startRow + step.rowStep * i;
    const col = startCol + step.colStep * i;
    if (row < 0 || row >= size || col < 0 || col >= size) {
      return null;
    }
    cells.push({ row, col });
  }

  return cells;
}

/** Vérifie que chaque case du candidat est vide ou contient déjà la lettre attendue à cet endroit. */
function fitsExistingLetters(
  letters: readonly (string | null)[][],
  cells: readonly Cell[],
  word: string,
): boolean {
  return cells.every((cell, index) => {
    const existing = letters[cell.row][cell.col];
    return existing === null || existing === word[index];
  });
}

/**
 * Vrai si un mot placé apparaît ailleurs que sur ses propres cases, dans l'une des 8 directions
 * (y compris à l'envers) : le remplissage aléatoire a reformé le mot de façon visible.
 */
function hasVisibleDuplicate(
  letters: readonly string[][],
  size: number,
  placedWords: readonly PlacedWord[],
): boolean {
  return placedWords.some((placed) => hasOtherOccurrence(letters, size, placed));
}

/**
 * Vrai si `placed.word` se lit ailleurs dans la grille que sur `placed.cells`, dans l'une des 8
 * directions. Les deux sens de lecture des cases *placées elles-mêmes* sont exclus de la
 * recherche : pour un mot palindrome, lire ses propres cases à l'envers retrouve aussi le mot,
 * mais ce sont les mêmes cases déjà surlignées à l'écran — pas un doublon ailleurs dans la
 * grille. Sans cette exclusion, tout palindrome ferait échouer la génération à coup sûr.
 */
function hasOtherOccurrence(
  letters: readonly string[][],
  size: number,
  placed: PlacedWord,
): boolean {
  const ownCells = placed.cells;
  const ownCellsReversed = [...placed.cells].reverse();

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const step of ALL_SEARCH_STEPS) {
        const cells = buildWordCells(row, col, step, placed.word.length, size);
        if (cells === null || !matchesLetters(letters, cells, placed.word)) {
          continue;
        }
        if (sameCells(cells, ownCells) || sameCells(cells, ownCellsReversed)) {
          continue;
        }
        return true;
      }
    }
  }

  return false;
}

/** Vrai si `word` se lit intégralement sur `cells`, dans l'ordre. */
function matchesLetters(
  letters: readonly string[][],
  cells: readonly Cell[],
  word: string,
): boolean {
  return cells.every((cell, index) => letters[cell.row][cell.col] === word[index]);
}

/** Vrai si les deux suites de cases sont identiques, case à case et dans le même ordre. */
function sameCells(a: readonly Cell[], b: readonly Cell[]): boolean {
  return a.length === b.length && a.every((cell, index) => sameCell(cell, b[index]));
}

/** Mélange `items` sur place (Fisher-Yates) en tirant les indices avec `rand`. */
function shuffle<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/** Remplace les cases vides restantes par des lettres A-Z tirées avec `rand`. */
function fillEmptyCells(attempt: Attempt, size: number, rand: () => number): string[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const existing = attempt.letters[row][col];
      return existing ?? ALPHABET[Math.floor(rand() * ALPHABET.length)];
    }),
  );
}

/**
 * Cherche le mot placé dont les extrémités correspondent exactement à `from` et `to`,
 * dans un sens ou dans l'autre. Renvoie null pour toute autre sélection (case unique,
 * cases non alignées, ou segment qui ne correspond pas exactement à un mot placé).
 */
export function findWordAt(grid: WordSearchGrid, from: Cell, to: Cell): PlacedWord | null {
  for (const placed of grid.words) {
    const first = placed.cells[0];
    const last = placed.cells[placed.cells.length - 1];

    if (
      (sameCell(from, first) && sameCell(to, last)) ||
      (sameCell(from, last) && sameCell(to, first))
    ) {
      return placed;
    }
  }

  return null;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}
