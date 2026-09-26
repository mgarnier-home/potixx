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
