import type { Cell } from './cell';
import {
  findWordAt,
  generateWordSearch,
  type PlacedWord,
  type WordSearchGrid,
} from './word-search';

// Liste de mots de la spec §4.6 (thème naissance/bébé).
const WORDS = [
  'BEBE',
  'FAMILLE',
  'AMOUR',
  'NAISSANCE',
  'FOYER',
  'JEUX',
  'BIBERON',
  'COUCHES',
  'DOUDOUS',
  'PARENTS',
] as const;

const SIZE = 10;

// Pas (deltaRow,deltaCol) autorisés entre deux cases consécutives d'un mot placé.
const ALLOWED_STEPS = new Set(['0,1', '1,0', '1,1', '1,-1']);

function wordFromCells(grid: WordSearchGrid, cells: Cell[]): string {
  return cells.map((cell) => grid.letters[cell.row][cell.col]).join('');
}

describe('generateWordSearch', () => {
  it('place les 10 mots pour 200 graines différentes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const grid = generateWordSearch(WORDS, SIZE, seed);

      expect(grid.words.length).toBe(10);
      expect(grid.letters.length).toBe(SIZE);
      grid.letters.forEach((row) => {
        expect(row.length).toBe(SIZE);
        row.forEach((letter) => expect(letter).toMatch(/^[A-Z]$/));
      });
      grid.words.forEach((placed) => {
        expect(wordFromCells(grid, placed.cells)).toBe(placed.word);
      });
    }
  });

  it("n'utilise que les directions autorisées", () => {
    const grid = generateWordSearch(WORDS, SIZE, 7);

    grid.words.forEach((placed) => {
      for (let i = 1; i < placed.cells.length; i++) {
        const rowStep = placed.cells[i].row - placed.cells[i - 1].row;
        const colStep = placed.cells[i].col - placed.cells[i - 1].col;
        expect(ALLOWED_STEPS.has(`${rowStep},${colStep}`)).toBe(true);
      }
    });
  });

  it('est déterministe pour une même graine', () => {
    const a = generateWordSearch(WORDS, SIZE, 7);
    const b = generateWordSearch(WORDS, SIZE, 7);
    expect(a).toEqual(b);
  });

  it('se régénère à l’identique à partir de la graine renvoyée', () => {
    const first = generateWordSearch(WORDS, SIZE, 123);
    const second = generateWordSearch(WORDS, SIZE, first.seed);
    expect(second.letters).toEqual(first.letters);
  });
});

// Pas des 8 directions (y compris à l'envers) utilisées pour détecter un mot visible par accident.
const ALL_SEARCH_STEPS: { rowStep: number; colStep: number }[] = [
  { rowStep: 0, colStep: 1 },
  { rowStep: 0, colStep: -1 },
  { rowStep: 1, colStep: 0 },
  { rowStep: -1, colStep: 0 },
  { rowStep: 1, colStep: 1 },
  { rowStep: -1, colStep: -1 },
  { rowStep: 1, colStep: -1 },
  { rowStep: -1, colStep: 1 },
];

/** Compte les occurrences exactes de `word` dans `letters`, dans les 8 directions. */
function countOccurrences(letters: string[][], size: number, word: string): number {
  let count = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const step of ALL_SEARCH_STEPS) {
        let matches = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + step.rowStep * i;
          const c = col + step.colStep * i;
          if (r < 0 || r >= size || c < 0 || c >= size || letters[r][c] !== word[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          count++;
        }
      }
    }
  }
  return count;
}

describe('generateWordSearch — pas de mot dupliqué visible', () => {
  it("chaque mot n'apparaît qu'une seule fois dans la grille, sur 200 graines, dans les 8 directions", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const grid = generateWordSearch(WORDS, SIZE, seed);

      for (const word of WORDS) {
        expect(countOccurrences(grid.letters, SIZE, word)).toBe(1);
      }
    }
  });
});

describe('findWordAt', () => {
  let grid: WordSearchGrid;
  let target: PlacedWord;

  beforeEach(() => {
    grid = generateWordSearch(WORDS, SIZE, 7);
    target = grid.words[0];
  });

  it('trouve un mot placé en touchant ses deux extrémités, dans les deux sens', () => {
    const first = target.cells[0];
    const last = target.cells[target.cells.length - 1];

    expect(findWordAt(grid, first, last)).toEqual(target);
    expect(findWordAt(grid, last, first)).toEqual(target);
  });

  it('renvoie null pour une sélection à une seule case', () => {
    const cell = target.cells[0];
    expect(findWordAt(grid, cell, cell)).toBeNull();
  });

  it('renvoie null pour deux cases dont aucun mot ne relie exactement les extrémités', () => {
    // (0,0) → (1,2) : delta (1,2) n'est atteignable par aucune des 4 directions autorisées,
    // donc ce ne peuvent être les deux extrémités d'un mot placé, quelle que soit la graine.
    expect(findWordAt(grid, { row: 0, col: 0 }, { row: 1, col: 2 })).toBeNull();
  });

  it("renvoie null pour un segment qui n'est pas un mot placé (extrémité + case intermédiaire)", () => {
    const first = target.cells[0];
    const middle = target.cells[Math.floor(target.cells.length / 2)];
    expect(findWordAt(grid, first, middle)).toBeNull();
  });
});
