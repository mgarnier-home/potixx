import type { Cell } from "./cell";
import {
  findWordAt,
  generateWordSearch,
  type PlacedWord,
  type WordSearchGrid,
} from "./word-search";

// Liste de mots de la spec §4.6 (thème naissance/bébé).
const WORDS = [
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
] as const;

const SIZE = 10;
const SEED_COUNT = 200;

// Pas (deltaRow,deltaCol) autorisés entre deux cases consécutives d'un mot placé : les 8
// directions (horizontale, verticale, diagonales, dans les deux sens de lecture).
const ALLOWED_STEPS = new Set([
  "0,1", // droite
  "0,-1", // gauche
  "1,0", // bas
  "-1,0", // haut
  "1,1", // bas-droite
  "-1,-1", // haut-gauche
  "1,-1", // bas-gauche
  "-1,1", // haut-droite
]);

function wordFromCells(grid: WordSearchGrid, cells: Cell[]): string {
  return cells.map((cell) => grid.letters[cell.row][cell.col]).join("");
}

/** Pas (deltaRow, deltaCol) entre les deux premières cases d'un mot placé, réduit à -1/0/1. */
function stepOf(cells: readonly Cell[]): { rowStep: number; colStep: number } {
  return {
    rowStep: Math.sign(cells[1].row - cells[0].row),
    colStep: Math.sign(cells[1].col - cells[0].col),
  };
}

function isDiagonal(step: { rowStep: number; colStep: number }): boolean {
  return step.rowStep !== 0 && step.colStep !== 0;
}

// Décision retenue (voir word-search.ts) : un mot est « à l'envers » si sa direction a une
// composante gauche (colStep -1) ou haut (rowStep -1).
function isReversed(step: { rowStep: number; colStep: number }): boolean {
  return step.rowStep === -1 || step.colStep === -1;
}

