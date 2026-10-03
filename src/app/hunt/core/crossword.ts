import type { Cell } from "./cell";
import { cellKey } from "./cell";

/** Sens d'une entrée dans la grille de mots croisés. */
export type Orientation = "across" | "down";

/** Une entrée (un mot) de la grille de mots croisés. */
export interface CrosswordEntry {
  number: number;
  answer: string;
  orientation: Orientation;
  start: Cell;
  clue: string;
}

/** Définition complète de la grille de mots croisés (contenu éditorial). */
export interface CrosswordDefinition {
  rows: number;
  cols: number;
  entries: CrosswordEntry[];
  highlight: Cell[];
  hiddenWord: string;
}

/** Résultat de la vérification de la grille remplie par le visiteur. */
export interface CrosswordCheck {
  wrongEntries: number[];
  solved: boolean;
}

/** Renvoie les cases occupées par une entrée, dans l'ordre des lettres de sa réponse. */
export function entryCells(entry: CrosswordEntry): Cell[] {
  const rowStep = entry.orientation === "down" ? 1 : 0;
  const colStep = entry.orientation === "across" ? 1 : 0;

  return Array.from({ length: entry.answer.length }, (_, index) => ({
    row: entry.start.row + rowStep * index,
    col: entry.start.col + colStep * index,
  }));
}

/**
 * Construit la solution de la grille (case → lettre) à partir des entrées.
 * Lève une Error si deux entrées se contredisent sur une case partagée.
 */
export function buildSolution(def: CrosswordDefinition): Map<string, string> {
  const solution = new Map<string, string>();

  for (const entry of def.entries) {
    const cells = entryCells(entry);
    cells.forEach((cell, index) => {
      const key = cellKey(cell);
      const letter = entry.answer[index];
      const existing = solution.get(key);
      if (existing !== undefined && existing !== letter) {
        throw new Error(
          `Croisement incohérent en ${key} : "${existing}" (déjà posé) contre "${letter}" (entrée n°${entry.number}).`,
        );
      }
      solution.set(key, letter);
    });
  }

  return solution;
}

/** Renvoie les cases pré-remplies (le caractère '-') et non modifiables par le visiteur. */
export function prefilledCells(def: CrosswordDefinition): Map<string, string> {
  const solution = buildSolution(def);
  const prefilled = new Map<string, string>();

  solution.forEach((letter, key) => {
    if (letter === "-") {
      prefilled.set(key, letter);
    }
  });

  return prefilled;
}

/**
 * Vérifie la grille remplie par le visiteur. Une entrée est fausse si une de ses cases
 * (hors '-') est vide ou différente de la solution. `solved` si aucune entrée n'est fausse.
 */
export function checkCrossword(
  def: CrosswordDefinition,
  letters: Record<string, string>,
): CrosswordCheck {
  const solution = buildSolution(def);
  const wrongEntries: number[] = [];

  for (const entry of def.entries) {
    const cells = entryCells(entry);
    const isWrong = cells.some((cell) => {
      const key = cellKey(cell);
      const expected = solution.get(key);
      if (expected === "-") {
        return false;
      }
      const actual = letters[key];
      return actual === undefined || actual === "" || actual !== expected;
    });

    if (isWrong) {
      wrongEntries.push(entry.number);
    }
  }

  return { wrongEntries, solved: wrongEntries.length === 0 };
}
