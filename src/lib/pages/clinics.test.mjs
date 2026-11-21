// The doctor clinic batch (website design release 7): the quick actions opening over an Open now
// card, Open now in the business's own time zone, the team and the specialities on a rail, and
// the regulator section (the CQC rating from Details and booking, CQC's own widget, and each
// professional's registration with a link to the public register).
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, needsSignature, REGULATORS, CQC_ID, lookNeedsSignature } from './render.mjs';
import { openState, clockIn, cqcWidgetUrl, CQC_LOCATION } from '../../scripts/page-actions.js';
import { professionalDetails, cleanTimeZone } from '../professional.mjs';

const HOURS = 'Monday to Friday, 8am to 6.30pm\nSaturday, 9am to 12pm\nSunday, closed';
const pro = { phone: '01632 960 123', hours: HOURS, bookingUrl: 'https://cal.com/rick/get-rick-rolled' };
const page = (blocks, look = {}) => ({ v: 1, title: 'Test', slug: 'test', look, blocks });
const ACTIONS = [
  { link: { label: 'Book an appointment', href: '@booking' }, detail: 'Online, at any time' },
  { link: { label: 'Register with us', href: '/new-patients/' } },
  { link: { label: 'Call the surgery', href: '@phone' } },
  { link: { label: 'Repeat prescription', href: 'https://www.nhs.uk/nhs-app/' }, detail: 'In the NHS App' },
];
const hero = (extra = {}) => ({ type: 'hero', variant: 'actions', data: { kicker: 'GP practice', heading: 'Good care, *close to home*', intro: 'Hello.', picture: { src: '/site-images/cbp-c1-harbour-hero.webp', alt: 'A reception', phone: '/site-images/cbp-c1-harbour-hero-phone.webp' }, actions: ACTIONS, openNow: true, closed: 'When we are closed, call **NHS 111** or go to [111.nhs.uk](https://111.nhs.uk/). In an emergency, call **999**.', ...extra } });
const draw = (blocks, professional = pro, opts = {}) => renderPage(page(blocks), { site: { name: 'Harbour Medical', professional }, ...opts });

