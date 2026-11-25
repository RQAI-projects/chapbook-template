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
import { hoursGroups, hoursOn, openState, dayInLabel, hoursParts, partlyClosed } from '../../scripts/page-actions.js';
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

test('B2 re-review minor 3: other separators, holidays, weekdays and words that only look like a day', () => {
  const sp = (h) => openingHours(h).map((x) => [x.dayOfWeek.join(' '), x.opens, x.closes]);
  const W5 = 'Monday Tuesday Wednesday Thursday Friday', W6 = `${W5} Saturday`;
  // Sunday is closed however the line separates it: brackets, a full stop, a slash, a bar, "and".
  for (const line of ['Mon to Sat 9am to 5pm (Sun closed)', 'Mon to Sat 9am to 5pm. Sun closed', 'Mon to Sat 9am to 5pm / Sun closed', 'Mon to Sat 9am to 5pm | Sun closed', 'Mon to Sat 9am to 5pm and Sun closed', 'Mon to Sat 9am to 5pm [Sun closed]']) {
    assert.deepEqual(sp(line), [[W6, '09:00', '17:00']], line);
    assert.deepEqual(hoursOn([line], 0), [], line);
  }
  assert.deepEqual(sp('Sat 9am to 1pm. Sun closed'), [['Saturday', '09:00', '13:00']]);
  assert.deepEqual(sp('Sat 9am to 1pm and Sun closed'), [['Saturday', '09:00', '13:00']]);
  // "and" or a full stop with no day after it is not a split: "Tue and Thu", "9.30am", "p.m.".
  assert.deepEqual(sp('Tue and Thu 9.30am to 1pm and 2pm to 5.30pm'), [['Tuesday Thursday', '09:30', '13:00'], ['Tuesday Thursday', '14:00', '17:30']]);
  assert.deepEqual(sp('Sat 9 a.m. to 1 p.m. Sun closed'), [['Saturday', '09:00', '13:00']]);
  // Bank holidays are not a day of the week: Saturday stays closed.
  assert.deepEqual(sp('Mon to Fri 9am to 5pm, Sat closed, bank holidays 10am to 2pm'), [[W5, '09:00', '17:00']]);
  assert.deepEqual(hoursOn(['Mon to Fri 9am to 5pm, Sat closed, bank holidays 10am to 2pm'], 6), []);
  assert.deepEqual(sp('Mon to Fri 9am to 5pm, public holidays closed'), [[W5, '09:00', '17:00']]);
  // A closed day does not take the times after it.
  assert.deepEqual(hoursOn(['Closed Sunday, open 9am to 5pm all other days'], 0), []);
  // "Weekdays" is Monday to Friday; "weekends" Saturday and Sunday.
  assert.deepEqual(sp('Weekdays 9am to 5pm, Saturday 10am to 1pm'), [[W5, '09:00', '17:00'], ['Saturday', '10:00', '13:00']]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].filter((d) => dayInLabel('Weekdays', d)), [1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].filter((d) => dayInLabel('Weekends', d)), [0, 6]);
  // "month" is never Monday, and whole, short and many-day names are all read.
  assert.equal(dayInLabel('first Saturday of the month', 1), false);
  assert.equal(dayInLabel('Satisfaction guaranteed', 6), false);
  // "The first Saturday of the month" cannot be said in the search data: Saturday is left out (round C4 re-review, minor 5).
  assert.deepEqual(sp('Mon to Fri 9am to 5pm, first Saturday of the month 10am to 2pm'), [[W5, '09:00', '17:00']]);
  for (const [w, d] of [['Tues', 2], ['Thurs', 4], ['Wednesday', 3], ['Saturdays', 6], ['Sundays', 0], ['Fri', 5]]) assert.equal(dayInLabel(w, d), true, w);
  assert.deepEqual(hoursParts('Mon to Fri 9am to 5pm (Sat by appointment)').map((x) => x.trim()).filter(Boolean), ['Mon to Fri 9am to 5pm', 'Sat by appointment']);
});

