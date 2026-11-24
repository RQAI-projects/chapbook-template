// Booking and paying on every website (owner, 22 Nov): who takes a payment, beside each pay
// button; plain words where booking and paying are two steps; "Pay when you book"; a monthly
// plan's own page; the business's time zone beside class times; the reminder promise once the
// business has switched reminders on; where to look when an email does not arrive; guides in the
// editor only. None of it changes how a page draws until a business uses it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, needsSignature, payLine, payPage, PAY_HOSTS, REMINDER_LINE, PAY_WHEN_BOOK } from './render.mjs';
import { professionalDetails } from '../professional.mjs';

const page = (blocks) => ({ v: 1, title: 'Test', slug: 'test', look: {}, blocks });
const SITE = { name: 'Test practice', url: 'https://test.example', professional: { phone: '01632 960 123' } };
const draw = (blocks, opts = {}) => renderPage(page(blocks), { site: SITE, today: '2026-11-23', ...opts });
const withPro = (extra) => ({ ...SITE, professional: { ...SITE.professional, ...extra } });
const STRIPE = 'https://buy.stripe.com/aEU5kC0n9';

test('a pay page is named from its address, and test pages are known for what they are', () => {
  for (const [href, name] of [[STRIPE, 'Stripe'], ['https://book.stripe.com/abc', 'Stripe'], ['https://paypal.me/sam/25', 'PayPal'], ['https://www.paypal.com/ncp/payment/PLB-123', 'PayPal'], ['https://pay.sumup.com/b2c/Q1', 'SumUp'], ['https://square.link/u/AbC', 'Square']]) {
    assert.deepEqual(payPage(href), { name, test: false }, href);
    assert.equal(payLine(href), `Pays securely through ${name}`);
  }
  assert.deepEqual(payPage('https://buy.stripe.com/test_cN25nr0iZ7bUa7meUY'), { name: 'Stripe', test: true });
  assert.deepEqual(payPage('https://www.sandbox.paypal.com/ncp/payment/PLB-A87RKBMWWFHM'), { name: 'PayPal', test: true });
  // Square's test links (its developer pages show https://sandbox.square.link/u/...).
  assert.deepEqual(payPage('https://sandbox.square.link/u/fTkKKauH'), { name: 'Square', test: true });
  for (const href of ['https://example.com/pay', 'http://buy.stripe.com/abc', 'https://buy.stripe.com/', 'https://buy.stripe.com.example.net/x', 'https://u:p@buy.stripe.com/a', '', 'javascript:alert(1)']) assert.equal(payLine(href), '', href);
  assert.ok(PAY_HOSTS.every((h) => h.host && h.name));
});

test('every pay button says who takes the payment, and nothing is said for an address not recognised', () => {
  const plans = { type: 'plans', variant: 'cards', data: { heading: 'Ways to pay', items: [{ name: 'Session', price: '£60', pay: { label: 'Pay now', href: STRIPE } }, { name: 'Other', price: '£5', pay: { label: 'Pay', href: 'https://example.com/pay' } }] } };
  const html = draw([plans]);
  assert.equal((html.match(/<span class="cb-paysafe">Pays securely through Stripe<\/span>/g) || []).length, 1);
  assert.ok(!html.includes('through example'));
  const svc = { type: 'services', variant: 'menu', data: { items: [{ name: 'Massage', price: '£50', link: { label: 'Book', href: '@booking' }, pay: { label: 'Pay deposit', href: 'https://paypal.me/sam/10' } }] } };
  const s = draw([svc]);
  assert.match(s, /<span class="cb-paynote"><span class="cb-thenpay">Book your time, then pay the deposit\.<\/span><span class="cb-paysafe">Pays securely through PayPal<\/span><\/span>/);
  // A pay button alone says who takes the payment, with no words about booking first.
  const alone = draw([{ type: 'services', variant: 'menu', data: { items: [{ name: 'Gift card', pay: { label: 'Buy', href: STRIPE } }] } }]);
  assert.ok(alone.includes('Pays securely through Stripe') && !alone.includes('cb-thenpay'));
});

