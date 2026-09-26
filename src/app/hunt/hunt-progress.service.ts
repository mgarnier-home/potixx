import {
  Injectable,
  InjectionToken,
  Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { Cell } from './core/cell';
import { cellKey } from './core/cell';
import type { CrosswordCheck, CrosswordDefinition } from './core/crossword';
import {
  buildSolution,
  checkCrossword as evaluateCrossword,
  entryCells,
  prefilledCells,
} from './core/crossword';
import { isCorrectAnswer, normalizeAnswer } from './core/normalize-answer';
import { randomSeed } from './core/seeded-random';
import type { WordSearchGrid } from './core/word-search';
import { findWordAt, generateWordSearch } from './core/word-search';
import {
  CROSSWORD,
  MAX_FAILURES_BEFORE_SKIP,
  PADLOCK_RIDDLES,
  PASSWORD,
  STEP_ORDER,
  WORD_SEARCH,
} from './hunt-content';
import type { StepId } from './hunt-content';

/**
 * Fabrique de graine pour le générateur de mots mêlés, injectable pour permettre des tests
 * déterministes (voir `hunt-progress.service.spec.ts`).
 */
export const SEED_FACTORY = new InjectionToken<() => number>('SEED_FACTORY', {
  providedIn: 'root',
  factory: () => randomSeed,
});

/**
 * Stockage utilisé pour persister la progression. `null` si `localStorage` est inaccessible
 * (navigation privée, quota, environnement sans DOM, etc.) : le jeu doit alors fonctionner
 * normalement sans persistance (point de vigilance §1 du plan).
 */
export const PROGRESS_STORAGE = new InjectionToken<Storage | null>('PROGRESS_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  },
});

/** Clé de sauvegarde dans le stockage (spec : `potixx.progress.v1`). */
export const STORAGE_KEY = 'potixx.progress.v1';

/** Les quatre mini-énigmes de la chasse (toutes les étapes sauf le trésor final). */
export type RiddleId = Exclude<StepId, 'treasure'>;

/** État complet de la progression d'un visiteur, tel que persisté. */
export interface HuntProgress {
  version: 1;
  padlock: { digitIndex: number; failures: number; solved: boolean };
  password: { failures: number; solved: boolean };
  crossword: {
    letters: Record<string, string>;
    locked: number[];
    failures: number;
    solved: boolean;
  };
  wordSearch: { seed: number; found: string[]; failures: number; solved: boolean };
}

/** Table cellule → numéros des entrées qui la contiennent, pour verrouiller les cases résolues. */
function buildCellEntryNumbers(def: CrosswordDefinition): ReadonlyMap<string, readonly number[]> {
  const map = new Map<string, number[]>();
  for (const entry of def.entries) {
    for (const cell of entryCells(entry)) {
      const key = cellKey(cell);
      const numbers = map.get(key) ?? [];
      numbers.push(entry.number);
      map.set(key, numbers);
    }
  }
  return map;
}

// Données dérivées de CROSSWORD, calculées une seule fois (contenu éditorial statique).
const CROSSWORD_SOLUTION = buildSolution(CROSSWORD);
const CROSSWORD_PREFILLED = prefilledCells(CROSSWORD);
const CROSSWORD_CELL_ENTRY_NUMBERS = buildCellEntryNumbers(CROSSWORD);
const CROSSWORD_ENTRY_NUMBERS = CROSSWORD.entries.map((entry) => entry.number);

/** Une seule lettre A-Z, après normalisation (accents, casse). */
const SINGLE_LETTER = /^[A-Z]$/;

/** Vrai si `value` est un entier ≥ 0. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Vrai si `value` est un objet simple (non tableau) dont toutes les valeurs sont des chaînes. */
function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/** Vrai si `value` est un tableau de nombres. */
function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

/** Vrai si `value` est un tableau de chaînes. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isValidPadlock(value: unknown): value is HuntProgress['padlock'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNonNegativeInteger(record['digitIndex']) &&
    record['digitIndex'] <= PADLOCK_RIDDLES.length &&
    isNonNegativeInteger(record['failures']) &&
    typeof record['solved'] === 'boolean'
  );
}

function isValidPassword(value: unknown): value is HuntProgress['password'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return isNonNegativeInteger(record['failures']) && typeof record['solved'] === 'boolean';
}

function isValidCrossword(value: unknown): value is HuntProgress['crossword'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isStringRecord(record['letters']) &&
    isNumberArray(record['locked']) &&
    isNonNegativeInteger(record['failures']) &&
    typeof record['solved'] === 'boolean'
  );
}

function isValidWordSearch(value: unknown): value is HuntProgress['wordSearch'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNonNegativeInteger(record['seed']) &&
    isStringArray(record['found']) &&
    isNonNegativeInteger(record['failures']) &&
    typeof record['solved'] === 'boolean'
  );
}

/**
 * Vérifie en profondeur la forme d'une progression chargée depuis le stockage : les champs
 * imbriqués doivent avoir le bon type et rester dans leurs bornes (ex. `digitIndex` du cadenas),
 * sinon une sauvegarde corrompue produirait un TypeError persistant en cours de partie.
 */
