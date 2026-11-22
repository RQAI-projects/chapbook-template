// Add to calendar (owner, 22 Nov): beside each dated class or event in Spaces remaining with a
// start time, a Google Calendar link and a calendar file made when the website is built. Times in
// UTC from the business's own time zone; RFC 5545 escaping, folding and CRLF; a UID that stays
// the same between publishes; nothing for a date that is full, past, without a time or followed
// from Cal.com.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, clockSpan, lengthOf, zonedTime, spaceEvent, icsText, icsEscape, icsFold, googleCalendarHref, calendarFiles, datesHrefOf, longDate, CALENDAR_DIR, RESERVED_SLUGS, needsSignature } from './render.mjs';

const SITE = { name: 'Kneadwell', url: 'https://kneadwell.example/', professional: { phone: '01632 960 123', location: '4 Mill Lane\nLeeds LS1 1AA', timeZone: 'Europe/London' } };
const ITEM = { id: 'i1', name: 'Pre-race massage clinic', date: '2026-03-29', time: '6pm to 7pm', detail: 'Ten minutes each, at the club', price: '£15', capacity: 20, left: 6 };
const spaces = (items, data = {}) => ({ id: 'sp1', type: 'spaces', variant: 'rows', data: { heading: 'Events', items, ...data } });
const page = (blocks, slug = 'events') => ({ v: 1, title: 'Events', slug, look: {}, blocks });
const draw = (blocks, opts = {}) => renderPage(page(blocks), { site: SITE, today: '2026-03-01', ...opts });
const css = readFileSync(new URL('../../styles/signature.css', import.meta.url), 'utf8');

test('clock times are read from the words people type', () => {
  assert.deepEqual(clockSpan('6pm'), { start: 1080, end: null });
  assert.deepEqual(clockSpan('6.30pm'), { start: 1110, end: null });
  assert.deepEqual(clockSpan('18:30'), { start: 1110, end: null });
  assert.deepEqual(clockSpan('9am to 10am'), { start: 540, end: 600 });
  assert.deepEqual(clockSpan('6 to 7.30pm'), { start: 1080, end: 1170 });
  assert.deepEqual(clockSpan('11 to 1pm'), { start: 660, end: 780 });
  assert.deepEqual(clockSpan('noon'), { start: 720, end: null });
  for (const none of ['', 'Six weeks', 'Evenings', 'All day']) assert.equal(clockSpan(none), null, none);
  assert.equal(lengthOf('90 min'), 90); assert.equal(lengthOf('2 hours'), 120); assert.equal(lengthOf('With Sam'), null);
});

test('times are written in UTC from the business’s time zone, right either side of a clock change', () => {
  // 29 March 2026: the clocks go forward in the UK at 1am.
  assert.equal(zonedTime('2026-03-28', 18 * 60, 'Europe/London').toISOString(), '2026-03-28T18:00:00.000Z');
  assert.equal(zonedTime('2026-03-29', 18 * 60, 'Europe/London').toISOString(), '2026-03-29T17:00:00.000Z');
  // 25 October 2026: back again.
  assert.equal(zonedTime('2026-10-24', 9 * 60, 'Europe/London').toISOString(), '2026-10-24T08:00:00.000Z');
  assert.equal(zonedTime('2026-10-25', 9 * 60, 'Europe/London').toISOString(), '2026-10-25T09:00:00.000Z');
  assert.equal(zonedTime('2026-12-03', 18 * 60, 'Asia/Kolkata').toISOString(), '2026-12-03T12:30:00.000Z');
  assert.equal(zonedTime('2026-07-01', 18 * 60, 'America/New_York').toISOString(), '2026-07-01T22:00:00.000Z');
});

test('the calendar file follows RFC 5545: CRLF, folding at 75 octets, escaping, a stable UID', () => {
  const ev = spaceEvent({ ...ITEM, detail: 'Small group; mats, provided\nBring water' }, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: SITE.url, place: SITE.professional.location, siteName: 'Kneadwell' });
  const text = icsText(ev, { stamp: new Date('2026-03-01T09:00:00Z') });
  assert.ok(text.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(text), 'every line ends CRLF');
  for (const line of text.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `${line.length}: ${line}`);
  const unfolded = text.replace(/\r\n /g, '');
  assert.match(unfolded, /\r\nUID:events-sp1-i1@kneadwell\.example\r\n/);
  assert.match(unfolded, /\r\nDTSTAMP:20260301T090000Z\r\nDTSTART:20260329T170000Z\r\nDTEND:20260329T180000Z\r\n/);
  assert.match(unfolded, /\r\nSUMMARY:Pre-race massage clinic\\, Kneadwell\r\n/);
  assert.match(unfolded, /\r\nLOCATION:4 Mill Lane\\, Leeds LS1 1AA\r\n/);
  assert.match(unfolded, /\r\nDESCRIPTION:Small group\\; mats\\, provided\\nBring water\\nPrice: £15\\nDetails and changes: https:\/\/kneadwell\.example\/\r\n/);
  assert.match(text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:[^\r]+\r\n/);
  assert.match(text, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  // The same item gives the same UID and file on the next publish, whatever else changes.
  const again = spaceEvent({ ...ITEM, left: 2, price: '£18' }, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: SITE.url });
  assert.equal(again.uid, ev.uid); assert.equal(again.file, 'events-sp1-i1.ics');
  // Escaping and folding on their own, with a character of several bytes at the fold.
  assert.equal(icsEscape('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
  const long = `DESCRIPTION:${'é'.repeat(80)}`;
  const folded = icsFold(long);
  for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), long);
  // No personal data: only the business's own words, address and website.
  assert.doesNotMatch(text, /ATTENDEE|ORGANIZER|MAILTO/i);
});

