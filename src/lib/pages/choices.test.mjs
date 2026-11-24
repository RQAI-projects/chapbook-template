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

// ---- round B review (24 Nov 2026) ----------------------------------------------------------------
import { hoursGroups, hoursOn, openState } from '../../scripts/page-actions.js';
import { calEmbedParts } from '../../scripts/booking-calendar.js';

test('S1: an owner link keeps its query and hash everywhere; the calendar is given the query', () => {
  const D60 = 'https://cal.com/sam/sports-massage?duration=60', D90 = 'https://cal.com/sam/sports-massage?duration=90';
  const t60 = choiceTarget(D60), t90 = choiceTarget(D90);
  assert.equal(t60.href, D60); assert.equal(t90.href, D90);
  assert.equal(t60.src, 'sam/sports-massage?duration=60'); assert.equal(t90.src, 'sam/sports-massage?duration=90');
  assert.equal(choiceTarget('https://cal.com/sam?month=2026-12#top').href, 'https://cal.com/sam?month=2026-12#top');
  assert.deepEqual(calEmbedParts(t60.src), { path: 'sam/sports-massage', extra: { duration: '60' } });
  assert.deepEqual(calEmbedParts('sam/x'), { path: 'sam/x', extra: {} });
  const p = page([{ id: 's', type: 'bookstrip', variant: 'cards', data: { heading: 'Book', items: [
    { id: 'i60', name: 'Sports massage', duration: '60 min', link: { label: 'Book', href: D60 } },
    { id: 'i90', name: 'Sports massage', duration: '90 min', link: { label: 'Book', href: D90 } }] } }]);
  const list = bookingChoices(p);
  assert.deepEqual(list.map((c) => [c.target.src, c.target.href]), [['sam/sports-massage?duration=60', D60], ['sam/sports-massage?duration=90', D90]]);
  // The Appointments page uses these (its sections' calendar and "Open booking in a separate page").
  const appt = readFileSync(new URL('../../pages/appointments.astro', import.meta.url), 'utf8');
  assert.match(appt, /data-booking-link=\{c\.target\.src\}/); assert.match(appt, /href=\{c\.target\.href\}/);
  assert.match(appt, /mainT\.embed/);
  // The main calendar's two separate-page links use the schedule without gv=true too (round B2 re-review minor 2).
  assert.match(appt, /const sepHref=main\?main\.href:href;/);
  assert.equal((appt.match(/href=\{sepHref\}/g) || []).length, 2);
  assert.doesNotMatch(appt, /<a href=\{href\}>Open booking in a separate page/);
  const G = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcdefghijk?gv=true';
  assert.equal(choiceTarget(G).href, 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcdefghijk');
  // The Online booking section's calendar too.
  const sec = draw(page([{ id: 'bk', type: 'booking', data: { heading: 'Book', useSite: false, url: D60 } }]));
  assert.match(sec, /data-booking-src="sam\/sports-massage\?duration=60"/);
  assert.match(sec, /href="https:\/\/cal\.com\/sam\/sports-massage\?duration=60"/);
});

test('S6: a line holding several groups gives the right days, for search engines and Open now', () => {
  const sp = (h) => openingHours(h).map((x) => [x.dayOfWeek.join(' '), x.opens, x.closes]);
  assert.deepEqual(sp('Sat 9am to 1pm, Sun closed'), [['Saturday', '09:00', '13:00']]);
  assert.deepEqual(hoursOn(['Sat 9am to 1pm, Sun closed'], 0), []);
  assert.deepEqual(sp('Mon to Fri 7am to 8pm, Sat 8am to 1pm'), [['Monday Tuesday Wednesday Thursday Friday', '07:00', '20:00'], ['Saturday', '08:00', '13:00']]);
  assert.deepEqual(sp('Mon to Fri 9-5 ;Sat  10am-2pm ,  Sun: closed'), [['Monday Tuesday Wednesday Thursday Friday', '09:00', '17:00'], ['Saturday', '10:00', '14:00']]);
  // Commas that are not between groups keep working.
  assert.deepEqual(sp('Monday to Friday, 9am to 6pm'), [['Monday Tuesday Wednesday Thursday Friday', '09:00', '18:00']]);
  assert.deepEqual(sp('Tue, Thu and Sat 9am to 1pm'), [['Tuesday Thursday Saturday', '09:00', '13:00']]);
  assert.deepEqual(sp('Tue and Thu 9.30am to 1pm, 2pm to 5.30pm'), [['Tuesday Thursday', '09:30', '13:00'], ['Tuesday Thursday', '14:00', '17:30']]);
  assert.deepEqual(sp('9am to 5pm, Mon to Fri'), [['Monday Tuesday Wednesday Thursday Friday', '09:00', '17:00']]);
  assert.equal(hoursGroups('Sat 9am to 1pm, Sun closed').length, 2);
  // Open now on a Sunday (29 Nov 2026) is not "Open now".
  const sun = new Date('2026-11-29T10:00:00Z');
  assert.equal(openState(['Mon to Fri 9am to 5pm', 'Sat 9am to 1pm, Sun closed'], sun, 'Europe/London').open, false);
  const sat = new Date('2026-11-28T10:00:00Z');
  assert.equal(openState(['Mon to Fri 7am to 8pm, Sat 8am to 1pm'], sat, 'Europe/London').text, 'Open now, closes at 1pm');
  // The rows on the website stay as the owner typed them.
  assert.deepEqual(hoursLines('Sat 9am to 1pm, Sun closed\n\n  Mon to Fri  9am to 5pm '), ['Sat 9am to 1pm, Sun closed', 'Mon to Fri 9am to 5pm']);
});

test('minor 2: block pages draw hours without blank rows', () => {
  const html = renderPage(page([{ id: 'c', type: 'contact', variant: 'card', data: { heading: 'Find us', business: true } }]), { site: { ...SITE, professional: { ...SITE.professional, hours: 'Mon to Fri 9am to 5pm\n\n\nSat 9am to 1pm  ' } }, today: '2026-11-24' });
  assert.match(html, /Mon to Fri 9am to 5pm<br>Sat 9am to 1pm</);
  assert.doesNotMatch(html, /<br><br>/);
});

test('minor 3: a person’s Book, tiles and pinned scenes with their own booking page are listed and keep the choice', () => {
  const p = page([
    { id: 'tm', type: 'team', variant: 'grid', data: { heading: 'Team', bookEach: true, items: [{ id: 'h', name: 'Hannah Reed', book: { label: 'Book with Hannah', href: CAL60 } }, { id: 'j', name: 'Jo Bell' }] } },
    { id: 'tl', type: 'tiles', variant: 'grid', data: { heading: 'Tiles', items: [{ id: 't1', name: 'Gait check', link: { label: 'Book', href: GOOGLE } }, { id: 't2', name: 'About us', link: { label: 'Read', href: '/about/' } }] } },
    { id: 'sc', type: 'scenes', variant: 'stack', data: { heading: 'Scenes', items: [{ id: 'k', name: 'First visit', link: { label: 'Book', href: CAL60 } }] } },
  ]);
  const list = bookingChoices(p);
  assert.deepEqual(list.map((c) => [c.type, c.field, c.name]), [['team', 'book', 'Hannah Reed'], ['tiles', 'link', 'Gait check'], ['scenes', 'link', 'First visit']]);
  const html = draw(p);
  for (const c of list) assert.ok(html.includes(`/appointments/#${c.key}`), c.key);
  assert.ok(html.includes('href="/about/"'));
});