test('quick actions: four large links over an Open now card, none of them ever dead', () => {
  const html = draw([hero()]);
  assert.match(html, /<div class="cb-act"><div class="cb-act-words">/);
  assert.match(html, /<h1 class="cb-h cb-hero-h">Good care, <em>close to home<\/em><\/h1>/);
  assert.equal((html.match(/class="cb-act-item/g) || []).length, 4);
  assert.ok(html.includes('href="/appointments/"') && html.includes('href="/new-patients/"') && html.includes('href="tel:01632960123"'));
  // A Call action shows the number under it, set once in Details and booking.
  assert.match(html, /Call the surgery<\/span><span class="cb-act-detail">01632 960 123<\/span>/);
  // A link to another website opens safely.
  assert.match(html, /href="https:\/\/www\.nhs\.uk\/nhs-app\/" rel="noopener"/);
  // The card: Open now (filled in on the visitor's device, in the business's time zone), the
  // hours as text for anyone without the script, and what to do when closed.
  assert.match(html, /<p class="cb-opennow cb-act-now" data-open="Monday to Friday, 8am to 6\.30pm\|Saturday, 9am to 12pm\|Sunday, closed" data-tz="Europe\/London" hidden><\/p>/);
  assert.match(html, /<p class="cb-act-hours">Monday to Friday, 8am to 6\.30pm<br>/);
  assert.match(html, /<div class="cb-rich cb-closed"><p>When we are closed, call <strong>NHS 111<\/strong> or go to <a href="https:\/\/111\.nhs\.uk\/"/);
  // The photo is asked for first, with a phone copy.
  assert.match(html, /<figure class="cb-hero-pic cb-act-pic"><img src="\/site-images\/cbp-c1-harbour-hero\.webp" srcset="[^"]+800w[^"]+1600w"[^>]* fetchpriority="high"/);
  // No phone number: no Call action at all. No booking link: Book goes to Contact.
  const bare = draw([hero()], { hours: HOURS });
  assert.equal((bare.match(/class="cb-act-item/g) || []).length, 3);
  assert.ok(!bare.includes('tel:') && bare.includes('href="/contact/"'));
  for (const m of bare.matchAll(/<a\b[^>]*?href="([^"]*)"/g)) assert.ok(m[1] && m[1] !== '#');
  // No hours: no Open now line (never a guess), the card keeps the closed note.
  const nohours = draw([hero()], { phone: '01632 960 123' });
  assert.ok(!nohours.includes('cb-opennow') && nohours.includes('cb-closed'));
  // In the editor: every action is a list entry with its link, and the card says what it will do.
  const ed = draw([{ id: 'b1', ...hero() }], pro, { editable: true });
  assert.ok(ed.includes('data-cb-list="b1:actions"') && ed.includes('data-cb-item="b1:actions.3"') && ed.includes('data-cb-link="b1:actions.0.link"'));
  assert.ok(ed.includes('data-cb="b1:actions.0.detail"') && ed.includes('data-cb="b1:closed"'));
  assert.match(ed, /says whether you are open now/);
  // It needs website design release 7, as do its new settings on other openings.
  assert.equal(needsSignature(hero()), true);
  assert.equal(needsSignature({ type: 'hero', variant: 'reveal', data: { heading: 'x', openNow: true } }), true);
  assert.equal(needsSignature({ type: 'contact', variant: 'card', data: { closed: 'Call 111.' } }), true);
});

test('Open now works in the business’s own time zone, whatever the visitor’s clock says', () => {
  const lines = HOURS.split('\n');
  // 17:30 on a Monday in London is 23:00 in India.
  const t = new Date('2026-11-23T17:30:00Z');
  assert.deepEqual(clockIn(t, 'Europe/London'), { dow: 1, mins: 17 * 60 + 30 });
  assert.deepEqual(clockIn(t, 'Asia/Kolkata'), { dow: 1, mins: 23 * 60 });
  assert.equal(openState(lines, t, 'Europe/London').text, 'Open now, closes at 6.30pm');
  assert.equal(openState(lines, t, 'Asia/Kolkata').text, 'Closed now, opens tomorrow at 8am');
  // British Summer Time: 07:30 UTC in July is 8.30am in London.
  assert.equal(openState(lines, new Date('2026-07-06T07:30:00Z'), 'Europe/London').text, 'Open now, closes at 6.30pm');
  // Saturday afternoon: closed until Monday.
  assert.equal(openState(lines, new Date('2026-11-21T13:00:00Z'), 'Europe/London').text, 'Closed now, opens on Monday at 8am');
  // An unknown zone falls back to the device's own clock rather than failing.
  assert.ok(openState(lines, t, 'Not/AZone'));
  // The setting: an IANA zone the browser knows, else Europe/London.
  assert.equal(cleanTimeZone('Asia/Dhaka'), 'Asia/Dhaka');
  assert.equal(cleanTimeZone('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  for (const bad of ['', 'London', 'Not/AZone', '"><script>', 'Europe/London; x']) assert.equal(cleanTimeZone(bad), 'Europe/London', bad);
  assert.equal(professionalDetails({}).timeZone, 'Europe/London');
  // The line on the page names the zone.
  assert.match(draw([{ type: 'contact', variant: 'map', data: { heading: 'Find us', business: true, openNow: true } }], { ...pro, timeZone: 'Asia/Karachi' }), /data-tz="Asia\/Karachi"/);
});

test('the team rail travels sideways on the website, and is a plain grid in the editor', () => {
  const team = { id: 'b1', type: 'team', variant: 'rail', data: { heading: 'Our doctors', bookEach: true, items: [{ name: 'Dr Ruth Penrose', quals: 'MRCGP, GMC 1234567' }, { name: 'Dr Samuel Okoye' }, { name: 'Dr Priya Nair' }] } };
  const html = draw([team]);
  assert.match(html, /<div class="cb-hs cb-team-rail" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="Our doctors, scrolls sideways">/);
  assert.equal((html.match(/<article class="cb-team-card">/g) || []).length, 3);
  // Initials, never a made-up face; each person's own Book button.
  assert.match(html, /<span class="cb-initials" aria-hidden="true">RP<\/span>/);
  assert.equal((html.match(/class="cb-person-book"/g) || []).length, 3);
  const ed = draw([team], pro, { editable: true });
  assert.ok(!ed.includes('data-hs') && ed.includes('cb-team-grid cb-team-railgrid') && ed.includes('data-cb-item="b1:items.2"'));
});

test('a speciality card on the rail shows who you will see, the usual wait and the fee', () => {
  const rail = { type: 'services', variant: 'rail', data: { heading: 'Specialities', items: [{ name: 'Dermatology', who: 'Dr Amelia Hart', wait: '5 days', price: 'from £220' }, { name: 'Massage', duration: '60 min', price: '£65' }] } };
  const html = draw([rail]);
  assert.match(html, /<dl class="cb-rail-facts"><div><dt>With<\/dt><dd><span>Dr Amelia Hart<\/span><\/dd><\/div><div><dt>Usual wait<\/dt><dd><span>5 days<\/span><\/dd><\/div><div><dt>Fee<\/dt><dd><span>from £220<\/span><\/dd><\/div><\/dl>/);
  assert.match(html, /<p class="cb-rail-meta"><span class="cb-time">60 min<\/span>/);
  assert.equal(needsSignature({ type: 'services', variant: 'menu', data: { items: [{ name: 'x', wait: '5 days' }] } }), true);
});

test('regulator: the business’s own CQC rating, never a sample one, and registrations with links to check them', () => {
  const reg = { id: 'b1', type: 'regulator', variant: 'panel', data: { heading: 'Who is responsible', items: [{ name: 'Dr Ruth Penrose', body: 'gmc', number: '1234567' }, { name: 'Jo Pascoe', body: 'nmc', number: '12A3456B' }, { name: 'Dr Ali Rahman', body: 'gmc', number: '7654321' }] } };
  // Nothing set: no CQC line on the website, a clear note in the editor.
  const none = draw([reg], pro);
  assert.ok(!none.includes('Care Quality Commission') && !none.includes('Overall rating'));
  assert.match(draw([reg], pro, { editable: true }), /Add your CQC location ID, your latest overall rating and its date in Details and booking/);
  // Set: the rating, its date and the report on CQC's website.
  const cqc = { ...pro, cqcId: '1-101641587', cqcRating: 'good', cqcDate: '2025-09-18' };
  const html = draw([reg], cqc);
  assert.match(html, /<strong class="cb-reg-word cb-reg-good">Good<\/strong>/);
  assert.match(html, /<p class="cb-reg-date">Rated 18 September 2025<\/p>/);
  assert.match(html, /href="https:\/\/www\.cqc\.org\.uk\/location\/1-101641587" rel="noopener">Read the CQC report/);
  // A rating with no location ID still links to CQC, never to a made-up page.
  assert.match(draw([reg], { ...pro, cqcRating: 'outstanding', cqcDate: '2025-01-02' }), /href="https:\/\/www\.cqc\.org\.uk\/" rel="noopener">Read the CQC report/);
  // Each person with their register and number; one link to each register used.
  assert.match(html, /<span class="cb-reg-name">Dr Ruth Penrose<\/span><span class="cb-reg-num"><span class="cb-reg-body">GMC<\/span> <span>1234567<\/span><\/span>/);
  assert.equal((html.match(/class="cb-link cb-reg-check"/g) || []).length, 2);
  assert.ok(html.includes(`href="${REGULATORS.gmc.href}"`) && html.includes(`href="${REGULATORS.nmc.href}"`));
  // CQC's own widget: only when chosen and a location ID is set, only on the website, as a holder
  // the page's script fills in (the page itself carries no script).
  const withWidget = { ...reg, data: { ...reg.data, widget: true } };
  assert.match(draw([withWidget], cqc), /<div class="cb-reg-widget" data-cqc="1-101641587"><\/div>/);
  assert.ok(!draw([withWidget], { ...cqc, cqcId: '' }).includes('cb-reg-widget'));
  assert.ok(!draw([withWidget], cqc, { editable: true }).includes('data-cqc'));
  assert.ok(!draw([withWidget], cqc).includes('<script'));
  assert.equal(cqcWidgetUrl('1-101641587'), 'https://www.cqc.org.uk/sites/all/modules/custom/cqc_widget/widget.js?data-id=1-101641587&data-host=https://www.cqc.org.uk&type=location');
  for (const bad of ['', '1-12', '2-101641587', '1-101641587&x=1', '"><script>']) { assert.equal(cqcWidgetUrl(bad), '', bad); assert.ok(!CQC_LOCATION.test(bad)); assert.ok(!CQC_ID.test(bad)); }
  // The details: only real values are kept.
  assert.deepEqual(['cqcId', 'cqcRating', 'cqcDate'].map((k) => professionalDetails({ cqcId: '1-101641587', cqcRating: 'good', cqcDate: '2025-09-18' })[k]), ['1-101641587', 'good', '2025-09-18']);
  assert.deepEqual(['cqcId', 'cqcRating', 'cqcDate'].map((k) => professionalDetails({ cqcId: 'x', cqcRating: 'great', cqcDate: '2025-02-30' })[k]), ['', '', '']);
  // The rating on one line, for inner pages; nothing at all on the website without a rating.
  const line = { type: 'regulator', variant: 'line', data: { heading: 'Our CQC rating' } };
  assert.match(draw([line], cqc), /cb-reg-oneline/);
  assert.ok(!draw([line], pro).includes('cb-reg'));
  assert.equal(needsSignature(reg), true);
});

test('the clinic typeface: a clean sans with one warm italic phrase', () => {
  const html = renderPage(page([hero()], { font: 'mixed' }), { site: { professional: pro } });
  assert.match(html, /class="cbp cbp-font cbp-hf-mixed"/);
  assert.equal(lookNeedsSignature({ font: 'mixed' }), true);
});
