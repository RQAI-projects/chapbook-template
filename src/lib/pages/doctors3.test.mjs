// The third consultant doctor batch (website design release 7) and the second batch's fixes: a
// still help line in the opening that goes to the help card, three windows onto one photo, line
// studies of a hand in place of photos in pinned scenes, questions as the opening, branching
// lines drawn slowly behind the words, and a gentle wave drawn through a numbers band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, needsSignature, normalisePage, HAND_STUDIES, handSvg } from './render.mjs';
import { faqJsonLd } from '../business-schema.mjs';

const pro = { phone: '01632 960 123', hours: 'Monday to Friday, 9am to 5pm\nSaturday, closed\nSunday, closed', location: '1 Elm Row\nBath BA1 1AA', bookingUrl: 'https://cal.com/rick/get-rick-rolled' };
const page = (blocks, look = {}) => ({ v: 1, title: 'Test', slug: 'test', look, blocks });
const draw = (blocks, opts = {}) => renderPage(page(blocks), { site: { name: 'Test practice', professional: pro }, ...opts });
const pic = (n, alt = 'A calm room') => ({ src: `/site-images/cbp-${n}.webp`, alt, phone: `/site-images/cbp-${n}-phone.webp`, w: 1216, phoneW: 800 });
const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');
const HELP = { type: 'notice', variant: 'help', data: { heading: 'If you need help *now*', items: [{ name: 'Samaritans', number: '116 123', detail: 'Free, day or night.' }] } };

test('a help line in the opening goes to the help card, and only when the page has one', () => {
  const hero = { type: 'hero', variant: 'inset', data: { heading: 'A quiet place', picture: pic('d7-mind-hero'), help: 'Need help now? Numbers to call' } };
  const html = draw([hero, HELP]);
  assert.match(html, /<p class="cb-hero-help"><a href="#help-now"><span class="cb-hero-help-dot" aria-hidden="true"><\/span>Need help now\? Numbers to call<\/a><\/p>/);
  assert.equal((html.match(/id="help-now"/g) || []).length, 1);
  assert.match(html, /<section class="cb cb-t-notice cb-notice--help[^"]*cb-still" id="help-now">/);
  // No card on the page: no line that goes nowhere.
  assert.ok(!draw([hero]).includes('cb-hero-help'));
  // Still for everyone: never animated, moved or faded.
  assert.match(css, /html\.cbm-js \.cbm \.cb-hero-help,html\.cbm-js \.cbm \.cb-hero-help \*\{opacity:1!important;transform:none!important;transition:none!important;animation:none!important\}/);
  assert.ok(needsSignature(hero));
});

test('three windows onto one photo: one described photo, two hidden copies, the details as a ledger', () => {
  const html = draw([{ type: 'hero', variant: 'triptych', data: { heading: 'Skin, looked at *properly*', picture: pic('d9-skin-hero', 'A calm consulting room'), details: true } }]);
  assert.equal((html.match(/class="cb-tri-strip"/g) || []).length, 3);
  assert.equal((html.match(/alt="A calm consulting room"/g) || []).length, 1, 'described once');
  assert.equal((html.match(/<figure class="cb-tri-strip" aria-hidden="true"><img [^>]*alt=""/g) || []).length, 2, 'the copies are hidden');
  assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1, 'asked for first once');
  assert.match(html, /<div class="cb-tri-ledger"><dl class="cb-facts cb-tri-facts">/);
  // Without a photo: the words alone, no empty windows.
  assert.ok(!draw([{ type: 'hero', variant: 'triptych', data: { heading: 'Skin' } }]).includes('cb-tri-strip'));
  assert.match(css, /@keyframes cbs-tri-rise\{from\{transform:translate3d\(0,3\.2rem,0\);opacity:0\}to\{transform:none;opacity:1\}\}/);
});

