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
});