test('round C review M1, M2 and minor 1: holidays, closed after a full stop, "and" after p.m., "&"', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'closed'; }).join(' ');
  //                                   Sun     Mon   Tue   Wed   Thu   Fri   Sat
  const cases = [
    [['Mon to Sat 9am to 5pm, Sundays and bank holidays 10am to 4pm'], '10-16 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Sundays and bank holidays 10am to 4pm'], '10-16 ? ? ? ? ? ?'],
    [['Mon to Sat 9am to 5pm', 'Sun and bank holidays 10am to 4pm'], '10-16 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Every day 9am to 5pm except bank holidays'], '9-17 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Mon to Fri 9am to 5pm except bank holidays'], '? 9-17 9-17 9-17 9-17 9-17 ?'],
    [['Mon to Fri 8.30am to 6pm including bank holidays'], '? 8.5-18 8.5-18 8.5-18 8.5-18 8.5-18 ?'],
    [['Mon to Fri 9am to 5pm. Closed weekends and bank holidays'], 'closed 9-17 9-17 9-17 9-17 9-17 closed'],
    [['Mon to Fri 9am to 6pm, closed Sundays and bank holidays'], 'closed 9-18 9-18 9-18 9-18 9-18 ?'],
    [['Mon to Fri 9am to 5pm, Sat 9am to 1pm, Sun and public holidays closed'], 'closed 9-17 9-17 9-17 9-17 9-17 9-13'],
    [['Mon to Fri 9am to 5pm, Sat closed, bank holidays 10am to 2pm'], '? 9-17 9-17 9-17 9-17 9-17 closed'],
    [['Daily 9 to 5, bank holiday Mondays closed'], '9-17 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Mon to Fri 9am to 5pm || Bank holidays closed'.split(' || ')].flat(), '? 9-17 9-17 9-17 9-17 9-17 ?'],
    [['Mon to Fri 9am to 5pm. Closed weekends'], 'closed 9-17 9-17 9-17 9-17 9-17 closed'],
    [['Mon to Sat 9am to 5pm. Closed on Sundays'], 'closed 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Mon to Sat 9am to 5pm and closed Sundays'], 'closed 9-17 9-17 9-17 9-17 9-17 9-17'],
    [['Open 9am to 5pm. Closed Sundays and bank holidays'], 'closed ? ? ? ? ? ?'],
    [['Sat 9 a.m. to 1 p.m. and Sun closed'], 'closed ? ? ? ? ? 9-13'],
    [['Sat 9am to 1pm & Sun closed'], 'closed ? ? ? ? ? 9-13'],
    [['Thu & Fri 9 to 8'], '? ? ? ? 9-20 9-20 ?'],
    [['Mon to Fri 9 a.m. to 5 p.m. and Sat 10 a.m. to 2 p.m.'], '? 9-17 9-17 9-17 9-17 9-17 10-14'],
  ];
  for (const [lines, want] of cases) assert.equal(week(lines), want, lines.join(' || '));
  // Open now and search engine data follow (Sunday 29 Nov and Saturday 28 Nov 2026, noon in London).
  assert.equal(openState(['Mon to Sat 9am to 5pm', 'Sundays and bank holidays 10am to 4pm'], new Date('2026-11-29T12:00:00Z'), 'Europe/London').text, 'Open now, closes at 4pm');
  assert.equal(openState(['Mon to Fri 9am to 5pm. Closed weekends'], new Date('2026-11-28T12:00:00Z'), 'Europe/London').open, false);
  assert.deepEqual(openingHours('Every day 9am to 5pm except bank holidays').map((x) => x.dayOfWeek.length), [7]);
});

