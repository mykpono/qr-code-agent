import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');

test('app.css includes mobile quick-win rules', () => {
  assert.ok(css.includes('.tool-scroll { padding: 0; overflow-x: visible; }'));
  assert.ok(css.includes('.gf-preview { order: -1;'));
  assert.ok(css.includes('.gf-dl { flex-direction: column;'));
  assert.ok(css.includes('.gf-themes { display: none; }'));
  assert.ok(css.includes('.gf-rail:not(.open) { display: none; }'));
  assert.ok(css.includes('.gf-support-footer { flex-direction: column;'));
  assert.ok(css.includes('.gf-support-footer p { flex: 0 0 auto;'));
  assert.ok(css.includes('justify-content: flex-start; gap: 12px;'));
  assert.ok(css.includes('section.blk { padding: 28px 0; }'));
  assert.ok(css.includes('.gf-preview { order: -1; flex: 0 0 auto;'));
  assert.ok(css.includes('.gf-config { order: 0; border-top: 1px solid var(--border-soft);'));
});

test('theme swatch selection ring does not share hit-area pseudo-element', () => {
  assert.ok(css.includes('.gf-themes button:not(.on)::after'));
  assert.ok(css.includes('.sw span:not(.on)::after'));
  assert.ok(!css.includes('.gf-themes button::after,\n.gf-i::after'));
});
