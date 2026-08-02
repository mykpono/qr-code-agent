import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedbackPayload, sendFeedback } from './feedback.js';

const ENDPOINT = 'https://script.google.com/macros/s/AKfyc-test/exec';

const base = {
  mood: 'no',
  topic: 'Would not scan',
  text: '  The code broke after I added my logo.  ',
  snapshot: 'URL · Star · Ribbon · ECC H (no link contents)',
  attachSnapshot: true,
  pageUrl: 'https://qrcodeagent.net/wifi-qr-code',
  locale: 'de',
};

test('the payload carries the verdict, topic, message, page and locale', () => {
  const b = buildFeedbackPayload(base);
  assert.equal(b.verdict, 'Not quite');
  assert.equal(b.topic, 'Would not scan');
  assert.equal(b.message, 'The code broke after I added my logo.');
  assert.equal(b.page, 'https://qrcodeagent.net/wifi-qr-code');
  assert.equal(b.locale, 'de');
});

test('a happy verdict reads as Yes', () => {
  assert.equal(buildFeedbackPayload({ ...base, mood: 'yes' }).verdict, 'Yes');
});

/* The relay only sets replyTo when this looks like an address, so a blank one
   must arrive blank rather than as whitespace. */
test('the optional email is trimmed, and empty when not filled in', () => {
  assert.equal(buildFeedbackPayload(base).email, '');
  assert.equal(buildFeedbackPayload({ ...base, email: '   ' }).email, '');
  assert.equal(buildFeedbackPayload({ ...base, email: ' a@b.co ' }).email, 'a@b.co');
});

/* The checkbox is the whole contract of the "attach my settings" line: unticked
   means the style summary never leaves the browser. */
test('the settings snapshot rides along only when the box is ticked', () => {
  assert.equal(buildFeedbackPayload(base).settings, base.snapshot);
  assert.ok(!('settings' in buildFeedbackPayload({ ...base, attachSnapshot: false })));
});

/* What the user encoded is theirs. The snapshot the widget builds is style-only
   and says so; if that ever changes, this fails. */
test('no scanned payload is ever included', () => {
  const encoded = JSON.stringify(buildFeedbackPayload(base));
  assert.ok(!encoded.includes('http://secret'), 'payload must not carry encoded content');
  assert.match(encoded, /no link contents/);
});

test('the honeypot rides along empty on a real submission', () => {
  assert.equal(buildFeedbackPayload(base).botcheck, '');
  assert.equal(buildFeedbackPayload({ ...base, botcheck: 'spam' }).botcheck, 'spam');
});

/* Apps Script has no OPTIONS handler, so anything that provokes a CORS
   preflight breaks every send. Keeping the request "simple" means text/plain
   and no extra headers — this pins that down, because the natural instinct when
   sending JSON is application/json. */
test('the request stays a simple CORS request', async () => {
  let seen = null;
  await sendFeedback(ENDPOINT, { verdict: 'Yes' }, {
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => ({ success: true }) };
    },
  });
  assert.equal(seen.url, ENDPOINT);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(Object.keys(seen.init.headers), ['Content-Type'],
    'any extra header triggers a preflight Apps Script cannot answer');
  assert.equal(seen.init.redirect, 'follow', 'Apps Script 302s to googleusercontent.com');
  assert.equal(JSON.parse(seen.init.body).verdict, 'Yes');
});

test('a delivered message resolves true', async () => {
  const ok = await sendFeedback(ENDPOINT, {}, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) }),
  });
  assert.equal(ok, true);
});

/* Every failure mode has to resolve false, not throw and not resolve true — the
   caller shows the thank-you ("that went straight to the person who builds
   this") on true, so a wrong answer here puts a lie on the screen. */
test('every failure mode resolves false', async () => {
  const cases = {
    'http error': async () => ({ ok: false, json: async () => ({}) }),
    'relay reports failure': async () => ({ ok: true, json: async () => ({ success: false }) }),
    'relay threw': async () => ({ ok: true, json: async () => ({ success: false, error: 'boom' }) }),
    'unparseable body': async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }),
    offline: async () => { throw new Error('network down'); },
  };
  for (const [name, fetchImpl] of Object.entries(cases)) {
    assert.equal(await sendFeedback(ENDPOINT, {}, { fetchImpl }), false, `${name} must resolve false`);
  }
});

/* Belt and braces: the strip is not rendered without an endpoint, but if that
   guard ever regresses, sending must still not claim success. */
test('a missing endpoint resolves false without calling fetch', async () => {
  let called = false;
  const ok = await sendFeedback('', {}, { fetchImpl: async () => { called = true; } });
  assert.equal(ok, false);
  assert.equal(called, false);
});
