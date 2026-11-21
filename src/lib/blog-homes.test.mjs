import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { HOME_FILES, homeFileFor } from './blog-homes.mjs';

const registry = JSON.parse(readFileSync(new URL('../data/themes.json', import.meta.url), 'utf8'));

test('every look has its home component, and the file exists', () => {
  for (const t of registry.themes) {
    const file = homeFileFor(t.id, registry);
    assert.ok(HOME_FILES[t.hero], `${t.id}: archetype ${t.hero} has a home`);
    assert.ok(existsSync(new URL(`../components/home/${file}.astro`, import.meta.url)), `${t.id}: ${file}.astro`);
  }
  assert.equal(homeFileFor('', registry), 'HomeRings');
  assert.equal(homeFileFor('no-such-look', registry), 'HomeRings');
  assert.equal(homeFileFor('contour', registry), 'HomeBusiness');
  assert.equal(homeFileFor('broadsheet', registry), 'HomeFrontPage');
});

test('the home page imports only the website’s own look’s home, never all of them', () => {
  const index = readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
  assert.ok(index.includes("from 'virtual:chapbook-home'"));
  assert.ok(!/components\/home\//.test(index.replace(/^\s*\/\/.*$/gm, '')), 'no blog home is imported directly');
  const config = readFileSync(new URL('../../astro.config.mjs', import.meta.url), 'utf8');
  assert.ok(config.includes('oneHome()'));
});
