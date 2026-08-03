import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
  Proves the suite is pointed at THIS repo's freshly built dist/ before a single
  real test runs.

  Why this exists: `webServer.reuseExistingServer` is on locally, so Playwright
  attaches to whatever already answers on the port instead of starting its own
  `astro preview`. The port used to default to 4321 — the same port `astro dev`
  binds — so with a dev server running, the entire suite silently tested that
  server's live, mid-edit state instead of the build. It does not error; it just
  reports about the wrong thing. That cost a full debugging cycle: eleven tests
  "failed", a widget rebuild got the blame, and the specs were in fact fine.

  `astro preview` serves dist/index.html byte-for-byte, so comparing the served
  bytes against the file on disk is an exact identity check. One assertion, and
  every way of pointing at the wrong thing fails loudly and by name:

    - a dev server            → also carries the @vite/client injection
    - a different project     → bytes differ
    - a different worktree    → bytes differ
    - a server started before the last build (the reuse footgun) → bytes differ,
      which is the "you must build first" note in playwright.config turned into
      something that actually fires

  If this ever fails for a legitimate reason — a preview server that starts
  rewriting HTML, say — narrow the comparison, do not delete it.
*/

const DIST_INDEX = fileURLToPath(new URL('../dist/index.html', import.meta.url));

test('preflight: the target is this repo\'s freshly built dist/', async ({ request, baseURL }) => {
  expect(existsSync(DIST_INDEX),
    `No dist/index.html — run \`npm run build\` before \`npm run test:e2e\`.`).toBe(true);

  let res;
  try {
    res = await request.get('/');
  } catch (err) {
    throw new Error(`Nothing answered at ${baseURL} — ${err.message}`);
  }
  expect(res.status(), `${baseURL} answered ${res.status()} for /`).toBe(200);

  const served = await res.text();
  const onDisk = readFileSync(DIST_INDEX, 'utf8');
  if (served === onDisk) return;

  // Diverged — say precisely which wrong thing is on the port.
  if (/@vite\/client|astro-dev-toolbar/.test(served)) {
    throw new Error(
      `${baseURL} is an astro DEV server, not the built site.\n` +
      `  e2e must run against dist/ so it tests what production serves.\n` +
      `  Fix: stop the dev server, or run the suite on another port:\n` +
      `      PREVIEW_PORT=4610 npm run test:e2e`,
    );
  }

  const at = [...served].findIndex((c, i) => c !== onDisk[i]);
  throw new Error(
    `${baseURL} is not serving this repo's dist/index.html.\n` +
    `  served ${served.length} bytes, dist/index.html is ${onDisk.length}; first difference at byte ${at}.\n` +
    `  served:  ${JSON.stringify(served.slice(Math.max(0, at - 40), at + 40))}\n` +
    `  on disk: ${JSON.stringify(onDisk.slice(Math.max(0, at - 40), at + 40))}\n` +
    `  Usually one of: another project/worktree holds the port, or the server was\n` +
    `  started before the last \`npm run build\` (reuseExistingServer kept the stale one).\n` +
    `  Fix: stop whatever holds ${baseURL}, rebuild, and re-run — or set PREVIEW_PORT.`,
  );
});
