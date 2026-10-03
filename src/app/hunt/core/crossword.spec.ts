import { cellKey } from "./cell";
import { CROSSWORD } from "../hunt-content";
import { buildSolution, checkCrossword, prefilledCells } from "./crossword";

describe("buildSolution", () => {
  it("content is consistent : ne lève pas et toutes les cases sont dans la grille 14×10", () => {
    let solution: Map<string, string> | undefined;
    expect(() => {
      solution = buildSolution(CROSSWORD);
    }).not.toThrow();

    for (const entry of CROSSWORD.entries) {
      const rowStep = entry.orientation === "down" ? 1 : 0;
      const colStep = entry.orientation === "across" ? 1 : 0;
      for (let i = 0; i < entry.answer.length; i++) {
        const row = entry.start.row + rowStep * i;
        const col = entry.start.col + colStep * i;
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(CROSSWORD.rows);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(CROSSWORD.cols);
      }
    }

    expect(solution).toBeDefined();
  });

  it("highlight spells AGRANDIRA", () => {
    const solution = buildSolution(CROSSWORD);
    const word = CROSSWORD.highlight.map((cell) => solution.get(cellKey(cell))).join("");
    expect(word).toBe("AGRANDIRA");
  });

  it("intersections from activity.png", () => {
    const solution = buildSolution(CROSSWORD);
    expect(solution.get(cellKey({ row: 3, col: 1 }))).toBe("S");
    expect(solution.get(cellKey({ row: 3, col: 5 }))).toBe("R");
    expect(solution.get(cellKey({ row: 5, col: 5 }))).toBe("N");
    expect(solution.get(cellKey({ row: 7, col: 5 }))).toBe("-");
    expect(solution.get(cellKey({ row: 7, col: 2 }))).toBe("A");
    expect(solution.get(cellKey({ row: 9, col: 2 }))).toBe("R");
    expect(solution.get(cellKey({ row: 9, col: 5 }))).toBe("E");
    expect(solution.get(cellKey({ row: 11, col: 0 }))).toBe("A");
    expect(solution.get(cellKey({ row: 11, col: 2 }))).toBe("I");
  });
});

describe("checkCrossword", () => {
  it("grille vide → les 9 entrées fausses", () => {
    const result = checkCrossword(CROSSWORD, {});
    expect(result.wrongEntries).toEqual(CROSSWORD.entries.map((entry) => entry.number));
    expect(result.solved).toBe(false);
  });

  it("solution complète → solved: true", () => {
    const solution = buildSolution(CROSSWORD);
    const letters: Record<string, string> = {};
    solution.forEach((letter, key) => (letters[key] = letter));

    const result = checkCrossword(CROSSWORD, letters);
    expect(result.wrongEntries).toEqual([]);
    expect(result.solved).toBe(true);
  });

  it("solution avec COUSIN modifié → wrongEntries: [1]", () => {
    const solution = buildSolution(CROSSWORD);
    const letters: Record<string, string> = {};
    solution.forEach((letter, key) => (letters[key] = letter));
    letters[cellKey({ row: 0, col: 1 })] = "Z";

    const result = checkCrossword(CROSSWORD, letters);
    expect(result.wrongEntries).toEqual([1]);
    expect(result.solved).toBe(false);
  });
});

describe("prefilledCells", () => {
  it("→ exactement 7,5 avec '-'", () => {
    const prefilled = prefilledCells(CROSSWORD);
    expect(Array.from(prefilled.keys())).toEqual(["7,5"]);
    expect(prefilled.get("7,5")).toBe("-");
  });
});