describe("generateWordSearch", () => {
  it(`place les 10 mots pour ${SEED_COUNT} graines différentes`, () => {
    for (let seed = 1; seed <= SEED_COUNT; seed++) {
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

  it("n'utilise que les 8 directions autorisées, pas entre cases consécutives", () => {
    for (let seed = 1; seed <= SEED_COUNT; seed++) {
      const grid = generateWordSearch(WORDS, SIZE, seed);

      grid.words.forEach((placed) => {
        for (let i = 1; i < placed.cells.length; i++) {
          const rowStep = placed.cells[i].row - placed.cells[i - 1].row;
          const colStep = placed.cells[i].col - placed.cells[i - 1].col;
          expect(ALLOWED_STEPS.has(`${rowStep},${colStep}`)).toBe(true);
        }
      });
    }
  });

  it("place au moins 3 mots en diagonale et au moins 2 mots à l’envers, sur chaque grille", () => {
    for (let seed = 1; seed <= SEED_COUNT; seed++) {
      const grid = generateWordSearch(WORDS, SIZE, seed);

      const diagonalCount = grid.words.filter((placed) => isDiagonal(stepOf(placed.cells))).length;
      const reversedCount = grid.words.filter((placed) => isReversed(stepOf(placed.cells))).length;

      expect(diagonalCount).toBeGreaterThanOrEqual(3);
      expect(reversedCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("est déterministe pour une même graine", () => {
    const a = generateWordSearch(WORDS, SIZE, 7);
    const b = generateWordSearch(WORDS, SIZE, 7);
    expect(a).toEqual(b);
  });

  it("se régénère à l’identique à partir de la graine renvoyée", () => {
    const first = generateWordSearch(WORDS, SIZE, 123);
    const second = generateWordSearch(WORDS, SIZE, first.seed);
    expect(second.letters).toEqual(first.letters);
  });

  it("un mot palindrome ajouté à la liste ne fait pas échouer la génération", () => {
    const wordsWithPalindrome = [...WORDS, "ELLE"];

    for (let seed = 1; seed <= 50; seed++) {
      expect(() => generateWordSearch(wordsWithPalindrome, SIZE, seed)).not.toThrow();

      const grid = generateWordSearch(wordsWithPalindrome, SIZE, seed);
      expect(grid.words.some((placed) => placed.word === "ELLE")).toBe(true);
    }
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

/**
 * Ensemble des cases (en clé triée, indépendante du sens de lecture) où `word` apparaît dans
 * `letters`, dans l'une des 8 directions. Deux lectures d'un même mot sur les mêmes cases (avant
 * et arrière, cas d'un palindrome) comptent comme un seul ensemble : ce sont les mêmes cases
 * visibles à l'écran, pas deux occurrences différentes.
 */
function distinctOccurrenceCellSets(letters: string[][], size: number, word: string): Set<string> {
  const sets = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const step of ALL_SEARCH_STEPS) {
        const cells: Cell[] = [];
        let matches = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + step.rowStep * i;
          const c = col + step.colStep * i;
          if (r < 0 || r >= size || c < 0 || c >= size || letters[r][c] !== word[i]) {
            matches = false;
            break;
          }
          cells.push({ row: r, col: c });
        }
        if (matches) {
          const key = cells
            .map((cell) => `${cell.row},${cell.col}`)
            .sort()
            .join("|");
          sets.add(key);
        }
      }
    }
  }
  return sets;
}

describe("generateWordSearch — pas de mot dupliqué visible", () => {
  it(`chaque mot n'apparaît qu'à sa position placée, sur ${SEED_COUNT} graines, dans les 8 directions`, () => {
    for (let seed = 1; seed <= SEED_COUNT; seed++) {
      const grid = generateWordSearch(WORDS, SIZE, seed);

      for (const word of WORDS) {
        expect(distinctOccurrenceCellSets(grid.letters, SIZE, word).size).toBe(1);
      }
    }
  });

  it("un mot palindrome n'apparaît qu'à sa position placée (les deux sens de lecture comptent pour un seul ensemble de cases)", () => {
    const wordsWithPalindrome = [...WORDS, "ELLE"];

    for (let seed = 1; seed <= 50; seed++) {
      const grid = generateWordSearch(wordsWithPalindrome, SIZE, seed);
      expect(distinctOccurrenceCellSets(grid.letters, SIZE, "ELLE").size).toBe(1);
    }
  });
});

describe("findWordAt", () => {
  let grid: WordSearchGrid;
  let target: PlacedWord;

  beforeEach(() => {
    grid = generateWordSearch(WORDS, SIZE, 7);
    target = grid.words[0];
  });

  it("trouve un mot placé en touchant ses deux extrémités, dans les deux sens", () => {
    const first = target.cells[0];
    const last = target.cells[target.cells.length - 1];

    expect(findWordAt(grid, first, last)).toEqual(target);
    expect(findWordAt(grid, last, first)).toEqual(target);
  });

  it("trouve un mot placé à l’envers dans les deux sens de toucher", () => {
    // Cherche, dans un lot de grilles, un mot dont la direction est « à l'envers » (au moins 2
    // par grille, garanti ci-dessus) pour vérifier que findWordAt ne privilégie pas un sens.
    let reversedWord: PlacedWord | undefined;
    for (let seed = 1; reversedWord === undefined && seed <= SEED_COUNT; seed++) {
      const candidateGrid = generateWordSearch(WORDS, SIZE, seed);
      reversedWord = candidateGrid.words.find((placed) => isReversed(stepOf(placed.cells)));
      if (reversedWord !== undefined) {
        grid = candidateGrid;
      }
    }

    expect(reversedWord).toBeDefined();
    const first = reversedWord!.cells[0];
    const last = reversedWord!.cells[reversedWord!.cells.length - 1];

    expect(findWordAt(grid, first, last)).toEqual(reversedWord);
    expect(findWordAt(grid, last, first)).toEqual(reversedWord);
  });

  it("renvoie null pour une sélection à une seule case", () => {
    const cell = target.cells[0];
    expect(findWordAt(grid, cell, cell)).toBeNull();
  });

  it("renvoie null pour deux cases dont aucun mot ne relie exactement les extrémités", () => {
    // (0,0) → (1,2) : delta (1,2) n'est atteignable par aucune des 8 directions (elles exigent
    // |rowStep| === |colStep| ou l'un des deux nul), donc ce ne peuvent être les deux extrémités
    // d'un mot placé, quelle que soit la graine.
    expect(findWordAt(grid, { row: 0, col: 0 }, { row: 1, col: 2 })).toBeNull();
  });

  it("renvoie null pour un segment qui n'est pas un mot placé (extrémité + case intermédiaire)", () => {
    const first = target.cells[0];
    const middle = target.cells[Math.floor(target.cells.length / 2)];
    expect(findWordAt(grid, first, middle)).toBeNull();
  });
});
