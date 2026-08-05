// Push every built URL to IndexNow, which feeds Bing (and Yandex, Seznam, Naver).
//
//   npm run indexnow:submit              # read dist/sitemap.xml, submit every URL
//   npm run indexnow:submit -- --dry-run # build the payload, call nothing
//   npm run indexnow:submit -- --check   # only verify the key file is served
//   npm run indexnow:submit -- --await-deploy   # wait for the deploy, then submit
//
// The flags combine: `-- --await-deploy --dry-run` runs the wait for real and
// then stops, which rehearses the workflow's exact path without announcing
// anything. `--dry-run` on its own still makes no network call at all.
//
// ── Why this exists ────────────────────────────────────────────────────────
// Plan task A6 asks for Bing Webmaster Tools verification so Bing indexes the
// site — the stated reason being that Bing's index feeds Copilot and parts of
// ChatGPT search, so it is AEO infrastructure rather than Bing traffic.
//
// Webmaster Tools needs an account. IndexNow reaches the same index and needs
// none: domain ownership is proven by hosting a key file, not by signing in.
// It does NOT replace A6 — Webmaster Tools is still where you *read* indexation
// numbers, and nothing here reports back. What it replaces is the manual "submit
// the sitemap again" step after every deploy that adds or changes URLs.
//
// ── How the key works ──────────────────────────────────────────────────────
// public/<key>.txt contains the key and nothing else. It is PUBLIC by design —
// it is not a secret, it is a proof of write access to the domain. Anyone can
// read it; only someone who can publish at this origin could have put it there.
// Committing it is correct. If it ever 404s, every submission is rejected, which
// is why check-build.mjs asserts it is served and why --check exists.
//
// Rotating it: generate a new hex key, drop the old file, add the new one, and
// update KEY below. There is no revocation step.
//
// ── Why --await-deploy exists ──────────────────────────────────────────────
// .github/workflows/indexnow.yml runs this on every push to main, in parallel
// with Vercel's build. Without a wait it would announce URLs that are not
// deployed yet, and a brand-new locale's 50 URLs would be handed to crawlers
// while they still 404 — a worse outcome than the missed submit this automation
// exists to prevent.
//
// The wait polls the LIVE sitemap until it lists every URL in the freshly built
// one. That is the deploy's own artifact, so once it names the new URLs the
// deploy has landed; and it makes the guarantee we actually care about explicit:
// never announce a URL that is not live.
//
// LIMIT, stated plainly: for a deploy that changes only page CONTENT and adds no
// URL, the live sitemap already satisfies the check and the wait returns at once,
// so the submit can precede the deploy by a minute or two. That is harmless —
// the URLs all exist, and crawlers arrive minutes to hours later, reading
// whatever is current then. Only the never-404 property is load-bearing here.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const KEY = '8a8056c4eb1dddf9fff1af976d2ae99f';
const HOST = 'qrcodeagent.net';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const LIVE_SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // IndexNow rejects larger batches with 422

// Vercel builds this site in about two minutes; ten is slack for a queued or
// retried deploy without letting a wedged one hang a workflow indefinitely.
const DEPLOY_POLL_MS = 15000;
const DEPLOY_TIMEOUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const CHECK_ONLY = args.includes('--check');
const AWAIT_DEPLOY = args.includes('--await-deploy');

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseLocs = (xml) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());

/* ---------- collect URLs from the built sitemap ---------- */
function readUrls() {
  const sitemap = fileURLToPath(new URL('../dist/sitemap.xml', import.meta.url));
  if (!existsSync(sitemap)) die('dist/sitemap.xml not found — run `npm run build` first');
  const urls = parseLocs(readFileSync(sitemap, 'utf8'));
  if (!urls.length) die('sitemap contained no <loc> entries');

  // A key at the site root authorises the whole origin, but a URL from another
  // host in the batch invalidates the entire request rather than being skipped.
  const foreign = urls.filter((u) => !u.startsWith(`https://${HOST}/`) && u !== `https://${HOST}`);
  if (foreign.length) die(`sitemap contains ${foreign.length} URL(s) outside ${HOST}: ${foreign[0]}`);
  if (urls.length > MAX_URLS) die(`${urls.length} URLs exceeds the ${MAX_URLS} per-request limit`);
  return urls;
}

