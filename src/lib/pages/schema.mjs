// Page builder: what a page is made of. A page is a list of blocks; each block has a type, a
// layout variant, a few safe style choices and its own words and pictures. This module is pure
// (no DOM, no Astro): the site build and Chapbook's editor both use it, so a page that passes
// normalisePage() here renders the same way in both places.

export const PAGE_VERSION = 1;
export const MAX_BLOCKS = 60;

// ---- small cleaners ------------------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Multi-line text: unify line endings, drop control characters, trim, cap.
export function cleanText(v, max = 2000) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
// Single-line text: newlines become spaces.
export function cleanLine(v, max = 200) {
  return cleanText(v, max * 2).replace(/\s*\n\s*/g, ' ').slice(0, max).trim();
}
const HEX = /^#[0-9a-f]{6}$/i;
export const cleanHex = (v) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : '');
const ID = /^[a-z0-9]{1,12}$/;
const ROLE = /^[a-z0-9-]{1,30}$/;
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const TEMPLATE_ID = /^[a-z0-9-]{1,60}$/;

// Slugs a page can never take: the site's own sections and files.
export const RESERVED_SLUGS = ['demos', 'posts', 'blog', 'writing', 'series', 'c', 'og', 'observatory', 'darkroom', 'apps', 'appointments', 'rss.xml', 'icons', 'glyph-preview', 'site-images', 'guides', 'interactives', 'fonts', 'licences', 'licenses', 'images', 'assets', '_astro', 'favicon.svg', 'robots.txt', 'sitemap.xml', '404', 'index', 'page', 'tag', 'tags', 'search', 'feed', 'admin', 'api'];
// home, about and contact are pages too, but they render at /, /about/ and /contact/.
export const SPECIAL_SLUGS = ['home', 'about', 'contact'];
export function slugProblem(slug, taken = []) {
  const s = String(slug || '');
  if (!s) return 'Give the page a web address.';
  if (!SLUG.test(s)) return 'Use lower-case letters, numbers and dashes only.';
  if (RESERVED_SLUGS.includes(s)) return 'That address is used by your website already. Choose another.';
  if (taken.includes(s)) return 'Another page already uses that address.';
  return '';
}
// "Our Treatments & Fees" → "our-treatments-fees"
export function slugFrom(title) {
  return String(title || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

// ---- links and pictures --------------------------------------------------------------------
// A link's address: a page on this site (/…), a full https address, an email or phone link, or
// one of the business details (@booking, @phone, @email) so a phone change updates every page.
export const LINK_SPECIALS = ['@booking', '@phone', '@email'];
export function cleanHref(v) {
  const s = cleanLine(v, 2048);
  if (LINK_SPECIALS.includes(s)) return s;
  if (/^\/(?![\/\\])[^\\\s\u0000-\u001f<>"'`]*$/.test(s) && !s.includes('..')) return s;
  if (/^mailto:[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/i.test(s)) return s;
  if (/^tel:\+?[0-9]{3,20}$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch { return ''; }
}
function cleanLink(v, maxLabel = 60) {
  if (!isObj(v)) return null;
  const label = cleanLine(v.label, maxLabel), href = cleanHref(v.href);
  return label || href ? { label, href } : null;
}
// Pictures live in the site's own repository. Chapbook's editor may also show a picture that is
// not saved yet (a data: URL); the published site never accepts one.
export const SITE_IMAGE = /^\/site-images\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const CREDIT_LICENCES = ['cc0', 'pdm', 'by', 'by-sa'];
function cleanCredit(v) {
  if (!isObj(v)) return null;
  const licence = String(v.license || v.licence || '').toLowerCase();
  if (!CREDIT_LICENCES.includes(licence)) return null;
  const page = cleanHref(v.page || v.url);
  const out = { creator: cleanLine(v.creator, 120), title: cleanLine(v.title, 160), license: licence, page: /^https:/.test(page) ? page : '' };
  // CC BY asks for the licence version and a link to the licence itself.
  if (/^\d\.\d$/.test(String(v.version || ''))) out.version = String(v.version);
  const deed = cleanHref(v.licenceUrl || v.licenseUrl);
  if (/^https:\/\/creativecommons\.org\//.test(deed)) out.licenceUrl = deed;
  return out;
}
export function cleanPicture(v, { allowData = false } = {}) {
  if (!isObj(v)) return null;
  const src = typeof v.src === 'string' ? v.src.trim() : '';
  // Older sites may also use pictures at a full https address, as their Home page always could.
  let https = false;
  if (/^https:\/\//i.test(src) && src.length <= 2048) { try { const u = new URL(src); https = u.protocol === 'https:' && !u.username && !u.password; } catch {} }
  const ok = (SITE_IMAGE.test(src) && !src.includes('..')) || https || (allowData && src.length < 12e6 && DATA_IMAGE.test(src));
  if (!ok) return null;
  const out = { src, alt: cleanLine(v.alt, 240) };
  const credit = cleanCredit(v.credit);
  if (credit) out.credit = credit;
  // Where the picture's centre of interest is, so crops keep faces in frame.
  if (['top', 'bottom', 'left', 'right'].includes(v.focus)) out.focus = v.focus;
  return out;
}
const VIDEO_HOSTS = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|(?:player\.)?vimeo\.com\/(?:video\/)?)/;
export function cleanVideo(v) {
  const s = cleanLine(v, 400);
  if (/^\/site-images\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(?:mp4|webm)$/.test(s)) return s;
  return VIDEO_HOSTS.test(s) ? s : '';
}
export function videoEmbed(src) {
  const s = cleanVideo(src);
  if (!s) return null;
  if (s.startsWith('/')) return { kind: 'file', src: s };
  let m = s.match(/(?:v=|embed\/|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { kind: 'frame', src: `https://www.youtube-nocookie.com/embed/${m[1]}`, host: 'YouTube' };
  m = s.match(/vimeo\.com\/(?:video\/)?(\d{4,12})/);
  if (m) return { kind: 'frame', src: `https://player.vimeo.com/video/${m[1]}?dnt=1`, host: 'Vimeo' };
  return null;
}
export const INTERACTIVE_SRC = /^\/interactives\/[a-z0-9][a-z0-9-]{0,79}\.html$/;

// ---- block types ---------------------------------------------------------------------------
// Field kinds: line (one line), rich (paragraphs, **bold**, *italic*, [links](…), - lists),
// plain (several lines, no marks, e.g. opening hours), picture, link, links (buttons), items
// (a repeating list), bool, number, choice, video, src (interactive file), children (columns).
const L = (max, label, ph) => ({ kind: 'line', max, label, ph: ph || `Add ${label.toLowerCase()}` });
const R = (max, label, ph) => ({ kind: 'rich', max, label, ph: ph || `Add ${label.toLowerCase()}` });
const PIC = (label = 'Picture') => ({ kind: 'picture', label });
const BTNS = (max = 2) => ({ kind: 'links', max, label: 'Buttons' });
const HEAD = L(160, 'Heading', 'Add a heading');

export const BACKGROUNDS = ['none', 'tint', 'accent', 'dark', 'picture'];
export const WIDTHS = ['narrow', 'normal', 'wide', 'full'];
export const SPACES = ['s', 'm', 'l'];
export const ALIGNS = ['left', 'centre'];
export const STYLE_LABELS = {
  bg: { none: 'Page colour', tint: 'Soft tint', accent: 'Accent colour', dark: 'Dark', picture: 'Picture' },
  width: { narrow: 'Narrow', normal: 'Normal', wide: 'Wide', full: 'Edge to edge' },
  space: { s: 'Tight', m: 'Normal', l: 'Roomy' },
  align: { left: 'Left', centre: 'Centred' },
};
// Types that can sit inside a columns block.
export const COLUMN_TYPES = ['text', 'image', 'cta', 'contact', 'credentials', 'facts', 'reviews', 'form'];

export const BLOCK_TYPES = {
  hero: {
    label: 'Opening', hint: 'The first thing people see: a heading, a line or two, buttons and a picture.',
    variants: { split: 'Words beside a photo', centred: 'Centred', 'photo-behind': 'Words over a photo', panel: 'With a details panel', poster: 'Big type', stacked: 'Photo on top', minimal: 'Words only' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, intro: R(1200, 'Introduction'), picture: PIC(), buttons: BTNS(2), details: { kind: 'bool', label: 'Show opening hours, address and phone' } },
  },
  text: {
    label: 'Text', hint: 'A heading and paragraphs. Can sit beside a picture.',
    variants: { plain: 'Plain', sidehead: 'Heading on the side', lede: 'Large opening words', boxed: 'Highlighted box', 'picture-left': 'Picture on the left', 'picture-right': 'Picture on the right' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, body: R(20000, 'Text', 'Add your words'), picture: PIC(), buttons: BTNS(2) },
  },
  image: {
    label: 'Picture', hint: 'One photo with a caption.',
    variants: { normal: 'In the column', wide: 'Wide', 'full-bleed': 'Edge to edge', framed: 'Framed' },
    fields: { picture: PIC(), caption: L(300, 'Caption') },
  },
  gallery: {
    label: 'Photo gallery', hint: 'Several photos in a grid, a mosaic or a strip.',
    variants: { grid: 'Grid', masonry: 'Mixed heights', mosaic: 'One large, four small', strip: 'Scrolling strip' },
    fields: { heading: HEAD, intro: R(600, 'Introduction'), pictures: { kind: 'pictures', max: 24, label: 'Photos' } },
  },
  services: {
    label: 'Services and prices', hint: 'What you offer, with prices, times and booking links.',
    variants: { menu: 'Menu with dotted lines', cards: 'Cards', numbered: 'Numbered list', table: 'Price table', board: 'Price board', feature: 'Large with photos' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 40, label: 'Services', add: 'Add a service', item: {
        name: L(100, 'Name', 'Name of the service'), description: R(600, 'Description'), price: L(60, 'Price', 'Price'), duration: L(60, 'Time', 'Time'),
        offer: L(120, 'Offer'), picture: PIC(), link: { kind: 'link', label: 'Booking link' }, pay: { kind: 'link', label: 'Pay link' },
      }, sample: { name: 'New service', description: '', price: '', duration: '' } },
    },
  },
  team: {
    label: 'Team', hint: 'The people behind the business, with photos and short bios.',
    variants: { grid: 'Grid', rows: 'Rows', single: 'One person, large', circles: 'Round photos' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 24, label: 'People', add: 'Add a person', item: {
        name: L(100, 'Name', 'Name'), role: L(120, 'Role', 'Role'), bio: R(2000, 'About them'), picture: PIC('Photo'), link: { kind: 'link', label: 'Link' },
      }, sample: { name: 'New person', role: '', bio: '' } },
    },
  },
  reviews: {
    label: 'Reviews', hint: 'What customers say about you.',
    variants: { cards: 'Cards', 'big-quote': 'One big quote', list: 'List', wall: 'Quote wall' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD,
      items: { kind: 'items', max: 24, label: 'Reviews', add: 'Add a review', item: {
        quote: R(1200, 'Quote', 'What they said'), name: L(100, 'Name', 'Their name'), detail: L(120, 'Detail', 'e.g. Runner, Poole'), stars: { kind: 'number', min: 0, max: 5, label: 'Stars' },
      }, sample: { quote: 'What they said.', name: 'Name', detail: '', stars: 5 } },
      source: { kind: 'link', label: 'Link to more reviews' },
    },
  },
  faq: {
    label: 'Questions and answers', hint: 'Common questions, answered.',
    variants: { accordion: 'Open one at a time', 'two-column': 'Two columns', list: 'All open' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 40, label: 'Questions', add: 'Add a question', item: { question: L(240, 'Question', 'The question'), answer: R(3000, 'Answer', 'The answer') }, sample: { question: 'A new question?', answer: 'The answer.' } },
    },
  },
  contact: {
    label: 'Contact details', hint: 'Address, opening hours, phone and email.',
    variants: { card: 'Card', inline: 'In a row', split: 'Heading beside details', band: 'Coloured band' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      business: { kind: 'bool', label: 'Use my business details' },
      address: { kind: 'plain', max: 300, label: 'Address', ph: 'Add an address' }, hours: { kind: 'plain', max: 400, label: 'Opening hours', ph: 'Add opening hours' },
      phone: L(60, 'Phone'), email: L(254, 'Email'), map: { kind: 'link', label: 'Map link' }, buttons: BTNS(2),
    },
  },
  cta: {
    label: 'Call to action', hint: 'A short message with a button, such as “Book now”.',
    variants: { band: 'Band', card: 'Card', minimal: 'Minimal', split: 'Words and buttons side by side' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, body: R(800, 'Text'), buttons: BTNS(2) },
  },
  form: {
    label: 'Contact form', hint: 'A form people fill in to message you.',
    variants: { normal: 'Form only', split: 'Words beside the form' },
    fields: { heading: HEAD, intro: R(800, 'Introduction'), button: L(40, 'Button text', 'Send message'), note: L(240, 'Small print') },
  },
  posts: {
    label: 'Latest posts', hint: 'Your newest posts, updated automatically.',
    variants: { list: 'List', cards: 'Cards', feature: 'One large, then a list' },
    fields: { heading: HEAD, count: { kind: 'number', min: 2, max: 6, label: 'How many' }, more: L(60, 'Link text', 'All posts') },
  },
  credentials: {
    label: 'Qualifications', hint: 'Qualifications, memberships, awards or guarantees.',
    variants: { list: 'List', badges: 'Badges', strip: 'One line' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, items: { kind: 'items', max: 16, label: 'Items', add: 'Add one', item: { text: L(160, 'Text', 'e.g. Fully insured') }, sample: { text: 'New item' } } },
  },
  facts: {
    label: 'Key facts', hint: 'A few numbers or short facts, such as “25 years”.',
    variants: { row: 'In a row', large: 'Large', ruled: 'With lines' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, items: { kind: 'items', max: 6, label: 'Facts', add: 'Add a fact', item: { value: L(24, 'Number or word', 'e.g. 25'), label: L(80, 'What it means', 'e.g. years in business') }, sample: { value: '10', label: 'New fact' } } },
  },
  notice: {
    label: 'Announcement', hint: 'A short notice, such as a holiday closure or an offer.',
    variants: { bar: 'Thin bar', ribbon: 'Ribbon' },
    fields: { text: L(240, 'Notice', 'Add a short notice'), link: { kind: 'link', label: 'Link' } },
  },
  columns: {
    label: 'Columns', hint: 'Two or three blocks side by side. They stack on phones.',
    variants: { 'half': 'Two equal', 'wide-left': 'Wider on the left', 'wide-right': 'Wider on the right', thirds: 'Three equal' },
    fields: { children: { kind: 'children', min: 2, max: 3, types: COLUMN_TYPES } },
  },
  video: {
    label: 'Video', hint: 'A YouTube or Vimeo video, or a video file.',
    variants: { normal: 'In the column', wide: 'Wide' },
    fields: { heading: HEAD, src: { kind: 'video', label: 'Video address' }, caption: L(300, 'Caption') },
  },
  interactive: {
    label: 'Interactive', hint: 'One of your saved interactives.',
    variants: { normal: 'In the column', wide: 'Wide' },
    fields: { heading: HEAD, src: { kind: 'src', label: 'Interactive' }, title: L(120, 'Title'), height: { kind: 'number', min: 240, max: 1400, label: 'Height' } },
  },
  spacer: {
    label: 'Space', hint: 'Extra space, with or without a line.',
    variants: { space: 'Space', line: 'Line', ornament: 'Ornament' },
    fields: { size: { kind: 'choice', options: ['s', 'm', 'l'], label: 'Size' } },
  },
};
export const TYPE_IDS = Object.keys(BLOCK_TYPES);
export const variantsOf = (type) => Object.keys(BLOCK_TYPES[type]?.variants || {});

// ---- normalising ---------------------------------------------------------------------------
function cleanField(f, v, opts) {
  switch (f.kind) {
    case 'line': return cleanLine(v, f.max);
    case 'rich': case 'plain': return cleanText(v, f.max);
    case 'picture': return cleanPicture(v, opts);
    case 'pictures': return (Array.isArray(v) ? v : []).map((p) => cleanPicture(p, opts)).filter(Boolean).slice(0, f.max);
    case 'link': return cleanLink(v);
    case 'links': return (Array.isArray(v) ? v : []).map((x) => cleanLink(x)).filter(Boolean).slice(0, f.max);
    case 'bool': return v === true;
    case 'number': { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= f.min && n <= f.max ? n : null; }
    case 'choice': return f.options.includes(v) ? v : null;
    case 'video': return cleanVideo(v);
    case 'src': return typeof v === 'string' && INTERACTIVE_SRC.test(v) ? v : '';
    default: return null;
  }
}
const emptyValue = (v) => v === '' || v === null || v === false || (Array.isArray(v) && !v.length);
function cleanItems(f, list, opts) {
  const seen = new Set(), out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!isObj(raw) || out.length >= f.max) continue;
    const item = {};
    for (const [k, sub] of Object.entries(f.item)) { const c = cleanField(sub, raw[k], opts); if (!emptyValue(c)) item[k] = c; }
    let id = typeof raw.id === 'string' && ID.test(raw.id) && !seen.has(raw.id) ? raw.id : '';
    if (!id) { let n = out.length + 1; while (seen.has(`i${n}`) || (Array.isArray(list) && list.some((x) => x && x.id === `i${n}`))) n++; id = `i${n}`; }
    seen.add(id);
    out.push({ id, ...item });
  }
  return out;
}
function cleanData(type, data, opts, depth) {
  const spec = BLOCK_TYPES[type], d = isObj(data) ? data : {}, out = {};
  for (const [k, f] of Object.entries(spec.fields)) {
    let c;
    if (f.kind === 'items') c = cleanItems(f, d[k], opts);
    else if (f.kind === 'children') c = depth ? [] : (Array.isArray(d[k]) ? d[k] : []).map((b) => normaliseBlock(b, opts, depth + 1, f.types)).filter(Boolean).slice(0, f.max);
    else c = cleanField(f, d[k], opts);
    if (!emptyValue(c)) out[k] = c;
  }
  // Any block may carry a backdrop picture, used when its background is "Picture".
  const backdrop = cleanPicture(d.backdrop, opts);
  if (backdrop) out.backdrop = backdrop;
  return out;
}
export function cleanStyle(s) {
  const v = isObj(s) ? s : {};
  return {
    bg: BACKGROUNDS.includes(v.bg) ? v.bg : 'none',
    width: WIDTHS.includes(v.width) ? v.width : 'normal',
    space: SPACES.includes(v.space) ? v.space : 'm',
    align: ALIGNS.includes(v.align) ? v.align : 'left',
  };
}
export function normaliseBlock(b, opts = {}, depth = 0, allowed = TYPE_IDS) {
  if (!isObj(b) || !Object.hasOwn(BLOCK_TYPES, b.type) || !allowed.includes(b.type)) return null;
  if (depth && b.type === 'columns') return null;
  const variants = variantsOf(b.type);
  const out = {
    id: typeof b.id === 'string' && ID.test(b.id) ? b.id : '',
    type: b.type,
    role: typeof b.role === 'string' && ROLE.test(b.role) ? b.role : b.type,
    variant: variants.includes(b.variant) ? b.variant : variants[0],
    style: cleanStyle(b.style),
    data: cleanData(b.type, b.data, opts, depth),
  };
  if (out.style.bg === 'picture' && !out.data.backdrop) out.style.bg = 'dark';
  if (b.sample === true) out.sample = true;
  // Which template slot a sample block came from ("template-id/role"), so an untouched one can be recognised.
  if (out.sample && typeof b.origin === 'string' && /^[a-z0-9-]{1,60}\/[a-z0-9-]{1,30}$/.test(b.origin)) out.origin = b.origin;
  return out;
}
// Ids must be unique across the whole page (columns included); blanks and repeats get new ones.
function settleIds(blocks, seen) {
  let n = 1;
  const fresh = () => { while (seen.has(`b${n}`)) n++; seen.add(`b${n}`); return `b${n}`; };
  for (const b of blocks) {
    if (!b.id || seen.has(b.id)) b.id = fresh(); else seen.add(b.id);
    if (b.data.children) settleIds(b.data.children, seen);
  }
}
const FONT_KEYS = ['classic', 'modern', 'editorial', 'clean', 'friendly', 'grotesk', 'mono'];
export const LOOK_COLOURS = ['bg', 'surface', 'ink', 'accent', 'deep'];
export function cleanLook(v) {
  const d = isObj(v) ? v : {};
  const colours = {};
  for (const k of LOOK_COLOURS) { const c = cleanHex(isObj(d.colours) ? d.colours[k] : ''); if (c) colours[k] = c; }
  const out = {};
  if (typeof d.palette === 'string' && TEMPLATE_ID.test(d.palette)) out.palette = d.palette;
  // A palette needs at least a background, text and accent colour to be used.
  if (colours.bg && colours.ink && colours.accent) out.colours = colours;
  if (FONT_KEYS.includes(d.font)) out.font = d.font;
  return out;
}
export function normalisePage(raw, opts = {}) {
  const p = isObj(raw) ? raw : {};
  const slug = typeof p.slug === 'string' && (SLUG.test(p.slug) || SPECIAL_SLUGS.includes(p.slug)) && !RESERVED_SLUGS.includes(p.slug) ? p.slug : '';
  const title = cleanLine(p.title, 80);
  const menu = isObj(p.menu) ? p.menu : {};
  const blocks = (Array.isArray(p.blocks) ? p.blocks : []).map((b) => normaliseBlock(b, opts)).filter(Boolean).slice(0, MAX_BLOCKS);
  const spare = (Array.isArray(p.spare) ? p.spare : []).map((b) => normaliseBlock(b, opts)).filter(Boolean).slice(0, MAX_BLOCKS);
  const seen = new Set();
  settleIds(blocks, seen); settleIds(spare, seen);
  const out = {
    v: PAGE_VERSION, title, slug,
    menu: { show: menu.show !== false, label: cleanLine(menu.label, 40) },
    description: cleanLine(p.description, 300),
    template: typeof p.template === 'string' && TEMPLATE_ID.test(p.template) ? p.template : '',
    look: cleanLook(p.look),
    blocks,
  };
  if (spare.length) out.spare = spare;
  return out;
}

// ---- making new blocks ---------------------------------------------------------------------
let counter = 0;
export function newId(taken = new Set()) {
  for (;;) {
    const id = (Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6) + (counter++ % 36).toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 10);
    if (ID.test(id) && !taken.has(id)) return id;
  }
}
export function allIds(page) {
  const ids = new Set();
  const walk = (list) => { for (const b of list || []) { ids.add(b.id); walk(b.data?.children); } };
  walk(page?.blocks); walk(page?.spare);
  return ids;
}
// A fresh, empty block of a type, ready for the editor (placeholders show until it is filled).
export function newBlock(type, variant, taken = new Set()) {
  if (!Object.hasOwn(BLOCK_TYPES, type)) throw new Error(`Unknown block type: ${type}`);
  const id = newId(taken); taken.add(id);
  const data = {};
  if (type === 'posts') data.count = 3;
  if (type === 'contact') data.business = true;
  if (type === 'spacer') data.size = 'm';
  if (type === 'interactive') data.height = 520;
  if (type === 'columns') data.children = [newBlock('text', 'plain', taken), newBlock('image', 'normal', taken)];
  const b = { id, type, role: type, variant: variantsOf(type).includes(variant) ? variant : variantsOf(type)[0], style: cleanStyle({}), data };
  return b;
}
// A copy with new ids throughout, for Duplicate.
export function cloneBlock(block, taken = new Set()) {
  const copy = JSON.parse(JSON.stringify(block));
  const walk = (b) => { b.id = newId(taken); taken.add(b.id); for (const c of b.data?.children || []) walk(c); };
  walk(copy);
  return copy;
}
// Find a block anywhere in a page (columns included).
export function findBlock(page, id) {
  for (const list of [page?.blocks, page?.spare]) {
    for (const b of list || []) {
      if (b.id === id) return b;
      for (const c of b.data?.children || []) if (c.id === id) return c;
    }
  }
  return null;
}
// The schema entry for a value path such as "items.2.price" inside a block of a type.
export function fieldAt(type, path) {
  const parts = String(path).split('.');
  let f = BLOCK_TYPES[type]?.fields?.[parts[0]];
  if (!f) return parts[0] === 'backdrop' ? { kind: 'picture', label: 'Background picture' } : null;
  if (f.kind === 'items' && parts.length >= 3) f = f.item[parts[2]];
  else if ((f.kind === 'links' || f.kind === 'pictures') && parts.length >= 2) f = { ...f, kind: f.kind === 'links' ? 'link' : 'picture' };
  return f || null;
}