test('dated places: two steps said plainly, or Pay when you book; the time zone beside the time', () => {
  const row = (extra) => ({ type: 'spaces', variant: 'rows', data: { items: [{ name: 'Class', date: '2026-12-01', time: '6pm', capacity: 8, left: 3, link: { label: 'Book', href: '@booking' }, ...extra }] } });
  const two = draw([row({ pay: { label: 'Pay now', href: STRIPE } })]);
  assert.match(two, /<span class="cb-thenpay">Book your place, then pay\.<\/span><span class="cb-paysafe">Pays securely through Stripe<\/span>/);
  const BOOKS = { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) };
  const paid = draw([row({ pay: { label: 'Pay now', href: STRIPE }, paid: true })], BOOKS);
  assert.ok(paid.includes(`<span class="cb-paid">${PAY_WHEN_BOOK}</span>`) && !paid.includes('cb-order-pay') && !paid.includes('Pay now') && !paid.includes('cb-thenpay'));
  // With nowhere to book online (Book becomes Call), it promises nothing and keeps its pay button
  // (newcomer walk, 23 Nov).
  const phoneOnly = draw([row({ pay: { label: 'Pay now', href: STRIPE }, paid: true })]);
  assert.ok(!phoneOnly.includes('cb-paid') && phoneOnly.includes('Pay now'));
  // Its own booking page is enough.
  assert.ok(draw([row({ link: { label: 'Book', href: 'https://cal.com/sam/class' }, paid: true })]).includes('cb-paid'));
  const zoned = draw([row({})], { site: withPro({ zoneLabel: 'UK time' }) });
  assert.match(zoned, /<span class="cb-sp-time">6pm <span class="cb-sp-zone">UK time<\/span><\/span>/);
  assert.ok(!draw([row({})]).includes('cb-sp-zone'), 'no zone until one is set');
  assert.equal(needsSignature(row({ paid: true })), true);
});

test('a booking item can say Pay when you book', () => {
  const strip = (v) => ({ type: 'bookstrip', variant: v, data: { heading: 'Book', items: [{ name: 'Sports massage', duration: '60 min', price: '£55', paid: true }, { name: 'Follow-up', duration: '30 min' }] } });
  const BOOKS = { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) };
  for (const v of ['strip', 'cards']) {
    const html = draw([strip(v)], BOOKS);
    assert.equal((html.match(/<span class="cb-paid">Pay when you book<\/span>/g) || []).length, 1, v);
    assert.equal((html.match(/You pay when you book\./g) || []).length, 1, `${v}: said once under the choices`);
    // No booking link: the strip offers a call, so it says nothing about paying (newcomer walk).
    const call = draw([strip(v)]);
    assert.ok(!call.includes('cb-paid') && !call.includes('You pay when you book'), v);
  }
  const edit = draw([{ ...strip('strip'), id: 'b1' }], { editable: true, ...BOOKS });
  assert.ok(edit.includes('cb-paid'));
  const editCall = draw([{ ...strip('strip'), id: 'b1' }], { editable: true });
  assert.ok(!editCall.includes('cb-paid') && editCall.includes('Pay when you book shows on your website once your booking link is set'));
});

test('a monthly plan can link to the payment service’s own page for members', () => {
  const plans = { type: 'plans', variant: 'cards', data: { items: [{ name: 'Monthly', price: '£40', per: 'a month', pay: { label: 'Join', href: STRIPE }, manage: { label: '', href: 'https://billing.stripe.com/p/login/abc123' } }] } };
  const html = draw([plans]);
  assert.match(html, /<a class="cb-link cb-pl-manage" href="https:\/\/billing\.stripe\.com\/p\/login\/abc123">Manage your membership<\/a>/);
  assert.ok(!draw([{ ...plans, data: { items: [{ name: 'Monthly', price: '£40' }] } }]).includes('cb-pl-manage'));
  assert.equal(needsSignature(plans), true);
});

test('the reminder promise appears beside Book only once the business has ticked it', () => {
  const strip = { type: 'bookstrip', variant: 'strip', data: { heading: 'Book', items: [{ name: 'Session' }] } };
  const booking = { type: 'booking', variant: 'calendar', data: { heading: 'Book online', useSite: true } };
  const off = draw([strip, booking], { site: withPro({ bookingUrl: 'https://cal.com/sam/session' }) });
  assert.ok(!off.includes(REMINDER_LINE));
  const on = draw([strip, booking], { site: withPro({ bookingUrl: 'https://cal.com/sam/session', reminders: true }) });
  assert.equal((on.match(new RegExp(REMINDER_LINE.replace('.', '\\.'), 'g')) || []).length, 2);
  // Ticked, but with no booking link (only a phone to call): nothing would send those emails, so
  // no promise is made.
  const phoneOnly = draw([strip, booking], { site: withPro({ reminders: true }) });
  assert.ok(!phoneOnly.includes(REMINDER_LINE) && !phoneOnly.includes('cb-remind'));
  assert.equal(professionalDetails({ reminders: 'yes' }).reminders, false, 'only a real tick counts');
  assert.equal(professionalDetails({ reminders: true }).reminders, true);
  assert.equal(professionalDetails({ zoneLabel: '  UK time  ' }).zoneLabel, 'UK time');
});

