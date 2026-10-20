import { defineConfig } from '@playwright/test';

// Run with `npm run test:e2e` (starts the Firebase Emulator automatically).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --mode emulator --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