test('round C build review minor 9: a later closed day, open bank holidays after a full stop, closed on two days', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'closed'; }).join(' ');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Wednesdays']), '? 9-17 9-17 closed 9-17 9-17 ?');
  assert.equal(week(['Mon to Fri 9am to 5pm. Open bank holidays 10am to 2pm']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.deepEqual(openingHours('Mon to Fri 9am to 5pm. Open bank holidays 10am to 2pm').map((x) => [x.opens, x.closes]), [['09:00', '17:00']]);
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed on Saturday and Sunday']), 'closed 9-17 9-17 9-17 9-17 9-17 closed');
  assert.equal(week(['Tue to Sat 10am to 6pm. Closed Sun & Mon']), 'closed closed 10-18 10-18 10-18 10-18 10-18');
  // Days left with nothing of their own after an open group stay unknown, never given its times.
  assert.equal(week(['Mon to Fri 9am to 5pm, Sat by appointment']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(week(['Mon to Fri 9am to 5pm, weekends by appointment']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(week(['Sundays and bank holidays 10am to 4pm']), '10-16 ? ? ? ? ? ?');
});

test('round C2 re-review N2: a closure of part of a day or of the year never closes the whole day', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'closed'; }).join(' ');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Wednesday afternoons']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(week(['Mon to Fri 8:30am to 6pm. Closed Thursday mornings']), '? 8.5-18 8.5-18 8.5-18 8.5-18 8.5-18 ?');
  assert.equal(week(['Mon to Sat 9am to 5pm. Closed Saturdays in August']), '? 9-17 9-17 9-17 9-17 9-17 9-17');
  assert.equal(week(['Mon to Sat 9am to 5pm', 'Closed Saturdays in August']), '? 9-17 9-17 9-17 9-17 9-17 9-17');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Saturday. Sunday by appointment']), '? 9-17 9-17 9-17 9-17 9-17 closed');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Saturdays and Sundays except by arrangement']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(week(['Mon to Sat 9am to 5pm. Closed Saturdays and Sundays in August']), '? 9-17 9-17 9-17 9-17 9-17 9-17');
  assert.equal(partlyClosed(['Mon to Sat 9am to 5pm. Closed Saturdays and Sundays in August'], 0), true);
  assert.equal(week(['Mon to Sat 9am to 1pm. Closed Thursday afternoon and Sunday']), 'closed 9-13 9-13 9-13 9-13 9-13 9-13');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Wednesday and Saturday afternoons']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Saturday afternoons']), '? 9-17 9-17 9-17 9-17 9-17 ?');
  // The search data says nothing more than is certain.
  assert.deepEqual(openingHours('Mon to Fri 9am to 5pm. Closed Wednesday afternoons').map((x) => x.dayOfWeek), [['Monday', 'Tuesday', 'Thursday', 'Friday']]);
  assert.equal(openState(['Mon to Fri 9am to 5pm. Closed Wednesday afternoons'], new Date('2026-11-25T15:00:00Z'), 'Europe/London'), null, 'Wednesday 3pm: nothing claimed');
  assert.equal(openState(['Mon to Fri 9am to 5pm. Closed Wednesday afternoons'], new Date('2026-11-24T18:00:00Z'), 'Europe/London'), null, 'Tuesday evening: Wednesday may open late');
  assert.match(openState(['Mon to Fri 9am to 5pm. Closed Wednesday afternoons'], new Date('2026-11-26T10:00:00Z'), 'Europe/London').text, /Open now, closes at 5pm/);
  // Bare closures still close the day.
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed Wednesdays']), '? 9-17 9-17 closed 9-17 9-17 ?');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed on Saturday and Sunday']), 'closed 9-17 9-17 9-17 9-17 9-17 closed');
  assert.equal(week(['Sun: closed']), 'closed ? ? ? ? ? ?');
});

