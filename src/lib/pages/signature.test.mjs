// The signature sections and movement (website design release 7): how each one is drawn in the
// editor and on the website, where every Book and Pay button goes when details are missing, what
// the spaces wording says (past dates included), and that movement stays out of the way of
// visitors who ask for less of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, normalisePage, variantsOf, SIGNATURE_TYPES, SIGNATURE_LAYOUTS, needsSignature, cleanDate, bookWays, bookWith, spacesWords, MOTION, MOTION_PRESETS, motionFor, pageColours, contrast } from './render.mjs';
import { spacesText, dayInLabel, calSlotsUrl, addDays, freeTimesText, seatsOn, hoursSpans, hoursOn, openState, timeText } from '../../scripts/page-actions.js';

const pro = { phone: '01632 960 123', email: 'hello@example.com', location: '3 Church Lane\nWimborne', hours: 'Monday to Friday, 9am to 6pm\nSaturday, 10am to 2pm\nSunday, closed', bookingUrl: 'https://cal.com/rick/get-rick-rolled', cqcId: '1-101641587', cqcRating: 'good', cqcDate: '2025-09-18' };
const SITE = { name: 'Sorrel House', professional: pro };
const NO_BOOKING = { name: 'Sorrel House', professional: { ...pro, bookingUrl: '' } };
const NOTHING = { name: 'Sorrel House', professional: {} };
const pic = (n) => ({ src: `/site-images/cbp-${n}.webp`, alt: `Photo ${n}` });
const page = (blocks, look = {}) => ({ v: 1, title: 'Test', slug: 'test', look, blocks });
const TODAY = '2026-11-23';
const DATA = {
  bookstrip: { heading: 'Book in a minute', items: [{ name: 'Consultation', duration: '30 min', price: '£35' }, { name: 'Facial', duration: '60 min', price: '£85', link: { label: '', href: 'https://cal.com/rick/facial' } }], button: 'Book', sticky: true, whatsapp: '447700900123' },
  plans: { heading: 'Ways to pay', items: [{ name: 'Deposit', price: '£50', includes: '- Holds your date', pay: { label: 'Pay deposit', href: 'https://buy.stripe.com/test' } }, { name: 'Course', price: '£255', popular: true }, { name: 'Plan', price: '£49', per: 'a month', popular: true }] },
  spaces: { heading: 'Open evenings', items: [{ name: 'Gone', date: '2026-11-01', capacity: 10, left: 3 }, { name: 'Soon', date: '2026-12-05', capacity: 16, left: 5, time: '6.30pm' }, { name: 'Nearly', date: '2026-12-19', capacity: 20, left: 2 }, { name: 'Full one', date: '2027-01-02', capacity: 12, left: 0, waitlist: { label: '', href: '/contact/' } }] },
  menuboard: { heading: 'Menu', items: [{ group: 'Skin', name: 'Facial', price: '£85' }, { name: 'Peel', price: '£95' }, { group: 'Needling', name: 'Microneedling', price: '£180' }] },
  tiles: { heading: 'Tiles', items: [{ name: 'A room', picture: pic('a') }, { value: '45', name: 'minutes' }, { name: 'Advice', text: 'Honest.' }] },
  compare: { heading: 'Before and after', intro: 'Shown with consent. Results vary.', items: [{ name: 'Pair', before: pic('b'), after: pic('c') }] },
  timetable: { heading: 'Week', items: [{ day: 'mon', time: '9am', name: 'Consultations' }, { day: 'thu', time: '6pm', name: 'Late', link: { label: '', href: '@booking' } }] },
  casestudy: { heading: 'A case', intro: 'Words.', picture: pic('d'), items: [{ label: 'Time', value: 'Six weeks' }], brief: 'Brief.', work: 'Work.', result: 'Result.' },
  scenes: { heading: 'Scenes', items: [{ name: 'One', picture: pic('e') }, { name: 'Two', picture: pic('f') }] },
  regulator: { heading: 'Who looks after you', items: [{ name: 'Dr Ruth Penrose', body: 'gmc', number: '1234567' }, { name: 'Jo Pascoe', body: 'nmc', number: '12A3456B' }], widget: true },
};
const EXTRA = [
  ['hero', 'reveal', { kicker: 'Skin', heading: 'Skin care with time to talk', mark: 'time to talk', intro: 'Hello.', picture: pic('g'), buttons: [{ label: 'Book', href: '@booking' }] }],
  ['hero', 'statement', { heading: 'One clear statement', buttons: [{ label: 'Book', href: '@booking' }] }],
  ['services', 'pinned', { heading: 'Treatments', items: [{ name: 'Facial', price: '£85', duration: '60 min', picture: pic('h') }, { name: 'Peel', price: '£95', picture: pic('i') }, { name: 'Words only' }] }],
  ['steps', 'sticky', { heading: 'Steps', items: [{ name: 'One', link: { label: 'Register', href: '/contact/' } }, { name: 'Two' }, { name: 'Three' }] }],
  ['facts', 'band', { items: [{ value: '45', label: 'minutes' }, { value: '2', label: 'weeks' }] }],
  ['credentials', 'row', { items: [{ text: 'Registered' }, { text: 'Insured' }] }],
  ['contact', 'map', { heading: 'Find us', business: true, openNow: true }],
  ['contact', 'hours', { heading: 'Hours', business: true, openNow: true }],
  ['team', 'grid', { heading: 'Team', bookEach: true, items: [{ name: 'Dr Amara Osei', quals: 'MRCGP' }, { name: 'Hannah Reed', book: { label: '', href: 'https://cal.com/rick/hannah' } }] }],
  // The doctor clinic batch.
  ['hero', 'actions', { kicker: 'GP practice', heading: 'Good care close to home', intro: 'Hello.', picture: pic('j'), openNow: true, closed: 'When we are closed, call **NHS 111**. In an emergency, call **999**.', actions: [{ link: { label: 'Book an appointment', href: '@booking' }, detail: 'Online' }, { link: { label: 'Register', href: '/new-patients/' } }, { link: { label: 'Call the surgery', href: '@phone' } }, { link: { label: 'Repeat prescription', href: 'https://www.nhs.uk/nhs-app/' } }] }],
  ['team', 'rail', { heading: 'Our doctors', bookEach: true, items: [{ name: 'Dr Ruth Penrose', quals: 'GMC 1234567' }, { name: 'Dr Samuel Okoye' }, { name: 'Dr Priya Nair' }] }],
  ['services', 'rail', { heading: 'Specialities', items: [{ name: 'Dermatology', who: 'Dr Amelia Hart', wait: '5 days', price: 'from £220', picture: pic('k'), link: { label: 'Book', href: '@booking' } }, { name: 'Cardiology', who: 'Dr Rohan Mehta', wait: '7 days', price: 'from £250' }] }],
  ['contact', 'hours', { heading: 'When we are open', business: true, openNow: true, closed: 'When we are closed, call NHS 111.' }],
];
const allBlocks = () => [
  ...SIGNATURE_TYPES.flatMap((type) => variantsOf(type).map((variant) => ({ type, variant, data: JSON.parse(JSON.stringify(DATA[type])) }))),
  ...EXTRA.map(([type, variant, data]) => ({ type, variant, data: JSON.parse(JSON.stringify(data)) })),
];
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?href="([^"]*)"/g)].map((m) => m[1]);

