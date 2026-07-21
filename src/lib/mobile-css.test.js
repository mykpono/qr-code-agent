import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');
const header = readFileSync(join(root, 'src/components/Header.astro'), 'utf8');

test('app.css includes mobile quick-win rules', () => {
  assert.ok(css.includes('.tool-scroll { padding: 0; overflow-x: visible; }'));
  assert.ok(css.includes('.gf-preview { order: -1;'));
  assert.ok(css.includes('.gf-dl { flex-direction: column;'));
  assert.ok(css.includes('.gf-rail:not(.open) { display: none; }'));
  assert.ok(css.includes('.gf-support-footer { flex-direction: column;'));
  assert.ok(css.includes('.gf-support-footer p { flex: 0 0 auto;'));
  assert.ok(css.includes('justify-content: flex-start; gap: 12px;'));
  assert.ok(css.includes('section.blk { padding: 28px 0; }'));
  assert.ok(css.includes('.gf-config { order: 0; border-top: 1px solid var(--border-soft);'));
});

// The generator's swatch row is the site's ONLY theme control, so it must stay
// visible at every breakpoint. It used to be hidden on mobile because a second
// copy lived in the header; that copy is gone.
test('the generator theme swatches are not hidden on mobile', () => {
  assert.ok(!css.includes('.gf-themes { display: none; }'),
    'gf-themes is the only theme control — hiding it leaves mobile with none');
  assert.ok(css.includes('.gf-themes button:not(.on)::after'),
    'the 44px hit-area pseudo-element must not be shared with the selection ring');
});

// Regression guard for a real overflow. With the theme swatches in the header,
// .hright was 289px wide (Support + language + 4 swatches); at 985px the header
// bar's own content width hit 995px and every page scrolled sideways in the
// 900-1120px band. No child's bounding rect exceeded the viewport, so an
// element-level check found nothing — the overflow was in the flex container's
// content width. Keeping the swatches out of the header is what fixed it.
test('the header does not carry the theme swatches', () => {
  assert.ok(!/class="sw"/.test(header),
    'theme swatches in .hright overflow the header bar between 900px and 1120px');
});

// Both are fixed-height 30px chips: if their label wraps, the text spills out of
// the rounded box instead of the chip simply keeping its natural width.
test('header chips never wrap or shrink', () => {
  for (const sel of ['.pill {', '.lang {']) {
    const rule = css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
    assert.ok(rule.includes('white-space: nowrap'), `${sel} must not wrap`);
    assert.ok(rule.includes('flex: 0 0 auto'), `${sel} must not shrink`);
  }
});