test('pinned scenes with line studies of a hand: drawings, never photos of hands, crossfading in turn', () => {
  const items = Object.keys(HAND_STUDIES).map((k, i) => ({ tag: `Group ${i + 1}`, name: `Scene ${i + 1}`, description: 'Words.', drawing: k }));
  const html = draw([{ type: 'scenes', variant: 'split', data: { heading: 'What I see', items } }]);
  assert.ok(!/<img/.test(html), 'no photo at all');
  assert.equal((html.match(/<figure class="cb-sc-pic cb-sc-draw"><svg class="cb-hand /g) || []).length, 4, 'each scene keeps its own drawing (phones, still)');
  assert.match(html, /<div class="cb-sc-stage is-art" aria-hidden="true"><span class="cb-sc-art is-on" data-i="0">/);
  assert.equal((html.match(/class="cb-sc-art/g) || []).length, 4);
  for (const k of Object.keys(HAND_STUDIES)) assert.match(handSvg(k), /^<svg class="cb-hand [^"]+" viewBox="[^"]+" aria-hidden="true" focusable="false"><path class="cb-hand-crease" d="M[^"]+"\/><path class="cb-hand-line" d="M[^"]+"\/><g class="cb-hand-focus"><circle class="cb-hand-halo"/);
  // A scene with a photo keeps its photo; an unknown drawing is dropped by the page's rules.
  const n = normalisePage(page([{ type: 'scenes', variant: 'split', data: { items: [{ name: 'A', drawing: 'hand-wrist' }, { name: 'B', drawing: 'a-foot' }] } }]));
  assert.deepEqual(n.blocks[0].data.items.map((x) => x.drawing || 'none'), ['hand-wrist', 'none']);
  assert.ok(needsSignature(n.blocks[0]));
});

test('questions first: plain questions beside the words, the first open, read as questions by search engines', () => {
  const block = { type: 'hero', variant: 'questions', data: { kicker: 'Men’s health', heading: 'Is this worth *checking*?', intro: 'Usually, yes.', buttons: [{ label: 'Book', href: '@booking' }], questions: [{ question: 'I get up at night to pass water. Is that normal?', answer: 'It is common, and worth a chat.' }, { question: 'Do I need a referral?', answer: 'No.' }] } };
  const html = draw([block]);
  assert.match(html, /<div class="cb-ask"><div class="cb-hero-words cb-ask-words">/);
  assert.match(html, /<div class="cb-faq cb-faq-accordion cb-ask-list"[^>]*><div class="cb-faq-item"><details open><summary>/);
  assert.equal((html.match(/<details open>/g) || []).length, 1);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  const ld = faqJsonLd([block]);
  assert.equal(ld.mainEntity.length, 2);
  assert.equal(ld.mainEntity[1].acceptedAnswer.text, 'No.');
  assert.equal(faqJsonLd([{ ...block, variant: 'split' }]), null, 'only the questions layout');
});

test('branching lines behind the words: drawn slowly once, whole and still with less movement', () => {
  const html = draw([{ type: 'hero', variant: 'branches', data: { heading: 'Brain and nerve care, *explained*', intro: 'Hello.' } }]);
  assert.match(html, /<div class="cb-br"><div class="cb-br-art" aria-hidden="true"><span class="cb-br-ghost"><svg class="cb-br-svg"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(!/<img/.test(html));
  // The words are the first screen's largest paint: a photo further down waits its turn.
  const below = draw([{ type: 'hero', variant: 'branches', data: { heading: 'Brain' } }, { type: 'text', variant: 'picture-right', data: { heading: 'Fog', picture: pic('d13-neuro-a', 'Fog') } }]);
  assert.ok(!below.includes('fetchpriority="high"') && below.includes('loading="lazy"'));
  const ask = draw([{ type: 'hero', variant: 'questions', data: { heading: 'Is this worth checking?' } }, { type: 'text', variant: 'picture-right', data: { heading: 'Rooms', picture: pic('d12-mens-c', 'Rooms') } }]);
  assert.ok(!ask.includes('fetchpriority="high"'));
  // The drawing is revealed by a window that slides (transform), inside the reduce motion guard.
  const guard = css.slice(css.indexOf('Branching lines drawn slowly'));
  assert.match(guard, /@media screen and \(prefers-reduced-motion:no-preference\)\{\s*html\.cbm-js \.cbm:not\(\[data-m-edit\]\) \.cb-br-win\{animation:cbs-trace-win 3\.2s/);
});

test('a gentle wave drawn through a numbers band as it comes into view', () => {
  const html = draw([{ type: 'facts', variant: 'band', data: { heading: 'In numbers', wave: true, items: [{ value: '12', label: 'years' }, { value: '45', label: 'minutes' }] } }]);
  assert.match(html, /<span class="cb-trace cb-trace-gentle cb-trace-band" aria-hidden="true" data-scroll="enter">/);
  assert.match(html, /cb-factlist cb-factlist-band cb-on-wave/);
  assert.ok(!draw([{ type: 'facts', variant: 'band', data: { items: [{ value: '1', label: 'x' }] } }]).includes('cb-trace-band'));
  assert.ok(needsSignature({ type: 'facts', variant: 'row', data: { wave: true } }));
});

test('a word marked in a rounded heading is set in the accent, never slanted', () => {
  assert.match(css, /\.cbp-hf-friendly \.cb-h em\{font-style:normal;color:var\(--cb-accent-text,var\(--accent\)\)\}/);
});
