import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBusinessHome, designDetails, designCss, effectiveColours, contrast, readableOn, BUSINESS_LAYOUTS, serviceMenuHtml, defaultTitles } from './render.mjs';
import { safeImage, paymentHref, professionalDetails, safeNavHref } from '../professional.mjs';

const full = { eyebrow: 'E', heading: 'Heading', intro: 'Intro', location: 'Loc', hours: 'Hours', email: 'a@b.co', phone: '+44 1', bookingUrl: 'https://cal.com/a/b', announcement: 'Sale on', story: 'Para one.\n\nPara two.', credentials: ['Cred'],
  heroImage: { src: '/site-images/hero.webp', alt: 'Front' }, gallery: [{ src: '/site-images/g1.webp', alt: 'One' }],
  services: [{ name: 'Svc', description: 'D', price: '£5', duration: '1h', offer: '20% off', promoCode: 'SAVE20', paymentUrl: 'https://buy.stripe.com/abc', payLabel: 'Buy', image: { src: '/site-images/s.webp', alt: 'S' } }] };
const page = (theme, extra = {}) => renderBusinessHome({ theme, site: { name: 'N', masthead: 'N', tagline: 'T', professional: full, ...extra }, posts: [{ href: '/p/', title: 'Post', dateLabel: 'Today' }] });

test('all twelve layouts show every kind of content', () => {
  assert.equal(BUSINESS_LAYOUTS.length, 12);
  for (const t of BUSINESS_LAYOUTS) {
    const h = page(t);
    for (const want of ['Heading', 'Svc', '£5', '20% off', 'SAVE20', 'prefilled_promo_code=SAVE20', 'Buy', '/site-images/hero.webp', '/site-images/g1.webp', '/site-images/s.webp', 'Sale on', 'Para two.', 'Cred', 'Post', 'Hours']) assert.ok(h.includes(want), `${t} lacks ${want}`);
  }
});

test('sections can be hidden, reordered and retitled', () => {
  const on = page('table', { design: { sections: [{ id: 'services', title: 'Food' }, { id: 'photos' }, { id: 'news', on: false }, { id: 'trust', on: false }] } });
  assert.ok(on.includes('Food') && !on.includes('The menu'));
  assert.ok(on.indexOf('Food') < on.indexOf('g1.webp'));
  assert.ok(!on.includes('Post') && !on.includes('Cred'));
});

test('turning hours off also hides them where they sit inside the opening', () => {
  for (const t of ['trade', 'clinic', 'contour', 'practice']) {
    assert.ok(page(t).includes('Hours'), t);
    assert.ok(!page(t, { design: { sections: [{ id: 'info', on: false }] } }).includes('Hours'), t);
  }
});

test('empty details stay hidden and nothing is invented', () => {
  for (const t of BUSINESS_LAYOUTS) {
    const h = renderBusinessHome({ theme: t, site: { name: 'N', masthead: 'M', tagline: 'T' } });
    for (const bad of ['pro-gallery', 'pro-story', 'pro-banner', 'pro-hero-photo', 'undefined', 'null', 'pro-price']) assert.ok(!h.includes(bad), `${t}: ${bad}`);
    assert.ok(h.includes('M'));
  }
});

test('everything a writer types is escaped', () => {
  const x = '<script>alert(1)</script>"\'';
  const h = renderBusinessHome({ theme: 'table', site: { name: x, masthead: x, tagline: x, professional: { heading: x, intro: x, hours: x, location: x, announcement: x, story: x, credentials: [x], services: [{ name: x, description: x, price: x, offer: x, duration: x }], gallery: [{ src: '/site-images/a.webp', alt: x }] }, design: { sections: [{ id: 'services', title: x }] } } });
  assert.ok(!h.includes('<script>'));
});

test('unsafe links and pictures are dropped', () => {
  assert.equal(safeImage('javascript:alert(1)'), null);
  assert.equal(safeImage({ src: '/etc/passwd' }), null);
  assert.equal(safeImage({ src: '/site-images/../x.webp' }), null);
  assert.equal(safeImage({ src: 'data:text/html;base64,AAAA' }), null);
  assert.deepEqual(safeImage({ src: '/site-images/a-1.webp', alt: 'A' }), { src: '/site-images/a-1.webp', alt: 'A' });
  const p = professionalDetails({ paymentUrl: 'http://x.test', services: [{ name: 'A', paymentUrl: 'javascript:alert(1)', promoCode: 'a b' }] });
  assert.equal(p.paymentUrl, ''); assert.equal(p.services[0].paymentUrl, ''); assert.equal(p.services[0].promoCode, '');
});

test('a promotion code only reaches Stripe links', () => {
  assert.equal(paymentHref({ paymentUrl: 'https://buy.stripe.com/x', promoCode: 'A1' }), 'https://buy.stripe.com/x?prefilled_promo_code=A1');
  assert.equal(paymentHref({ paymentUrl: 'https://pay.example.com/x', promoCode: 'A1' }), 'https://pay.example.com/x');
  assert.equal(paymentHref({}), '');
});

