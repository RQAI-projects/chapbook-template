// The first allied health therapist batch (website design release 7): a recovery plan as sticky
// steps beside a progress line that fills as the steps are read, everyday tasks drawn in line on
// a sideways rail of tiles, and tiles that come in from different sides and fit together. Each is
// decoration over words that read on their own, stays still with movement turned down, and never
// changes how an older section draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, needsSignature, normalisePage, BLOCK_TYPES } from './render.mjs';

const page = (blocks, look = {}) => ({ v: 1, title: 'Test', slug: 'test', look, blocks });
const draw = (blocks, opts = {}) => renderPage(page(blocks), { site: { name: 'Test practice', professional: { phone: '01632 960 123' } }, ...opts });
const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');
const STEPS = [{ when: 'Week 1', name: 'Assessment', description: 'We listen.' }, { when: 'Weeks 2 to 4', name: 'Treatment', description: 'Then movement.' }, { name: 'Back to sport' }];

test('a progress line beside sticky steps fills as they are read, each step with its time', () => {
  const steps = { type: 'steps', variant: 'sticky', data: { heading: 'Your recovery plan', trace: 'progress', items: STEPS } };
  const html = draw([steps]);
  assert.match(html, /<div class="cb-stk has-prog" data-stk data-scroll="read" style="--n:3">/);
  assert.match(html, /<span class="cb-stk-prog" aria-hidden="true"><i class="cb-stk-fill"><\/i><i class="cb-stk-mark"><\/i><\/span><ol class="cb-steps cb-steps-sticky">/);
  assert.match(html, /<p class="cb-step-when">Week 1<\/p><h3 class="cb-step-name">Assessment<\/h3>/);
  assert.ok(!html.includes('cb-stk-bar'), 'the line replaces the small bar');
  // The editor shows the steps with their line and times, nothing pinned.
  const edit = draw([{ ...steps, id: 's1' }], { editable: true });
  assert.ok(edit.includes('cb-stk-steps') && !edit.includes('data-stk'));
  // Without the line, sticky steps draw exactly as before: no time, the small bar.
  const plain = draw([{ type: 'steps', variant: 'sticky', data: { heading: 'Steps', items: STEPS } }]);
  assert.ok(!plain.includes('cb-step-when') && !plain.includes('cb-stk-prog') && plain.includes('<span class="cb-stk-bar"><i></i></span>'));
  // Transform only; full without the page's script or with movement turned down.
  assert.match(css, /\.cb-stk-fill\{[^}]*transform:scaleY\(var\(--p,1\)\)/);
  assert.match(css, /\.cb-stk-mark\{[^}]*transform:translate3d\(0,calc\(var\(--p,1\) \* 100%\),0\)/);
  assert.match(css, /@media screen and \(prefers-reduced-motion:no-preference\)\{\n  html\.cbm-js \.cbm\[data-m-scroll\] \.cb-stk\.has-prog:not\(\.is-live\)\{--p:0\}/);
  assert.equal(needsSignature(steps), true);
});

test('everyday tasks drawn in line on a rail of tiles that travels sideways, a plain row in the editor', () => {
  const kinds = ['dressing', 'cooking', 'washing', 'stairs', 'work', 'school'];
  for (const k of kinds) assert.ok(BLOCK_TYPES.tiles.fields.items.item.shape.options.includes(k), k);
  const tiles = { type: 'tiles', variant: 'rail', data: { heading: 'Everyday *tasks*', items: kinds.map((shape) => ({ shape, name: shape, text: 'Words.' })) } };
  const html = draw([tiles]);
  assert.match(html, /<div class="cb-hs cb-tl-rail" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="Everyday tasks, scrolls sideways"><div class="cb-hs-track cb-tl-railtrack">/);
  assert.equal((html.match(/<span class="cb-task cb-task-[a-z]+" aria-hidden="true"><svg viewBox="0 0 96 96" focusable="false">/g) || []).length, 6);
  assert.equal((html.match(/<h3 class="cb-tl-name">/g) || []).length, 6, 'every task has its words, read without the drawing');
  const edit = draw([{ ...tiles, id: 't1' }], { editable: true });
  assert.match(edit, /class="cb-tl cb-tl-row cb-tl-railrow"/);
  assert.ok(!edit.includes('data-hs'));
  // An older shape is still drawn as before.
  assert.match(draw([{ type: 'tiles', variant: 'mosaic', data: { items: [{ shape: 'circle', name: 'A' }] } }]), /<span class="cb-shape cb-shape-circle" aria-hidden="true"><i><\/i><\/span>/);
  assert.equal(normalisePage(page([{ type: 'tiles', variant: 'rail', data: { items: [{ shape: 'rocket', name: 'A' }] } }])).blocks[0].data.items[0].shape, undefined, 'an unknown drawing is not kept');
});

test('tiles that assemble: they come in from different sides, only with movement, and are whole without it', () => {
  const tiles = { type: 'tiles', variant: 'mosaic', data: { assemble: true, items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] } };
  assert.match(draw([tiles]), /class="cb-tl cb-tl-mosaic cb-tl-assemble"/);
  assert.ok(!draw([{ ...tiles, data: { ...tiles.data, assemble: false } }]).includes('cb-tl-assemble'));
  const rules = css.slice(css.indexOf('/* ---- Tiles that come in from different sides'));
  assert.match(rules, /^\/\* [^\n]*\n@media screen and \(prefers-reduced-motion:no-preference\)\{/);
  assert.match(rules, /\.cbm\.cbm-ready\[data-m-scroll\] \.cb-tl-assemble>\[data-m\]\{transform:translate3d\(var\(--ax,0px\),var\(--ay,40px\),0\) scale\(\.94\)/);
  // Four sides, so neighbouring tiles never arrive from the same one.
  assert.equal((rules.match(/\.cb-tl-assemble>:nth-child\(4n(\+\d)?\)\{--ax:/g) || []).length, 4);
});

test('a colour-block opening keeps its smaller words at full strength only where the softened mix would not read', () => {
  const blob = { type: 'hero', variant: 'blob', data: { heading: 'Back to *moving well*', intro: 'Words.' } };
  const look = (accent) => ({ palette: 'x', colours: { bg: '#f4f6f5', surface: '#dfe8e4', ink: '#13201b', accent, deep: '#13201b' } });
  // Stride's own green: black words on it reach 4.84:1, softened 4.38:1, so they stay black.
  assert.match(renderPage(page([blob], look('#1f8a5b')), {}), /--cb-blob-dim:#000000/);
  // A deeper accent reads softened, so nothing changes; nor on a page without a blob opening.
  assert.ok(!renderPage(page([blob], look('#13603e')), {}).includes('--cb-blob-dim'));
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'split', data: { heading: 'A' } }], look('#1f8a5b')), {}).includes('--cb-blob-dim'));
  const blocks = readFileSync(new URL('../../styles/blocks.css', import.meta.url), 'utf8');
  assert.match(blocks, /\.cb-hero--blob\.cb-bg-none\{[^}]*--ink-dim:var\(--cb-blob-dim,color-mix\(in srgb,var\(--cb-on-accent\) 86%,var\(--accent\)\)\)/);
});
