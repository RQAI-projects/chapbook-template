import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingTarget, renderPage, normalisePage, richText, inline, BLOCK_TYPES, TYPE_IDS, variantsOf, newBlock, cloneBlock, findBlock, fieldAt, cleanHref, cleanPicture, slugProblem, slugFrom, pageColours, contrast, pageCss, RESERVED_SLUGS } from './render.mjs';

const site = { name: 'Harbour Physio', professional: { phone: '01202 555 123', email: 'hello@harbour.example', location: '4 Quay Street\nPoole', hours: 'Mon–Fri 8–6', bookingUrl: 'https://cal.com/harbour/assessment' } };
const page = (blocks, extra = {}) => ({ v: 1, title: 'Test', slug: 'test', blocks, ...extra });

test('every type and variant renders, published and editable, without throwing', () => {
  for (const type of TYPE_IDS) {
    for (const variant of variantsOf(type)) {
      const b = newBlock(type, variant);
      for (const editable of [false, true]) {
        const html = renderPage(page([b]), { site, editable });
        assert.equal(typeof html, 'string');
        if (!editable) assert.ok(!html.includes('data-cb'), `${type}/${variant} leaks editor markers`);
      }
    }
  }
});

test('words are escaped everywhere, including rich text and attributes', () => {
  const evil = '<img src=x onerror=alert(1)>"\'&';
  const blocks = [
    { type: 'hero', variant: 'split', data: { heading: evil, kicker: evil, intro: evil, buttons: [{ label: evil, href: '/x' }], picture: { src: '/site-images/a.jpg', alt: evil } } },
    { type: 'services', variant: 'menu', data: { heading: evil, items: [{ name: evil, price: evil, description: evil }] } },
    { type: 'reviews', variant: 'cards', data: { items: [{ quote: evil, name: evil, detail: evil, stars: 4 }] } },
  ];
  for (const editable of [false, true]) {
    const html = renderPage(page(blocks), { site, editable });
    assert.ok(!html.includes('<img src=x'), 'raw tag leaked');
    assert.ok(!/onerror=alert\(1\)>/.test(html.replace(/&[a-z#0-9]+;/g, '')) || !html.includes('<img src=x onerror'), 'handler leaked');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  }
});

test('rich text: paragraphs, bold, italic, safe links and lists only', () => {
  assert.equal(richText('One\n\nTwo'), '<p>One</p><p>Two</p>');
  assert.equal(richText('Line one\nline two'), '<p>Line one<br>line two</p>');
  assert.equal(inline('a **b** *c*'), 'a <strong>b</strong> <em>c</em>');
  assert.equal(richText('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(inline('[Book](https://cal.com/x)'), '<a href="https://cal.com/x">Book</a>');
  assert.equal(inline('[About](/about/)', { href: (p) => `/base${p}` }), '<a href="/base/about/">About</a>');
  assert.equal(inline('[x](javascript:alert(1))'), '[x](javascript:alert(1))');
  assert.equal(inline('[x](http://plain.example)'), '[x](http://plain.example)');
  assert.ok(!inline('[<b>](https://a.example)').includes('<b>'));
  assert.equal(inline('2 * 3 * 4'), '2 * 3 * 4');
  assert.equal(inline('**<script>**'), '<strong>&lt;script&gt;</strong>');
});

test('links: only site paths, https, mailto, tel and business details', () => {
  for (const ok of ['/about/', 'https://cal.com/a', 'mailto:a@b.co', 'tel:+441202555123', '@booking', '@phone', '@email']) assert.equal(cleanHref(ok) ? true : false, true, ok);
  for (const bad of ['javascript:alert(1)', 'http://x.com', '//evil.com', '/\\evil.com', 'data:text/html,x', 'https://user:pw@x.com', '/a"onmouseover=x', '../x', '/a/../b']) assert.equal(cleanHref(bad), '', bad);
});

test('business-detail buttons follow Site settings', () => {
  const b = { type: 'cta', data: { heading: 'Book', buttons: [{ label: 'Book now', href: '@booking' }, { label: 'Call us', href: '@phone' }] } };
  const html = renderPage(page([b]), { site });
  assert.ok(html.includes('href="/appointments/"'));
  assert.ok(html.includes('href="tel:01202555123"'));
  const noPhone = renderPage(page([b]), { site: { professional: {} } });
  assert.ok(!noPhone.includes('Call us'), 'a button with nowhere to go is hidden when published');
  assert.ok(noPhone.includes('href="/contact/"'), 'booking falls back to the contact page');
  const ed = renderPage(page([b]), { site: { professional: {} }, editable: true });
  assert.ok(ed.includes('data-cb-incomplete'), 'the editor shows the unfinished button');
});

test('pictures: only the site\'s own pictures, data: only in the editor', () => {
  assert.ok(cleanPicture({ src: '/site-images/cafe-1.webp', alt: 'Window seat' }));
  for (const bad of ['http://x.com/a.jpg', 'https://u:p@x.com/a.jpg', '/site-images/../x', 'javascript:x', '/other/a.jpg', 'data:image/svg+xml;base64,AAAA', '//x.com/a.jpg']) assert.equal(cleanPicture({ src: bad }), null, bad);
  assert.ok(cleanPicture({ src: 'https://cdn.example.com/a.jpg' }), 'older sites may use pictures at an https address');
  const data = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(cleanPicture({ src: data }), null);
  assert.ok(cleanPicture({ src: data }, { allowData: true }));
  const html = renderPage(page([{ type: 'image', data: { picture: { src: '/site-images/a.jpg', alt: 'A' } } }]), { href: (p) => `/repo${p}` });
  assert.ok(html.includes('src="/repo/site-images/a.jpg"'));
});

test('CC BY photos carry their credit on the published page', () => {
  const pic = { src: '/site-images/a.jpg', alt: 'Sea', credit: { creator: 'Ann Lee', license: 'by', page: 'https://openverse.org/image/1' } };
  for (const b of [{ type: 'image', data: { picture: pic } }, { type: 'hero', variant: 'split', data: { heading: 'x', picture: pic } }, { type: 'gallery', data: { pictures: [pic] } }]) {
    const html = renderPage(page([b]), {});
    assert.ok(html.includes('Ann Lee') && html.includes('CC BY'), b.type);
  }
  const cc0 = renderPage(page([{ type: 'image', data: { picture: { ...pic, credit: { ...pic.credit, license: 'cc0' } } } }]), {});
  assert.ok(!cc0.includes('CC BY'));
});

test('editor markers name the block and the value path', () => {
  const b = { id: 'b7f3', type: 'services', variant: 'menu', data: { heading: 'Fees', items: [{ id: 'i1', name: 'Massage', price: '£65' }] } };
  const html = renderPage(page([b]), { editable: true });
  assert.ok(html.includes('data-cb-block="b7f3"'));
  assert.ok(html.includes('data-cb="b7f3:heading"'));
  assert.ok(html.includes('data-cb="b7f3:items.0.price"'));
  assert.ok(html.includes('data-cb-item="b7f3:items.0"'));
  assert.ok(html.includes('data-cb-list="b7f3:items"'));
  assert.ok(html.includes('data-cb="b7f3:items.0.description"') && html.includes('data-cb-empty'), 'empty fields show a placeholder in the editor');
  assert.equal(fieldAt('services', 'items.0.price').kind, 'line');
  assert.equal(fieldAt('services', 'items.0.description').kind, 'rich');
  assert.equal(fieldAt('hero', 'buttons.1').kind, 'link');
  assert.equal(fieldAt('gallery', 'pictures.2').kind, 'picture');
});

test('empty optional values hide on the published page', () => {
  const html = renderPage(page([{ type: 'text', data: { body: 'Just words' } }]), {});
  assert.ok(!html.includes('<h2'));
  assert.ok(!html.includes('cb-actions'));
});

test('normalising drops unknown types, variants and fields, and fixes ids', () => {
  const p = normalisePage({ slug: 'x', blocks: [{ type: 'evil', data: {} }, { id: 'A!', type: 'text', variant: 'nope', style: { bg: 'red', width: 'huge' }, data: { body: 'x', onclick: 'y' } }, { id: 'same', type: 'text' }, { id: 'same', type: 'text' }] });
  assert.equal(p.blocks.length, 3);
  assert.equal(p.blocks[0].variant, 'plain');
  assert.deepEqual(p.blocks[0].style, { bg: 'none', width: 'normal', space: 'm', align: 'left' });
  assert.ok(!('onclick' in p.blocks[0].data));
  const ids = p.blocks.map((b) => b.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((id) => /^[a-z0-9]{1,12}$/.test(id)));
});

test('columns hold two or three allowed blocks, never nested columns', () => {
  const p = normalisePage({ blocks: [{ type: 'columns', data: { children: [{ type: 'text' }, { type: 'columns' }, { type: 'hero' }, { type: 'image' }, { type: 'cta' }, { type: 'contact' }] } }] });
  const kids = p.blocks[0].data.children;
  assert.deepEqual(kids.map((k) => k.type), ['text', 'image', 'cta']);
  const html = renderPage(p, { editable: true });
  for (const k of kids) assert.ok(html.includes(`data-cb-block="${k.id}"`));
  assert.equal(findBlock(p, kids[1].id).type, 'image');
});

test('slugs: plain words, never the site\'s own sections', () => {
  assert.equal(slugFrom('Our Treatments & Fees'), 'our-treatments-and-fees');
  assert.equal(slugFrom('Café Menü'), 'cafe-menu');
  assert.equal(slugProblem('posts'), 'That address is used by your website already. Choose another.');
  assert.equal(slugProblem('Bad Slug'), 'Use lower-case letters, numbers and dashes only.');
  assert.equal(slugProblem('treatments', ['treatments']), 'Another page already uses that address.');
  assert.equal(slugProblem('treatments'), '');
  for (const s of RESERVED_SLUGS) assert.ok(slugProblem(s));
  assert.equal(normalisePage({ slug: 'posts' }).slug, '');
  assert.equal(normalisePage({ slug: 'home' }).slug, 'home');
});

test('page palettes stay readable whatever colours are chosen', () => {
  const combos = [
    { bg: '#ffffff', ink: '#ffffff', accent: '#ffff00' },
    { bg: '#101010', ink: '#111111', accent: '#000080' },
    { bg: '#f7f0e3', ink: '#2b1a12', accent: '#a33b1e' },
    { bg: '#0b1f33', ink: '#e8eef5', accent: '#f2b134' },
  ];
  for (const c of combos) {
    const k = pageColours({ colours: c });
    assert.ok(contrast(k.ink, k.bg) >= 4.5, `ink on bg ${JSON.stringify(c)}`);
    assert.ok(contrast(k.onAccent, k.accent) >= 4.5 || contrast(k.onAccent, k.accent) >= 3, `text on accent ${JSON.stringify(c)}`);
    assert.ok(contrast(k.onDeep, k.deep) >= 4.5, `text on deep ${JSON.stringify(c)}`);
    assert.ok(contrast(k.accentText, k.bg) >= 4.5, `accent text ${JSON.stringify(c)}`);
    assert.ok(contrast(k.surfaceInk, k.surface) >= 4.5, `surface ${JSON.stringify(c)}`);
    assert.ok(contrast(k.surfaceAccent, k.surface) >= 4.5 && contrast(k.surfaceDim, k.surface) >= 4.5, `surface accent ${JSON.stringify(c)}`);
  }
  const css = pageCss(normalisePage({ look: { palette: 'x', colours: { bg: '#ffffff', ink: '#111111', accent: '#6f1d2b' }, font: 'modern' } }));
  assert.ok(css.includes('--accent:#6f1d2b') && css.includes("--cb-heading-font:'Fraunces'"));
  assert.ok(!pageCss(normalisePage({ look: { colours: { bg: 'red' } } })).includes('--bg-0'), 'bad colours are ignored');
});

test('duplicate gives every block new ids', () => {
  const b = newBlock('columns');
  const c = cloneBlock(b);
  assert.notEqual(c.id, b.id);
  assert.notEqual(c.data.children[0].id, b.data.children[0].id);
});

test('the first opening is the page\'s only h1', () => {
  const html = renderPage(page([{ type: 'hero', data: { heading: 'One' } }, { type: 'hero', data: { heading: 'Two' } }]), {});
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('videos become privacy-friendly embeds', () => {
  const html = renderPage(page([{ type: 'video', data: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }]), {});
  assert.ok(html.includes('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  assert.equal(normalisePage(page([{ type: 'video', data: { src: 'https://evil.example/v' } }])).blocks[0].data.src, undefined);
});

test('interactives load from the site\'s own interactives folder, sandboxed', () => {
  const html = renderPage(page([{ type: 'interactive', data: { src: '/interactives/tide-chart.html', height: 600 } }]), {});
  assert.ok(html.includes('sandbox="allow-scripts allow-forms"') && html.includes('/interactives/tide-chart.html'));
  assert.equal(renderPage(page([{ type: 'interactive', data: { src: 'https://evil.example/x.html' } }]), {}).includes('iframe'), false);
});

test('every block type has a label, hint and at least one variant', () => {
  for (const [id, t] of Object.entries(BLOCK_TYPES)) {
    assert.ok(t.label && t.hint, id);
    assert.ok(Object.keys(t.variants).length >= 1, id);
  }
});

test('a page without an opening still gets exactly one h1', () => {
  const html = renderPage(page([{ type: 'text', data: { body: 'x' } }, { type: 'services', data: { heading: 'Fees' } }, { type: 'faq', data: { heading: 'Questions' } }]), {});
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(html.includes('<h1 class="cb-h">Fees</h1>'));
  for (const v of variantsOf('hero')) assert.equal((renderPage(page([{ type: 'hero', variant: v, data: { heading: 'Hi', details: true } }]), { site }).match(/<h1/g) || []).length, 1, v);
});

test('CC BY credits carry the licence version and link, including on background pictures', () => {
  const pic = { src: '/site-images/a.jpg', alt: '', credit: { creator: 'Ann Lee', license: 'by', version: '4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', page: 'https://openverse.org/x' } };
  const html = renderPage(page([{ type: 'cta', style: { bg: 'picture' }, data: { heading: 'Hi', backdrop: pic } }]), {});
  assert.ok(html.includes('CC BY 4.0') && html.includes('href="https://creativecommons.org/licenses/by/4.0/"'));
  assert.equal(cleanPicture({ src: '/site-images/a.jpg', credit: { license: 'by', licenceUrl: 'https://evil.example/x' } }).credit.licenceUrl, undefined);
});

test('the h1 goes to a heading that really appears', () => {
  const count = (blocks, ctx = {}) => (renderPage(page(blocks), ctx).match(/<h1/g) || []).length;
  assert.equal(count([{ type: 'hero', data: { intro: 'No heading' } }, { type: 'text', data: { heading: 'Real heading' } }]), 1);
  assert.equal(count([{ type: 'posts', data: { heading: 'News' } }, { type: 'text', data: { heading: 'About' } }]), 1, 'no posts yet');
  assert.equal(count([{ type: 'form', data: { heading: 'Write to us' } }, { type: 'faq', data: { heading: 'Questions' } }]), 1, 'form not connected');
});

test('contact details show social links and the profile email when Site settings has none', () => {
  const html = renderPage(page([{ type: 'contact', data: { business: true } }]), { site: { socials: { linkedin: 'https://linkedin.com/in/x', instagram: 'javascript:alert(1)' }, professional: {} }, fallbackEmail: 'me@example.com' });
  assert.ok(html.includes('href="https://linkedin.com/in/x"') && !html.includes('javascript:'));
  assert.ok(html.includes('mailto:me@example.com'));
});

test('italic only on word boundaries, so sums and code stay as typed', () => {
  assert.equal(inline('2*3*4'), '2*3*4');
  assert.equal(inline('snake*case*'), 'snake*case*');
  assert.equal(inline('**bold** and *it*'), '<strong>bold</strong> and <em>it</em>');
  assert.equal(inline('(*aside*)'), '(<em>aside</em>)');
});

test('opening videos: shown without a poster, credits kept, YouTube under the words, a pause button that can be clicked', () => {
  for (const v of ['centred', 'panel', 'poster', 'split', 'stacked']) assert.ok(renderPage(page([{ type: 'hero', variant: v, data: { heading: 'Hi', video: '/site-images/a.mp4' } }]), {}).includes('<video'), v);
  const pic = { src: '/site-images/p.jpg', alt: '', credit: { creator: 'Ann', license: 'by' } };
  assert.ok(renderPage(page([{ type: 'hero', variant: 'split', data: { heading: 'Hi', video: '/site-images/a.mp4', picture: pic } }]), {}).includes('Ann'));
  const yt = renderPage(page([{ type: 'hero', variant: 'photo-behind', data: { heading: 'Hi', video: 'https://youtu.be/dQw4w9WgXcQ', picture: pic } }]), {});
  assert.ok(yt.includes('cb-hero-player') && yt.includes('<img') && !/cb-hero-bg[^>]*>\s*<iframe/.test(yt));
  const bg = renderPage(page([{ type: 'hero', variant: 'photo-behind', data: { heading: 'Hi', video: '/site-images/a.mp4' } }]), {});
  assert.ok(/<\/div><button type="button" class="cb-video-toggle"/.test(bg), 'the pause button sits above the shading, outside the background');
});

test('booking links: dashboard addresses and Google account paths', () => {
  assert.equal(bookingTarget('https://app.cal.com/event-types/12').kind, 'link');
  assert.equal(bookingTarget('https://cal.com/event-types/12').kind, 'link');
  assert.equal(bookingTarget('https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0abcDEF123456789').kind, 'google');
  const html = renderPage(page([{ type: 'booking', data: { heading: 'Book', useSite: false } }, { type: 'text', data: { heading: 'Real' } }]), { site: { professional: {} } });
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('a page can choose its body typeface too', () => {
  const html = renderPage(page([{ type: 'text', data: { body: 'x' } }], { look: { font: 'modern', bodyFont: 'reading' } }), {});
  assert.ok(html.includes("--cb-body-font:'Newsreader'") && html.includes('cbp-bodyfont'));
  assert.ok(!renderPage(page([{ type: 'text', data: { body: 'x' } }], { look: { bodyFont: 'comic-sans' } }), {}).includes('cbp-bodyfont'));
});

test('booking: Cal.com and Google show a calendar on request, other booking pages a button', () => {
  const r = (url, extra = {}, ctx = {}) => renderPage(page([{ type: 'booking', variant: 'calendar', data: { heading: 'Book', url, ...extra } }]), { site, ...ctx });
  const cal = r('https://cal.com/harbour/assessment');
  assert.ok(cal.includes('data-booking-kind="cal"') && cal.includes('data-booking-src="harbour/assessment"'));
  assert.ok(!cal.includes('<iframe') && !cal.includes('<script'), 'nothing loads until the visitor asks');
  const g = r('https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcdefghijk');
  assert.ok(g.includes('data-booking-kind="google"') && g.includes('?gv=true'));
  const other = r('https://calendly.com/x/30min');
  assert.ok(other.includes('href="https://calendly.com/x/30min"') && !other.includes('data-booking-kind'));
  assert.ok(!r('javascript:alert(1)', { useSite: false }, { site: { professional: {} } }).includes('javascript'));
  const fromSite = renderPage(page([{ type: 'booking', data: { useSite: true } }]), { site });
  assert.ok(fromSite.includes('data-booking-src="harbour/assessment"'), 'uses the Site settings booking link');
  const none = renderPage(page([{ type: 'booking', data: { heading: 'Book', useSite: true } }]), { site: { professional: { phone: '01202 111222' } } });
  assert.ok(none.includes('href="tel:01202111222"'), 'no booking page: offer the phone');
  const ed = renderPage(page([{ type: 'booking', data: { url: 'https://cal.com/a/b' } }]), { site, editable: true });
  assert.ok(!ed.includes('data-booking-kind') && ed.includes('data-cb-hint'), 'the editor never loads the booking service');
});

test('videos: behind the opening words, in the opening, in galleries and in columns', () => {
  const bg = renderPage(page([{ type: 'hero', variant: 'photo-behind', data: { heading: 'Hi', video: '/site-images/clinic.mp4', picture: { src: '/site-images/p.jpg', alt: '' } } }]), {});
  assert.ok(bg.includes('autoplay') && bg.includes('muted') && bg.includes('poster="/site-images/p.jpg"') && bg.includes('cb-video-toggle'));
  const split = renderPage(page([{ type: 'hero', variant: 'split', data: { heading: 'Hi', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }]), {});
  assert.ok(split.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  const r2 = renderPage(page([{ type: 'gallery', data: { pictures: [{ src: '/site-images/a.jpg', alt: 'Tour', video: 'https://media.example.com/tour.mp4' }] } }]), {});
  assert.ok(r2.includes('<video src="https://media.example.com/tour.mp4"') && r2.includes('preload="none"'));
  assert.equal(normalisePage(page([{ type: 'hero', data: { video: 'javascript:alert(1)' } }])).blocks[0].data.video, undefined);
  assert.equal(normalisePage(page([{ type: 'hero', data: { video: 'https://evil.example/x.exe' } }])).blocks[0].data.video, undefined);
  const cols = normalisePage(page([{ type: 'columns', data: { children: [{ type: 'video', data: { src: '/site-images/a.mp4' } }, { type: 'text', data: { body: 'x' } }] } }]));
  assert.equal(cols.blocks[0].data.children[0].type, 'video');
  const ed = renderPage(page([{ type: 'hero', variant: 'photo-behind', data: { video: '/site-images/a.mp4' } }]), { editable: true });
  assert.ok(ed.includes('data-cb-video') && !ed.includes('autoplay'), 'the editor shows the video still');
});

// ---- movement, moving openings and the blocks made for them (release 5) --------------------
import { readFileSync } from 'node:fs';
import { cleanMotion, cleanLook, motionFor, MOTION, MOTION_KEYS, MOTION_PRESETS, motionAttrs, backdropHtml, turnColours } from './render.mjs';

const hero = (variant, data = {}, style = {}) => ({ type: 'hero', variant, style, data: { kicker: 'Open daily', heading: 'Small plates, long tables', intro: 'Lunch and dinner.', picture: { src: '/site-images/room.webp', alt: 'The room' }, buttons: [{ label: 'Book', href: '/contact/' }], ...data } });
const count = (html, needle) => html.split(needle).length - 1;

test('movement is a fixed set of choices: anything else is dropped', () => {
  assert.deepEqual(cleanMotion({ scroll: 'rise', buttons: 'javascript:alert(1)', heading: 'none', pictures: 'drift', backdrop: '<b>', pace: 'steady', count: 'yes', extra: 1 }), { scroll: 'rise', pictures: 'drift' });
  assert.equal(cleanMotion({ pace: 'lively' }), null, 'a pace alone moves nothing');
  assert.equal(cleanMotion({}), null);
  assert.equal(cleanMotion('rise'), null);
  assert.deepEqual(cleanMotion({ scroll: 'fade', count: true, preset: 'gentle' }), { scroll: 'fade', count: true, preset: 'gentle' });
  assert.equal(cleanMotion({ scroll: 'fade', preset: 'nope' }).preset, undefined);
  assert.deepEqual(cleanMotion({ scroll: 'fade', own: true }), { scroll: 'fade', own: true }, 'the writer\'s own choice is remembered');
  assert.equal(cleanMotion({ scroll: 'fade', own: 'yes' }).own, undefined);
  assert.equal(cleanLook({ motion: { scroll: 'nope' } }).motion, undefined);
  for (const [id, p] of Object.entries(MOTION_PRESETS)) {
    assert.ok(p.name && p.hint, `${id} needs a name and a hint`);
    if (id !== 'still') assert.deepEqual(cleanMotion({ ...p.motion, preset: id }), motionFor(id), `${id} is made of valid choices`);
  }
  assert.equal(motionFor('still'), null);
  assert.equal(motionFor('lively', 'bubbles').backdrop, 'bubbles');
  for (const k of MOTION_KEYS) assert.ok(MOTION[k].label && Object.keys(MOTION[k].options).length >= 3, `${k} has a label and choices`);
});

test('a page without movement renders exactly as before; one with it carries its choices as attributes', () => {
  const still = renderPage(page([hero('split')]), { site });
  assert.ok(!still.includes('cbm') && !still.includes('data-m-'), 'no movement markers on a still page');
  const html = renderPage(page([hero('split')], { look: { motion: { scroll: 'rise', heading: 'words', buttons: 'fill', pictures: 'drift', opening: 'cover', pace: 'lively', backdrop: 'bubbles', count: true } } }), { site });
  assert.match(html, /<div class="cbp cbm" data-page="test" data-m-scroll="rise" data-m-heading="words" data-m-buttons="fill" data-m-pictures="drift" data-m-opening="cover" data-m-pace="lively" data-m-count>/);
  assert.ok(!html.includes('data-m-edit'));
  assert.ok(renderPage(page([hero('split')], { look: { motion: { scroll: 'rise' } } }), { site, editable: true }).includes(' data-m-edit>'), 'the editor is told to keep still');
  assert.equal(motionAttrs({ scroll: '"><script>', count: true }), ' data-m-count', 'only known choices become attributes');
});

test('the backdrop moves behind the first opening only, echoes behind a coloured call to action, and never sits over a photo', () => {
  const look = { motion: { scroll: 'rise', backdrop: 'aurora' } };
  const cta = (bg) => ({ type: 'cta', variant: 'band', style: { bg }, data: { heading: 'Book', buttons: [{ label: 'Book', href: '/contact/' }] } });
  const html = renderPage(page([hero('split'), hero('centred'), cta('accent'), cta('none')], { look }), { site });
  assert.equal(count(html, 'class="cbm-bd cbm-bd-aurora"'), 1, 'one backdrop, in the first opening');
  assert.equal(count(html, 'cbm-bd-aurora cbm-bd-echo'), 1, 'one echo, in the coloured call to action');
  assert.ok(html.indexOf('cbm-bd-aurora"') < html.indexOf('cb-hero--centred'));
  for (const v of ['photo-behind', 'inset', 'open']) assert.ok(!renderPage(page([hero(v)], { look }), { site }).includes('cbm-bd'), `${v} keeps its photo clear`);
  assert.equal(backdropHtml('nope'), '');
  assert.match(backdropHtml('stars'), /<canvas><\/canvas>/);
  assert.ok(Object.keys(MOTION.backdrop.options).filter((k) => k !== 'none').every((k) => backdropHtml(k).includes('aria-hidden="true"')), 'every backdrop is hidden from screen readers');
});

test('every opening gives the page exactly one h1, however it draws the heading', () => {
  for (const variant of variantsOf('hero')) {
    for (const data of [{}, { rotate: 'brands, websites' }]) {
      const html = renderPage(page([hero(variant, data), { type: 'text', variant: 'plain', data: { heading: 'Story', body: 'Words.' } }]), { site });
      assert.equal(count(html, '<h1'), 1, `${variant}: one h1`);
      assert.ok(html.indexOf('<h1') < html.indexOf('Story'), `${variant}: the opening has it`);
    }
  }
});

test('the rolling headline and moving words are written once for readers; the copies are hidden', () => {
  const html = renderPage(page([hero('marquee'), { type: 'marquee', variant: 'double', data: { items: [{ text: 'Open late' }, { text: 'Walk-ins' }] } }]), { site });
  assert.equal(count(html, '<h1 class="cb-h cb-hero-h">Small plates, long tables</h1>'), 1);
  const visible = html.replace(/<span class="cb-h cb-hero-h" aria-hidden="true">[^<]*<\/span>/g, '').replace(/<span class="cb-mq-set" aria-hidden="true">.*?<\/span><\/span>/g, '');
  assert.equal(count(visible, 'Small plates, long tables'), 1, 'the heading is read once');
  assert.equal(count(visible, 'Open late'), 1, 'each moving word is read once');
  assert.match(html, /--mq-shift:-\d+\.\d+%;--mq-dur:\d+s/);
  const edit = renderPage(page([hero('marquee'), { type: 'marquee', variant: 'line', data: { items: [{ text: 'Open late' }] } }]), { site, editable: true });
  assert.equal(count(edit, 'Small plates, long tables'), 1, 'the editor shows one copy, to click and change');
  assert.equal(count(edit, 'cb-mq-still'), 2, 'and nothing rolls while editing');
  assert.match(edit, /data-cb="[a-z0-9]+:items\.0\.text"/);
  assert.equal(renderPage(page([{ type: 'marquee', variant: 'line', data: { items: [] } }]), { site }).includes('cb-mq'), false, 'no words, no band');
});

test('changing words take turns at the end of the heading; the editor keeps the heading plain', () => {
  const html = renderPage(page([hero('poster', { heading: 'We make', rotate: 'brands, <b>websites</b>;films|  ,' })]), { site });
  assert.match(html, /<h1 class="cb-h cb-hero-h">We make <span class="cb-rot"><span class="is-on">brands<\/span><span class="cb-rot-sep">, <\/span><span>&lt;b&gt;websites&lt;\/b&gt;<\/span><span class="cb-rot-sep">, <\/span><span>films<\/span><\/span><\/h1>/, 'a plain list every reader gets, with or without the script');
  const edit = renderPage(page([hero('poster', { heading: 'We make', rotate: 'brands, websites' })]), { site, editable: true });
  assert.ok(!edit.includes('cb-rot"'), 'no moving words inside the heading being edited');
  assert.match(edit, /Changing words: brands · websites/);
});

test('openings with their own way of drawing: giant name, name that opens, photo in the letters, arch badge', () => {
  assert.match(renderPage(page([hero('wordmark', { heading: 'Corner Cuts' })]), { site }), /<h1 class="cb-h cb-hero-h cb-wordmark" style="--fit:\d+\.\d\d">Corner Cuts<\/h1>/);
  assert.match(renderPage(page([hero('wordmark', { heading: 'A much longer heading that could never fit on one line' })]), { site }), /cb-wordmark cb-wordmark-long">/);
  const open = renderPage(page([hero('open', { heading: 'Harbour Kitchen Bar' })]), { site });
  assert.match(open, /<h1 class="cb-h cb-hero-h cb-open-h"><span class="cb-open-a">Harbour Kitchen<\/span> <span class="cb-open-b">Bar<\/span><\/h1>/);
  assert.match(renderPage(page([hero('open', { heading: 'Get moving again, without the guesswork' })]), { site }), /cb-open-h cb-open-long"><span class="cb-open-a">Get moving again,<\/span> <span class="cb-open-b">without the guesswork<\/span>/, 'a long heading keeps its corners but does not travel');
  assert.match(renderPage(page([hero('open', { heading: 'Harbour' })]), { site }), /<span class="cb-open-a">Harbour<\/span><\/h1>/);
  // A picture address can never close the style it sits in.
  const mask = renderPage(page([hero('mask', { picture: { src: "https://example.com/a'b)c (1).jpg", alt: '' } })]), { site });
  assert.match(mask, /style="--cb-mask:url\(&#39;https:\/\/example\.com\/a%27b%29c%20%281%29\.jpg&#39;\)"/);
  const arch = renderPage(page([hero('arch', { kicker: 'A very long label that would never fit round a small circle badge at all' })]), { site });
  const ring = arch.match(/<textPath[^>]*>([^<]*)<\/textPath>/)[1];
  assert.ok(ring.length <= 50 && ring.length >= 20, `the badge text fits the circle (${ring.length})`);
  assert.equal(count(renderPage(page([hero('arch'), hero('arch')]), { site }), 'id="cba-'), 2, 'each badge has its own path');
});

test('openings with more photos show them, and the editor can add to them', () => {
  const pics = [1, 2, 3, 4].map((n) => ({ src: `/site-images/p${n}.webp`, alt: `Photo ${n}` }));
  for (const v of ['orbit', 'collage', 'filmstrip', 'bento', 'blob']) {
    const html = renderPage(page([hero(v, { pictures: pics })]), { site });
    assert.ok(html.includes('/site-images/p1.webp'), `${v} shows an extra photo`);
    const edit = renderPage(page([hero(v, { pictures: pics })]), { site, editable: true });
    assert.match(edit, /data-cb-list="[a-z0-9]+:pictures"/, `${v}: a list to add to`);
    assert.match(edit, /data-cb-img="[a-z0-9]+:pictures\.0"/, `${v}: each photo can be changed`);
  }
  const film = renderPage(page([hero('filmstrip', { pictures: pics })]), { site });
  assert.equal(count(film, 'alt="Photo 1"'), 1, 'each rolling photo is described once');
  assert.ok(count(film, '/site-images/p1.webp') > 2, 'and repeated, hidden, to make the loop');
  assert.ok(!renderPage(page([hero('filmstrip', { pictures: [] })]), { site }).includes('cb-film-row'), 'one photo is shown plainly');
});

test('the new blocks: steps, showcase, rolling reviews and reels, with a still form for the editor', () => {
  const items = [{ name: 'One', description: 'First.' }, { name: 'Two', description: '<i>Second</i>' }];
  const steps = renderPage(page([{ type: 'steps', variant: 'line', data: { heading: 'How', items } }]), { site });
  assert.match(steps, /<ol class="cb-steps cb-steps-line"><li class="cb-step"><span class="cb-step-n" aria-hidden="true">01<\/span>/);
  assert.ok(steps.includes('&lt;i&gt;Second&lt;/i&gt;') && !steps.includes('<i>Second'));
  const show = [{ name: 'A', picture: { src: '/site-images/a.webp', alt: 'A' } }, { name: 'B' }, { name: 'C' }];
  for (const v of variantsOf('showcase')) assert.ok(renderPage(page([{ type: 'showcase', variant: v, data: { heading: 'Work', items: show } }]), { site }).includes(`cb-show-${v}`), v);
  const plates = renderPage(page([{ type: 'showcase', variant: 'plates', data: { items: show } }], { look: { colours: { bg: '#ffffff', ink: '#111111', accent: '#aa2200' } } }), { site });
  assert.match(plates, /<div class="cb-plates" style="--plate-c:#[0-9a-f]{6};--plate-on:#[0-9a-f]{6}">/);
  assert.equal(count(plates, 'data-plate-c="#'), 3, 'each plate brings its colour');
  const reviews = [{ quote: 'Good.', name: 'Jo' }, { quote: 'Great.', name: 'Sam' }];
  const ticker = renderPage(page([{ type: 'reviews', variant: 'ticker', data: { items: reviews } }]), { site });
  assert.ok(ticker.includes('cb-mq-cards') && count(ticker.replace(/<figure class="cb-review" aria-hidden="true">.*?<\/figure>/g, ''), 'Good.') === 1);
  const still = renderPage(page([{ type: 'reviews', variant: 'ticker', data: { items: reviews } }]), { site, editable: true });
  assert.ok(still.includes('cb-reviews-cards') && !still.includes('cb-mq'), 'the editor shows them as plain cards');
  const pics = [1, 2, 3].map((n) => ({ src: `/site-images/g${n}.webp`, alt: `G${n}` }));
  const reel = renderPage(page([{ type: 'gallery', variant: 'reel', data: { pictures: pics } }]), { site });
  assert.ok(reel.includes('cb-mq-pics') && count(reel, 'alt="G1"') === 1);
  assert.ok(renderPage(page([{ type: 'gallery', variant: 'reel', data: { pictures: pics } }]), { site, editable: true }).includes('data-cb-list'), 'the editor can still add photos');
});

test('photo credits name the photos a layout shows, once each; hidden copies cannot take keyboard focus', () => {
  const by = (n) => ({ src: `/site-images/c${n}.webp`, alt: `C${n}`, credit: { license: 'by', creator: `Maker ${n}`, page: 'https://example.com/p', version: '4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' } });
  const blob = renderPage(page([hero('blob', { picture: by(1), pictures: [by(2), by(3)] })]), { site });
  assert.ok(blob.includes('Maker 1') && blob.includes('Maker 2'), 'both photos shown in the colour block are credited');
  assert.ok(!blob.includes('Maker 3'), 'a photo the layout does not show is not credited');
  assert.equal(count(renderPage(page([hero('filmstrip', { picture: by(1), pictures: [] })]), { site }), 'Maker 1'), 1, 'one photo, one credit');
  assert.ok(!renderPage(page([hero('collage', { picture: by(1), pictures: [by(2), by(3), by(4), by(5)] })]), { site }).includes('Maker 5'));
  const ticker = renderPage(page([{ type: 'reviews', variant: 'ticker', data: { items: [{ quote: 'See [our post](/posts/x).', name: 'Jo' }, { quote: 'Good.', name: 'Sam' }] } }]), { site });
  const hidden = ticker.match(/<figure class="cb-review" aria-hidden="true">.*?<\/figure>/g) || [];
  assert.ok(hidden.length > 0 && hidden.every((h) => !/<a (?!tabindex="-1")/.test(h)), 'links in hidden copies are out of the Tab order');
  assert.equal(count(ticker.replace(/<figure class="cb-review" aria-hidden="true">.*?<\/figure>/g, ''), 'tabindex="-1"'), 0, 'the real link is not');
  // Rows and list items whose photo shows on hover can be reached by keyboard, but not in the editor.
  const rows = [{ name: 'Cut', picture: { src: '/site-images/a.webp', alt: 'A' } }, { name: 'Shave' }];
  const pub = renderPage(page([{ type: 'services', variant: 'rows', data: { items: rows } }]), { site });
  assert.equal(count(pub, '<article tabindex="0"'), 1, 'only the row that has a photo');
  assert.equal(count(renderPage(page([{ type: 'services', variant: 'rows', data: { items: rows } }]), { site, editable: true }), 'tabindex'), 0);
  const emoji = renderPage(page([hero('arch', { kicker: '\u{1F33A}'.repeat(45) })]), { site });
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(emoji), 'a long label of emoji is cut between characters, never through one');
  const wide = renderPage(page([{ type: 'marquee', variant: 'tags', data: { items: [{ text: 'Open' }] } }]), { site });
  assert.ok(count(wide, 'class="cb-mq-set"') >= 30, 'one short label is repeated often enough to fill a very wide screen');
});

test('colours that take turns always carry a text colour that reads on them', () => {
  for (const colours of [{ bg: '#ffffff', ink: '#111111', accent: '#aa2200' }, { bg: '#0a0a0a', ink: '#f5f5f0', accent: '#d2ff3a' }, { bg: '#c9f24a', ink: '#11140a', accent: '#11140a' }, { bg: '#f7e7de', ink: '#25140c', accent: '#a8350a' }]) {
    for (const t of turnColours(pageColours({ colours }))) {
      assert.match(t.c, /^#[0-9a-f]{6}$/); assert.match(t.on, /^#[0-9a-f]{6}$/);
      assert.ok(contrast(t.c, t.on) >= 4.5, `${t.on} on ${t.c}`);
    }
  }
});

test('the movement script never turns text into markup, and the styles hide nothing without it', () => {
  const js = readFileSync(new URL('../../scripts/page-motion.js', import.meta.url), 'utf8');
  for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function']) assert.ok(!js.includes(banned), `page-motion.js must not use ${banned}`);
  const css = readFileSync(new URL('../../styles/motion.css', import.meta.url), 'utf8');
  // Every rule that starts something hidden must depend on the script having started (html.cbm-js
  // or .cbm-ready) or be a keyframe; a page whose script never runs must show everything.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  for (const m of rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = m;
    if (!/(?:^|;)\s*opacity\s*:\s*0\s*(?:;|$)/.test(body)) continue;
    const ok = /cbm-js|cbm-ready|\.cbm-l\b|\.cb-rot|\.cbm-bd-ripples/.test(selector);
    assert.ok(ok, `this rule hides something without waiting for the script: ${selector.trim().slice(0, 90)}`);
  }
});

test('three dimensions and pages that come apart: each has a plain form when nothing can move', () => {
  const pics = [1, 2, 3, 4].map((n) => ({ src: `/site-images/q${n}.webp`, alt: `Q${n}` }));
  const ring = renderPage(page([hero('carousel', { pictures: pics })]), { site });
  assert.match(ring, /<div class="cb-car" style="--n:5"><div class="cb-car-ring"><figure style="--i:0">/);
  assert.equal(count(ring, 'alt="Q1"'), 1);
  assert.ok(!renderPage(page([hero('carousel', { pictures: pics.slice(0, 1) })]), { site }).includes('cb-car-ring'), 'two photos do not make a ring: they are shown plainly');
  assert.ok(renderPage(page([hero('carousel', { pictures: pics })]), { site, editable: true }).includes('cb-car-still'), 'the editor lays the photos in a row');
  const tiles = renderPage(page([hero('shatter')]), { site });
  assert.equal(count(tiles, '<i style="--c:'), 24, 'the photo is laid out as 24 tiles');
  assert.match(tiles, /<figure class="cb-hero-pic cb-hero-band cb-shatter" data-scroll="exit" style="--cb-pic:url\(&#39;\/site-images\/room\.webp&#39;\)"><img /, 'and is still there whole, for when nothing moves');
  assert.match(tiles, /<span class="cb-tiles" aria-hidden="true">/);
  assert.ok(!renderPage(page([hero('shatter')]), { site, editable: true }).includes('cb-tiles'), 'the editor shows the whole photo');
  assert.deepEqual(renderPage(page([hero('shatter')]), { site }), renderPage(page([hero('shatter')]), { site }), 'the tiles fly the same way every time the page is drawn');
  const together = renderPage(page([{ type: 'gallery', variant: 'gather', data: { pictures: pics } }]), { site });
  assert.ok(together.includes('<div class="cb-gallery" data-scroll="enter">') && count(together, '--dx:') === 4);
  assert.ok(!renderPage(page([{ type: 'gallery', variant: 'gather', data: { pictures: pics } }]), { site, editable: true }).includes('data-scroll'));
  const flip = renderPage(page([{ type: 'services', variant: 'flip', data: { items: [{ name: 'Cut', price: '£24', description: 'With a wash.' }] } }]), { site });
  assert.match(flip, /<article tabindex="0"><div class="cb-flip-in"><div class="cb-flip-front">/, 'a card can be turned from the keyboard');
  assert.ok(flip.includes('cb-flip-back') && !renderPage(page([{ type: 'services', variant: 'flip', data: { items: [{ name: 'Cut' }] } }]), { site, editable: true }).includes('tabindex'));
  const layers = renderPage(page([{ type: 'showcase', variant: 'layers', data: { items: [{ name: 'A' }, { name: 'B', picture: pics[0] }] } }]), { site });
  assert.match(layers, /<div class="cb-layers" data-scroll="enter"><div class="cb-layers-stage" aria-hidden="true">/);
  assert.equal(count(layers, '<i style="--i:'), 2);
  for (const k of ['globe', 'ring', 'terrain']) assert.match(backdropHtml(k), /<canvas><\/canvas>/, `${k} is drawn live`);
});

test('openings that are alive from the first second: a giant word behind the photo, and a magnifying glass', () => {
  const word = renderPage(page([hero('backword', { word: 'Roast' })]), { site });
  assert.match(word, /<p class="cb-bw-word" style="--len:5">Roast<\/p>/, 'the word is real text, sized to its length');
  assert.equal(count(word, '<i style="--i:'), 7, 'seven loose shapes float round the photo');
  assert.equal(count(word, '<h1'), 1);
  const editing = renderPage(page([hero('backword', {})]), { site, editable: true });
  assert.ok(!editing.includes('cb-bw-bits') && /class="cb-bw-word"[^>]* data-cb="[^"]+:word"/.test(editing), 'in the editor the shapes are left out and the word can be typed');
  assert.ok(!renderPage(page([hero('backword', {})]), { site }).includes('cb-bw-word'), 'no word, no empty element');
  const lens = renderPage(page([hero('lens')]), { site });
  assert.match(lens, /<div class="cb-lens" style="--cb-pic:url\(&#39;\/site-images\/room\.webp&#39;\)">/);
  assert.match(lens, /<span class="cb-lens-glass" aria-hidden="true"><i><\/i><\/span>/);
  assert.ok(!renderPage(page([hero('lens')]), { site, editable: true }).includes('cb-lens-glass'), 'the editor shows the plain round photo');
});
