import { expect, type Page } from '@playwright/test';
import { entryCells } from '../src/app/hunt/core/crossword';
import {
  CROSSWORD,
  MAX_FAILURES_BEFORE_SKIP,
  PADLOCK_RIDDLES,
  PASSWORD,
  WORD_SEARCH,
} from '../src/app/hunt/hunt-content';

/**
 * Fonctions partagées par les scénarios E2E (spec §6). Elles ne lisent jamais l'état interne de
 * l'application : tout passe par les `data-testid` exposés par les écrans, comme le ferait un
 * vrai visiteur. Les réponses et le contenu viennent de `hunt-content.ts` pour ne jamais dupliquer
 * les valeurs éditoriales.
 */

/** Coordonnées d'une case de grille (mots croisés ou mots mêlés). */
interface CellPosition {
  row: number;
  col: number;
}

/** Résout l'énigme du cadenas en répondant juste aux quatre chiffres, puis attend le retour à la carte. */
export async function solvePadlock(page: Page): Promise<void> {
  for (const riddle of PADLOCK_RIDDLES) {
    await page.getByTestId('padlock-input').fill(riddle.answer);
    await page.getByTestId('padlock-submit').click();
  }
  await expect(page.getByTestId('back-to-map')).toBeHidden();
}

/** Résout l'énigme du mot de passe, puis attend le retour à la carte. */
export async function solvePassword(page: Page): Promise<void> {
  await page.getByTestId('password-input').fill(PASSWORD.answer);
  await page.getByTestId('password-submit').click();
  await expect(page.getByTestId('back-to-map')).toBeHidden();
}

/**
 * Remplit toute la grille de mots croisés avec la solution, case par case (et non mot par mot) :
 * une entrée déjà partiellement remplie par un mot croisé écrit avant elle décalerait la saisie si
 * on tapait la réponse entière depuis le début. Toucher directement la case cible place le curseur
 * dessus, quel que soit l'ordre de remplissage. Vérifie, attend l'illumination du mot caché puis
 * clique sur « Continuer ».
 */
export async function solveCrossword(page: Page): Promise<void> {
  for (const entry of CROSSWORD.entries) {
    const cells = entryCells(entry);
    for (const [index, cell] of cells.entries()) {
      const letter = entry.answer[index];
      if (letter === '-') {
        continue; // Case pré-remplie (GRAND-MERE / GRAND-PERE), non modifiable.
      }
      await page.getByTestId(`cw-cell-${cell.row}-${cell.col}`).click();
      await page.keyboard.type(letter);
    }
  }

  await page.getByTestId('cw-check').click();
  await expect(page.getByTestId('cw-continue')).toBeVisible();
  await page.getByTestId('cw-continue').click();
  await expect(page.getByTestId('back-to-map')).toBeHidden();
}

/**
 * Lit la grille de mots mêlés affichée à l'écran, case par case, depuis le texte des `ws-cell-*`
 * (pas depuis l'état interne du service).
 */
export async function readWordSearchGrid(page: Page): Promise<string[][]> {
  const size = WORD_SEARCH.size;
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));

  const cells = await page.locator('[data-testid^="ws-cell-"]').evaluateAll((elements) =>
    elements.map((element) => ({
      testId: element.getAttribute('data-testid') ?? '',
      letter: (element.textContent ?? '').trim(),
    })),
  );

  for (const { testId, letter } of cells) {
    const match = /^ws-cell-(\d+)-(\d+)$/.exec(testId);
    if (match === null) {
      continue;
    }
    const row = Number(match[1]);
    const col = Number(match[2]);
    grid[row][col] = letter;
  }

  return grid;
}

// Les mots ne sont placés que dans ces 4 directions (spec §4.6) ; leur sens inverse n'est jamais
// utilisé, et `HuntProgressService.selectWordSearch` accepte de toute façon les deux extrémités
// dans n'importe quel ordre.
const WORD_SEARCH_DIRECTIONS: readonly CellPosition[] = [
  { row: 0, col: 1 }, // droite
  { row: 1, col: 0 }, // bas
  { row: 1, col: 1 }, // bas-droite
  { row: 1, col: -1 }, // bas-gauche
];

/** Cherche `word` dans `grid` selon les 4 directions autorisées ; renvoie ses deux extrémités. */
export function findWordEndpoints(
  grid: readonly string[][],
  word: string,
): { from: CellPosition; to: CellPosition } {
  const size = grid.length;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const step of WORD_SEARCH_DIRECTIONS) {
        const end = {
          row: row + step.row * (word.length - 1),
          col: col + step.col * (word.length - 1),
        };
        if (end.row < 0 || end.row >= size || end.col < 0 || end.col >= size) {
          continue;
        }

        let matches = true;
        for (let index = 0; index < word.length; index++) {
          const r = row + step.row * index;
          const c = col + step.col * index;
          if (grid[r][c] !== word[index]) {
            matches = false;
            break;
          }
        }

        if (matches) {
          return { from: { row, col }, to: end };
        }
      }
    }
  }

  throw new Error(`Mot "${word}" introuvable dans la grille de mots mêlés reconstituée.`);
}

/** Résout la grille de mots mêlés en sélectionnant chaque mot, puis clique sur « Continuer ». */
export async function solveWordSearch(page: Page): Promise<void> {
  const grid = await readWordSearchGrid(page);

  for (const word of WORD_SEARCH.words) {
    const { from, to } = findWordEndpoints(grid, word);
    await page.getByTestId(`ws-cell-${from.row}-${from.col}`).click();
    await page.getByTestId(`ws-cell-${to.row}-${to.col}`).click();
    await expect(page.getByTestId(`ws-word-${word}`)).toHaveClass(/found/);
  }

  await page.getByTestId('ws-continue').click();
  await expect(page.getByTestId('back-to-map')).toBeHidden();
}

/** Réponse fausse au cadenas : jamais l'une des quatre bonnes réponses (0, 4, 2 ou 7). */
export async function failPadlockDigit(page: Page): Promise<void> {
  await page.getByTestId('padlock-input').fill('9');
  await page.getByTestId('padlock-submit').click();
}

/** Réponse fausse au mot de passe. */
export async function failPassword(page: Page): Promise<void> {
  await page.getByTestId('password-input').fill('mauvais mot de passe');
  await page.getByTestId('password-submit').click();
}

/** « Vérifier » sur une grille vide (ou fausse) : compte comme un échec pour chaque mot. */
export async function failCrossword(page: Page): Promise<void> {
  await page.getByTestId('cw-check').click();
}

/**
 * Sélection invalide de mots mêlés : deux cases voisines ne peuvent jamais former les deux
 * extrémités d'un mot de la liste (le plus court fait 4 lettres, donc au moins 3 cases d'écart).
 */
export async function failWordSearchSelection(page: Page): Promise<void> {
  await page.getByTestId('ws-cell-0-0').click();
  await page.getByTestId('ws-cell-0-1').click();
}

/**
 * Échoue `MAX_FAILURES_BEFORE_SKIP` fois via `failAction`, puis clique sur « Passer l'énigme »
 * (qui n'apparaît qu'à partir de ce seuil, spec §4.2).
 */
export async function skipRiddle(
  page: Page,
  failAction: (page: Page) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_FAILURES_BEFORE_SKIP; attempt++) {
    await failAction(page);
  }
  await page.getByTestId('skip').click();
}