test('the Google Calendar link carries the title, the UTC times, the place and a short note', () => {
  const ev = spaceEvent(ITEM, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: SITE.url, place: SITE.professional.location, siteName: 'Kneadwell' });
  const href = googleCalendarHref(ev), u = new URL(href);
  assert.equal(`${u.origin}${u.pathname}`, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('dates'), '20260329T170000Z/20260329T180000Z');
  assert.ok(href.includes('dates=20260329T170000Z/20260329T180000Z'), 'the slash is kept plain');
  assert.equal(u.searchParams.get('text'), 'Pre-race massage clinic, Kneadwell');
  assert.equal(u.searchParams.get('location'), '4 Mill Lane, Leeds LS1 1AA');
  assert.match(u.searchParams.get('details'), /Ten minutes each, at the club[\s\S]*https:\/\/kneadwell\.example\//);
  // With no end time or length, an hour; a length in the words is used.
  const hour = spaceEvent({ ...ITEM, time: '6pm' }, { tz: 'Europe/London' });
  assert.equal(hour.end - hour.start, 3600e3);
  const ninety = spaceEvent({ ...ITEM, time: '6pm', detail: '90 min, at the club' }, { tz: 'Europe/London' });
  assert.equal(ninety.end - ninety.start, 90 * 60e3);
});

test('a dated row with places left has the disclosure and both links, named with the item and date', () => {
  const html = draw([spaces([ITEM])]);
  assert.match(html, /<details class="cb-sp-cal"><summary>Add to calendar<\/summary><p class="cb-sp-calgo"><a href="https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&amp;dates=20260329T170000Z\/20260329T180000Z[^"]*" target="_blank" rel="noopener" aria-label="Add Pre-race massage clinic, Sunday 29 March, to Google Calendar">Google Calendar<\/a><a href="\/add-to-calendar\/events-sp1-i1\.ics" download="events-sp1-i1\.ics" aria-label="Add Pre-race massage clinic, Sunday 29 March, to Apple, Outlook or another calendar">Apple, Outlook and others<\/a><\/p><\/details>/);
  assert.match(html, /<section class="cb cb-t-spaces[^"]*" id="dates-sp1">/);
  assert.equal(longDate('2026-12-03'), 'Thursday 3 December');
  // The website's own address prefix is kept.
  assert.ok(draw([spaces([ITEM])], { href: (p) => `/site${p}` }).includes('href="/site/add-to-calendar/events-sp1-i1.ics"'));
});

test('no Add to calendar when full, past, without a time, followed from Cal.com, or switched off', () => {
  const none = (items, data, opts) => !draw([spaces(items, data)], opts).includes('cb-sp-cal');
  assert.ok(none([{ ...ITEM, left: 0 }]), 'full');
  assert.ok(none([ITEM], {}, { today: '2026-04-01' }), 'past');
  assert.ok(none([{ ...ITEM, time: '' }]), 'no time');
  assert.ok(none([{ ...ITEM, time: 'Evenings' }]), 'no clock time');
  assert.ok(none([{ ...ITEM, cal: 'cal.com/kneadwell/clinic' }]), 'Cal.com gives its own');
  assert.ok(none([ITEM], { noCalendar: true }), 'switched off');
  assert.equal(needsSignature(spaces([ITEM], { noCalendar: true })), true);
  // The files made for the build follow the same rules.
  const files = calendarFiles([page([spaces([ITEM, { ...ITEM, id: 'i2', time: '' }, { ...ITEM, id: 'i3', cal: 'cal.com/a/b' }, { ...ITEM, id: 'i4', date: '2026-02-01' }])])], { site: SITE, today: '2026-03-01' });
  assert.deepEqual(files.map((f) => f.name), ['events-sp1-i1']);
  assert.deepEqual(calendarFiles([page([spaces([ITEM], { noCalendar: true })])], { site: SITE, today: '2026-03-01' }), []);
  // A page cannot take the files' address.
  assert.ok(RESERVED_SLUGS.includes(CALENDAR_DIR.replace(/\//g, '')));
  // Hidden on a row that passes while the page is open; links finger-sized; colour from the page.
  assert.match(css, /\.cb-sp-item\.is-past \.cb-sp-cal\{display:none\}/);
  assert.match(css, /\.cb-sp-calgo a\{[^}]*min-height:44px/);
});

test('a Thank you page has one quiet line to the dated classes, only when the website has some', () => {
  const thanks = { id: 't1', type: 'hero', role: 'thanks', variant: 'minimal', data: { heading: 'Thank you' } };
  const pages = [page([spaces([ITEM])], 'events')];
  const href = datesHrefOf(pages, { site: SITE, today: '2026-03-01' });
  assert.equal(href, '/events/#dates-sp1');
  assert.ok(draw([thanks], { datesHref: href }).includes('<p class="cb-cal-line"><a class="cb-link" href="/events/#dates-sp1">Booked a class? Add it to your calendar</a></p>'));
  assert.ok(!draw([thanks]).includes('cb-cal-line'), 'no dates, no line');
  assert.equal(datesHrefOf([page([spaces([{ ...ITEM, left: 0 }])])], { site: SITE, today: '2026-03-01' }), '');
  assert.equal(datesHrefOf(pages, { site: SITE, today: '2026-04-01' }), '');
  // Only the Thank you page's opening says it.
  assert.ok(!draw([{ ...thanks, role: 'hero' }], { datesHref: href }).includes('cb-cal-line'));
});

test('a page without Spaces remaining draws exactly as before', () => {
  const html = draw([{ type: 'text', variant: 'plain', data: { heading: 'Hello', body: 'Words.' } }]);
  assert.ok(!html.includes('cb-sp-cal') && !html.includes('id="dates-'));
});
