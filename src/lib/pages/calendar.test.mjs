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

test('a bare number is a time only when joined to a clock time, so a count or a week is never read as one', () => {
  assert.deepEqual(clockSpan('2 sessions, 6pm'), { start: 1080, end: null });
  assert.deepEqual(clockSpan('Week 3, 6pm'), { start: 1080, end: null });
  assert.deepEqual(clockSpan('1 hour from 6pm'), { start: 1080, end: null });
  assert.equal(spaceEvent({ ...ITEM, time: '1 hour from 6pm' }, { tz: 'Europe/London' }).start.toISOString(), '2026-03-29T17:00:00.000Z');
  // Joined by to, till, until or a dash, it is the start or the end.
  assert.deepEqual(clockSpan('6 till 7.30pm'), { start: 1080, end: 1170 });
  assert.deepEqual(clockSpan('9 until 11am'), { start: 540, end: 660 });
  assert.deepEqual(clockSpan('6-8pm'), { start: 1080, end: 1200 });
  assert.deepEqual(clockSpan('6.30 to 8pm'), { start: 1110, end: 1200 });
  assert.deepEqual(clockSpan('10am to 12'), { start: 600, end: 720 });
  assert.deepEqual(clockSpan('6pm to 8'), { start: 1080, end: 1200 });
  // Two times not joined are not a span: the first is the start.
  assert.deepEqual(clockSpan('10am, then 2pm'), { start: 600, end: null });
  assert.equal(clockSpan('£6.30'), null);
});

// Review 2, findings 1 and 2 and the minor midnight (23 Nov): no link when unsure.
test('a number after a word before a dash belongs to the word, so the clock time is the start', () => {
  for (const [t, start, end] of [['Week 3 - 6pm', 1080, null], ['Week 3 \u2013 6pm', 1080, null], ['Session 1 - 7pm', 1140, null], ['Class 5 - 7pm', 1140, null], ['Class 5 \u2014 7pm', 1140, null],
    ['Level 2 - 10am', 600, null], ['Studio 2 - 9am', 540, null], ['Part 2 \u2013 6.30pm', 1110, null], ['Room 4 - 6pm', 1080, null], ['Ages 5 - 7pm', 1140, null]]) {
    assert.deepEqual(clockSpan(t), { start, end }, t);
  }
  // A day, from, between, or a word that says when: the number is the start, as before.
  for (const [t, start, end] of [['4 - 6pm', 960, 1080], ['Thursday 4 - 6pm', 960, 1080], ['Thu 4 - 6pm', 960, 1080], ['Tuesdays 6-7pm', 1080, 1140], ['Wednesdays 6 - 7pm', 1080, 1140],
    ['from 9 - 11am', 540, 660], ['between 2 - 4pm', 840, 960], ['Evenings 6-8pm', 1080, 1200], ['Daily 9-10am', 540, 600], ['9-10am', 540, 600]]) {
    assert.deepEqual(clockSpan(t), { start, end }, t);
  }
  const ev = spaceEvent({ ...ITEM, time: 'Week 3 - 6pm' }, { tz: 'Europe/London' });
  assert.equal(ev.start.toISOString(), '2026-03-29T17:00:00.000Z');
  assert.equal(ev.end - ev.start, 60 * 60e3);
});

test('a time with minutes and no am or pm counts only on the 24-hour clock or joined to am or pm', () => {
  for (const none of ['6.30', '6:30', '7.15', '9.30', '10:00', '6.30-8', '7.30 to 9', '8.30-10', '11.30-12.30']) {
    assert.equal(clockSpan(none), null, none);
    assert.equal(spaceEvent({ ...ITEM, time: none }, { tz: 'Europe/London' }), null, none);
  }
  assert.deepEqual(clockSpan('Arrive 5.45, start 6pm'), { start: 1080, end: null });
  assert.deepEqual(clockSpan('06:30'), { start: 390, end: null });
  assert.deepEqual(clockSpan('18:30'), { start: 1110, end: null });
  assert.deepEqual(clockSpan('19.00'), { start: 1140, end: null });
  assert.deepEqual(clockSpan('09:00 to 17:00'), { start: 540, end: 1020 });
  assert.deepEqual(clockSpan('6.30 to 8pm'), { start: 1110, end: 1200 });
  assert.deepEqual(clockSpan('7.30 till 9pm'), { start: 1170, end: 1260 });
  assert.deepEqual(clockSpan('11.30am-12.30'), { start: 690, end: 750 });
  assert.deepEqual(clockSpan('6pm-7.30'), { start: 1080, end: 1170 });
});

