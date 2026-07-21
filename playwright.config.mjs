import { defineConfig, devices } from '@playwright/test';

// Smoke tests only. Their single job is to BOOT the built app in a real browser
// and prove the generator island hydrates — the one thing `npm test`, `npm run
// build` and `check-build.mjs` all miss. A hydration crash (see NEXT-PHASES.md:
// `drawMod` not exported) passed every one of those and still took the generator
// off every page for 18 minutes. This is the gate that would have caught it.
//
// Runs against `astro preview` (the built dist/, not the dev server) so what CI
// tests is what production serves. `webServer` builds nothing — CI builds first;
// locally you must `npm run build` before `npm run test:e2e`.

const PORT = Number(process.env.PREVIEW_PORT) || 4321;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Keep a trace for any failed test so a red CI run is debuggable from the
    // uploaded artifact without a local repro.
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
