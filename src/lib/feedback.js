/*
  Feedback transport — the last item on the handoff's TODO list
  (design_handoff_qr_generator/README.md §4: "the form resolves locally; point it
  at a real endpoint and send the config snapshot only when the checkbox is
  ticked").

  The endpoint is a Google Apps Script web app running in Myk's own account,
  which mails each submission to info@myxys.com. Its source is checked in at
  scripts/feedback-relay.gs. No third-party form service, no server in this
  deploy — the site stays static output with no adapter.

  The /exec URL is PUBLIC by design: it ships in the bundle, like the Umami site
  ID. Anyone who reads the page can post to it, and all that buys them is mail
  to one fixed inbox. Do NOT put anything secret here.

  Pure builder + one transport call, kept out of Generator.jsx so the payload
  shape is testable (golden rule 7b).
*/

/* Apps Script does not answer CORS preflight (OPTIONS), so this request has to
   stay a "simple request": text/plain, no Accept header, no custom headers. The
   body is still JSON — the script parses e.postData.contents itself. Adding
   application/json here triggers a preflight and every send fails with a CORS
   error that looks, misleadingly, like the endpoint being down. */
const CONTENT_TYPE = 'text/plain;charset=utf-8';

export function buildFeedbackPayload({
  mood, topic, text, email, snapshot, attachSnapshot, pageUrl, locale, botcheck,
}) {
  const body = {
    verdict: mood === 'no' ? 'Not quite' : 'Yes',
    topic: topic || '',
    message: (text || '').trim(),
    email: (email || '').trim(),
    page: pageUrl || '',
    locale: locale || 'en',
    // Real submissions leave this empty; the relay drops anything that arrives
    // with it filled. Catches naive form-scrapers only — it is no defence
    // against someone reading the endpoint out of the bundle and posting.
    botcheck: botcheck || '',
  };

  /* The design snapshot is the STYLE only — type, pattern, frame, ECC — and it
     is built with the "(no link contents)" marker already in it. What the user
     encoded never leaves the browser, ticked or not. */
  if (attachSnapshot && snapshot) body.settings = snapshot;

  return body;
}

/* Resolves true only on a delivered message. Every failure path — offline, HTTP
   error, malformed reply, timeout, missing endpoint — resolves false so the
   caller can keep the typed text on screen and offer a retry, rather than
   claiming a send that did not happen. */
export async function sendFeedback(endpoint, body, { fetchImpl, timeoutMs = 10000 } = {}) {
  if (!endpoint) return false;
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return false;

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': CONTENT_TYPE },
      body: JSON.stringify(body),
      // Apps Script 302s from script.google.com to script.googleusercontent.com;
      // the answer we care about is on the far side of that hop.
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data ? data.success === true : false;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