function isValidProgress(value: unknown): value is HuntProgress {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record['version'] !== 1) {
    return false;
  }
  return (
    isValidPadlock(record['padlock']) &&
    isValidPassword(record['password']) &&
    isValidCrossword(record['crossword']) &&
    isValidWordSearch(record['wordSearch'])
  );
}

/**
 * Service de progression de la chasse au trésor : détient tout l'état du jeu, le persiste dans
 * le stockage local et expose l'API consommée par les écrans (carte, 4 énigmes, trésor).
 */
@Injectable({ providedIn: 'root' })
export class HuntProgressService {
  private readonly storage = inject(PROGRESS_STORAGE);
  private readonly seedFactory = inject(SEED_FACTORY);

  private readonly state = signal<HuntProgress>(this.loadInitialState());

  /** Progression courante, en lecture seule. */
  readonly progress: Signal<HuntProgress> = this.state.asReadonly();

  /** Première énigme non résolue, ou `'treasure'` si tout est résolu. */
  readonly currentStep: Signal<StepId> = computed(() => {
    const progress = this.state();
    if (!progress.padlock.solved) {
      return 'padlock';
    }
    if (!progress.password.solved) {
      return 'password';
    }
    if (!progress.crossword.solved) {
      return 'crossword';
    }
    if (!progress.wordSearch.solved) {
      return 'wordSearch';
    }
    return 'treasure';
  });

  /** Grille de mots mêlés, régénérée de façon déterministe depuis la graine sauvegardée. */
  readonly wordSearchGrid: Signal<WordSearchGrid> = computed(() =>
    generateWordSearch(WORD_SEARCH.words, WORD_SEARCH.size, this.state().wordSearch.seed),
  );

  constructor() {
    // Sauvegarde silencieuse à chaque changement d'état (échec possible : quota, navigation privée…).
    effect(() => {
      const json = JSON.stringify(this.state());
      try {
        this.storage?.setItem(STORAGE_KEY, json);
      } catch {
        // Volontairement silencieux (point de vigilance §1 du plan) : le jeu continue sans sauvegarde.
      }
    });
  }

  /** Une étape est débloquée si elle précède, ou est, l'étape courante dans l'ordre imposé. */
  isUnlocked(step: StepId): boolean {
    return STEP_ORDER.indexOf(step) <= STEP_ORDER.indexOf(this.currentStep());
  }

  /**
   * Le bouton « Passer l'énigme » apparaît au-delà du seuil d'échecs, tant que l'énigme n'est
   * pas déjà résolue (une énigme résolue après plusieurs échecs ne doit plus proposer de passer).
   */
  canSkip(riddle: RiddleId): boolean {
    const state = this.state()[riddle];
    return !state.solved && state.failures >= MAX_FAILURES_BEFORE_SKIP;
  }

  /** Répond au chiffre courant du cadenas. `false` sans effet si le cadenas est déjà résolu. */
  answerPadlockDigit(input: string): boolean {
    const padlock = this.state().padlock;
    if (padlock.solved) {
      return false;
    }

    const expected = PADLOCK_RIDDLES[padlock.digitIndex].answer;
    if (isCorrectAnswer(input, expected)) {
      this.state.update((progress) => ({ ...progress, padlock: this.advancePadlock(progress) }));
      return true;
    }

    this.state.update((progress) => ({
      ...progress,
      padlock: { ...progress.padlock, failures: progress.padlock.failures + 1 },
    }));
    return false;
  }

  /** Répond à l'énigme du mot de passe. `false` sans effet si déjà résolue. */
  answerPassword(input: string): boolean {
    const password = this.state().password;
    if (password.solved) {
      return false;
    }

    if (isCorrectAnswer(input, PASSWORD.answer)) {
      this.state.update((progress) => ({
        ...progress,
        password: { ...progress.password, solved: true },
      }));
      return true;
    }

    this.state.update((progress) => ({
      ...progress,
      password: { ...progress.password, failures: progress.password.failures + 1 },
    }));
    return false;
  }

  /**
   * Écrit une lettre dans la grille de mots croisés. Ignoré pour les clés hors grille (cases
   * noires), les cases pré-remplies et les cases appartenant à un mot déjà verrouillé. `''`
   * efface la case. La lettre est normalisée (accents, casse) et n'est acceptée que si elle se
   * réduit à une seule lettre A-Z ; toute autre saisie (plusieurs caractères, chiffre, espace) est
   * ignorée sans modifier la case.
   */
  setCrosswordLetter(key: string, letter: string): void {
    if (!CROSSWORD_SOLUTION.has(key) || CROSSWORD_PREFILLED.has(key)) {
      return;
    }

    const owningEntries = CROSSWORD_CELL_ENTRY_NUMBERS.get(key) ?? [];
    const locked = this.state().crossword.locked;
    if (owningEntries.some((entryNumber) => locked.includes(entryNumber))) {
      return;
    }

    if (letter === '') {
      this.state.update((progress) => {
        const letters = { ...progress.crossword.letters };
        delete letters[key];
        return { ...progress, crossword: { ...progress.crossword, letters } };
      });
      return;
    }

    const normalized = normalizeAnswer(letter).toUpperCase();
    if (!SINGLE_LETTER.test(normalized)) {
      return;
    }

    this.state.update((progress) => ({
      ...progress,
      crossword: {
        ...progress.crossword,
        letters: { ...progress.crossword.letters, [key]: normalized },
      },
    }));
  }

