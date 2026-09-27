import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E de la chasse au trésor, sur téléphone (iPhone 13 simulé dans Chromium) et sur
 * ordinateur (Chromium 1280×800). Le serveur de dev Angular est lancé automatiquement.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // En CI, le rapport 'line' seul n'écrit rien sur disque : on ajoute le rapport HTML (sans
  // l'ouvrir automatiquement) pour avoir un artefact exploitable en cas d'échec.
  reporter: process.env['CI'] ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
