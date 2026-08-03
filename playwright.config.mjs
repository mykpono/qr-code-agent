import { defineConfig, devices } from '@playwright/test';

// Smoke tests only. Their single job is to BOOT the built app in a real browser
// and prove the generator island hydrates — the one thing `npm test`, `npm run
// build` and `check-build.mjs` all miss. A hydration crash (see NEXT-PHASES.md:
// `drawMod` not exported) passed every one of those and still took the generator
// off every page for 18 minutes. This is the gate that would have caught it.
//
// Runs against `astro preview` (the built dist/, not the dev server) so what CI
// tests is what production serves. `webServer` builds nothing — CI builds first;
// locally you must `npm run build` before `npm run test:e2e`. The `preflight`
// project below enforces both of those rather than trusting them.
//
// NOT 4321: that is the port `astro dev` binds, and `reuseExistingServer` is on
// locally, so a running dev server used to capture the whole suite silently —
// every test reporting on mid-edit source instead of the build. 4331 is this
// suite's own port; override with PREVIEW_PORT when it is taken.
const PORT = Number(process.env.PREVIEW_PORT) || 4331;

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
  // `preflight` gates everything else: if the port holds the wrong server, the
  // suite stops with one named failure instead of a screenful of misleading
  // ones. A setup project (not globalSetup) because it must run AFTER webServer
  // has had its chance to start, which is exactly what `dependencies` gives.
  projects: [
    { name: 'preflight', testMatch: /preflight\.setup\.mjs$/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /preflight\.setup\.mjs$/,
      dependencies: ['preflight'],
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