test('every signature section and layout is drawn in the editor and on the website', () => {
  for (const b of allBlocks()) {
    const pub = renderPage(page([b]), { site: SITE, today: TODAY });
    const ed = renderPage(page([b]), { site: SITE, today: TODAY, editable: true });
    const name = `${b.type}/${b.variant}`;
    assert.ok(pub.includes(`cb-t-${b.type}`), `${name} draws nothing on the website`);
    assert.ok(!pub.includes('data-cb'), `${name} leaks editor markers`);
    assert.ok(ed.includes('data-cb-block'), `${name} cannot be chosen in the editor`);
    // Every heading the person typed is there, on both.
    if (b.data.heading) for (const html of [pub, ed]) assert.ok(html.replace(/<\/?mark[^>]*>/g, '').includes(b.data.heading), `${name} lost its heading`);
  }
});

test('every list entry can be changed in the editor: words, and the list itself', () => {
  for (const b of allBlocks()) {
    // (The slim bar is only a Book button: its list waits for the strip or the cards.)
    // (So is the rating on one line: its registrations wait for the panel.)
    if (!b.data.items || (b.type === 'bookstrip' && b.variant === 'bar') || (b.type === 'regulator' && b.variant === 'line')) continue;
    const ed = renderPage(page([{ id: 'b1', ...b }]), { site: SITE, today: TODAY, editable: true });
    assert.ok(ed.includes('data-cb-list="b1:items"'), `${b.type}/${b.variant}: the list cannot take a new entry`);
    for (let i = 0; i < b.data.items.length; i++) assert.ok(ed.includes(`data-cb-item="b1:items.${i}"`), `${b.type}/${b.variant}: entry ${i} cannot be moved or removed`);
    // A name typed on the page is marked for typing.
    const first = Object.keys(b.data.items[0]).find((k) => typeof b.data.items[0][k] === 'string' && !['day', 'group'].includes(k));
    if (first) assert.ok(ed.includes(`data-cb="b1:items.0.${first}"`), `${b.type}/${b.variant}: ${first} cannot be typed on the page`);
  }
});