test('a contact section says where to look when a confirmation email does not arrive, once there is a booking page and the emails are ticked', () => {
  const contact = { type: 'contact', variant: 'card', data: { heading: 'Contact', business: true } };
  assert.ok(!draw([contact]).includes('cb-spam'), 'no booking page, no line: the page draws as before');
  // A booking link alone (a café's table booking, say) changes nothing: the page draws as before.
  const before = draw([contact], { site: withPro({ bookingUrl: 'https://cal.com/sam/session' }) });
  assert.ok(!before.includes('cb-spam'));
  assert.equal(before, draw([contact], { site: withPro({ bookingUrl: 'https://cal.com/sam/session', reminders: false }) }));
  assert.ok(!draw([contact], { site: withPro({ reminders: true }) }).includes('cb-spam'), 'ticked with no booking link: no line');
  assert.ok(draw([contact], { site: withPro({ bookingUrl: 'https://cal.com/sam/session', reminders: true }) }).includes('<p class="cb-small cb-spam">No email? Check your spam folder, or call us.</p>'));
  assert.ok(draw([contact], { site: { ...SITE, professional: { bookingUrl: 'https://cal.com/sam/session', reminders: true } } }).includes('No email? Check your spam folder.</p>'));
});

test('guides for the cancelling words and the thank-you page show in the editor only', () => {
  const cancel = { id: 'c1', type: 'faq', role: 'cancel', variant: 'list', data: { heading: 'Cancelling', items: [{ question: 'Can I move my booking?', answer: 'Yes.' }] } };
  const thanks = { id: 't1', type: 'hero', role: 'thanks', variant: 'minimal', data: { heading: 'Thank you' } };
  const edit = draw([cancel, thanks], { editable: true });
  assert.match(edit, /not legal advice/);
  assert.match(edit, /https:\/\/test\.example\/thank-you\//);
  // The cancelling guide says who the rights are for, to confirm an early start, and what happens
  // when customers are not told.
  assert.match(edit, /These rights are for consumers/);
  assert.match(edit, /ask them to confirm that/);
  assert.match(edit, /it can run up to a year longer/);
  // The design's placeholder address is never offered for pasting into a pay service.
  const placeholder = draw([thanks], { editable: true, site: { ...SITE, url: 'https://your-domain.com' } });
  assert.ok(!placeholder.includes('your-domain.com') && placeholder.includes('your website’s address with /thank-you/ on the end'));
  const live = draw([cancel, thanks]);
  assert.ok(!live.includes('cb-role-guide') && !live.includes('legal advice'));
  // A section with an ordinary role, or one named after something built in, has no guide.
  assert.ok(!draw([{ ...cancel, role: 'constructor' }], { editable: true }).includes('cb-role-guide'));
});

// Review 2 minor (23 Nov): the consumer guide sits beside the consumer sample only.
test('an NHS practice or plain terms for organisations get a short guide of their own, not the consumer one', () => {
  const nhs = { id: 'c2', type: 'faq', role: 'cancel', variant: 'list', data: { heading: 'Moving or cancelling', items: [{ question: 'How do I move or cancel?', answer: 'Cancel in the NHS App or online and book a new time, or call us to cancel or move it.' }] } };
  const org = { id: 'c3', type: 'faq', role: 'cancel', variant: 'list', data: { heading: 'Moving or ending the work', items: [{ question: 'Fees and deposits', answer: 'Your engagement letter sets out our fees.' }] } };
  const a = draw([nhs], { editable: true }), b = draw([org], { editable: true });
  for (const h of [a, b]) { assert.match(h, /cb-role-guide/); assert.doesNotMatch(h, /14 days|consumers/); }
  assert.match(a, /how patients move or cancel appointments with your practice/);
  assert.match(b, /in line with your engagement letter/);
  assert.ok(!draw([nhs, org]).includes('cb-role-guide'));
});

test('an older page with none of this draws exactly as before', () => {
  const blocks = [
    { type: 'plans', variant: 'cards', data: { items: [{ name: 'Session', price: '£60', pay: { label: 'Pay now', href: '' } }] } },
    { type: 'spaces', variant: 'rows', data: { items: [{ name: 'Class', date: '2026-12-01', time: '6pm', capacity: 8, left: 3 }] } },
    { type: 'bookstrip', variant: 'strip', data: { items: [{ name: 'Session', price: '£60' }] } },
    { type: 'contact', variant: 'card', data: { business: true } },
  ];
  const html = draw(blocks);
  for (const c of ['cb-paysafe', 'cb-thenpay', 'cb-paid', 'cb-pl-manage', 'cb-sp-zone', 'cb-remind', 'cb-spam', 'cb-role-guide']) assert.ok(!html.includes(c), c);
});

test('ways to pay: a card whose price asks leads to Contact; other words keep Book or Call (walk and review, 23 Nov)', () => {
  const plans = (price) => ({ type: 'plans', variant: 'cards', data: { items: [{ name: 'Clubs and teams', price }] } });
  const site = { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) };
  for (const price of ['Ask', 'Ask for a quote', 'Quote', 'quoted', 'POA', 'On request', 'TBC', '', '  ']) {
    assert.match(draw([plans(price)], site), /<a class="cb-btn cb-btn-2 cb-pl-pay" href="\/contact\/"[^>]*>Get in touch<\/a>/, price);
  }
  for (const price of ['Free', 'Card', 'Card, when you book', 'Insured', '£150', 'From £50', 'Basket', 'Taskforce']) {
    assert.match(draw([plans(price)], site), /href="\/appointments\/"[^>]*>Book<\/a>/, price);
    assert.match(draw([plans(price)]), /href="tel:01632960123"[^>]*>Call 01632 960 123<\/a>/, `${price}, phone only`);
  }
});
test('Pay when you book is said once, even on pages saved from the earlier samples (review, 23 Nov)', () => {
  const BOOKS = { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) };
  for (const note of ['You pay when you book. Move or cancel up to 24 hours before at no cost.', 'You pay for a power hour when you book. Move it up to 48 hours before at no cost.']) {
    const html = draw([{ type: 'bookstrip', variant: 'strip', data: { heading: 'Book', note, items: [{ name: 'A', price: '£35', paid: true }, { name: 'B', price: '£55', paid: true }] } }], BOOKS);
    assert.equal((html.match(/when you book/gi) || []).length - (html.match(/Pay when you book<\/span>/g) || []).length, 1, note);
    assert.ok(!html.includes('cb-bs-paid'));
  }
});
test('a form note: only "through this form" and "in this form" change with no form (review, 23 Nov)', () => {
  const note = (n) => draw([{ type: 'form', variant: 'split', data: { heading: 'Send', note: n } }], { site: withPro({ email: 'sam@example.com' }) });
  assert.ok(note('Using this form is fine.').includes('Using this form is fine.'));
  assert.ok(note('Please send nothing private in this form.').includes('in your email.'));
});