  /** Vérifie la grille : verrouille les mots justes, compte un échec sinon marque résolu. */
  checkCrossword(): CrosswordCheck {
    const letters = this.state().crossword.letters;
    const result = evaluateCrossword(CROSSWORD, letters);

    this.state.update((progress) => {
      const correctNumbers = CROSSWORD_ENTRY_NUMBERS.filter(
        (entryNumber) => !result.wrongEntries.includes(entryNumber),
      );
      const lockedSet = new Set([...progress.crossword.locked, ...correctNumbers]);

      return {
        ...progress,
        crossword: {
          ...progress.crossword,
          locked: Array.from(lockedSet),
          failures: result.solved ? progress.crossword.failures : progress.crossword.failures + 1,
          solved: result.solved ? true : progress.crossword.solved,
        },
      };
    });

    return result;
  }

  /**
   * Sélectionne un segment de la grille de mots mêlés. `false` et +1 échec si aucun mot ne
   * correspond exactement ou si le mot est déjà trouvé ; `false` sans effet si déjà résolu.
   */
  selectWordSearch(from: Cell, to: Cell): boolean {
    const wordSearch = this.state().wordSearch;
    if (wordSearch.solved) {
      return false;
    }

    const placed = findWordAt(this.wordSearchGrid(), from, to);
    if (placed === null || wordSearch.found.includes(placed.word)) {
      this.state.update((progress) => ({
        ...progress,
        wordSearch: { ...progress.wordSearch, failures: progress.wordSearch.failures + 1 },
      }));
      return false;
    }

    this.state.update((progress) => {
      const found = [...progress.wordSearch.found, placed.word];
      return {
        ...progress,
        wordSearch: {
          ...progress.wordSearch,
          found,
          solved: found.length >= WORD_SEARCH.words.length,
        },
      };
    });
    return true;
  }

  /** Passe l'énigme donnée, si `canSkip` l'autorise ; ne fait rien sinon. */
  skip(riddle: RiddleId): void {
    if (!this.canSkip(riddle)) {
      return;
    }

    switch (riddle) {
      case 'padlock':
        this.state.update((progress) => ({ ...progress, padlock: this.advancePadlock(progress) }));
        break;
      case 'password':
        this.state.update((progress) => ({
          ...progress,
          password: { ...progress.password, solved: true },
        }));
        break;
      case 'crossword':
        this.state.update((progress) => ({
          ...progress,
          crossword: {
            ...progress.crossword,
            letters: this.fullCrosswordLetters(),
            locked: [...CROSSWORD_ENTRY_NUMBERS],
            solved: true,
          },
        }));
        break;
      case 'wordSearch':
        this.state.update((progress) => ({
          ...progress,
          wordSearch: { ...progress.wordSearch, found: [...WORD_SEARCH.words], solved: true },
        }));
        break;
    }
  }

  /** Recommence la chasse depuis le début, avec une nouvelle graine de mots mêlés. */
  restart(): void {
    this.state.set(this.createFreshState());
  }

  /** Avance le cadenas au chiffre suivant, échecs remis à zéro ; résolu après le dernier. */
  private advancePadlock(progress: HuntProgress): HuntProgress['padlock'] {
    const digitIndex = progress.padlock.digitIndex + 1;
    return { digitIndex, failures: 0, solved: digitIndex >= PADLOCK_RIDDLES.length };
  }

  /** Solution complète des mots croisés pour toutes les cases modifiables (hors '-'). */
  private fullCrosswordLetters(): Record<string, string> {
    const solution = buildSolution(CROSSWORD);
    const letters: Record<string, string> = {};
    solution.forEach((letter, key) => {
      if (letter !== '-') {
        letters[key] = letter;
      }
    });
    return letters;
  }

  /** État neuf : aucune énigme résolue, nouvelle grille de mots mêlés. */
  private createFreshState(): HuntProgress {
    const seed = generateWordSearch(WORD_SEARCH.words, WORD_SEARCH.size, this.seedFactory()).seed;
    return {
      version: 1,
      padlock: { digitIndex: 0, failures: 0, solved: false },
      password: { failures: 0, solved: false },
      crossword: { letters: {}, locked: [], failures: 0, solved: false },
      wordSearch: { seed, found: [], failures: 0, solved: false },
    };
  }

  /** Charge l'état depuis le stockage, ou un état neuf si absent/corrompu/incompatible. */
  private loadInitialState(): HuntProgress {
    const raw = this.readStorage();
    if (raw === null) {
      return this.createFreshState();
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return isValidProgress(parsed) ? parsed : this.createFreshState();
    } catch {
      return this.createFreshState();
    }
  }

  /** Lecture silencieuse du stockage : `null` si absent, illisible ou levant une exception. */
  private readStorage(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