test('no Book, Pay or Call button ever goes nowhere, however few details the website has', () => {
  for (const site of [SITE, NO_BOOKING, NOTHING]) {
    const html = renderPage(page(allBlocks()), { site, today: TODAY });
    for (const h of hrefs(html)) assert.ok(h && h !== '#' && !/^(tel|mailto):$/.test(h), `a dead link "${h}" with ${site.professional.bookingUrl ? 'a booking link' : site.professional.phone ? 'a phone only' : 'no details'}`);
  }
  // The order of fallbacks: own link, then the booking link, then a call or WhatsApp, then Contact.
  const C = (p) => ({ biz: p, href: (x) => x });
  assert.deepEqual(bookWays(C(pro), { own: { href: 'https://cal.com/rick/own' } }).map((w) => w.href), ['https://cal.com/rick/own']);
  assert.deepEqual(bookWays(C(pro)).map((w) => w.kind), ['book']);
  assert.deepEqual(bookWays(C({ phone: '01632 960 123' }), { whatsapp: '447700900123' }).map((w) => w.kind), ['call', 'whatsapp']);
  assert.deepEqual(bookWays(C({})).map((w) => [w.kind, w.href]), [['contact', '/contact/']]);
  // A person's own Book button says who it is with.
  assert.equal(bookWith('Dr Amara Osei'), 'Book with Dr Osei');
  assert.equal(bookWith('Hannah Reed'), 'Book with Hannah');
  const team = renderPage(page([{ type: 'team', variant: 'grid', data: EXTRA[8][2] }]), { site: SITE });
  assert.match(team, /href="\/appointments\/"[^>]*>Book with Dr Osei</);
  // Her own Cal.com page opens the Appointments page with her named (round B review, minor 3).
  assert.match(team, /href="\/appointments\/#book-[a-z0-9-]+"[^>]*>Book with Hannah</);
  // A person with a link of her own (Read more, LinkedIn, a Cal.com page) but no Book link uses the
  // website's booking, never that other link (round B2 re-review M1).
  for (const href of ['https://www.linkedin.com/in/hannah-reed', '/about/', 'https://cal.com/rick/hannah']) {
    const other = renderPage(page([{ id: 'tm1', type: 'team', variant: 'grid', data: { bookEach: true, items: [{ id: 'p1', name: 'Hannah Reed', link: { label: 'Read more', href } }] } }]), { site: SITE });
    assert.match(other, /<p class="cb-person-book"><a[^>]*href="\/appointments\/"[^>]*>Book with Hannah</, href);
  }
  const bare = renderPage(page([{ type: 'team', variant: 'grid', data: { bookEach: true, items: [{ name: 'Hannah Reed' }] } }]), { site: NOTHING });
  assert.match(bare, /href="\/contact\/"[^>]*>Ask about Hannah</);
});

test('spaces remaining: the words for each number, past dates, and a number only once the date is checked', () => {
  assert.deepEqual([6, 3, 2, 1, 0].map(spacesWords), ['6 spaces left', '3 spaces left', 'Last 2', 'Last space', 'Full']);
  assert.deepEqual([6, 2, 1, 0, -1, NaN].map(spacesText), ['6 spaces left', 'Last 2', 'Last space', 'Full', 'Full', 'Full']);
  const hide = renderPage(page([{ type: 'spaces', variant: 'rows', data: DATA.spaces }]), { site: SITE, today: TODAY });
  assert.ok(!hide.includes('>Gone<'), 'a date that had passed when the site was built is not drawn');
  assert.ok(hide.includes('>Soon<') && hide.includes('>Nearly<'));
  // A hand-set number waits, hidden, until the page's script has checked the date.
  assert.match(hide, /<p class="cb-sp-left" hidden>5 spaces left<\/p>/);
  assert.match(hide, /<p class="cb-sp-left is-last" hidden>Last 2<\/p>/);
  assert.match(hide, /class="cb-sp-left is-full" hidden>Full</);
  assert.match(hide, /Join the waiting list/);
  assert.match(hide, /Spaces as last updated on 23 Nov 2026\. Booking confirms your place\./);
  const finished = renderPage(page([{ type: 'spaces', variant: 'cards', data: { ...DATA.spaces, past: 'finished' } }]), { site: SITE, today: TODAY });
  assert.match(finished, /is-past[^>]*>[\s\S]*?>Gone<[\s\S]*?<p class="cb-sp-left">Finished<\/p>/);
  assert.ok(!/is-past[\s\S]*?Book<\/a>[\s\S]*?>Soon</.test(finished), 'a finished date offers no Book button');
  // Nothing left at all: the section says so instead of showing an empty list.
  const none = renderPage(page([{ type: 'spaces', variant: 'rows', data: { heading: 'Dates', items: [{ name: 'Gone', date: '2026-01-01', left: 2 }] } }]), { site: SITE, today: TODAY });
  assert.match(none, /<p class="cb-sp-none">No dates at the moment\.<\/p>/);
  // More left than there are spaces cannot be stored.
  assert.equal(normalisePage(page([{ type: 'spaces', data: { items: [{ name: 'x', capacity: 4, left: 9 }] } }])).blocks[0].data.items[0].left, 4);
  assert.deepEqual(['2026-02-30', '2026-13-01', '26-1-1', '2026-11-23'].map(cleanDate), ['', '', '', '2026-11-23']);
});

