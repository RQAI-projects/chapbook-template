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
  const paid = draw([row({ pay: { label: 'Pay now', href: STRIPE }, paid: true })]);
  assert.ok(paid.includes(`<span class="cb-paid">${PAY_WHEN_BOOK}</span>`) && !paid.includes('cb-order-pay') && !paid.includes('Pay now') && !paid.includes('cb-thenpay'));
  const zoned = draw([row({})], { site: withPro({ zoneLabel: 'UK time' }) });
  assert.match(zoned, /<span class="cb-sp-time">6pm <span class="cb-sp-zone">UK time<\/span><\/span>/);
  assert.ok(!draw([row({})]).includes('cb-sp-zone'), 'no zone until one is set');
  assert.equal(needsSignature(row({ paid: true })), true);
});

test('a booking item can say Pay when you book', () => {
  const strip = (v) => ({ type: 'bookstrip', variant: v, data: { heading: 'Book', items: [{ name: 'Sports massage', duration: '60 min', price: '£55', paid: true }, { name: 'Follow-up', duration: '30 min' }] } });
  for (const v of ['strip', 'cards']) {
    const html = draw([strip(v)]);
    assert.equal((html.match(/<span class="cb-paid">Pay when you book<\/span>/g) || []).length, 1, v);
  }
  const edit = draw([{ ...strip('strip'), id: 'b1' }], { editable: true });
  assert.ok(edit.includes('cb-paid'));
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
  assert.equal(professionalDetails({ reminders: 'yes' }).reminders, false, 'only a real tick counts');
  assert.equal(professionalDetails({ reminders: true }).reminders, true);
  assert.equal(professionalDetails({ zoneLabel: '  UK time  ' }).zoneLabel, 'UK time');
});

test('a contact section says where to look when a confirmation email does not arrive, once there is a booking page', () => {
  const contact = { type: 'contact', variant: 'card', data: { heading: 'Contact', business: true } };
  assert.ok(!draw([contact]).includes('cb-spam'), 'no booking page, no line: the page draws as before');
  assert.ok(draw([contact], { site: withPro({ bookingUrl: 'https://cal.com/sam/session' }) }).includes('<p class="cb-small cb-spam">No email? Check your spam folder, or call us.</p>'));
  assert.ok(draw([contact], { site: { ...SITE, professional: { bookingUrl: 'https://cal.com/sam/session' } } }).includes('No email? Check your spam folder.</p>'));
});

test('guides for the cancelling words and the thank-you page show in the editor only', () => {
  const cancel = { id: 'c1', type: 'faq', role: 'cancel', variant: 'list', data: { heading: 'Cancelling', items: [{ question: 'Can I move my booking?', answer: 'Yes.' }] } };
  const thanks = { id: 't1', type: 'hero', role: 'thanks', variant: 'minimal', data: { heading: 'Thank you' } };
  const edit = draw([cancel, thanks], { editable: true });
  assert.match(edit, /not legal advice/);
  assert.match(edit, /https:\/\/test\.example\/thank-you\//);
  const live = draw([cancel, thanks]);
  assert.ok(!live.includes('cb-role-guide') && !live.includes('legal advice'));
  // A section with an ordinary role, or one named after something built in, has no guide.
  assert.ok(!draw([{ ...cancel, role: 'constructor' }], { editable: true }).includes('cb-role-guide'));
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
