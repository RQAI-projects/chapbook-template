import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFromHome, pageFromAbout } from './migrate.mjs';
import { renderPage } from './render.mjs';
import { BUSINESS_LAYOUTS } from '../business/render.mjs';

const professional = {
  eyebrow: 'Family bakery since 1998', heading: 'Bread worth the queue', intro: 'Sourdough, buns and coffee on Ashley Road.',
  announcement: 'Closed Mondays in January', location: '12 Ashley Road, Poole', hours: 'Tue–Sat 7–3', email: 'hi@crumb.example', phone: '01202 111 222',
  bookingUrl: 'https://cal.com/crumb/order', bookingLabel: 'Order a cake', paymentUrl: 'https://buy.stripe.com/abc', paymentLabel: 'Pay a deposit',
  story: 'We started in a garage.\n\nNow we bake every night.', storyTitle: 'How we started',
  heroImage: { src: '/site-images/hero.jpg', alt: 'Loaves' }, gallery: [{ src: '/site-images/g1.jpg', alt: 'Buns' }],
  services: [{ name: 'Sourdough', price: '£4.50', description: 'Long ferment.', paymentUrl: 'https://buy.stripe.com/x', promoCode: 'JAN10' }, { name: 'Birthday cake', price: 'from £35', bookingUrl: 'https://cal.com/crumb/cake' }],
  credentials: ['5 star hygiene rating'],
};

test('every business design converts with nothing lost', () => {
  for (const theme of BUSINESS_LAYOUTS) {
    const page = pageFromHome({ name: 'Crumb', defaultTheme: theme, professional }, theme);
    const all = JSON.stringify(page);
    for (const must of ['Bread worth the queue', 'Sourdough', 'Birthday cake', '£4.50', 'We started in a garage.', 'Closed Mondays', '5 star hygiene rating', '/site-images/hero.jpg', '/site-images/g1.jpg', 'Order a cake', 'Pay a deposit', 'prefilled_promo_code=JAN10']) assert.ok(all.includes(must), `${theme}: ${must}`);
    assert.equal(page.slug, 'home');
    assert.equal(page.blocks[0].type, 'notice');
    assert.equal(page.blocks[1].type, 'hero');
    const html = renderPage(page, { site: { professional } });
    assert.ok(html.includes('Bread worth the queue'), theme);
  }
});

test('hidden sections are kept aside, not dropped', () => {
  const design = { sections: [{ id: 'services', on: false }, { id: 'story', on: false }] };
  const page = pageFromHome({ defaultTheme: 'clinic', professional, design }, 'clinic');
  assert.ok(!page.blocks.some((b) => b.type === 'services'));
  assert.ok(page.spare.some((b) => b.type === 'services'));
  assert.ok(page.spare.some((b) => b.role === 'story'));
});

test('the writer\'s own section titles are kept', () => {
  const design = { sections: [{ id: 'services', title: 'Our bakes' }] };
  const page = pageFromHome({ defaultTheme: 'table', professional, design }, 'table');
  assert.equal(page.blocks.find((b) => b.type === 'services').data.heading, 'Our bakes');
});

test('a personal site converts too', () => {
  const page = pageFromHome({ name: 'Sam', masthead: 'Sam Rivers', tagline: 'Notes on rivers', defaultTheme: 'observatory' }, 'observatory');
  assert.equal(page.blocks[0].type, 'hero');
  assert.equal(page.blocks[0].data.heading, 'Sam Rivers');
});

test('About keeps the profile and any lists', () => {
  const profile = { name: 'Dr Maya Okafor', role: 'Physiotherapist', tagline: 'Shoulders and knees', bio: ['First para.', 'Second para.'], stats: [{ value: 15, suffix: '+', label: 'years' }], memberships: ['CSP'] };
  const page = pageFromAbout(profile, { name: 'Harbour' }, { experience: [{ role: 'Lead', place: 'Navy', dates: '2010–2015' }] });
  const all = JSON.stringify(page);
  for (const must of ['Dr Maya Okafor', 'Physiotherapist', 'First para.\\n\\nSecond para.', '15+', 'CSP', 'Lead, Navy, 2010–2015']) assert.ok(all.includes(must), must);
  const empty = pageFromAbout({ name: 'Your Name', bio: ['A short paragraph about who you are and what this blog is for.'] }, { name: 'Crumb' });
  assert.ok(!JSON.stringify(empty).includes('A short paragraph'), 'starter placeholders are not carried over');
});