test('midnight is 12am and noon 12pm', () => {
  assert.deepEqual(clockSpan('10pm to midnight'), { start: 1320, end: 1440 });
  assert.deepEqual(clockSpan('11pm till midnight'), { start: 1380, end: 1440 });
  assert.deepEqual(clockSpan('midnight'), { start: 0, end: null });
  assert.deepEqual(clockSpan('10am till noon'), { start: 600, end: 720 });
  assert.deepEqual(clockSpan('noon to 2'), { start: 720, end: 840 });
  const late = spaceEvent({ ...ITEM, time: '10pm to midnight' }, { tz: 'Europe/London' });
  assert.equal(late.end - late.start, 120 * 60e3);
});

test('an end earlier than the start is the next day', () => {
  assert.deepEqual(clockSpan('11pm to 1am'), { start: 1380, end: 1500 });
  assert.deepEqual(clockSpan('22:00-01:00'), { start: 1320, end: 1500 });
  assert.deepEqual(clockSpan('11 to 1am'), { start: 1380, end: 1500 });
  const late = spaceEvent({ ...ITEM, date: '2026-12-31', time: '11pm to 1am' }, { tz: 'Europe/London' });
  assert.equal(late.end - late.start, 120 * 60e3);
  assert.equal(late.end.toISOString(), '2027-01-01T01:00:00.000Z');
  const ev = spaceEvent({ ...ITEM, date: '2026-12-31', time: '22:00-01:00' }, { tz: 'Europe/London' });
  assert.equal(ev.end - ev.start, 180 * 60e3);
});

test('the end is the start plus the length, so the clock change days keep the length', () => {
  // 28 March 2027 in London: the clocks go forward at 1am (1.30am does not happen on the clock).
  const spring = spaceEvent({ ...ITEM, date: '2027-03-28', time: '1.30am' }, { tz: 'Europe/London' });
  assert.equal(spring.end - spring.start, 60 * 60e3);
  // 31 October 2027: back again, so 1am to 2am happens twice.
  const autumn = spaceEvent({ ...ITEM, date: '2027-10-31', time: '12.30am' }, { tz: 'Europe/London' });
  assert.equal(autumn.end - autumn.start, 60 * 60e3);
  const ny = spaceEvent({ ...ITEM, date: '2027-11-07', time: '1.30am', detail: '90 minutes' }, { tz: 'America/New_York' });
  assert.equal(ny.end - ny.start, 90 * 60e3);
  const span = spaceEvent({ ...ITEM, date: '2027-03-28', time: '12.30am to 2.30am' }, { tz: 'Europe/London' });
  assert.equal(span.end - span.start, 120 * 60e3);
});

test('when nothing safe can be read, there is no Add to calendar', () => {
  for (const none of ['6 to 8', 'From 6', '9am to 8am', 'Doors at 7', '2 sessions']) {
    assert.equal(clockSpan(none), null, none);
    assert.equal(spaceEvent({ ...ITEM, time: none }, { tz: 'Europe/London' }), null, none);
    assert.ok(!draw([spaces([{ ...ITEM, time: none }])]).includes('cb-sp-cal'), none);
  }
});

