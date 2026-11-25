// Your services (round C): cards linked to the one list in site.json, professional.services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, linkServices, serviceChoices, servicesOf } from './render.mjs';
import { normalisePage, linksServices, serviceKey } from './schema.mjs';
import { professionalDetails } from '../professional.mjs';

const LIST = [
  { id: 'kn30', name: 'Sports massage', duration: '30 min', price: '£35' },
  { id: 'kn60', name: 'Sports massage', duration: '60 min', price: '£58', bookingUrl: 'https://cal.com/joe/sixty?duration=60#x', paymentUrl: 'https://buy.stripe.com/abc', payLabel: 'Pay now', promoCode: 'JAN10', paid: true },
  { id: 'kn90', name: 'Sports massage', duration: '90 min', price: '£75', act: 'ask' },
  { id: 'mo', name: 'Monthly', price: '£50', paymentUrl: 'https://buy.stripe.com/mo', payLabel: 'Join', manage: 'https://billing.stripe.com/p/login/abc', act: 'join' },
];
const SITE = { name: 'Kneadwell', professional: { phone: '01632 960 123', bookingUrl: 'https://cal.com/joe', services: LIST } };
const C = (site = SITE, editable = false) => ({ biz: professionalDetails(site.professional), editable });
const block = (type, items, variant = 'cards') => normalisePage({ v: 1, blocks: [{ id: 'b', type, variant, data: { heading: 'H', items } }] }).blocks[0];
const draw = (blocks, o = {}) => renderPage({ v: 1, slug: 'home', blocks }, { site: SITE, today: '2026-11-25', ...o });

test('the list keeps what a card needs: id, button words, Pay when you book, manage link, links as typed', () => {
  const p = professionalDetails(SITE.professional);
  assert.equal(p.services.length, 4);
  assert.deepEqual([p.services[1].id, p.services[1].paid, p.services[1].bookingTyped], ['kn60', true, 'https://cal.com/joe/sixty?duration=60#x']);
  assert.equal(p.services[2].act, 'ask');
  assert.equal(p.services[3].manage, 'https://billing.stripe.com/p/login/abc');
  // Up to 60 services (the standard pages took 30).
  assert.equal(professionalDetails({ services: Array.from({ length: 70 }, (_, i) => ({ name: `S${i}` })) }).services.length, 60);
  // Keys: the id, or the place in the list for a service written before ids.
  assert.deepEqual([...servicesOf(professionalDetails({ services: [{ name: 'A' }, { id: 'bb', name: 'B' }, { name: 'C' }] })).keys()], ['n1', 'bb', 'n3']);
  assert.equal(serviceKey({ id: 'Bad id' }, 4), 'n5');
});

test('a linked card takes name, length, price and links from the list; its own words stay', () => {
  const b = linkServices(block('services', [{ service: 'kn60', description: 'Firm', link: { label: 'About', href: '/about/' } }]), C());
  const x = b.data.items[0];
  assert.deepEqual([x.name, x.duration, x.price, x.description], ['Sports massage', '60 min', '£58', 'Firm']);
  assert.equal(x.pay.href, 'https://buy.stripe.com/abc?prefilled_promo_code=JAN10');
  // Round C review P1: a card's own link (a page, a call) and its words stay the card's own.
  assert.deepEqual(x.link, { label: 'About', href: '/about/' });
  for (const own of ['@phone', '/conditions/', 'mailto:hi@example.com']) assert.equal(linkServices(block('services', [{ service: 'kn60', link: { label: 'Go', href: own } }]), C()).data.items[0].link.href, own);
  // Only a Book that goes to the booking takes the service's own booking link, exactly as typed.
  const y = linkServices(block('services', [{ service: 'kn60', link: { label: 'Book a massage', href: '@booking' } }]), C()).data.items[0];
  assert.deepEqual(y.link, { label: 'Book a massage', href: 'https://cal.com/joe/sixty?duration=60#x' });
  // Without one of its own the card goes to the booking as before.
  assert.equal(linkServices(block('services', [{ service: 'kn30', link: { label: 'Book', href: '@booking' } }]), C()).data.items[0].link.href, '@booking');
});

