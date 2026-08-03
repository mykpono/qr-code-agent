/*
  QR Code Agent — feedback relay (Google Apps Script).

  This is NOT part of the build. It is the server side of the generator's
  feedback strip, and it lives in Myk's own Google account rather than in this
  repo's deploy. The copy here is the source of truth for what is deployed —
  edit it here first, then paste it over the script and redeploy, or the two
  silently drift apart.

  ── Deploying ────────────────────────────────────────────────────────────────
  1. Open https://script.new and paste this whole file over the default stub.
  2. Deploy ▸ New deployment ▸ (gear) Web app
       Execute as:      Me
       Who has access:  Anyone            ← required; "Anyone with Google
                                            account" makes the browser POST fail
  3. Authorise it. Google shows an "unverified app" warning the first time —
     that is expected for your own scripts: Advanced ▸ Go to (project).
  4. Copy the deployment's /exec URL into PUBLIC_FEEDBACK_ENDPOINT in Vercel.
  5. Visit the /exec URL in a browser. A healthy deployment answers
     {"ok":true}. Anything else means the deployment is wrong, not the site.

  Re-deploying after an edit: Deploy ▸ Manage deployments ▸ (pencil) ▸ Version:
  New version. Use the SAME deployment so the URL does not change — "New
  deployment" mints a fresh URL and leaves the old code live at the old one.

  Quota: 100 recipients/day on a free Gmail account, 1,500/day on Workspace.
*/

var TO = 'info@myxys.com';

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    /* Honeypot. A filled trap is a bot, so drop the message — but answer
       success, because a bot told it failed just retries. */
    if (d.botcheck) return json({ success: true });

    var verdict = d.verdict === 'Not quite' ? 'Not quite' : 'Yes';
    var replyTo = typeof d.email === 'string' && d.email.indexOf('@') > 0 ? d.email.trim() : '';

    var lines = [
      'Verdict:  ' + verdict,
      'Topic:    ' + (d.topic || '—'),
      'Locale:   ' + (d.locale || 'en'),
      'Page:     ' + (d.page || '—'),
      'Reply to: ' + (replyTo || '(none given)'),
      '',
      d.message || '(no message)',
    ];
    /* Style only, and only when the user ticked the box. What they encoded is
       never sent — see buildFeedbackPayload in src/lib/feedback.js. */
    if (d.settings) lines.push('', 'Settings: ' + d.settings);

    var options = { name: 'qrcodeagent.net' };
    if (replyTo) options.replyTo = replyTo;

    MailApp.sendEmail(
      TO,
      'QR feedback — ' + verdict + (d.topic ? ' · ' + d.topic : ''),
      lines.join('\n'),
      options
    );

    return json({ success: true });
  } catch (err) {
    /* The site treats any non-{success:true} answer as a failure and keeps the
       user's message on screen, so returning the error here is safe. */
    return json({ success: false, error: String(err) });
  }
}

/* Health check — open the /exec URL in a browser after deploying. */
function doGet() {
  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
