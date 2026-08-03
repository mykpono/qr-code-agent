// Push every built URL to IndexNow, which feeds Bing (and Yandex, Seznam, Naver).
//
//   npm run indexnow:submit              # read dist/sitemap.xml, submit every URL
//   npm run indexnow:submit -- --dry-run # build the payload, call nothing
//   npm run indexnow:submit -- --check   # only verify the key file is served
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

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const KEY = '8a8056c4eb1dddf9fff1af976d2ae99f';
const HOST = 'qrcodeagent.net';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // IndexNow rejects larger batches with 422

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const CHECK_ONLY = args.includes('--check');

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/* ---------- collect URLs from the built sitemap ---------- */
function readUrls() {
  const sitemap = fileURLToPath(new URL('../dist/sitemap.xml', import.meta.url));
  if (!existsSync(sitemap)) die('dist/sitemap.xml not found — run `npm run build` first');
  const xml = readFileSync(sitemap, 'utf8');
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) die('sitemap contained no <loc> entries');

  // A key at the site root authorises the whole origin, but a URL from another
  // host in the batch invalidates the entire request rather than being skipped.
  const foreign = urls.filter((u) => !u.startsWith(`https://${HOST}/`) && u !== `https://${HOST}`);
  if (foreign.length) die(`sitemap contains ${foreign.length} URL(s) outside ${HOST}: ${foreign[0]}`);
  if (urls.length > MAX_URLS) die(`${urls.length} URLs exceeds the ${MAX_URLS} per-request limit`);
  return urls;
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

if (DRY) {
  console.log('dry run — no network calls made.');
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