test('the design’s placeholder address is never written into a calendar file', () => {
  const ev = spaceEvent(ITEM, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: 'https://your-domain.com' });
  const text = icsText(ev).replace(/\r\n /g, '');
  assert.doesNotMatch(text, /your-domain/);
  assert.doesNotMatch(text, /^URL:/m);
  assert.match(text, /\r\nUID:events-sp1-i1-2026-03-29@chapbook-website\r\n/);
  assert.doesNotMatch(googleCalendarHref(ev), /your-domain/);
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
  assert.match(unfolded, /\r\nUID:events-sp1-i1-2026-03-29@kneadwell\.example\r\n/);
  assert.match(unfolded, /\r\nDTSTAMP:20260301T090000Z\r\nDTSTART:20260329T170000Z\r\nDTEND:20260329T180000Z\r\n/);
  assert.match(unfolded, /\r\nSUMMARY:Pre-race massage clinic\\, Kneadwell\r\n/);
  assert.match(unfolded, /\r\nLOCATION:4 Mill Lane\\, Leeds LS1 1AA\r\n/);
  assert.match(unfolded, /\r\nDESCRIPTION:Small group\\; mats\\, provided\\nBring water\\nPrice: £15\\nDetails and changes: https:\/\/kneadwell\.example\/\r\n/);
  assert.match(text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:[^\r]+\r\n/);
  assert.match(text, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  // The same item gives the same UID and file on the next publish, whatever else changes.
  const again = spaceEvent({ ...ITEM, left: 2, price: '£18' }, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: SITE.url });
  assert.equal(again.uid, ev.uid); assert.equal(again.file, 'events-sp1-i1-2026-03-29.ics');
  // The same row used again for a new date is a new event, with a new UID and file.
  const moved = spaceEvent({ ...ITEM, date: '2026-04-26' }, { slug: 'events', blockId: 'sp1', tz: 'Europe/London', url: SITE.url });
  assert.notEqual(moved.uid, ev.uid); assert.equal(moved.file, 'events-sp1-i1-2026-04-26.ics');
  // Escaping and folding on their own, with a character of several bytes at the fold.
  assert.equal(icsEscape('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
  // A lone carriage return (a hand-edited address) is a new line too, never a broken line.
  assert.equal(icsEscape('1 Mill Lane\rLeeds\r\nLS1'), '1 Mill Lane\\nLeeds\\nLS1');
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
  assert.match(html, /<details class="cb-sp-cal"><summary>Add to calendar<span class="cb-sr">: Pre-race massage clinic, Sunday 29 March<\/span><\/summary><p class="cb-sp-calgo"><a href="https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&amp;dates=20260329T170000Z\/20260329T180000Z[^"]*" target="_blank" rel="noopener" aria-label="Add Pre-race massage clinic, Sunday 29 March, to Google Calendar">Google Calendar<\/a><a href="\/add-to-calendar\/events-sp1-i1-2026-03-29\.ics" download="events-sp1-i1-2026-03-29\.ics" aria-label="Add Pre-race massage clinic, Sunday 29 March, to Apple, Outlook and others">Apple, Outlook and others<\/a><\/p><\/details>/);
  assert.match(html, /<section class="cb cb-t-spaces[^"]*" id="dates-sp1">/);
  assert.equal(longDate('2026-12-03'), 'Thursday 3 December');
  // The website's own address prefix is kept.
  assert.ok(draw([spaces([ITEM])], { href: (p) => `/site${p}` }).includes('href="/site/add-to-calendar/events-sp1-i1-2026-03-29.ics"'));
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
  assert.deepEqual(files.map((f) => f.name), ['events-sp1-i1-2026-03-29']);
  // A Full date has no link, so no file either.
  assert.deepEqual(calendarFiles([page([spaces([{ ...ITEM, left: 0 }])])], { site: SITE, today: '2026-03-01' }), []);
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
  assert.ok(draw([thanks], { datesHref: href }).includes('<p class="cb-cal-line"><a class="cb-link" href="/events/#dates-sp1">Booked a date with us? Add it to your calendar</a></p>'));
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
