import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MOBILE_BREAKPOINT, STACK_BREAKPOINT } from './mobile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');
const header = readFileSync(join(root, 'src/components/Header.astro'), 'utf8');
const generator = readFileSync(join(root, 'src/components/Generator.jsx'), 'utf8');

/* The columns stack via a CSS media query, but the feedback strip is re-parented
   by JS watching matchMedia. If the two widths ever disagree there is a band
   where the columns are stacked and the strip is still inside the preview
   column — stranded halfway up the widget — or the reverse, where it is hoisted
   out while the columns are still side by side and it wedges between them. */
test('the CSS stacking breakpoint matches the one Generator.jsx watches', () => {
  assert.ok(css.includes(`@media (max-width: ${STACK_BREAKPOINT}px)`),
    `app.css must stack the columns at ${STACK_BREAKPOINT}px`);
  assert.ok(generator.includes('max-width: ${STACK_BREAKPOINT}px'),
    'Generator.jsx must watch STACK_BREAKPOINT, not a hard-coded width');
  assert.ok(STACK_BREAKPOINT > MOBILE_BREAKPOINT,
    'the columns stack before the phone treatment kicks in, not after');
});

test('app.css includes mobile quick-win rules', () => {
  assert.ok(css.includes('.tool-scroll { padding: 0; overflow-x: visible; }'));
  assert.ok(css.includes('.gf-preview { order: -1;'));
  assert.ok(css.includes('.gf-dl { margin-top: 12px; flex-direction: column;'));
  assert.ok(css.includes('.gf-support-footer { flex-direction: column;'));
  assert.ok(css.includes('.gf-support-footer p { flex: 0 0 auto;'));
  assert.ok(css.includes('justify-content: flex-start; gap: 12px;'));
  assert.ok(css.includes('section.blk { padding: 28px 0; }'));
  assert.ok(css.includes('.gf-setup { order: 0; border-top: 1px solid var(--border-soft);'));
});

// Eleven type tabs do not fit on a phone. Left to wrap they take three rows and
// push the preview off-screen; the mobile rule scrolls them instead, and that
// only works if wrapping is switched off at the same time.
test('the type tabs scroll rather than wrap on mobile', () => {
  const rule = css.slice(css.indexOf('.gf-types { padding-left: 16px'));
  const decl = rule.slice(0, rule.indexOf('}'));
  assert.ok(decl.includes('flex-wrap: nowrap'), 'tabs must not wrap on mobile');
  assert.ok(decl.includes('overflow-x: auto'), 'tabs must scroll on mobile');
});

// The corner row is nine swatches at 1fr. On a 343px viewport that is ~2px of
// drawable width each — unusable, and the swatch canvas is the whole control.
test('the nine corner swatches reflow on mobile', () => {
  assert.ok(css.includes('.gf-swatches.c9 { grid-template-columns: repeat(5, 1fr); }'),
    'nine corner swatches in one row are unusable below 900px');
});

// Stacked layout puts the preview column FIRST, so the feedback strip — which
// lives inside it on desktop — would otherwise sit halfway up the widget.
// Generator.jsx re-parents it to .gf-body; these are the styles that land it.
test('the hoisted feedback strip is styled as the widget\'s last band', () => {
  const rule = css.slice(css.indexOf('.gf-body > .gf-fb { order: 1;'));
  const decl = rule.slice(0, rule.indexOf('}'));
  assert.ok(decl.includes('order: 1'), 'it must sort after the setup column');
  assert.ok(decl.includes('background: #ffffff'),
    'its chips are #faf6ec — on the Cream card surface they would be invisible');
  // and it must never wedge between the two columns if the flag is ever wrong
  assert.ok(css.includes('.gf-body > .gf-fb { flex: 0 0 100%; }'),
    'a stray third flex item would squeeze the columns');
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
