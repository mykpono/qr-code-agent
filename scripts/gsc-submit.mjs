// Resubmit the sitemap to Google Search Console via the Search Console API.
//
//   npm run gsc:submit              # submit, then print the sitemap's GSC status
//   npm run gsc:submit -- --status  # status only, submit nothing
//   npm run gsc:submit -- --dry-run # build+sign the request, call nothing (no creds needed)
//
// Google retired the old ping endpoint (google.com/ping?sitemap=) in 2023, so a
// programmatic resubmit has to go through the authenticated API. This uses a
// service account and signs its own JWT with Node's built-in crypto — no
// googleapis dependency (that package is ~50MB for one PUT call).
//
// ── One-time setup ─────────────────────────────────────────────────────────
// 1. Google Cloud console → create a service account → add a JSON key.
// 2. Enable the "Google Search Console API" for that project.
// 3. In Search Console → Settings → Users and permissions → add the service
//    account's email (…@….iam.gserviceaccount.com) as an **Owner** (Full user
//    is not enough to submit sitemaps).
// 4. Provide the key to this script by EITHER:
//      export GSC_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"   # CI/Vercel
//      export GSC_KEY_FILE=./service-account.json                      # local
//    NEVER commit the key. scripts/*.json and *service-account*.json are
//    gitignored; keep it out of the repo regardless.
//
// ── Config (env, all optional) ─────────────────────────────────────────────
//   GSC_SITE_URL   the property EXACTLY as registered in Search Console.
//                  URL-prefix property → "https://qrcodeagent.net/" (default)
//                  Domain property      → "sc-domain:qrcodeagent.net"
//   GSC_SITEMAP    sitemap URL (default https://qrcodeagent.net/sitemap.xml)

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const SITE_URL = process.env.GSC_SITE_URL || 'https://qrcodeagent.net/';
const SITEMAP = process.env.GSC_SITEMAP || 'https://qrcodeagent.net/sitemap.xml';
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/* ---------- credentials ---------- */
function loadKey() {
  let raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw && process.env.GSC_KEY_FILE) {
    try { raw = readFileSync(process.env.GSC_KEY_FILE, 'utf8'); }
    catch { die(`cannot read GSC_KEY_FILE: ${process.env.GSC_KEY_FILE}`); }
  }
  if (!raw) {
    if (DRY) return null; // dry-run does not need real creds
    die('no credentials — set GSC_SERVICE_ACCOUNT_JSON or GSC_KEY_FILE (see header of this file)');
  }
  let key;
  try { key = JSON.parse(raw); } catch { die('credentials are not valid JSON'); }
  for (const f of ['client_email', 'private_key', 'token_uri']) {
    if (!key[f]) die(`credentials missing "${f}" — is this a service-account key?`);
  }
  return key;
}

/* ---------- signed JWT → access token ---------- */
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function buildJwt(key, nowSec) {
  // Scope: full webmasters (submit needs write). readonly cannot submit.
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: key.token_uri,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(key.private_key);
  return `${signingInput}.${b64url(signature)}`;
}

async function getAccessToken(key) {
  const jwt = buildJwt(key, Math.floor(Date.now() / 1000));
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(`token exchange failed (${res.status}): ${body.error_description || body.error || 'unknown'}`);
  return body.access_token;
}

/* ---------- Search Console API ---------- */
const api = (site, feed) =>
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(feed)}`;

async function submit(token) {
  const res = await fetch(api(SITE_URL, SITEMAP), {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 204) { console.log(`✓ submitted ${SITEMAP}`); return; }
  const body = await res.text();
  if (res.status === 403) die(`403 forbidden — is the service account added as an OWNER of "${SITE_URL}" in Search Console?`);
  if (res.status === 404) die(`404 not found — does GSC_SITE_URL exactly match the registered property? Got "${SITE_URL}"`);
  die(`submit failed (${res.status}): ${body.slice(0, 300)}`);
}

async function status(token) {
  const res = await fetch(api(SITE_URL, SITEMAP), { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (res.status === 404) die(`sitemap not registered for "${SITE_URL}" yet — submit it first (drop --status)`);
    die(`status failed (${res.status})`);
  }
  const s = await res.json();
  const contents = (s.contents || []).map((c) => `${c.type}:${c.submitted}`).join(', ') || '(none reported yet)';
  console.log(`  path:          ${s.path}`);
  console.log(`  last submitted:${s.lastSubmitted || '—'}`);
  console.log(`  last downloaded:${s.lastDownloaded || '— (Google has not fetched it yet)'}`);
  console.log(`  pending:       ${s.isPending ? 'yes' : 'no'}`);
  console.log(`  errors:        ${s.errors || 0}   warnings: ${s.warnings || 0}`);
  console.log(`  URLs:          ${contents}`);
}

/* ---------- run ---------- */
console.log(`Search Console · property "${SITE_URL}" · sitemap ${SITEMAP}`);
const key = loadKey();

if (DRY) {
  const jwt = key ? buildJwt(key, 1700000000) : '(no key loaded — signing skipped)';
  console.log('dry run — no network calls made.');
  console.log(`  would PUT ${api(SITE_URL, SITEMAP)}`);
  console.log(`  jwt: ${typeof jwt === 'string' ? jwt.slice(0, 48) + '…' : jwt}`);
  process.exit(0);
}

const token = await getAccessToken(key);
if (!STATUS_ONLY) await submit(token);
console.log('sitemap status:');
await status(token);
