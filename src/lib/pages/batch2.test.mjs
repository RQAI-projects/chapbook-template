// Signature batch 2 (website design release 7): still water (the words above a photo and its
// reflection), arched ways to work that rise into place, steps that climb, and a route drawn down
// the page. Each is decoration over words that read on their own, stays still with movement turned
// down, uses transform and opacity only, and never changes how an older section draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, needsSignature } from './render.mjs';

const page = (blocks) => ({ v: 1, title: 'Test', slug: 'test', look: {}, blocks });
const draw = (blocks, opts = {}) => renderPage(page(blocks), { site: { name: 'Test', professional: { phone: '01632 960 123' } }, ...opts });
const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');
const PIC = { src: '/site-images/water.webp', alt: 'Still water at dawn', phone: '/site-images/water-phone.webp', w: 1088, phoneW: 720 };
const PLANS = [{ name: 'Power hour', price: '£150' }, { name: 'Monthly', price: '£600', popular: true }, { name: 'Project', price: 'From £3,000' }];

test('still water: the words, then the photo whole (its own reflection), settling as the page opens', () => {
  const hero = { id: 'h', type: 'hero', variant: 'reflection', data: { heading: 'A quiet place to talk', picture: PIC, help: 'Need help now?' } };
  const html = draw([hero, { id: 'n', type: 'notice', variant: 'help', data: { heading: 'If you need help now', items: [{ name: 'Samaritans', number: '116 123' }] } }]);
  assert.match(html, /<div class="cb-rf"><div class="cb-hero-words cb-rf-words"><h1 class="cb-h cb-hero-h">A quiet place to talk<\/h1>/);
  assert.match(html, /<figure class="cb-hero-pic cb-rf-water"><img src="\/site-images\/water\.webp"[^>]*alt="Still water at dawn" fetchpriority="high"/);
  // No mirrored copy under the photo (it would double the photo's own reflection): only the
  // softened water that settles, hidden from screen readers.
  assert.ok(!html.includes('cb-rf-mirror') && !html.includes('scaleY(-1)'));
  assert.match(html, /<span class="cb-rf-ripple" aria-hidden="true"><img src="\/site-images\/water\.webp" srcset="[^"]+" sizes="[^"]+" alt="" decoding="async"><\/span><\/figure>/);
  assert.match(html, /<a href="#help-now">/, 'the help line in the first screen');
  // The editor shows the photo alone; with no photo it is the words alone.
  assert.ok(!draw([hero], { editable: true }).includes('cb-rf-ripple'));
  assert.ok(!draw([{ ...hero, data: { heading: 'Words' } }]).includes('cb-rf-water'));
  assert.equal(needsSignature(hero), true);
  // The photo is whole (wide, the horizon across the middle); the settling copy is drawn only with
  // movement allowed, and moves by opacity and transform alone.
  assert.match(css, /\.cbp \.cb-hero-pic\.cb-rf-water\{[^}]*aspect-ratio:2\/1/);
  assert.match(css, /\.cb-rf-ripple\{display:none;/);
  assert.match(css, /html\.cbm-js \.cbm \.cb-rf-water\.is-stirred \.cb-rf-ripple\{display:block;opacity:\.8\}/);
  assert.match(css, /html\.cbm-js \.cbm \.cb-rf-water\.is-calm \.cb-rf-ripple\{animation:cb-rf-calm/);
  assert.match(css, /html\.cbm-paused \.cb-rf-ripple\{display:none!important\}/);
  // The page's script stirs the water and calms it once half the photo is in view.
  const motion = readFileSync(new URL('../../scripts/page-motion.js', import.meta.url), 'utf8');
  assert.match(motion, /querySelectorAll\('\.cb-rf-water'\)[\s\S]*classList\.add\('is-calm'\)[\s\S]*threshold: 0\.5[\s\S]*classList\.add\('is-stirred'\)/);
  assert.match(css, /@keyframes cb-rf-calm\{from\{opacity:\.8\}to\{opacity:0\}\}/);
  assert.match(css, /@keyframes cb-rf-wave\{from\{transform:scaleY\(1\.07\) translate3d\(0,8px,0\)\}to\{transform:none\}\}/);
});

test('arched ways to work rise into place, the marked one raised; a plain grid in the editor', () => {
  const plans = { id: 'p', type: 'plans', variant: 'arches', data: { heading: 'Ways to work with me', items: PLANS } };
  const html = draw([plans]);
  assert.match(html, /<div class="cb-pl cb-pl-arches" data-scroll="enter" data-scroll-span="0\.75">/);
  assert.match(html, /<article style="--k:1" class="cb-pl-item is-popular"><p class="cb-pl-flag">Most popular<\/p>/);
  assert.ok(!draw([{ ...plans }], { editable: true }).includes('data-scroll'));
  assert.equal(needsSignature(plans), true);
  assert.match(css, /\.cb-pl-arches>\.cb-pl-item\{border-radius:999px 999px/);
  // Transform only: the words are at full strength the whole way, so nothing is ever faint.
  assert.match(css, /\.cb-pl-arches\.is-live>\.cb-pl-item\{transform:translate3d\([^}]*\)\}/);
});

test('steps that climb: a ladder with rise builds itself; without it the ladder draws as before', () => {
  const ladder = (rise) => ({ id: 'l', type: 'plans', variant: 'ladder', data: { items: [{ name: '30 minutes', price: '£35' }, { name: '60 minutes', price: '£55' }, { name: '90 minutes', price: '£75' }], ...(rise ? { rise: true } : {}) } });
  assert.match(draw([ladder(true)]), /<div class="cb-pl cb-pl-ladder cb-pl-rise" data-scroll="enter" data-scroll-span="0\.9"><article style="--k:0" class="cb-pl-item">/);
  const plain = draw([ladder(false)]);
  assert.ok(plain.includes('<div class="cb-pl cb-pl-ladder"><article class="cb-pl-item">') && !plain.includes('data-scroll'));
  assert.equal(needsSignature(ladder(true)), true);
});

test('a route down the page: numbered points on one line that draws as the steps are read', () => {
  const steps = { id: 's', type: 'steps', variant: 'route', data: { heading: 'How we work', items: [{ when: 'Weeks 1 to 2', name: 'Listen', description: 'We start with the people.' }, { name: 'Decide' }, { name: 'Do' }] } };
  const html = draw([steps]);
  assert.match(html, /<div class="cb-route" style="--n:3" data-scroll="read"><span class="cb-route-line" aria-hidden="true"><i><\/i><\/span><ol class="cb-steps cb-steps-route">/);
  assert.match(html, /<li class="cb-step cb-route-item"><span class="cb-route-n" aria-hidden="true">01<\/span><div class="cb-step-body"><p class="cb-route-when">Weeks 1 to 2<\/p><h3 class="cb-step-name">Listen<\/h3>/);
  assert.ok(!draw([steps], { editable: true }).includes('data-scroll'));
  assert.equal(needsSignature(steps), true);
  assert.match(css, /\.cb-route-line i\{[^}]*transform:scaleY\(var\(--p,1\)\)\}/);
  assert.match(css, /html\.cbm-js \.cbm\[data-m-scroll\] \.cb-route:not\(\.is-live\)\{--p:0\}/);
});

test('a giant word behind an opening on a deep band reads as large type, not a faint watermark', () => {
  assert.match(css, /\.cbp \.cb-bg-dark \.cb-bw-word\{color:color-mix\(in srgb,currentColor 38%,transparent\)\}/);
});

// Review 2, finding 4 (23 Nov): the giant word keeps its size at Edge to edge, and a wide word is
// sized by its own letters, so it stays inside the band and clear of the words.
test('the giant word on a deep band is sized by its letters, and never by a percentage', async () => {
  const { wordEm } = await import('./render.mjs');
  assert.equal(wordEm('Ease'), 2.24, 'the sample keeps its size');
  assert.ok(wordEm('Move') > 2.24 && wordEm('Mmmm') > wordEm('Move'));
  assert.equal(wordEm('Go'), 2.24, 'a short word is never drawn larger than four letters');
  const hero = (bg, width = 'normal') => ({ id: 'h', type: 'hero', variant: 'backword', style: { bg, width }, data: { heading: 'Massage', word: 'Move', picture: PIC } });
  assert.match(draw([hero('dark')]), /<p class="cb-bw-word" style="--len:4;--bw-em:2\.635">MOVE<\/p>|<p class="cb-bw-word" style="--len:4;--bw-em:2\.635">Move<\/p>/);
  assert.ok(!draw([hero('none')]).includes('--bw-em'), 'an opening that is not on a deep band draws as before');
  assert.match(css, /font-size:min\(24rem,calc\(\(var\(--bw-col\) \+ var\(--bw-room\)\) \/ var\(--bw-em,calc\(var\(--len,6\) \* \.56\)\)\)\)/);
  assert.match(css, /--bw-room:min\(var\(--bw-gap\) \* \.9,100vw - var\(--bw-w\)\)/);
  assert.match(css, /\.cbp \.cb-bg-dark\.cb-hero--backword\.cb-w-full \.cb-bw-word\{--bw-w:100vw\}/);
});

// Review 2 minor (23 Nov): the still water photo is shown across the content width.
test('the still water photo says it is shown across the content width', () => {
  const hero = (width) => ({ id: 'h', type: 'hero', variant: 'reflection', style: { width }, data: { heading: 'A quiet place to talk', picture: PIC } });
  const html = draw([hero('normal')]);
  assert.equal((html.match(/sizes="\(max-width: 760px\) 92vw, min\(72rem, 92vw\)"/g) || []).length, 2, 'the photo and its settling copy, so one file serves both');
  assert.match(draw([hero('full')]), /sizes="100vw"/);
  assert.match(draw([hero('wide')]), /sizes="\(max-width: 760px\) 92vw, min\(90rem, 92vw\)"/);
  // Other photos keep their sizes.
  const split = { id: 's', type: 'hero', variant: 'split', data: { heading: 'Hello', picture: PIC } };
  assert.match(draw([split]), /sizes="\(max-width: 760px\) 92vw, 60vw"/);
});

test('with one column the giant word is sized by its letters, and with no photo the words leave room under the buttons', () => {
  assert.match(css, /@media \(max-width:760px\)\{\s*\.cbp \.cb-bg-dark\.cb-hero--backword \.cb-bw-word\{font-size:min\(24rem,calc\(84vw \/ var\(--bw-em,calc\(var\(--len,6\) \* \.56\)\)\)\)\}\s*\.cbp \.cb-bg-dark\.cb-hero--backword>\.cb-in>\.cb-hero-words\{padding-bottom:27vw\}/);
  const hero = { id: 'h', type: 'hero', variant: 'backword', style: { bg: 'dark' }, data: { heading: 'Massage', word: 'Ease' } };
  assert.match(draw([hero]), /<div class="cb-in"><p class="cb-bw-word"[^>]*>Ease<\/p><div class="cb-hero-words">/);
});
