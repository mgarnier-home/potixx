import { expect, test } from "@playwright/test";
import { PADLOCK_RIDDLES, TREASURE, WORD_SEARCH } from "../src/app/hunt/hunt-content";
import {
  crosswordEntryCells,
  failCrossword,
  failPadlockDigit,
  failPassword,
  failWordSearchSelection,
  findWordEndpoints,
  readWordSearchGrid,
  skipRiddle,
  solveCrossword,
  solvePadlock,
  solvePassword,
  solveWordSearch,
  typeCrosswordEntry,
} from "./helpers";

// Chaque test Playwright s'exécute dans un contexte de navigateur neuf (comportement par défaut) :
// le stockage local part donc déjà vide, sans avoir besoin de le vider explicitement. C'est
// important pour le scénario de rechargement ci-dessous, qui doit conserver la progression écrite
// avant son `page.reload()`.

test("map shows the first step", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("step-padlock")).toBeVisible();
  await expect(page.getByTestId("step-padlock")).toHaveClass(/current/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("opens the current step and goes back to the map", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("step-padlock").click();
  await expect(page.getByRole("heading", { name: "Le cadenas" })).toBeVisible();

  await page.getByTestId("back-to-map").click();
  await expect(page.getByTestId("step-padlock")).toBeVisible();
});

test("crossword: typing through the hidden input fills the grid and a check locks a correct word", async ({
  page,
}) => {
  // Cadenas et mot de passe déjà résolus : les mots croisés sont l'étape courante.
  await page.addInitScript(() =>
    localStorage.setItem(
      "potixx.progress.v1",
      JSON.stringify({
        version: 1,
        padlock: { digitIndex: 4, failures: 0, solved: true },
        password: { failures: 0, solved: true },
        crossword: { letters: {}, locked: [], failures: 0, solved: false },
        wordSearch: { seed: 42, found: [], failures: 0, solved: false },
      }),
    ),
  );
  await page.goto("/");

  await page.getByTestId("step-crossword").click();
  await page.getByTestId("cw-clue-1").click();
  await page.keyboard.type("cousin");

  await expect(page.getByTestId("cw-cell-0-1")).toHaveText("1C");
  await expect(page.getByTestId("cw-cell-5-1")).toHaveText("N");

  // Une définition place toujours le curseur sur la première case du mot (spec §4.5).
  await page.getByTestId("cw-clue-3").click();
  await page.keyboard.type("soeuz");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("r");
  await expect(page.getByTestId("cw-cell-3-5")).toHaveText("R");

  await page.getByTestId("cw-check").click();
  await expect(page.getByTestId("cw-cell-0-1")).toHaveClass(/locked/);
  await expect(page.getByTestId("cw-cell-11-1")).toHaveClass(/wrong/);
});

test("crossword: whole words typed from their clues stay aligned across locked words and solve the grid", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "potixx.progress.v1",
      JSON.stringify({
        version: 1,
        padlock: { digitIndex: 4, failures: 0, solved: true },
        password: { failures: 0, solved: true },
        crossword: { letters: {}, locked: [], failures: 0, solved: false },
        wordSearch: { seed: 42, found: [], failures: 0, solved: false },
      }),
    ),
  );
  await page.goto("/");
  await page.getByTestId("step-crossword").click();

  // COUSIN, SOEUR et ONCLE juste verrouillés ; GRAND-PERE les croise tous les trois.
  await typeCrosswordEntry(page, 1);
  await page.getByTestId("cw-check").click();
  await expect(page.getByTestId("cw-cell-3-1")).toHaveClass(/locked/);

  await typeCrosswordEntry(page, 3); // SOEUR : le S verrouillé est tapé par-dessus.
  await typeCrosswordEntry(page, 4);
  await page.getByTestId("cw-check").click();
  await expect(page.getByTestId("cw-cell-5-5")).toHaveClass(/locked/);

  await typeCrosswordEntry(page, 2); // GRANDPERE : croise R et N verrouillés, saute le « - ».
  for (const number of [1, 2, 3, 4]) {
    for (const { testId, letter } of crosswordEntryCells(number)) {
      await expect(page.getByTestId(testId)).toContainText(letter);
    }
  }

  for (const number of [5, 6, 7, 8, 9]) {
    await typeCrosswordEntry(page, number);
  }
  await page.getByTestId("cw-check").click();
  await expect(page.getByTestId("cw-continue")).toBeVisible();
});

