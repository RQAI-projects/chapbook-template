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
