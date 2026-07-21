import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOBILE_BREAKPOINT,
  defaultTemplatesOpen,
  isMobileViewport,
  shouldCollapseTemplatesOnResize,
} from './mobile.js';

test('MOBILE_BREAKPOINT matches mobile media query', () => {
  assert.equal(MOBILE_BREAKPOINT, 900);
});

test('isMobileViewport treats 900px and below as mobile', () => {
  assert.equal(isMobileViewport(900), true);
  assert.equal(isMobileViewport(390), true);
  assert.equal(isMobileViewport(901), false);
  assert.equal(isMobileViewport(1120), false);
});

test('defaultTemplatesOpen is false on mobile and true on desktop', () => {
  assert.equal(defaultTemplatesOpen(390), false);
  assert.equal(defaultTemplatesOpen(900), false);
  assert.equal(defaultTemplatesOpen(901), true);
  assert.equal(defaultTemplatesOpen(1200), true);
});

test('shouldCollapseTemplatesOnResize only when entering mobile', () => {
  assert.equal(shouldCollapseTemplatesOnResize(true), true);
  assert.equal(shouldCollapseTemplatesOnResize(false), false);
});