test("treasure: shows the reveal and restart sends back to a fresh map", async ({ page }) => {
  // Les quatre énigmes déjà résolues : le trésor est l'étape courante.
  await page.addInitScript(() =>
    localStorage.setItem(
      "potixx.progress.v1",
      JSON.stringify({
        version: 1,
        padlock: { digitIndex: 4, failures: 0, solved: true },
        password: { failures: 0, solved: true },
        crossword: { letters: {}, locked: [], failures: 0, solved: true },
        wordSearch: { seed: 42, found: [], failures: 0, solved: true },
      }),
    ),
  );
  await page.goto("/");

  await page.getByTestId("step-treasure").click();
  await expect(page.getByTestId("treasure-message")).toHaveText(
    "Notre famille s'agrandira en Avril 2027",
  );
  // La scène est tirée au sort : le coffre (avec le bébé) ou la mouette.
  await expect(
    page.getByTestId("treasure-chest").or(page.getByTestId("treasure-gull")),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("restart").click();
  await expect(page.getByTestId("treasure-message")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("restart").click();
  await expect(page.getByTestId("step-padlock")).toBeVisible();
  await expect(page.getByTestId("step-padlock")).toHaveClass(/current/);
});

test("full hunt with correct answers", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("step-padlock").click();
  await solvePadlock(page);

  await page.getByTestId("step-password").click();
  await solvePassword(page);

  await page.getByTestId("step-crossword").click();
  await solveCrossword(page);

  await page.getByTestId("step-wordSearch").click();
  await solveWordSearch(page);

  await page.getByTestId("step-treasure").click();
  await expect(page.getByTestId("treasure-message")).toHaveText(TREASURE.message);
});

test("full hunt by skipping every riddle", async ({ page }) => {
  await page.goto("/");

  // Le cadenas a 4 chiffres à passer un par un : 3 échecs puis « Passer » à chacun.
  await page.getByTestId("step-padlock").click();
  let remainingDigits = PADLOCK_RIDDLES.length;
  while (remainingDigits > 0) {
    await skipRiddle(page, failPadlockDigit);
    remainingDigits--;
  }
  await expect(page.getByTestId("back-to-map")).toBeHidden();

  await page.getByTestId("step-password").click();
  await skipRiddle(page, failPassword);
  await expect(page.getByTestId("password-continue")).toBeVisible();
  await page.getByTestId("password-continue").click();
  await expect(page.getByTestId("back-to-map")).toBeHidden();

  await page.getByTestId("step-crossword").click();
  await skipRiddle(page, failCrossword);
  await expect(page.getByTestId("cw-continue")).toBeVisible();
  await page.getByTestId("cw-continue").click();
  await expect(page.getByTestId("back-to-map")).toBeHidden();

  await page.getByTestId("step-wordSearch").click();
  await skipRiddle(page, failWordSearchSelection);
  await expect(page.getByTestId("ws-continue")).toBeVisible();
  await page.getByTestId("ws-continue").click();
  await expect(page.getByTestId("back-to-map")).toBeHidden();

  await page.getByTestId("step-treasure").click();
  await expect(page.getByTestId("treasure-message")).toHaveText(TREASURE.message);
});

test("progress survives reload", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("step-padlock").click();
  await solvePadlock(page);
  await page.getByTestId("step-password").click();
  await solvePassword(page);
  await page.getByTestId("step-crossword").click();
  await solveCrossword(page);

  // Un seul mot mêlé trouvé, pour vérifier que le reste de la grille et sa progression survivent.
  await page.getByTestId("step-wordSearch").click();
  const grid = await readWordSearchGrid(page);
  const word = WORD_SEARCH.words[0];
  const { from, to } = findWordEndpoints(grid, word);
  await page.getByTestId(`ws-cell-${from.row}-${from.col}`).click();
  await page.getByTestId(`ws-cell-${to.row}-${to.col}`).click();
  await expect(page.getByTestId(`ws-word-${word}`)).toHaveClass(/found/);
  const rowZeroBeforeReload = grid[0].join("");

  await page.reload();

  await expect(page.getByTestId("step-wordSearch")).toHaveClass(/current/);

  await page.getByTestId("step-wordSearch").click();
  const gridAfterReload = await readWordSearchGrid(page);
  expect(gridAfterReload[0].join("")).toBe(rowZeroBeforeReload);
  await expect(page.getByTestId(`ws-word-${word}`)).toHaveClass(/found/);
});
