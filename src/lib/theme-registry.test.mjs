import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(readFileSync(join(root, 'src/data/themes.json'), 'utf8'));
const ids = registry.themes.map((theme) => theme.id);
const heroes = registry.themes.map((theme) => theme.hero);
const retired = ['graphite', 'gazette', 'arcade', 'gallery'];
const replacements = [
  ['blueprint-workshop', 'blueprint-board'],
  ['desert-archive', 'desert-scroll'],
  ['woodland-chronicle', 'woodland-trail'],
  ['field-atlas', 'field-atlas'],
];

test('the catalogue contains 20 unique, structurally distinct full themes', () => {
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(heroes).size, heroes.length);
});

test('the four repetitive themes are replaced, not duplicated', () => {
  for (const id of retired) assert.equal(ids.includes(id), false, `${id} should be retired`);
  for (const [id, hero] of replacements) {
    const theme = registry.themes.find((candidate) => candidate.id === id);
    assert.ok(theme, `${id} should be registered`);
    assert.equal(theme.hero, hero);
    assert.ok(theme.description.length > 40);
    assert.match(theme.preview.bg, /^#[0-9a-f]{6}$/i);
  }
});

test('every registered theme has CSS and every homepage archetype is wired', () => {
  const themeImports = readFileSync(join(root, 'src/styles/themes.css'), 'utf8');
  const homepage = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');

  for (const theme of registry.themes) {
    const cssPath = join(root, `src/styles/themes/${theme.id}.css`);
    assert.equal(existsSync(cssPath), true, `missing ${theme.id}.css`);
    assert.ok(themeImports.includes(`./themes/${theme.id}.css`), `missing ${theme.id} CSS import`);
    assert.ok(homepage.includes(`${theme.hero}:`) || homepage.includes(`'${theme.hero}':`), `missing ${theme.hero} homepage mapping`);
  }
});

test('the obsolete palette chooser cannot shadow full site themes', () => {
  const base = readFileSync(join(root, 'src/layouts/Base.astro'), 'utf8');
  const globalCss = readFileSync(join(root, 'src/styles/global.css'), 'utf8');

  assert.equal(base.includes('data-site-theme'), false);
  assert.equal(base.includes('Choose theme'), false);
  assert.equal(globalCss.includes('.theme-chooser'), false);
  assert.equal(globalCss.includes('.theme-menu-panel'), false);
});