/* ---------- wait until the deploy actually serves the built URLs ---------- */
// Resolves once the live sitemap lists every built URL. Dies on timeout rather
// than submitting anyway: a deploy that never landed means the URLs below it did
// not either, and announcing them would be the failure this wait prevents.
async function awaitDeploy(builtUrls) {
  const want = new Set(builtUrls);
  const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
  let lastLive = -1;

  for (let attempt = 1; ; attempt++) {
    let live = [];
    try {
      const res = await fetch(LIVE_SITEMAP, { cache: 'no-store' });
      if (res.ok) live = parseLocs(await res.text());
      else console.log(`  ${LIVE_SITEMAP} returned ${res.status} — deploy still in flight`);
    } catch (e) {
      // A transient network blip must not end the wait; the deadline does that.
      console.log(`  could not reach ${LIVE_SITEMAP}: ${e.message}`);
    }

    const liveSet = new Set(live);
    const missing = [...want].filter((u) => !liveSet.has(u));
    if (!missing.length && live.length) {
      console.log(`✓ deploy is live — all ${want.size} built URLs are in ${LIVE_SITEMAP}`);
      return;
    }

    if (live.length !== lastLive) {
      console.log(`  waiting for deploy · ${want.size - missing.length}/${want.size} built URLs live`
        + ` (live sitemap has ${live.length})`);
      lastLive = live.length;
    }

    if (Date.now() >= deadline) {
      die(`deploy did not land within ${DEPLOY_TIMEOUT_MS / 60000} min — `
        + `${missing.length} built URL(s) still absent from ${LIVE_SITEMAP}, e.g. ${missing[0]}. `
        + 'Nothing was submitted. Check the Vercel deployment for this commit, then re-run.');
    }
    if (attempt === 1) console.log(`  polling every ${DEPLOY_POLL_MS / 1000}s…`);
    await sleep(DEPLOY_POLL_MS);
  }
}

/* ---------- the key file must be live BEFORE submitting ---------- */
async function checkKeyFile() {
  let res;
  try { res = await fetch(KEY_LOCATION); }
  catch (e) { die(`could not reach ${KEY_LOCATION}: ${e.message}`); }
  if (!res.ok) {
    die(`${KEY_LOCATION} returned ${res.status}. The key file must be deployed before `
      + 'submitting — commit public/<key>.txt and let Vercel build first.');
  }
  const body = (await res.text()).trim();
  if (body !== KEY) die(`${KEY_LOCATION} served "${body.slice(0, 40)}" but the key is "${KEY}"`);
  console.log(`✓ key file live at ${KEY_LOCATION}`);
}

/* ---------- run ---------- */
console.log(`IndexNow · host ${HOST} · key ${KEY.slice(0, 8)}…`);

if (CHECK_ONLY) { await checkKeyFile(); process.exit(0); }

const urlList = readUrls();
const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
console.log(`  ${urlList.length} URLs from dist/sitemap.xml`);

// Ordered before the dry-run exit so `--dry-run --await-deploy` exercises the
// wait for real and still submits nothing — the only way to rehearse the
// workflow's exact path without announcing 250 URLs.
if (AWAIT_DEPLOY) await awaitDeploy(urlList);

if (DRY) {
  console.log(`dry run — nothing submitted${AWAIT_DEPLOY ? '' : ', no network calls made'}.`);
  console.log(`  would POST ${ENDPOINT}`);
  console.log(`  keyLocation: ${KEY_LOCATION}`);
  console.log(`  first 3: ${urlList.slice(0, 3).join(', ')}`);
  console.log(`  payload bytes: ${Buffer.byteLength(JSON.stringify(payload))}`);
  process.exit(0);
}

await checkKeyFile();

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

// 200 accepted · 202 accepted, key validation pending · 400 bad body ·
// 403 key not valid for this host · 422 URLs do not match host, or too many ·
// 429 rate limited.
if (res.status === 200 || res.status === 202) {
  console.log(`✓ submitted ${urlList.length} URLs (HTTP ${res.status}${res.status === 202 ? ' — key validation pending' : ''})`);
  console.log('  IndexNow does not report indexation. Read that in Bing Webmaster Tools (A6).');
  process.exit(0);
}
const body = await res.text().catch(() => '');
if (res.status === 403) die('403 — key not valid for this host. Is the key file deployed and matching?');
if (res.status === 422) die('422 — URLs do not match the host, or too many in one request.');
if (res.status === 429) die('429 — rate limited. Wait and retry; do not loop.');
die(`submit failed (${res.status}): ${body.slice(0, 300)}`);