test('a booking strip choice books the service; Pay when you book comes from the list', () => {
  const b = linkServices(block('bookstrip', [{ service: 'kn30' }, { service: 'kn60' }], 'strip'), C());
  assert.equal(b.data.items[0].link, undefined);
  assert.deepEqual(b.data.items[1].link, { label: 'Book', href: 'https://cal.com/joe/sixty?duration=60#x' });
  assert.equal(b.data.items[1].paid, true);
  const html = draw([block('bookstrip', [{ service: 'kn30' }, { service: 'kn60' }], 'strip')]);
  assert.match(html, /data-href="\/appointments\/#book-svc-kn60"/);
  assert.deepEqual(serviceChoices(SITE).map((c) => [c.key, c.name, c.target.href]), [['book-svc-kn60', 'Sports massage, 60 min', 'https://cal.com/joe/sixty?duration=60#x']]);
});

test('ways to pay: one service in several lengths shows the length as the heading; button words and manage link from the list', () => {
  const b = linkServices(block('plans', [{ service: 'kn30', per: 'a session' }, { service: 'kn60' }, { service: 'kn90' }], 'ladder'), C());
  assert.deepEqual(b.data.items.map((x) => x.name), ['30 minutes', '60 minutes', '90 minutes']);
  assert.equal(b.data.items[0].per, 'a session');
  assert.equal(b.data.items[2].act, 'ask');
  const m = linkServices(block('plans', [{ service: 'mo' }, { name: 'Clubs and teams', price: 'Ask' }]), C()).data.items;
  assert.deepEqual([m[0].name, m[0].act, m[0].pay.label, m[0].manage.href], ['Monthly', 'join', 'Join', 'https://billing.stripe.com/p/login/abc']);
  // A typed card beside a linked one is drawn as typed.
  assert.deepEqual({ ...m[1], id: '' }, { ...block('plans', [{ name: 'Clubs and teams', price: 'Ask' }]).data.items[0], id: '' });
});

test('a summary card works out "From" and the lengths from the services it covers, so it cannot go stale', () => {
  const x = linkServices(block('services', [{ services: ['kn60', 'kn30', 'kn90'], description: 'Firm work' }], 'flip'), C()).data.items[0];
  assert.deepEqual([x.name, x.duration, x.price], ['Sports massage', '30 to 90 min', 'From £35']);
  const cheaper = { ...SITE, professional: { ...SITE.professional, services: LIST.map((s) => (s.id === 'kn30' ? { ...s, price: '£32' } : s)) } };
  assert.equal(linkServices(block('services', [{ services: ['kn60', 'kn30', 'kn90'] }], 'flip'), C(cheaper)).data.items[0].price, 'From £32');
  // Different names: the card's own name stays.
  assert.equal(linkServices(block('services', [{ services: ['kn30', 'mo'], name: 'Everything' }]), C()).data.items[0].name, 'Everything');
});

test('values are cleaned to the section\'s own lengths (round C review P3)', () => {
  const long = { ...SITE, professional: { services: [{ id: 'l', name: 'N'.repeat(100), price: 'P'.repeat(80) }] } };
  const x = linkServices(block('plans', [{ service: 'l' }]), C(long)).data.items[0];
  assert.equal(x.name.length, 60);
  assert.equal(x.price.length, 40);
});

test('a card whose service was removed: nothing on the website, a plain line in the editor', () => {
  const b = block('services', [{ service: 'gone' }, { name: 'Typed', price: '£1' }]);
  assert.equal(linkServices(b, C()).data.items.length, 1);
  assert.match(linkServices(b, C(SITE, true)).data.items[0].name, /removed from Your services/);
});

test('in the editor the list values open the service; the card\'s own words are typed in place', () => {
  const html = draw([block('services', [{ service: 'kn60', description: 'Firm' }], 'menu')], { editable: true });
  assert.match(html, /data-cb-svc="b:items\.0"[^>]*>Sports massage</);
  assert.match(html, /data-cb-svc="b:items\.0"[^>]*>£58</);
  assert.match(html, /data-cb="b:items\.0\.description"/);
  assert.doesNotMatch(html, /data-cb="b:items\.0\.(name|price|duration)"/);
});