test('a Full date offers the waiting list by email with its name, or a call (newcomer walk, 23 Nov)', () => {
  const full = (extra) => ({ type: 'spaces', variant: 'rows', data: { items: [{ name: 'Foam rolling', date: '2026-12-03', time: '6pm', capacity: 8, left: 0, ...extra }] } });
  const both = withPro({ email: 'sam@example.com' });
  const mail = draw([full({ waitlist: { label: 'Join the waiting list', href: '@email' } })], { site: both });
  assert.ok(mail.includes('href="mailto:sam@example.com?subject=Waiting%20list%3A%20Foam%20rolling%2C%20Thursday%203%20December"') && mail.includes('>Join the waiting list</a>'));
  const call = draw([full({ waitlist: { label: 'Join the waiting list', href: '@email' } })]);
  assert.match(call, /href="tel:01632960123">Call 01632 960 123 to join the waiting list<\/a>/);
  const ask = draw([full({})], { site: both });
  assert.ok(ask.includes('>Email to ask about a space</a>'), 'no waiting list link: still a way to ask');
  assert.match(draw([full({})]), />Call 01632 960 123 to ask about a space<\/a>/);
  assert.ok(draw([full({ waitlist: { label: 'Join', href: '/contact/' } })]).includes('href="/contact/"'), 'an own link is kept');
});

test('a calendar that does not load has words and links ready to show (newcomer walk, 23 Nov)', () => {
  const html = draw([{ type: 'booking', variant: 'calendar', data: { heading: 'Book' } }], { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) });
  assert.match(html, /<p class="cb-booking-fail" hidden>The calendar did not load\. <a href="https:\/\/cal\.com\/sam\/massage" rel="noopener">Open booking in a separate page<\/a>, or call <a href="tel:01632960123">01632 960 123<\/a>\.<\/p>/);
});