test('round C3 re-review S3: whole-day closures speak again; only words for part of a day or the year keep a day\'s hours', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'closed'; }).join(' ');
  for (const l of ['Closed at weekends', 'Closed at the weekend']) assert.equal(week(['Mon to Fri 9am to 5pm', l]), 'closed 9-17 9-17 9-17 9-17 9-17 closed', l);
  for (const l of ['Sunday \u2014 closed', 'Sunday \u2013 closed', 'Closed Sunday\u2019s']) assert.equal(week(['Mon to Sat 9am to 5pm', l]), 'closed 9-17 9-17 9-17 9-17 9-17 9-17', l);
  for (const l of ['Closed Wednesdays for training', 'Closed every Wednesday', 'Closed each Wednesday', 'Closed all day Wednesday']) assert.equal(week([`Mon to Fri 9am to 5pm. ${l}`]), '? 9-17 9-17 closed 9-17 9-17 ?', l);
  // Sunday closed, Wednesday as typed (and left out of the search data).
  const both = ['Mon to Fri 9am to 5pm. Closed Sundays and Wednesday afternoons'];
  assert.equal(week(both), 'closed 9-17 9-17 9-17 9-17 9-17 ?');
  assert.equal(partlyClosed(both, 3), true); assert.equal(partlyClosed(both, 0), false);
  assert.match(openState(both, new Date('2026-11-29T11:00:00Z'), 'Europe/London').text, /Closed now, opens tomorrow at 9am/);
  assert.deepEqual(openingHours('Mon to Fri 9am to 5pm || Closed at weekends'.split(' || ').join('\n')).map((x) => x.dayOfWeek.length), [5]);
  // Part of a day or of the year still keeps the typed hours.
  for (const l of ['Closed Wednesday afternoons', 'Closed Wed PM', 'Closed Wednesdays from 1pm']) assert.equal(partlyClosed([`Mon to Fri 9am to 5pm. ${l}`], 3), true, l);
  assert.equal(partlyClosed(['Mon to Sat 9am to 5pm. Closed Saturdays and Sundays in August'], 6), true);
});

test('round C4 re-review minor 5: show, never guess', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'closed'; }).join(' ');
  assert.equal(week(['Every day 9am to 5pm except Sunday']), 'closed 9-17 9-17 9-17 9-17 9-17 9-17');
  assert.equal(week(['Open daily 10am to 4pm except Mondays']), '10-16 closed 10-16 10-16 10-16 10-16 10-16');
  assert.equal(week(['Mon to Sat 9am to 5pm except Wednesday']), '? 9-17 9-17 closed 9-17 9-17 9-17');
  assert.equal(week(['Mon to Fri 9am to 5pm. Closed all Wednesdays']), '? 9-17 9-17 closed 9-17 9-17 ?');
  assert.equal(week(['Mon to Sat 9am to 5pm. Closed on all Sundays']), 'closed 9-17 9-17 9-17 9-17 9-17 9-17');
  assert.equal(week(['Mon to Fri 9am to 5pm. Sat closed. 10am to 2pm Sunday']), '10-14 9-17 9-17 9-17 9-17 9-17 closed');
  // Words the reader cannot be sure of: no search data and no Open now for the days that part names.
  const first = ['Mon to Sat 9am to 5pm. Open the first Sunday of the month 10am to 2pm'];
  assert.equal(partlyClosed(first, 0), true); assert.equal(partlyClosed(first, 1), false);
  assert.deepEqual(openingHours(first.join('\n')).map((x) => x.dayOfWeek.length), [6]);
  assert.equal(openState(first, new Date('2026-11-29T11:00:00Z'), 'Europe/London'), null);
  for (const l of ['Closed every other Saturday', 'Closed Saturdays in school holidays']) assert.equal(partlyClosed([`Mon to Sat 9am to 5pm. ${l}`], 6), true, l);
  assert.equal(partlyClosed(['Every day 9am to 5pm except Sunday 10am to 2pm'], 0), true);
});

