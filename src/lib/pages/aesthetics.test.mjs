// The aesthetics batch (release 7): the pinned split opening, the rail of cards under moving
// words, the menu index, ways to pay held like a hand, tiles that open, photos beside a
// statement, register links, italic words in headings, the two new heading typefaces and the
// still wash. Each is drawn in the editor and on the website, keeps every word for screen
// readers, never leaves a dead button, and moves only for visitors who have not asked for less.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeTitle, titleLine, townOf } from '../professional.mjs';
import { renderPage, normalisePage, needsSignature, lookNeedsSignature, SIGNATURE_LAYOUTS, SIGNATURE_FIELDS, plainHeading, cleanLook, PAGE_FONTS, MOTION, MOTION_PRESETS, variantsOf } from './render.mjs';

const pro = { phone: '01632 960 123', email: 'hello@example.com', location: '2 Linden Court\nHarrogate HG1 1AA', hours: 'Monday to Friday, 9am to 6pm\nSunday, closed', bookingUrl: 'https://cal.com/rick/get-rick-rolled' };
const SITE = { name: 'Maison Vale', professional: pro };
const NOTHING = { name: 'Maison Vale', professional: {} };
const pic = (n) => ({ src: `/site-images/cbp-${n}.webp`, alt: `Photo ${n}` });
const page = (blocks, look = {}) => ({ v: 1, title: 'Test', slug: 'test', look, blocks });
const BLOCKS = [
  { type: 'hero', variant: 'pinned', data: { kicker: 'About', heading: 'A practice *built* around time', intro: 'Hello.', story: 'First part.\n\nSecond part.', picture: pic('a'), buttons: [{ label: 'Book', href: '@booking' }] } },
  { type: 'services', variant: 'rail', data: { heading: 'Treatments and *results*', band: 'Peels, Skin boosters, Microneedling', items: [{ name: 'Peel', price: '£120', duration: '30 min', picture: pic('b'), link: { label: 'About peels', href: '/treatments/' } }, { name: 'Boosters', price: 'from £260', picture: pic('c') }, { name: 'Words only' }] } },
  { type: 'menuboard', variant: 'index', data: { heading: 'The *menu*', items: [{ group: 'Facials', name: 'Facial', duration: '60 min', price: '£95', description: 'A calm hour.' }, { name: 'LED', price: '£45', tag: 'Add on' }, { group: 'Peels', name: 'Light peel', duration: '30 min', price: '£110' }] } },
  { type: 'plans', variant: 'fan', data: { heading: 'Ways to pay', items: [{ name: 'On the day', price: 'Card' }, { name: 'Deposit', price: '£60', pay: { label: 'Pay deposit', href: 'https://buy.stripe.com/test' } }, { name: 'Membership', price: '£55', popular: true }] } },
  { type: 'tiles', variant: 'open', data: { heading: 'Treatments', items: [{ name: 'Facial', duration: '60 min', price: '£90', text: 'Calm.', picture: pic('d') }, { value: '30', name: 'minutes first' }, { name: 'Boosters', price: 'from £230', picture: pic('e'), link: { label: 'Book', href: '@booking' } }] } },
  { type: 'hero', variant: 'statement', data: { heading: 'Skin care, explained properly', picture: pic('f'), pictures: [pic('g'), pic('h')] } },
  { type: 'credentials', variant: 'row', data: { heading: 'Registration', items: [{ text: 'GMC registered doctor, number 0000000', link: { label: 'Check the GMC register', href: 'https://www.gmc-uk.org/registration-and-licensing/the-medical-register' } }, { text: 'Insured' }] } },
];

test('the new layouts are drawn in the editor and on the website, every word kept', () => {
  for (const b of BLOCKS) {
    for (const editable of [true, false]) {
      const html = renderPage(page([b]), { site: SITE, editable });
      assert.ok(html.includes(`cb-${b.type}--${b.variant}`), `${b.type}/${b.variant} ${editable ? 'editor' : 'website'}`);
      for (const x of b.data.items || []) if (x.name) assert.ok(html.includes(x.name), `${b.type}/${b.variant}: ${x.name}`);
    }
  }
  // The pinned opening keeps its story; the website keeps it under the first screen.
  const hero = renderPage(page([BLOCKS[0]]), { site: SITE });
  assert.match(hero, /cb-pinhero[\s\S]*cb-pinhero-first[\s\S]*<h1[^>]*>A practice <em>built<\/em> around time<\/h1>[\s\S]*cb-pinhero-story[\s\S]*Second part/);
  assert.match(hero, /fetchpriority="high"/, 'the opening photo is asked for first');
});

