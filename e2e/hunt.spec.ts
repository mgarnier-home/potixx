import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Chaque test part d'une partie neuve.
  await page.addInitScript(() => localStorage.removeItem('potixx.progress.v1'));
});

test('map shows the first step', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('step-padlock')).toBeVisible();
  await expect(page.getByTestId('step-padlock')).toHaveClass(/current/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('opens the current step and goes back to the map', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('step-padlock').click();
  await expect(page.getByRole('heading', { name: 'Le cadenas' })).toBeVisible();

  await page.getByTestId('back-to-map').click();
  await expect(page.getByTestId('step-padlock')).toBeVisible();
});

test('crossword: typing through the hidden input fills the grid and a check locks a correct word', async ({
  page,
}) => {
  // Cadenas et mot de passe déjà résolus : les mots croisés sont l'étape courante.
  await page.addInitScript(() =>
    localStorage.setItem(
      'potixx.progress.v1',
      JSON.stringify({
        version: 1,
        padlock: { digitIndex: 4, failures: 0, solved: true },
        password: { failures: 0, solved: true },
        crossword: { letters: {}, locked: [], failures: 0, solved: false },
        wordSearch: { seed: 42, found: [], failures: 0, solved: false },
      }),
    ),
  );
  await page.goto('/');

  await page.getByTestId('step-crossword').click();
  await page.getByTestId('cw-clue-1').click();
  await page.keyboard.type('cousin');

  await expect(page.getByTestId('cw-cell-0-1')).toHaveText('1C');
  await expect(page.getByTestId('cw-cell-5-1')).toHaveText('N');

  await page.getByTestId('cw-clue-3').click();
  await page.keyboard.type('oeuz');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('r');
  await expect(page.getByTestId('cw-cell-3-5')).toHaveText('R');

  await page.getByTestId('cw-check').click();
  await expect(page.getByTestId('cw-cell-0-1')).toHaveClass(/locked/);
  await expect(page.getByTestId('cw-cell-11-1')).toHaveClass(/wrong/);
});