test('round C5 re-review S1, S2 and minor 1: "except" with part of a day, appointment notes, "except" before the times', () => {
  // x closed, - unsaid (no search data, no Open now), ? not named, else the times.
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { if (partlyClosed(lines, d)) return '-'; const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'x'; }).join(' ');
  for (const [l, w] of [
    ['Mon to Fri 9am to 5pm except Wednesday afternoons', '? 9-17 9-17 - 9-17 9-17 ?'],
    ['Mon to Fri 9am to 5pm except Wednesday mornings', '? 9-17 9-17 - 9-17 9-17 ?'],
    ['Mon to Sat 9am to 5pm except Thursday when we open at 1pm', '? 9-17 9-17 9-17 - 9-17 9-17'],
    ['Mon to Sat 9am to 5pm except Saturday afternoon', '? 9-17 9-17 9-17 9-17 9-17 -'],
    ['Mon to Fri 9am to 5pm except Thursdays after 1pm', '? 9-17 9-17 9-17 - 9-17 ?'],
    ['Every day 9am to 5pm except Sunday', 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Open every day except Sunday, 9am to 5pm', 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Open daily except Mondays, 10am to 4pm', '10-16 x 10-16 10-16 10-16 10-16 10-16'],
    ['Every day except Sunday 9am to 5pm', 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Every day apart from Sunday 9am to 5pm', 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Mon to Sat 9am to 5pm. Last booking 4.30pm', '? 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Mon to Sat 9am to 5pm, last booking 4.30pm', '? 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Mon to Fri 9am to 6pm. Last appointment 5pm', '? 9-18 9-18 9-18 9-18 9-18 ?'],
    ['Mon to Fri 9am to 6pm. First appointment 8am', '? 9-18 9-18 9-18 9-18 9-18 ?'],
    ['Mon to Fri 9am to 6pm. First appointment 8am by arrangement', '? 9-18 9-18 9-18 9-18 9-18 ?'],
    ['Mon to Fri 9am to 5pm. Closed the last week of December', '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ['Mon to Fri 9am to 5pm. Last Saturday of the month 10am to 2pm', '? 9-17 9-17 9-17 9-17 9-17 -'],
    ['Mon to Fri 9am to 5pm || Sat 9am to 12pm (first and third Saturday only)', '? 9-17 9-17 9-17 9-17 9-17 -'],
    ['Mon to Fri 9am to 5pm except bank holidays', '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ['Every day 9am to 5pm except Sundays and bank holidays', 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ['Weekdays 9am to 5pm. Weekends by appointment', '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ['Tue to Sat 10am to 6pm, late night Thursday until 8pm', '? ? 10-18 10-18 10-18 10-18 10-18'],
    ['Mon to Fri. 9am to 5pm', '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ['Monday to Friday. 9am to 5pm. Saturday. 10am to 2pm', '? 9-17 9-17 9-17 9-17 9-17 10-14'],
    ['Mon to Fri 9am to 5pm. 10am to 2pm on Saturdays', '? 9-17 9-17 9-17 9-17 9-17 10-14'],
    ['Weekdays. 8am to 6pm', '? 8-18 8-18 8-18 8-18 8-18 ?'],
    ['Tue to Sat. 9.30am to 5.30pm. Closed Sun and Mon', 'x x 9.5-17.5 9.5-17.5 9.5-17.5 9.5-17.5 9.5-17.5'],
    ['Mon to Fri 9am to 5pm. Sat 10am to 2pm. 1pm to 2pm closed for lunch', '? 9-17 9-17 9-17 9-17 9-17 10-14+13-14'],
  ]) assert.equal(week(l.split(' || ')), w, l);
});

test('round C9 items 4 and 5: "except <day> <times>" with no comma; closed times on a named day; the C6 review\'s h8 lines', () => {
  // x closed, - unsaid (no search data, no Open now), ? not named, else the times. Lunch hours written
  // without a day still count as open, as in every earlier round (a known gap, left).
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { if (partlyClosed(lines, d)) return '-'; const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'x'; }).join(' ');
  for (const [l, w] of [
    ["Mon to Fri 9am to 5pm, closed 1pm to 2pm", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm, closed 1pm to 2pm for lunch", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm. Closed 1pm to 2pm", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm. Closed for lunch 1pm to 2pm", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm. 1pm to 2pm closed for lunch", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm (closed 1pm to 2pm)", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm || Closed for lunch 1pm to 2pm", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm || Sat 10am to 2pm || Closed 1pm to 2pm for lunch", '? 9-17 9-17 9-17 9-17 9-17 10-14'],
    ["Mon to Fri 9am to 5pm. Sat 10am to 2pm. 1pm to 2pm closed for lunch", '? 9-17 9-17 9-17 9-17 9-17 10-14+13-14'],
    ["Mon to Fri 9am to 1pm and 2pm to 5pm", '? 9-13+14-17 9-13+14-17 9-13+14-17 9-13+14-17 9-13+14-17 ?'],
    ["Mon to Fri 9am to 1pm, 2pm to 5pm", '? 9-13+14-17 9-13+14-17 9-13+14-17 9-13+14-17 9-13+14-17 ?'],
    ["Sat 10am to 2pm. Closed Sunday", 'x ? ? ? ? ? 10-14'],
    ["Mon to Fri 9am to 5pm, Sat 10am to 2pm. Closed Sunday", 'x 9-17 9-17 9-17 9-17 9-17 10-14'],
    ["Mon to Sat 9am to 5pm. Closed Sundays and bank holidays", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5pm. Closed on bank holidays", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed 24 Dec to 2 Jan", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed 24th December to 2nd January", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed Christmas Day and Boxing Day", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed from 23 December, open again 3 January", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed 25 and 26 December", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed for holidays 1 to 14 August", '? 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 9-17+13-14 ?'],
    ["Mon to Fri 9am to 5pm. Closed from 4pm on Christmas Eve", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed Wednesdays from 1pm", '? 9-17 9-17 - 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Closed at 3pm on Fridays", '? 9-17 9-17 9-17 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm. Doors closed 12.30pm to 1.30pm", '? 9-17+12.5-13.5 9-17+12.5-13.5 9-17+12.5-13.5 9-17+12.5-13.5 9-17+12.5-13.5 ?'],
    ["Mon to Fri 9am to 5.30pm. Closed 12pm to 1pm", '? 9-17.5+12-13 9-17.5+12-13 9-17.5+12-13 9-17.5+12-13 9-17.5+12-13 ?'],
    ["Mon to Fri 8am to 6pm. Closed Sat and Sun", 'x 8-18 8-18 8-18 8-18 8-18 x'],
    ["Mon to Fri 9am to 5pm. Sat 9am to 12pm. Closed Sun", 'x 9-17 9-17 9-17 9-17 9-17 9-12'],
    ["Tue to Sat 9am to 5pm. Closed Sun and Mon", 'x x 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5pm. Closed Saturday 1pm to 5pm", '? 9-17 9-17 9-17 9-17 9-17 -'],
    ["Mon to Sat 9am to 5pm, closed Wed 1pm to 2pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Every day except Sunday 9am to 5pm", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Every day apart from Sunday 9am to 5pm", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Every day 9am to 5pm except Saturday 10am to 2pm", '- - - - - - -'],
    ["Mon to Fri 9am to 5pm except Thursdays after 1pm", '? 9-17 9-17 9-17 - 9-17 ?'],
    ["Mon to Sat 9am to 5pm except Thursday when we open at 1pm", '? 9-17 9-17 9-17 - 9-17 9-17'],
  ]) assert.equal(week(l.split(' || ')), w, l);
});

test('round C10: item 4 only when the whole line holds one time range (C9 review M1, M2); a day straight before "closed" with times (S1)', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { if (partlyClosed(lines, d)) return '-'; const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'x'; }).join(' ');
  for (const [l, w] of [
    ["Every day 9am to 5pm, except Saturday 10am to 2pm", '9-17 9-17 9-17 9-17 9-17 9-17 -'],
    ["Every day 9am to 5pm, apart from Saturday 10am to 2pm", '9-17 9-17 9-17 9-17 9-17 9-17 -'],
    ["Every day 9am to 5pm; except Sunday 10am to 4pm", '- 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5pm, except Saturday 10am to 2pm", '? 9-17 9-17 9-17 9-17 9-17 -'],
    ["Mon to Fri 9am to 5pm, except Wednesday 1pm to 5pm", '? 9-17 9-17 - 9-17 9-17 ?'],
    ["Mon to Fri 9am to 5pm, apart from Friday 9am to 4pm", '? 9-17 9-17 9-17 9-17 - ?'],
    ["Monday to Friday, 9am to 5pm, except Wednesday 9am to 1pm", '? 9-17 9-17 - 9-17 9-17 ?'],
    ["Every day except Sunday 9am to 5pm, Saturday 10am to 2pm", '- - - - - - -'],
    ["Every day except Sunday 9am to 5pm and Saturday 10am to 2pm", '- - - - - - -'],
    ["Every day except Sunday 9am to 5pm. Saturday 10am to 2pm", '- - - - - - -'],
    ["Every day except Sunday 9am to 5pm", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Every day apart from Sunday 9am to 5pm", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Every day, except Sunday 9am to 5pm", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Open daily except Mon 10am to 4pm", '10-16 x 10-16 10-16 10-16 10-16 10-16'],
    ["Mon to Fri 9am to 5pm, Saturday closed 1pm to 5pm", '? 9-17 9-17 9-17 9-17 9-17 -'],
    ["Mon to Sat 9am to 5pm, Wed closed 1pm to 2pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5pm || Wednesday: closed 1pm to 2pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5pm. Closed Saturday 1pm to 5pm", '? 9-17 9-17 9-17 9-17 9-17 -'],
    ["Mon to Fri 9am to 5pm. Saturday closed", '? 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Sat 9am to 5pm. Sundays closed", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5pm. Sat closed. 10am to 2pm Sunday", '10-14 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Fri 9am to 6pm closed 1pm to 2pm", '? 9-18+13-14 9-18+13-14 9-18+13-14 9-18+13-14 9-18+13-14 ?'],
  ]) assert.equal(week(l.split(' || ')), w, l);
});

test('round C11: one time range, then closed days with no punctuation, reads as the full-stop form (C10 re-review minor 1)', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { if (partlyClosed(lines, d)) return '-'; const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'x'; }).join(' ');
  for (const [l, w] of [
    ["Mon to Fri 9am to 5pm Closed weekends", 'x 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Fri 9am to 5pm Sat and Sun closed", 'x 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Fri 9am to 5pm Closed Saturday and Sunday", 'x 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Sat 9am to 5pm Closed Sundays", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5pm Sunday closed", 'x 9-17 9-17 9-17 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5pm. Closed weekends", 'x 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Fri 9am to 5pm. Sat and Sun closed", 'x 9-17 9-17 9-17 9-17 9-17 x'],
    ["Mon to Fri 9am to 5pm Sat 10am to 2pm Sun closed", '- - - - - - -'],
    ["Mon to Fri 9am to 6pm closed 1pm to 2pm", '? 9-18+13-14 9-18+13-14 9-18+13-14 9-18+13-14 9-18+13-14 ?'],
    ["Monday closed Tuesday to Saturday 9am to 5pm", '? - - - - - -'],
  ]) assert.equal(week(l.split(' || ')), w, l);
});

test('round C12: "closed <day> at 1pm" and "closed <day> 1pm" leave that day unsaid (C11 re-review M1, S1)', () => {
  const week = (lines) => [0, 1, 2, 3, 4, 5, 6].map((d) => { if (partlyClosed(lines, d)) return '-'; const s = hoursOn(lines, d); return s === null ? '?' : s.length ? s.map(([a, z]) => `${a / 60}-${z / 60}`).join('+') : 'x'; }).join(' ');
  for (const [l, w] of [
    ["Mon to Sat 9am to 5pm closed Wednesday at 1pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5pm Wednesday closed at 1pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5.30pm closed Thursday at 1pm", '? 9-17.5 9-17.5 9-17.5 - 9-17.5 9-17.5'],
    ["Mon to Fri 9am to 5pm closed Fridays at 3pm", '? 9-17 9-17 9-17 9-17 - ?'],
    ["Mon to Sat 9am to 5pm. Closed Wednesday at 1pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Sat 9am to 5pm. Wednesday closed at 1pm", '? 9-17 9-17 - 9-17 9-17 9-17'],
    ["Mon to Fri 9am to 5.30pm, Thursday closed at 1pm", '? 9-17.5 9-17.5 9-17.5 - 9-17.5 ?'],
    ["Mon to Sat 9am to 5pm closed Saturday 1pm", '? 9-17 9-17 9-17 9-17 9-17 -'],
  ]) assert.equal(week(l.split(' || ')), w, l);
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
