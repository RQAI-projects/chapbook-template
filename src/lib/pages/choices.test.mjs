// Round B of 1.0.30 (app walk, 24 Nov 2026). A Book on an item with its own Cal.com or Google
// booking link opens the website's Appointments page with that item named (its address after "#"),
// so the visitor's choice is kept; and opening hours show one typed line to a row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, bookingChoices, choiceKey, choiceTarget } from './render.mjs';
import { hoursLines, hoursHtml } from '../professional.mjs';
import { openingHours } from '../business-schema.mjs';

const CAL60 = 'https://cal.com/hollybrook/sports-massage-60';
const GOOGLE = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcdefghijk';
const page = (blocks, slug = 'home') => ({ v: 1, title: 'Home', slug, look: {}, blocks });
const SITE = { name: 'Hollybrook', professional: { phone: '01632 960 123', bookingUrl: 'https://cal.com/hollybrook' } };
const draw = (p, o = {}) => renderPage(p, { site: SITE, today: '2026-11-24', ...o });
const strip = (variant = 'strip') => ({ id: 'strip', type: 'bookstrip', variant, data: { heading: 'Book', button: 'Book', items: [
  { id: 'a', name: 'Sports massage', duration: '30 min', price: '£35' },
  { id: 'b', name: 'Sports massage', duration: '60 min', price: '£55', link: { label: 'Book', href: CAL60 } },
  { id: 'c', name: 'Desk and neck', duration: '30 min', price: '£35', link: { label: 'Book', href: 'https://example.com/book' } },
] } });
const classes = { id: 'ev', type: 'spaces', variant: 'cards', data: { heading: 'Classes', items: [
  { id: 'p', name: 'Pasta class', date: '2026-12-03', time: '6pm', price: '£20', left: 4, link: { label: 'Book', href: GOOGLE } },
  { id: 'q', name: 'Bread class', date: '2026-12-08', time: '6pm', price: '£20', left: 4 },
] } };
const cards = { id: 'tr', type: 'services', variant: 'cards', data: { heading: 'Treatments', items: [
  { id: 'x', name: 'Before an event', duration: '30 min', price: '£35', link: { label: 'Book a massage', href: CAL60 } },
  { id: 'y', name: 'After an event', duration: '60 min', price: '£55', link: { label: 'Book a massage', href: '@booking' } },
  { id: 'z', name: 'Gift voucher', price: '£50' },
] } };

test('the choice key is stable, plain and the same wherever it is made', () => {
  assert.equal(choiceKey('home', 'strip', 'b'), 'book-home-strip-b');
  assert.equal(choiceKey('', 'Strip_1', 'B 2'), 'book-home-strip-1-b-2');
  assert.deepEqual(choiceTarget(CAL60), { kind: 'cal', src: 'hollybrook/sports-massage-60', href: CAL60, provider: 'Cal.com' });
  assert.equal(choiceTarget(GOOGLE).kind, 'google');
  assert.match(choiceTarget(GOOGLE).src, /\?gv=true$/);
  for (const h of ['https://example.com/book', '@booking', '/contact/', 'http://cal.com/a/b', '', null]) assert.equal(choiceTarget(h), null, String(h));
});

test('the bookable things on a page, each with its own link, in one list', () => {
  const list = bookingChoices(page([strip(), classes, cards]));
  assert.deepEqual(list.map((c) => [c.key, c.type, c.name, c.link, c.target?.kind || '']), [
    ['book-home-strip-a', 'bookstrip', 'Sports massage, 30 min', '', ''],
    ['book-home-strip-b', 'bookstrip', 'Sports massage, 60 min', CAL60, 'cal'],
    ['book-home-strip-c', 'bookstrip', 'Desk and neck, 30 min', 'https://example.com/book', ''],
    ['book-home-ev-p', 'spaces', 'Pasta class, Thursday 3 December', GOOGLE, 'google'],
    ['book-home-ev-q', 'spaces', 'Bread class, Tuesday 8 December', '', ''],
    ['book-home-tr-x', 'services', 'Before an event, 30 min', CAL60, 'cal'],
    ['book-home-tr-y', 'services', 'After an event, 60 min', '', ''],
  ]);
  // A card with no Book button is not something to book (Gift voucher above).
});

test('Book on an item with its own Cal.com or Google link opens the Appointments page with that item', () => {
  const html = draw(page([strip('cards'), classes, cards]));
  assert.match(html, /href="\/appointments\/#book-home-strip-b"/);
  assert.match(html, /href="\/appointments\/#book-home-ev-p"/);
  assert.match(html, /href="\/appointments\/#book-home-tr-x"/);
  // Any other own link opens directly; without one, the Appointments page as before.
  assert.match(html, /href="https:\/\/example\.com\/book"/);
  assert.doesNotMatch(html, new RegExp(CAL60.replace(/[./]/g, '\\$&')));
  // The strip's choices carry the same address for the page's script; without the script Book opens the Appointments page.
  const one = draw(page([strip('strip')]));
  assert.match(one, /value="1" data-href="\/appointments\/#book-home-strip-b"/);
  assert.match(one, /class="cb-btn cb-bs-book" href="\/appointments\/"/);
  // The website's own address prefix is kept.
  assert.match(draw(page([classes]), { href: (p) => `/site${p}` }), /href="\/site\/appointments\/#book-home-ev-p"/);
});

test('in the editor the link is still the item’s own, so the Links panel shows it', () => {
  const html = draw(page([strip('cards'), classes, cards]), { editable: true });
  assert.doesNotMatch(html, /#book-home/);
});

test('opening hours keep each typed line as its own row, and search engines read the same lines', () => {
  const typed = 'Mon to Fri 9am to 6pm\n  Sat 9am to 1pm  \n\n';
  assert.deepEqual(hoursLines(typed), ['Mon to Fri 9am to 6pm', 'Sat 9am to 1pm']);
  assert.equal(hoursHtml(typed), '<span class="hours-line">Mon to Fri 9am to 6pm</span><span class="hours-line">Sat 9am to 1pm</span>');
  assert.equal(hoursHtml('<b>9 & 5</b>'), '<span class="hours-line">&lt;b&gt;9 &amp; 5&lt;/b&gt;</span>');
  assert.deepEqual(hoursLines(''), []);
  const spec = openingHours(typed);
  assert.deepEqual(spec.map((s) => [s.dayOfWeek, s.opens, s.closes]), [
    [['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '09:00', '18:00'],
    [['Saturday'], '09:00', '13:00'],
  ]);
  // Block pages: the hours table has a row for each line.
  const html = draw(page([{ id: 'c', type: 'contact', variant: 'hours', data: { business: true, heading: 'Hours' } }]), { site: { ...SITE, professional: { ...SITE.professional, hours: typed } } });
  assert.equal((html.match(/<tr>/g) || []).length, 2);
});

test('ordinary templates: every place hours show gives one row per line', () => {
  const src = readFileSync(new URL('../business/render.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /esc\((?:c\.)?p\.hours\)/, 'no place prints the hours as one run of text');
  for (const f of ['../../pages/contact.astro', '../../pages/appointments.astro']) {
    const a = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(a, /hours-line/, f);
    assert.doesNotMatch(a, /\{(?:professional|p)\.hours\}/, f);
  }
});