test('with no form, the form section’s note speaks of email, not of a form (newcomer walk, 23 Nov)', () => {
  const form = { type: 'form', variant: 'split', data: { heading: 'Send a message', note: 'Please do not send health details, or anything urgent, through this form.' } };
  const html = draw([form], { site: withPro({ email: 'sam@example.com' }) });
  assert.ok(html.includes('Please do not send health details, or anything urgent, by email.') && !html.includes('this form'));
  const withForm = draw([form], { site: withPro({ email: 'sam@example.com' }), formEndpoint: 'https://formspree.io/f/abcd' });
  assert.ok(withForm.includes('through this form'));
});

test('a dark page gives a tinted footer (Woodland) a tint of its own colours, with readable words; light pages as before (review, 23 Nov)', async () => {
  const { pageCss, pageColours, contrast } = await import('./render.mjs');
  const dark = { colours: { bg: '#12251f', ink: '#f3efe6', accent: '#f4a77e' } };
  const tint = pageCss({ look: dark, blocks: [] }).match(/--footer-tint:(#[0-9a-f]{6})/)?.[1];
  assert.ok(tint && contrast(pageColours(dark).dim, tint) >= 4.5, tint);
  assert.ok(!pageCss({ look: { colours: { bg: '#eef1e8', ink: '#1e2a22', accent: '#3d5a40' } }, blocks: [] }).includes('--footer-tint'));
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../../styles/themes/woodland-chronicle.css', import.meta.url), 'utf8'), /\.site-footer \{[^}]*background:var\(--footer-tint, rgba\(238,240,223,\.45\)\)/);
});

test('a price asks only with no digit and a way of asking, as whole words (review 2, 23 Nov)', async () => {
  const { asksPrice } = await import('./render.mjs');
  for (const p of ['', '  ', 'Ask', 'ask us', 'Quote', 'Get a quote', 'Quoted', 'Quotation', 'POA', 'P.O.A.', 'p.o.a', 'Price on application', 'On request', 'Price on request', 'TBC', 'To be confirmed', 'Enquire', 'Enquire for price']) assert.equal(asksPrice(p), true, p);
  for (const p of ['Free', 'Card', 'Card, when you book', 'Insured', '£0', 'From £50', '£50 (ask about concessions)', '£45 TBC', 'Tasks', 'Basket', 'Taskforce', 'Enquired']) assert.equal(asksPrice(p), false, p);
});
test('ways to pay: the card’s own button words when it has no pay link, never guessed (app walk, 24 Nov)', () => {
  const plans = (x) => ({ type: 'plans', variant: 'rows', data: { items: [{ name: 'Block of five', price: '£250', ...x }] } });
  const books = { site: withPro({ bookingUrl: 'https://cal.com/sam/massage' }) };
  assert.match(draw([plans({ act: 'ask' })], books), /href="\/contact\/"[^>]*>Ask about this<\/a>/);
  assert.match(draw([plans({ act: 'contact' })], books), /href="\/contact\/"[^>]*>Get in touch<\/a>/);
  assert.match(draw([plans({ act: 'join' })], books), /href="\/appointments\/"[^>]*>Join<\/a>/);
  assert.match(draw([plans({ act: 'buy' })], books), /href="\/appointments\/"[^>]*>Buy<\/a>/);
  assert.match(draw([plans({ act: 'join' })]), /href="\/contact\/"[^>]*>Join<\/a>/, 'phone only: Join goes to Contact, never rings');
  assert.match(draw([plans({})], books), /href="\/appointments\/"[^>]*>Book<\/a>/, 'no choice: as before');
  assert.match(draw([plans({ name: 'Monthly', act: 'book' })], books), /href="\/appointments\/"[^>]*>Book<\/a>/, 'the words are not guessed from the name');
  // With a pay link the pay button wins, with its own words.
  assert.match(draw([plans({ act: 'ask', pay: { label: 'Join', href: STRIPE } })], books), /<a class="cb-btn cb-pl-pay" href="https:\/\/buy\.stripe\.com\/aEU5kC0n9"[^>]*>Join<\/a>/);
  // Ask at reception and No button still win over the card's words.
  const block = (unpaid) => ({ type: 'plans', variant: 'rows', data: { unpaid, items: [{ name: 'Block', price: '£250', act: 'join' }] } });
  assert.match(draw([block('ask')], books), /Ask at reception/);
  assert.doesNotMatch(draw([block('none')], books), />Join</);
});