test('a page with a linked card needs the design that knows the list (release 8)', () => {
  assert.equal(linksServices(block('services', [{ service: 'kn60' }])), true);
  assert.equal(linksServices(block('services', [{ name: 'Typed' }])), false);
  // A page without linked cards draws exactly as before.
  const typed = [block('services', [{ name: 'Sports massage', price: '£35', duration: '30 min' }], 'menu')];
  assert.equal(draw(typed), renderPage({ v: 1, slug: 'home', blocks: typed }, { site: { ...SITE, professional: { ...SITE.professional, services: [] } }, today: '2026-11-25' }));
});

test('round C build review S6: a linked card keeps its look, the length in its own place, in the heading or not shown', () => {
  const b = linkServices(block('services', [{ service: 'kn30', lengthShows: 'heading' }, { service: 'kn60', lengthShows: 'hidden' }, { service: 'kn90' }], 'board'), C());
  assert.deepEqual(b.data.items.map((x) => [x.name, x.duration ?? '']), [['Sports massage, 30 minutes', ''], ['Sports massage', ''], ['Sports massage', '90 min']]);
  // Ways to pay: the length heading rule stands; "hidden" keeps the name.
  const p = linkServices(block('plans', [{ service: 'kn30' }, { service: 'kn60', lengthShows: 'hidden' }]), C());
  assert.deepEqual(p.data.items.map((x) => x.name), ['30 minutes', 'Sports massage']);
});

test('round C build review S2 and minor 3: a summary card keeps a name; From only from plain amounts in one currency', () => {
  const renamed = { ...SITE, professional: { ...SITE.professional, services: LIST.map((s) => (s.id === 'kn30' ? { ...s, name: 'Short sports massage' } : s)) } };
  assert.equal(linkServices(block('services', [{ services: ['kn30', 'kn60'], name: 'Sports massage' }], 'flip'), C(renamed)).data.items[0].name, 'Sports massage', 'its own name');
  assert.equal(linkServices(block('services', [{ services: ['kn30', 'kn60'] }], 'flip'), C(renamed)).data.items[0].name, 'Short sports massage', 'else the first service\'s');
  const odd = (prices, own) => linkServices(block('services', [{ services: ['a', 'b'], name: 'X', ...(own ? { price: own } : {}) }], 'flip'), C({ professional: { services: [{ id: 'a', name: 'A', price: prices[0], duration: '30 mins' }, { id: 'b', name: 'B', price: prices[1], duration: '60 min' }] } })).data.items[0];
  assert.equal(odd(['Two for £50', '£35'], 'From £35').price, 'From £35', 'the card\'s own words');
  assert.equal(odd(['€30', '£35']).price, undefined, 'never across currencies');
  assert.equal(odd(['£30', '£35']).price, 'From £30');
  assert.equal(odd(['£30', '£35']).duration, '30 to 60 mins', '"30 mins" and "60 min" are one unit');
});

test('round C build review minor 6: an id of the form n<number> is refused', () => {
  const p = professionalDetails({ services: [{ id: 'n2', name: 'A' }, { name: 'B' }] });
  assert.equal(p.services[0].id, undefined);
  assert.deepEqual([...servicesOf(p).keys()], ['n1', 'n2']);
  assert.equal(serviceKey({ id: 'n7' }, 0), 'n1');
});

test('round C2 re-review minors 5 and 10: a linked card says what it cut and when it shows no price', () => {
  const C = { biz: { services: [{ id: 'sa', name: 'Sports massage for runners after a long race in the hills', duration: '30 min', price: '£35' }, { id: 'sb', name: 'B', duration: '60 min', price: 'Ask' }] } };
  const b = (items, type = 'plans') => ({ id: 'p', type, data: { items } });
  assert.deepEqual(linkServices(b([{ service: 'sa', lengthShows: 'heading' }]), C).data.items[0]._cut, [{ field: 'name', max: 60 }]);
  assert.equal(linkServices(b([{ service: 'sa' }]), C).data.items[0]._cut, undefined);
  assert.equal(linkServices(b([{ services: ['sa', 'sb'] }], 'services'), C).data.items[0]._noPrice, true);
  assert.equal(linkServices(b([{ services: ['sa', 'sb'], price: 'Ask us' }], 'services'), C).data.items[0]._noPrice, undefined);
});