test('rail: the band of words is decoration, the cards travel on a wide screen and are swiped on a phone', () => {
  const html = renderPage(page([BLOCKS[1]]), { site: SITE });
  assert.match(html, /<div class="cb-rail-band" aria-hidden="true">/);
  assert.match(html, /class="cb-hs cb-rail" data-hs/);
  assert.match(html, /aria-label="Treatments and results, scrolls sideways"/, 'the label has no stars in it');
  assert.equal((html.match(/class="cb-rail-card/g) || []).length, 3);
  // In the editor the cards sit still in a grid and the words are listed as a hint.
  const ed = renderPage(page([BLOCKS[1]]), { site: SITE, editable: true });
  assert.ok(!ed.includes('data-hs') && ed.includes('cb-rail-still') && ed.includes('Moving words above the cards'));
  // No band, no copies.
  assert.ok(!renderPage(page([{ ...BLOCKS[1], data: { ...BLOCKS[1].data, band: '' } }]), { site: SITE }).includes('cb-rail-band'));
});

test('menu index: plain links to each group, a line with words opens, times shown', () => {
  const html = renderPage(page([BLOCKS[2]]), { site: SITE });
  const ids = [...html.matchAll(/<h3 class="cb-mb-group" id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.ok(html.includes(`href="#${id}"`), `the index links to ${id}`);
  assert.match(html, /<details><summary class="cb-mb-line">[\s\S]*Facial[\s\S]*60 min[\s\S]*£95[\s\S]*<\/summary><p class="cb-mb-desc">A calm hour\.<\/p><\/details>/);
  assert.match(html, /data-mbi style="--n:2"/);
  assert.match(html, /aria-current="true"/);
  // Groups without names, and the editor, get the plain columns.
  assert.ok(!renderPage(page([BLOCKS[2]]), { site: SITE, editable: true }).includes('data-mbi'));
});

test('ways to pay held like a hand: each card knows its place, and a card with no pay link still leads somewhere', () => {
  for (const site of [SITE, NOTHING]) {
    const html = renderPage(page([BLOCKS[3]]), { site });
    assert.match(html, /class="cb-pl cb-pl-fan" data-scroll="enter" data-scroll-span="0.8" style="--n:3"/);
    assert.deepEqual([...html.matchAll(/--fi:(-?[\d.]+)/g)].map((m) => Number(m[1])), [-1, 0, 1]);
    for (const m of html.matchAll(/<a\b[^>]*?href="([^"]*)"/g)) assert.ok(m[1] && m[1] !== '#', `dead link with ${JSON.stringify(site.professional)}`);
  }
});

test('tiles that open: price and time on a panel, a tile without a link can still be reached with the keyboard', () => {
  const html = renderPage(page([BLOCKS[4]]), { site: SITE });
  assert.match(html, /class="cb-tl cb-tl-open"/);
  assert.match(html, /<article tabindex="0" class="cb-tl-item has-pic has-panel">[\s\S]*?<div class="cb-tl-panel"><p class="cb-tl-meta"><span class="cb-tl-time">60 min<\/span><span class="cb-tl-price">£90<\/span>/);
  assert.match(html, /<article class="cb-tl-item has-pic has-panel">/, 'a tile with a link needs no tabindex');
  assert.ok(!/has-value[^"]*has-panel/.test(html), 'a number tile has no panel');
});

test('photos beside a statement: three at most, the first asked for first; none means the statement alone', () => {
  const html = renderPage(page([BLOCKS[5]]), { site: SITE });
  assert.equal((html.match(/class="cb-float-pic"/g) || []).length, 3);
  assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1);
  const bare = renderPage(page([{ type: 'hero', variant: 'statement', data: { heading: 'Just words' } }]), { site: SITE });
  assert.ok(!bare.includes('cb-float') && bare.includes('cb-statement'));
});

test('a registration can link to its public register', () => {
  const html = renderPage(page([BLOCKS[6]]), { site: SITE });
  assert.match(html, /<li><span>GMC registered doctor, number 0000000<\/span><a class="cb-link cb-creds-link" href="https:\/\/www\.gmc-uk\.org\/[^"]+">Check the GMC register<\/a><\/li>/);
});

test('italic words in headings: drawn on the website, typed with their stars in the editor, never markup', () => {
  const one = (heading, editable = false) => renderPage(page([{ type: 'text', variant: 'plain', data: { heading } }]), { site: SITE, editable });
  assert.match(one('Skin care, *quietly* done'), /Skin care, <em>quietly<\/em> done/);
  // The editor shows the word as it will look, with its stars faint; its words read back the same.
  const edited = one('Skin care, *quietly* done', true);
  assert.match(edited, /Skin care, <span class="cb-emk"[^>]*>\*<\/span><em>quietly<\/em><span class="cb-emk">\*<\/span> done/);
  assert.ok(edited.replace(/<[^>]*>/g, '').includes('Skin care, *quietly* done'));
  assert.ok(!one('Rated 5* by guests').includes('<em>'));
  assert.ok(!one('*<b>x</b>*').includes('<b>'), 'escaped first');
  assert.equal(plainHeading('A *word* here'), 'A word here');
});

test('the release 7 gate knows the new layouts, settings, register links and italic words', () => {
  for (const [type, v] of [['hero', 'pinned'], ['services', 'rail']]) assert.ok(SIGNATURE_LAYOUTS[type].includes(v));
  for (const [type, k] of [['hero', 'story'], ['services', 'band']]) assert.ok(SIGNATURE_FIELDS[type].includes(k));
  for (const [type, v] of [['menuboard', 'index'], ['plans', 'fan'], ['tiles', 'open']]) assert.ok(variantsOf(type).includes(v));
  assert.ok(needsSignature({ type: 'credentials', variant: 'list', data: { items: [{ text: 'x', link: { label: 'Check', href: '/x/' } }] } }));
  assert.ok(needsSignature({ type: 'text', variant: 'plain', data: { heading: 'A *word*' } }));
  assert.ok(!needsSignature({ type: 'text', variant: 'plain', data: { heading: 'Five* service' } }));
  assert.ok(!needsSignature({ type: 'credentials', variant: 'list', data: { items: [{ text: 'x' }] } }));
  assert.ok(lookNeedsSignature({ font: 'noir' }) && lookNeedsSignature({ motion: { backdrop: 'dawn' } }));
  assert.ok(!lookNeedsSignature({ font: 'modern', motion: { backdrop: 'aurora' } }) && !lookNeedsSignature(null));
});

test('the new heading typefaces, the still wash and the Nocturne style are fixed choices', () => {
  for (const f of ['fine', 'noir']) { assert.ok(PAGE_FONTS[f]); assert.equal(cleanLook({ font: f }).font, f); }
  assert.ok(MOTION.backdrop.options.dawn);
  assert.equal(MOTION_PRESETS.nocturne.motion.scroll, 'wipe');
  assert.equal(MOTION_PRESETS.nocturne.motion.heading, 'rising');
  // The wash sits behind the opening only, never echoed behind a call to action.
  const html = renderPage(page([{ type: 'hero', variant: 'statement', data: { heading: 'Hi' } }, { type: 'cta', variant: 'band', data: { heading: 'Book' }, style: { bg: 'dark' } }], { motion: { backdrop: 'dawn', scroll: 'cascade' } }), { site: SITE });
  assert.equal((html.match(/cbm-bd-dawn/g) || []).length, 1);
});

test('movement for the new parts waits for a visitor who has not asked for less, and moves only transforms and opacity', () => {
  const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');
  const tail = css.slice(css.indexOf('Aesthetics batch (release 7)'));
  // Every animation, transition and sticky pin in the new part sits inside a reduce-motion guard.
  const outside = tail.replace(/@media screen and \(prefers-reduced-motion:no-preference\)[^{]*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  // (The menu index stays beside the list for everyone: it is a way to find a group, not movement.)
  for (const word of ['animation:', 'transition:', 'position:sticky']) assert.ok(!outside.replace('.cb-mbi-nav{position:sticky', '').includes(word), `${word} outside the guard`);
  for (const m of tail.matchAll(/@keyframes [\w-]+\{((?:[^{}]|\{[^{}]*\})*)\}/g)) assert.ok(!/(width|height|top|left|margin|padding):/.test(m[1]), `a keyframe moves layout: ${m[0].slice(0, 60)}`);
  // The rail's band of words is left out for visitors who ask for less, and without the script.
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.cb-rail-band\{display:none\}\}/);
  assert.match(css, /html:not\(\.cbm-js\) \.cb-rail-band\{display:none\}/);
  // The panel of a tile is only closed for a mouse on a wide screen.
  assert.match(tail, /@media \(hover:hover\) and \(pointer:fine\) and \(min-width:761px\)\{\s*html\.cbm-js \.cbp:not\(\[data-m-edit\]\) \.cb-tl-open/);
});

test('every new layout survives normalising, so a page file can never carry anything else', () => {
  const n = normalisePage(page(BLOCKS));
  assert.deepEqual(n.blocks.map((b) => `${b.type}/${b.variant}`), BLOCKS.map((b) => `${b.type}/${b.variant}`));
  assert.equal(n.blocks[0].data.story, 'First part.\n\nSecond part.');
  assert.equal(n.blocks[1].data.band, 'Peels, Skin boosters, Microneedling');
  assert.equal(n.blocks[2].data.items[0].duration, '60 min');
  assert.equal(n.blocks[4].data.items[0].price, '£90');
  assert.equal(n.blocks[6].data.items[0].link.label, 'Check the GMC register');
});

test('a business home page is found by what it does and where', () => {
  const site = { name: 'Maison Vale', masthead: 'Maison Vale', professional: { eyebrow: 'Skin and aesthetics', location: '2 Linden Court, Station Parade\nHarrogate HG1 1AA' } };
  assert.equal(titleLine(homeTitle(site), site.name), 'Skin and aesthetics in Harrogate | Maison Vale');
  assert.equal(homeTitle({ masthead: 'Maison Vale' }), 'Maison Vale', 'no details: the name, as before');
  assert.equal(homeTitle({ masthead: 'X', professional: { eyebrow: 'Dentist in Leeds', location: '1 Road\nLeeds LS1 1AA' } }), 'Dentist in Leeds');
  assert.equal(townOf('Studio 2, Loom Mill, Ancoats\nManchester M4 1AA'), 'Manchester');
});

test('a photo with a phone copy is drawn with both sizes; anything else is dropped', () => {
  const pic2 = { src: '/site-images/cbp-vale-hero.webp', phone: '/site-images/cbp-vale-hero-phone.webp', alt: 'A room' };
  const html = renderPage(page([{ type: 'hero', variant: 'reveal', data: { heading: 'Hi', picture: pic2 } }]), { site: SITE });
  assert.match(html, /srcset="\/site-images\/cbp-vale-hero-phone\.webp 800w, \/site-images\/cbp-vale-hero\.webp 1600w" sizes="\(max-width: 760px\) 92vw, 60vw"/);
  // A photo that says how wide each copy is (every signature photo does) is described exactly.
  const sized = renderPage(page([{ type: 'hero', variant: 'reveal', data: { heading: 'Hi', picture: { ...pic2, w: 832, phoneW: 720 } } }]), { site: SITE });
  assert.match(sized, /srcset="\/site-images\/cbp-vale-hero-phone\.webp 720w, \/site-images\/cbp-vale-hero\.webp 832w"/);
  assert.equal(normalisePage(page([{ type: 'hero', variant: 'reveal', data: { picture: { ...pic2, w: 99999, phoneW: 'x' } } }])).blocks[0].data.picture.w, undefined, 'only real widths');
  const n = normalisePage(page([{ type: 'hero', variant: 'reveal', data: { picture: { ...pic2, phone: 'https://example.com/x.webp' } } }]));
  assert.equal(n.blocks[0].data.picture.phone, undefined, 'only the site’s own images');
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'reveal', data: { heading: 'Hi', picture: { src: pic2.src, alt: 'x' } } }]), { site: SITE }).includes('srcset'));
});

test('a page that opens with words only asks for its first photo at once; one with an opening photo does not', () => {
  const words = renderPage(page([{ type: 'hero', variant: 'minimal', data: { heading: 'Treatments' } }, BLOCKS[1]]), { site: SITE });
  assert.equal((words.match(/fetchpriority="high"/g) || []).length, 1);
  assert.match(words, /<img src="\/site-images\/cbp-b\.webp" alt="Photo b" fetchpriority="high"/);
  const photoFirst = renderPage(page([BLOCKS[0], BLOCKS[1]]), { site: SITE });
  assert.equal((photoFirst.match(/fetchpriority="high"/g) || []).length, 1, 'only the opening photo');
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'minimal', data: { heading: 'T' } }, BLOCKS[1]]), { site: SITE, editable: true }).includes('fetchpriority'));
});