test('design values are validated and buttons stay readable', () => {
  assert.equal(designCss({ accent: 'red;}body{display:none' }), '');
  assert.equal(designCss({ font: 'x', corners: 'x' }), '');
  assert.equal(designCss({ font: 'constructor', corners: '__proto__' }), '');
  assert.equal(renderBusinessHome({ theme: 'constructor', site: {} }), '');
  assert.equal(readableOn('#777777'), '#000000');
  assert.ok(contrast(readableOn('#c8553d'), '#c8553d') >= 4.5);
  assert.match(designCss({ accent: '#a33b1e' }), /html\[data-blog-theme\]\[data-blog-theme\]\{[^}]*--accent:#a33b1e/);
  assert.equal(readableOn('#f2b705'), '#16181d');
  assert.equal(readableOn('#1d3a5f'), '#ffffff');
  assert.equal(designDetails({ sections: [{ id: 'nope' }, { id: 'news' }, { id: 'news' }] }).sections.filter((s) => s.id === 'news').length, 1);
});

test('the appointment page menu shows offers and payments too', () => {
  const h = serviceMenuHtml(professionalDetails(full).services);
  assert.ok(h.includes('Buy') && h.includes('20% off'));
});

test('each trade starts in its natural order, and the writer can change it', () => {
  const h = page('table');
  assert.ok(h.indexOf('Hours') < h.indexOf('The menu'));
  const moved = page('table', { design: { sections: [{ id: 'services' }, { id: 'info' }] } });
  assert.ok(moved.indexOf('The menu') < moved.indexOf('class="table-facts"'));
});

test('picture data never reaches a published page, only the preview', () => {
  const D = 'data:image/png;base64,QUJD';
  assert.equal(safeImage(D), null);
  assert.deepEqual(safeImage(D, true), { src: D, alt: '' });
  const site = { name: 'N', professional: { heroImage: D, gallery: [{ src: D }], services: [{ name: 'S', image: D }] } };
  assert.ok(!renderBusinessHome({ theme: 'table', site }).includes('data:image'));
  assert.ok(renderBusinessHome({ theme: 'table', site, allowDataImages: true }).includes('data:image'));
});

test('every section heading a writer sets is shown, in every layout', () => {
  for (const t of BUSINESS_LAYOUTS) for (const id of ['services', 'photos', 'story', 'trust', 'news', 'info']) {
    const h = page(t, { design: { sections: [{ id, title: 'MYTITLE' }] } });
    const inOpening = id === 'info' && ['trade', 'clinic', 'practice', 'contour'].includes(t);
    if (!inOpening) assert.ok(h.includes('>MYTITLE<') || h.includes('MYTITLE '), `${t} ${id}`);
  }
});

test('neighbouring sections pair up even with a hidden one between them', () => {
  const site = { name: 'N', professional: { hours: 'H', services: [{ name: 'S' }] } };
  assert.ok(renderBusinessHome({ theme: 'cut', site }).includes('class="cut-body"'));
  assert.ok(renderBusinessHome({ theme: 'cut', site: { ...site, design: { sections: [{ id: 'services' }, { id: 'story', on: false }, { id: 'info' }] } } }).includes('class="cut-body"'));
});

test('a phone or email alone is shown, never a bare heading', () => {
  for (const t of BUSINESS_LAYOUTS) {
    const h = renderBusinessHome({ theme: t, site: { name: 'N', professional: { phone: '+44 1234', email: 'a@b.co' } } });
    assert.ok(h.includes('+44 1234'), `${t} phone`);
  }
  const empty = renderBusinessHome({ theme: 'clinic', site: { name: 'N' } });
  assert.ok(!empty.includes('clinic-panel'));
});

test('partly changed colours stay readable', () => {
  const clinic = { bg: '#f6fafb', ink: '#12303a', accent: '#0f6e84' };
  const dark = effectiveColours({ background: '#101010' }, clinic);
  assert.ok(contrast(dark.ink, dark.background) >= 4.5);
  assert.ok(contrast(dark.accentText, dark.background) >= 4.5);
  const yellow = effectiveColours({ accent: '#ffee00' }, clinic);
  assert.ok(contrast(yellow.accentText, yellow.background) >= 4.5);
  assert.match(designCss({ accent: '#ffee00' }, clinic), /--pro-button-ink:#16181d/);
  assert.match(designCss({ background: '#101010' }, clinic), /--bg-3:color-mix/);
});

test('menu links stay on the site or use https', () => {
  assert.equal(safeNavHref('/about/'), '/about/');
  assert.equal(safeNavHref('https://x.test/a'), 'https://x.test/a');
  for (const bad of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'http://x.test', '', '/\t/evil.test/', '/\n/evil.test/']) assert.equal(safeNavHref(bad), '', bad);
});

test('secondary text stays readable, and odd colour values are refused', () => {
  const c = effectiveColours({ background: '#808080', ink: '#000000' }, {});
  assert.ok(contrast(c.dim, c.background) >= 4.5);
  assert.equal(designDetails({ background: ['#101010'] }).background, '');
});