test('ways to pay: one most popular card, and a card with no pay link still leads somewhere', () => {
  const p = normalisePage(page([{ type: 'plans', variant: 'ladder', data: DATA.plans }]));
  assert.deepEqual(p.blocks[0].data.items.map((x) => !!x.popular), [false, true, false]);
  const html = renderPage(p, { site: SITE });
  assert.equal((html.match(/Most popular/g) || []).length, 1);
  assert.match(html, /href="https:\/\/buy\.stripe\.com\/test"[^>]*>Pay deposit</);
  assert.match(html, /cb-btn cb-btn-2 cb-pl-pay" href="\/appointments\/"/);
  // Where Book reads oddly (a GP's "How to pay"), a card without a pay link can say to ask at
  // reception, or show nothing; a card with its own pay link keeps it either way.
  for (const [unpaid, foot] of [['ask', '<p class="cb-pl-ask">Ask at reception</p>'], ['none', '']]) {
    const q = normalisePage(page([{ type: 'plans', variant: 'rows', data: { ...DATA.plans, unpaid } }]));
    assert.equal(q.blocks[0].data.unpaid, unpaid);
    const out = renderPage(q, { site: SITE });
    assert.match(out, /href="https:\/\/buy\.stripe\.com\/test"[^>]*>Pay deposit</);
    assert.ok(!out.includes('href="/appointments/"'), `${unpaid}: no Book button`);
    assert.equal((out.match(/<div class="cb-pl-foot">/g) || []).length, 3);
    if (foot) assert.equal(out.split(foot).length - 1, 2);
    // In the editor every card still has its pay link to fill in.
    assert.equal((renderPage(q, { site: SITE, editable: true }).match(/cb-pl-pay/g) || []).length, 3);
  }
  // Any other value is not kept, so the card leads to Book, a call or Contact as before.
  const odd = normalisePage(page([{ type: 'plans', variant: 'rows', data: { ...DATA.plans, unpaid: 'shout' } }]));
  assert.ok(!['shout'].includes(odd.blocks[0].data.unpaid));
  assert.match(renderPage(odd, { site: SITE }), /cb-btn cb-btn-2 cb-pl-pay" href="\/appointments\/"/);
});

test('the release 7 layouts and settings are recognised, so an older design is asked to update', () => {
  for (const type of SIGNATURE_TYPES) assert.ok(needsSignature({ type, variant: variantsOf(type)[0] }), type);
  for (const [type, list] of Object.entries(SIGNATURE_LAYOUTS)) for (const variant of list) assert.ok(needsSignature({ type, variant, data: {} }), `${type}/${variant}`);
  assert.ok(needsSignature({ type: 'team', variant: 'grid', data: { bookEach: true } }));
  assert.ok(needsSignature({ type: 'text', variant: 'plain', data: { mark: 'these words' } }));
  assert.ok(needsSignature({ type: 'columns', variant: 'half', data: { children: [{ type: 'contact', variant: 'card', data: { openNow: true } }] } }));
  assert.ok(!needsSignature({ type: 'hero', variant: 'split', data: { heading: 'x' } }));
  assert.ok(!needsSignature({ type: 'team', variant: 'grid', data: { bookEach: false } }));
});

test('marked words: wrapped once on the website, never in the editor, and never as markup', () => {
  const b = { type: 'text', variant: 'lede', data: { heading: 'A <b>bold</b> claim', body: 'If it is not right for you, we will say so. We will say so again.', mark: 'we will say so' } };
  const pub = renderPage(page([b], { motion: motionFor('hearth') }), { site: SITE });
  assert.equal((pub.match(/<mark class="cb-mark">/g) || []).length, 1);
  assert.match(pub, /<mark class="cb-mark">we will say so<\/mark>\. We will say so again/);
  assert.ok(pub.includes('data-m-mark="underline"'));
  assert.ok(!renderPage(page([b]), { site: SITE, editable: true }).includes('<mark'));
  const evil = renderPage(page([{ type: 'text', variant: 'plain', data: { body: 'a <b> c', mark: '<b>' } }]), { site: SITE });
  assert.ok(evil.includes('<mark class="cb-mark">&lt;b&gt;</mark>') && !evil.includes('<b>'));
});

test('pinned list and sticky steps: copies for the movement are hidden from screen readers, words never are', () => {
  const [pin, stk] = [EXTRA[2], EXTRA[3]].map(([type, variant, data]) => renderPage(page([{ type, variant, data }]), { site: SITE }));
  assert.match(pin, /<div class="cb-pin-stage" aria-hidden="true"><img class="is-on" data-i="0"[^>]*alt=""/);
  assert.equal((pin.match(/<img/g) || []).length, 4, 'each entry keeps its own described photo, plus the stage copies');
  assert.match(pin, /alt="Photo h"/);
  assert.ok(pin.includes('data-pinlist') && pin.includes('>Words only<'));
  // One photo is no stage: a plain list.
  const one = renderPage(page([{ type: 'services', variant: 'pinned', data: { items: [{ name: 'A', picture: pic('x') }, { name: 'B' }] } }]), { site: SITE });
  assert.ok(!one.includes('data-pinlist') && !one.includes('cb-pin-stage'));
  assert.match(stk, /<div class="cb-stk-rail" aria-hidden="true">/);
  assert.equal((stk.match(/<h3 class="cb-step-name">/g) || []).length, 3);
  assert.match(stk, /<a class="cb-btn cb-btn-small" href="\/contact\/">Register<\/a>/);
  // In the editor neither is pinned: a plain list to type into.
  const ed = renderPage(page([{ type: 'steps', variant: 'sticky', data: EXTRA[3][2] }]), { site: SITE, editable: true });
  assert.ok(!ed.includes('cb-stk-rail'));
});

test('open now: the line is filled in from the opening hours on the visitor’s own device', () => {
  const html = renderPage(page([{ type: 'contact', variant: 'map', data: EXTRA[6][2] }]), { site: SITE });
  assert.match(html, /<p class="cb-opennow" data-open="Monday to Friday, 9am to 6pm\|Saturday, 10am to 2pm\|Sunday, closed" data-tz="Europe\/London" hidden><\/p>/);
  assert.match(html, /<th scope="row">Monday to Friday<\/th><td>9am to 6pm<\/td>/);
  assert.match(html, /<th scope="row">Sunday<\/th><td>closed<\/td>/);
  assert.ok(!renderPage(page([{ type: 'contact', variant: 'map', data: EXTRA[6][2] }]), { site: NOTHING }).includes('cb-opennow'), 'no hours, no line');
  const L = ['Monday to Friday, 9am to 6pm', 'Saturday, 10am to 2pm', 'Sunday, closed'];
  const at = (s) => openState(L, new Date(s));
  assert.deepEqual(at('2026-11-23T10:30'), { open: true, text: 'Open now, closes at 6pm' });
  assert.deepEqual(at('2026-11-23T07:00'), { open: false, text: 'Closed now, opens at 9am' });
  assert.deepEqual(at('2026-11-27T18:30'), { open: false, text: 'Closed now, opens tomorrow at 10am' });
  assert.deepEqual(at('2026-11-28T15:00'), { open: false, text: 'Closed now, opens on Monday at 9am' });
  assert.equal(openState(['Ask us'], new Date('2026-11-23T10:00')), null, 'hours that cannot be read say nothing');
  assert.deepEqual(hoursSpans('Tue and Thu 9.30am to 1pm, 2pm to 5.30pm'), [[570, 780], [840, 1050]]);
  assert.deepEqual(hoursSpans('Sat 10-2'), [[600, 840]]);
  assert.deepEqual(hoursSpans('08:00 - 18:00'), [[480, 1080]]);
  assert.deepEqual(hoursOn(['Mon–Fri 8am–6pm', 'Sat 9am–1pm'], 3), [[480, 1080]]);
  assert.deepEqual([540, 570, 720, 1080].map(timeText), ['9am', '9.30am', '12pm', '6pm']);
  assert.ok(dayInLabel('Mon to Fri', 3) && dayInLabel('Fri until Sun', 0) && !dayInLabel('Mon to Fri', 6));
});

test('live slots from Cal.com: a keyless read-only address, and words that never overstate', () => {
  assert.equal(calSlotsUrl('rick/get-rick-rolled', '2026-11-23', '2026-11-30', 'Europe/London'), 'https://api.cal.com/v2/slots?eventTypeSlug=get-rick-rolled&username=rick&start=2026-11-23&end=2026-11-30&timeZone=Europe%2FLondon');
  assert.equal(calSlotsUrl('../x', '2026-11-23', '2026-11-30'), '');
  assert.equal(addDays('2026-11-30', 2), '2026-12-02');
  const now = Date.parse('2026-11-23T10:00:00Z');
  assert.equal(freeTimesText({ '2026-11-23': [{ start: '2026-11-23T09:00:00Z' }, { start: '2026-11-23T14:00:00Z' }] }, '2026-11-23', now), '1 time free today');
  assert.equal(freeTimesText({ '2026-11-25': [{ start: '2026-11-25T09:00:00Z' }] }, '2026-11-23', now), 'Next free time: Wednesday 25 November');
  assert.equal(freeTimesText({}, '2026-11-23', now), '');
  assert.deepEqual(seatsOn({ '2026-12-03': [{ start: 'x', seatsRemaining: 4, seatsTotal: 10 }] }, '2026-12-03'), { left: 4, total: 10 });
  assert.equal(seatsOn({ '2026-12-03': [{ start: 'x' }] }, '2026-12-03'), null);
  assert.deepEqual(seatsOn({}, '2026-12-03'), { left: 0, total: null });
});

test('movement: the new choices are fixed lists, the plan’s timings, and nothing moves for visitors who ask for less', () => {
  assert.ok(MOTION.heading.options.rising && MOTION.mark.options.underline && MOTION.pace.options.measured);
  for (const k of ['hearth', 'gallery', 'showtime']) assert.equal(MOTION_PRESETS[k].motion.pace, 'measured');
  const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Every animation, and every transition of a transform or opacity, sits inside a block that
  // only applies when the visitor has not asked for less motion (or is switched off there).
  const outside = [];
  let depth = 0, still = [];
  for (const m of css.matchAll(/\s*@media[^{]*\{|\{|\}|[^{}]+/g)) {
    const t = m[0];
    if (t.trim().startsWith('@media')) { still.push(/prefers-reduced-motion:no-preference/.test(t)); depth++; continue; }
    if (t === '{') { still.push(still[still.length - 1] || false); depth++; continue; }
    if (t === '}') { still.pop(); depth--; continue; }
    const inMotion = still.some(Boolean);
    if (!inMotion && /animation:(?!none)[^;]*\d/.test(t)) outside.push(t.trim().slice(0, 80));
  }
  assert.deepEqual(outside, [], 'an animation outside the reduced-motion guard');
  // Lines rise as whole words (never split into letters, which would also need a stand-in label).
  const motion = readFileSync(new URL('../../scripts/page-motion.js', import.meta.url), 'utf8');
  assert.match(motion, /const letters = !\['words', 'rising'\]\.includes\(headingStyle\)/);
  assert.match(motion, /if \(headingStyle === 'rising'\) \{[\s\S]{0,200}offsetTop/);
  // The plan's numbers.
  assert.match(css, /cbs-reveal-frame 1\.4s cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(css, /@keyframes cbs-reveal-frame\{from\{transform:scale\(\.76\)\}/);
  assert.match(css, /data-m-heading=rising\] \.cbm-w>span\{transform:translate3d\(0,105%,0\);transition:transform \.8s cubic-bezier\(\.22,1,\.36,1\) calc\(var\(--k,0\) \* 80ms\)/);
  assert.match(css, /mark\.cb-mark\.cbm-mk::after\{[^}]*transition:transform \.7s/);
  assert.match(css, /cb-pin-stage img\{[^}]*transition:opacity \.4s/);
  assert.match(css, /cb-stk-num>span\{[^}]*transition:transform \.25s/);
  assert.match(css, /cb-bookbar\.is-live\{[^}]*transition:transform \.3s cubic-bezier\(\.22,1,\.36,1\)/);
  // Only transforms and opacity move in what was added for the plan.
  for (const m of css.matchAll(/transition:([^;}]+)/g)) for (const part of m[1].split(/,(?![^(]*\))/)) {
    const prop = part.trim().split(/\s/)[0].replace(/!important$/, '');
    assert.ok(['transform', 'opacity', 'background-color', 'color', 'border-color', 'box-shadow', 'scale', 'none', 'clip-path', '-webkit-mask-size', 'mask-size'].includes(prop) || prop.startsWith('var('), `transition of ${prop}`);
  }
});

test('the proof palettes keep every text colour readable', () => {
  // porcelain-fig and chalk-juniper, the two palettes made for the signature websites.
  for (const colours of [{ bg: '#f6f1ec', surface: '#ece3da', ink: '#221a1d', accent: '#7a2e46', deep: '#2b1d22' }, { bg: '#f3f4ef', surface: '#e4e8df', ink: '#1a211d', accent: '#2f5d4a', deep: '#1c2a24' }]) {
    const k = pageColours({ colours });
    assert.ok(contrast(k.ink, k.bg) >= 4.5 && contrast(k.surfaceInk, k.surface) >= 4.5 && contrast(k.onAccent, k.accent) >= 4.5 && contrast(k.onDeep, k.deep) >= 4.5, JSON.stringify(colours));
  }
});

test('consultant doctors: a portrait set in type, a photo that opens from a circle, drawn lines, beats and recovery', async () => {
  const { traceSvg, recoverySpan } = await import('./render.mjs');
  const { lookNeedsSignature } = await import('./schema.mjs');
  // The portrait: the letters of the name, large, never a made-up face; a photo once added.
  const portrait = (data, editable = false) => renderPage(page([{ id: 'p', type: 'hero', variant: 'portrait', data }]), { site: SITE, editable });
  const plain = portrait({ heading: 'Dr Eleanor Marsh', intro: 'Consultant cardiologist.', frame: 'circle' });
  assert.match(plain, /<div class="cb-prt cb-frame-circle"><figure class="cb-prt-pic"><span class="cb-mono" aria-hidden="true"><span class="cb-mono-letters">EM<\/span><\/span><\/figure>/);
  assert.match(plain, /<h1 class="cb-h cb-hero-h">Dr Eleanor Marsh<\/h1>/);
  assert.ok(!plain.includes('<img'));
  assert.match(portrait({ heading: 'Dr Eleanor Marsh', monogram: 'EHM' }), /cb-frame-arch[\s\S]*cb-mono-letters">EHM</);
  assert.match(portrait({ heading: 'x', picture: pic('own') }), /cb-prt-pic"><img src="\/site-images\/cbp-own\.webp"/);
  const ed = portrait({ heading: 'Dr Eleanor Marsh', monogram: 'EM' }, true);
  assert.match(ed, /data-cb-img="p:picture"/); assert.match(ed, /data-cb="p:monogram"/); assert.match(ed, /Add a picture/);
  // The aperture: the photo inside a circle inside the frame, loaded first; the words as ever.
  const ap = renderPage(page([{ type: 'hero', variant: 'aperture', data: { heading: 'See clearly', picture: pic('eye'), buttons: [{ label: 'Book', href: '@booking' }] } }]), { site: SITE });
  assert.match(ap, /<figure class="cb-hero-pic cb-ap-pic" data-scroll="enter" data-scroll-span="0\.85"><span class="cb-ap-ring"><span class="cb-ap-in"><img src="\/site-images\/cbp-eye\.webp"[^>]*fetchpriority="high"/);
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'aperture', data: { heading: 'x', picture: pic('eye') } }]), { site: SITE, editable: true }).includes('data-scroll'), 'still in the editor');
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'aperture', data: { heading: 'See clearly' } }]), { site: SITE }).includes('cb-ap-'));
  // Lines beside steps: one stretch a step, hidden from screen readers, a faint whole copy behind.
  assert.equal((traceSvg('heart', 3).match(/L\d+(\.\d+)? 4 /g) || []).length, 3, 'one beat a step');
  assert.match(traceSvg('wave', 2), /viewBox="0 0 200 40"/);
  const steps = (variant, trace, editable = false) => renderPage(page([{ id: 's', type: 'steps', variant, data: { heading: 'Your first appointment', trace, items: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }] } }]), { site: SITE, editable });
  const sticky = steps('sticky', 'heart');
  assert.match(sticky, /<div class="cb-stk has-trace" data-stk style="--n:3"><span class="cb-trace cb-trace-heart cb-trace-top" data-scroll="enter" aria-hidden="true"><span class="cb-trace-ghost"><svg/);
  assert.match(sticky, /<span class="cb-trace cb-trace-heart cb-stk-trace" aria-hidden="true">/);
  assert.ok(!sticky.includes('cb-stk-bar'), 'the drawn line takes the place of the bar');
  assert.ok(steps('sticky', 'none').includes('cb-stk-bar') && !steps('sticky', 'none').includes('cb-trace'));
  assert.match(steps('line', 'wave'), /cb-trace cb-trace-wave cb-trace-top" data-scroll="enter"/);
  assert.match(steps('sticky', 'wave', true), /cb-trace cb-trace-wave cb-trace-top" aria-hidden="true"/);
  for (const w of ['One', 'Two', 'Three']) assert.ok(sticky.includes(`>${w}</h3>`));
  // Numbers that beat once, after counting; a card's typical recovery, first and large.
  assert.match(renderPage(page([{ type: 'facts', variant: 'band', data: { beat: true, items: [{ value: '20', label: 'years' }] } }]), { site: SITE }), /cb-factlist cb-factlist-band cb-beat/);
  assert.match(readFileSync(new URL('../../scripts/page-motion.js', import.meta.url), 'utf8'), /if \(el\.closest\('\.cb-beat'\)\) el\.classList\.add\('is-beat'\)/);
  const rail = renderPage(page([{ type: 'services', variant: 'rail', data: { heading: 'Conditions', items: [{ name: 'Knee pain', recovery: '6 to 12 weeks', description: 'Words.' }, { name: 'Hip pain' }] } }]), { site: SITE });
  // The words first, then the same span marked on a track of the year, hidden from screen readers.
  assert.match(rail, /<dl class="cb-rail-facts"><div class="cb-rail-rec"><dt>Typical recovery<\/dt><dd><span>6 to 12 weeks<\/span><span class="cb-rec" aria-hidden="true" data-end="12 months" style="--a:0\.115;--b:0\.231"><i><\/i><\/span><\/dd><\/div><\/dl>/);
  assert.deepEqual(recoverySpan('3 to 6 months'), { a: 0.25, b: 0.5, end: '12 months' });
  assert.deepEqual(recoverySpan('6 to 18 months'), { a: 0.25, b: 0.75, end: '2 years' });
  assert.deepEqual(recoverySpan('1 year'), { a: 1, b: 1, end: '12 months' });
  for (const t of ['', 'it depends', '3 years', '9 to 3 months']) assert.equal(recoverySpan(t), null, t);
  assert.ok(!renderPage(page([{ type: 'services', variant: 'rail', data: { items: [{ name: 'x', recovery: 'it varies' }] } }]), { site: SITE }).includes('cb-rec"'), 'no track without a length of time');
  // A line drawn under the opening's heading: decoration, after the one h1, in any layout.
  const heroT = renderPage(page([{ type: 'hero', variant: 'centred', data: { heading: 'Quiet rooms', trace: 'wave', intro: 'Words.' } }]), { site: SITE });
  assert.match(heroT, /<\/h1><span class="cb-trace cb-trace-wave cb-trace-hero" aria-hidden="true"><span class="cb-trace-ghost"><svg class="cb-trace-svg" viewBox="0 0 500 40"/);
  assert.ok(!renderPage(page([{ type: 'hero', variant: 'centred', data: { heading: 'Quiet rooms', trace: 'none' } }]), { site: SITE }).includes('cb-trace'));
  assert.ok(needsSignature({ type: 'hero', variant: 'split', data: { trace: 'wave' } }) && !needsSignature({ type: 'hero', variant: 'split', data: { trace: 'none' } }));
  assert.match(rail, /cb-rail-card cb-solo has-facts/);
  // A numbered list of services is a real list: each entry a list item (Clearview's treatments).
  const numbered = renderPage(page([{ type: 'services', variant: 'numbered', data: { heading: 'What I treat', items: [{ name: 'Cataracts', price: 'from £250' }, { name: 'Glaucoma' }] } }]), { site: SITE });
  assert.match(numbered, /<ol class="cb-svc cb-svc-numbered"><li><span class="cb-num" aria-hidden="true">01<\/span>/);
  assert.ok(!/<ol class="cb-svc cb-svc-numbered">[\s\S]*?<article/.test(numbered.split('</ol>')[0]), 'no article straight inside the list');
  // The release gate knows every one of them; a choice of "none" needs nothing new.
  for (const b of [{ type: 'hero', variant: 'portrait', data: {} }, { type: 'hero', variant: 'aperture', data: {} }, { type: 'steps', variant: 'line', data: { trace: 'heart' } }, { type: 'facts', variant: 'row', data: { beat: true } }, { type: 'services', variant: 'list', data: { items: [{ name: 'x', recovery: '6 weeks' }] } }]) assert.ok(needsSignature(b), JSON.stringify(b));
  assert.ok(!needsSignature({ type: 'steps', variant: 'line', data: { trace: 'none' } }));
  assert.ok(lookNeedsSignature({ font: 'lyric' }));
  assert.equal(normalisePage(page([], { font: 'lyric' })).look.font, 'lyric');
  // The new movement only runs for visitors who have not asked for less, and moves transforms only.
  const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');
  const batch = css.slice(css.indexOf('Consultant doctors batch'));
  for (const m of batch.matchAll(/animation:cbs-(beat|act-rise|trace-win|trace-in)|transition:transform \.7s|--ap:calc/g)) {
    const before = batch.slice(0, m.index);
    assert.ok(before.lastIndexOf('@media screen and (prefers-reduced-motion:no-preference)') > before.lastIndexOf('\n}'), `${m[0]} outside the reduce-motion guard`);
  }
  for (const k of batch.matchAll(/@keyframes [\w-]+\{([^@]*?)\}\}/g)) assert.doesNotMatch(k[1], /(width|height|left|top|margin|clip-path):/);
});
