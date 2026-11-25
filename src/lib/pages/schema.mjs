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
// A calendar date as the page file keeps it: 2026-12-05. Anything that is not a real day is dropped.
export function cleanDate(v) {
  const m = typeof v === 'string' ? v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return '';
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate() ? m[0] : '';
}
const HEX = /^#[0-9a-f]{6}$/i;
export const cleanHex = (v) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : '');
const ID = /^[a-z0-9]{1,12}$/;
const ROLE = /^[a-z0-9-]{1,30}$/;
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const TEMPLATE_ID = /^[a-z0-9-]{1,60}$/;

// Slugs a page can never take: the site's own sections and files.
export const RESERVED_SLUGS = ['demos', 'posts', 'blog', 'writing', 'series', 'c', 'og', 'observatory', 'darkroom', 'apps', 'appointments', 'rss.xml', 'icons', 'glyph-preview', 'site-images', 'guides', 'interactives', 'fonts', 'licences', 'licenses', 'images', 'assets', '_astro', 'favicon.svg', 'robots.txt', 'sitemap.xml', '404', 'index', 'page', 'tag', 'tags', 'search', 'feed', 'admin', 'api', 'add-to-calendar'];
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
// `ai-generated`: a sample photo made for Chapbook by an image model, credited as what it is.
const CREDIT_LICENCES = ['cc0', 'pdm', 'by', 'by-sa', 'ai-generated'];
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
  // A smaller copy of the same photo for phones (about 800px wide), in the site's own images.
  const phone = typeof v.phone === 'string' ? v.phone.trim() : '';
  if (phone && SITE_IMAGE.test(phone) && !phone.includes('..') && SITE_IMAGE.test(src)) {
    out.phone = phone;
    // How wide each copy really is, in pixels, so a browser takes the right one.
    const px = (n) => (Number.isInteger(n) && n >= 16 && n <= 8000 ? n : 0);
    if (px(v.w)) out.w = v.w;
    if (px(v.phoneW)) out.phoneW = v.phoneW;
  }
  const credit = cleanCredit(v.credit);
  if (credit) out.credit = credit;
  // Where the picture's centre of interest is, so crops keep faces in frame.
  if (['top', 'bottom', 'left', 'right'].includes(v.focus)) out.focus = v.focus;
  // A gallery tile may play a short clip; the picture is its poster.
  const clip = videoFile(v.video);
  if (clip) out.video = clip;
  return out;
}
const VIDEO_HOSTS = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|(?:player\.)?vimeo\.com\/(?:video\/)?)/;
// A video file in the site (/site-images/…) or at an https address (such as the writer's own
// Cloudflare R2 storage), or a YouTube or Vimeo page.
export const VIDEO_FILE = /^\/site-images\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(?:mp4|webm)$/;
export function videoFile(v) {
  const s = cleanLine(v, 2048);
  if (VIDEO_FILE.test(s)) return s;
  try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password && /\.(?:mp4|webm)$/i.test(u.pathname) ? u.href : ''; } catch { return ''; }
}
export function cleanVideo(v) {
  const s = cleanLine(v, 2048);
  return videoFile(s) || (VIDEO_HOSTS.test(s) ? s : '');
}
export function videoEmbed(src) {
  const s = cleanVideo(src);
  if (!s) return null;
  if (videoFile(s)) return { kind: 'file', src: s };
  let m = s.match(/(?:v=|embed\/|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { kind: 'frame', src: `https://www.youtube-nocookie.com/embed/${m[1]}`, host: 'YouTube' };
  m = s.match(/vimeo\.com\/(?:video\/)?(\d{4,12})/);
  if (m) return { kind: 'frame', src: `https://player.vimeo.com/video/${m[1]}?dnt=1`, host: 'Vimeo' };
  return null;
}
// Online booking. Cal.com (open source, free for one person; links to Google, Outlook or Apple
// calendars) and Google Calendar booking pages can show their calendar on the page. Any other https
// booking page gets a button.
export function bookingTarget(v) {
  const s = cleanHref(v);
  if (!/^https:/.test(s)) return null;
  const u = new URL(s);
  const path = u.pathname.replace(/^\/+|\/+$/g, '');
  // Public booking links look like cal.com/<name>/<event>. The dashboard (app.cal.com, settings,
  // event types…) can't be shown to visitors, so those only get a button.
  const CAL_APP = /^(?:event-types|bookings|settings|availability|apps|workflows|insights|auth|signup|login|pricing|blog|help|teams|routing-forms|upcoming|apps)(?:\/|$)/;
  // The owner's link is kept as typed, query and hash included (round B review S1): a Cal.com
  // link such as cal.com/sam/massage?duration=60 opens that length. `embed` is what the page's
  // calendar is given: the path, with the query, which booking-calendar.js passes on to Cal.com.
  const rest = `${u.search}${u.hash}`;
  if (['cal.com', 'www.cal.com'].includes(u.hostname) && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+){0,3}$/.test(path) && !CAL_APP.test(path)) return { kind: 'cal', href: `https://cal.com/${path}${rest}`, calLink: path, embed: `${path}${u.search}`, provider: 'Cal.com' };
  const g = u.hostname === 'calendar.google.com' && path.replace(/^calendar\/u\/\d+\//, 'calendar/');
  if (g && /^calendar\/appointments\/schedules\/[A-Za-z0-9_-]{10,200}$/.test(g)) {
    // A pasted Google embed code carries gv=true on the address it puts in its frame, so the page's
    // frame keeps it. Google's help page does not describe gv=true, so the address for "Open
    // booking in a separate page" is the schedule's address without it, with anything else the
    // owner typed.
    const q = new URLSearchParams(u.search); q.delete('gv');
    return { kind: 'google', href: `https://calendar.google.com/${g}${q.toString() ? `?${q}` : ''}${u.hash}`, frame: `https://calendar.google.com/${g}?gv=true`, provider: 'Google Calendar' };
  }
  return { kind: 'link', href: u.href, provider: '' };
}
// Payment pages the website recognises, so a pay button can say who takes the payment ("Pays
// securely through Stripe"). `path` is what the address must start with on that host; `query`,
// a saved button's id after the "?". Chapbook's pay link check (payLink.js) uses the same list.
export const PAY_HOSTS = [
  { host: 'buy.stripe.com', name: 'Stripe' },
  { host: 'book.stripe.com', name: 'Stripe' },
  { host: 'donate.stripe.com', name: 'Stripe' },
  { host: 'paypal.me', name: 'PayPal' },
  { host: 'www.paypal.me', name: 'PayPal' },
  { host: 'www.paypal.com', path: '/paypalme/', name: 'PayPal' },
  { host: 'paypal.com', path: '/paypalme/', name: 'PayPal' },
  // PayPal's own "payment links and buttons", its donate page and its older saved buttons.
  { host: 'www.paypal.com', path: '/ncp/payment/', name: 'PayPal' },
  { host: 'www.paypal.com', path: '/donate', query: ['hosted_button_id', 'campaign_id'], name: 'PayPal' },
  { host: 'www.paypal.com', path: '/cgi-bin/webscr', query: ['hosted_button_id'], name: 'PayPal' },
  // PayPal's sandbox: the same pages, for trying things out. Recognised so it can be warned about.
  { host: 'www.sandbox.paypal.com', path: '/ncp/payment/', name: 'PayPal', test: true },
  { host: 'sandbox.paypal.com', path: '/ncp/payment/', name: 'PayPal', test: true },
  { host: 'www.sandbox.paypal.com', path: '/cgi-bin/webscr', query: ['hosted_button_id'], name: 'PayPal', test: true },
  { host: 'www.sandbox.paypal.com', path: '/donate', query: ['hosted_button_id', 'campaign_id'], name: 'PayPal', test: true },
  { host: 'pay.sumup.com', name: 'SumUp' },
  { host: 'square.link', name: 'Square' },
  { host: 'checkout.square.site', name: 'Square' },
  // Square's sandbox links, for trying things out (Square's developer pages, Checkout API
  // "optional checkout configurations": "url" : "https://sandbox.square.link/u/fTkKKauH").
  { host: 'sandbox.square.link', name: 'Square', test: true },
];
// The payment page an address is, or null: { name, test }. A Stripe test link (its path starts
// /test_) and a PayPal or Square sandbox page are recognised as `test: true`: no real money changes hands.
export function payPage(href) {
  let u;
  try { u = new URL(String(href ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, ''), path = u.pathname || '/';
  const hit = PAY_HOSTS.find((h) => h.host === host && path.toLowerCase().startsWith(h.path || '/')
    && (h.query ? h.query.some((q) => u.searchParams.get(q)) : path.length > (h.path || '/').length));
  if (!hit) return null;
  return { name: hit.name, test: !!hit.test || (hit.name === 'Stripe' && /^\/test_/i.test(path)) };
}
// "Pays securely through Stripe": the words beside a pay button, named from its address, or ''
// for an address the website does not recognise.
export const payLine = (href) => { const p = payPage(href); return p ? `Pays securely through ${p.name}` : ''; };
export const INTERACTIVE_SRC = /^\/interactives\/[a-z0-9][a-z0-9-]{0,79}\.html$/;

// ---- block types ---------------------------------------------------------------------------
// Field kinds: line (one line), rich (paragraphs, **bold**, *italic*, [links](…), - lists),
// plain (several lines, no marks, e.g. opening hours), picture, link, links (buttons), items
// (a repeating list), bool, number, choice, video, src (interactive file), children (columns),
// date (a calendar day, kept as 2026-12-05). A number may carry `step` for its plus and minus
// buttons in the editor, and `quick: true` to have those buttons beside the entry on the page.
// A line marked `panel: true` has no place of its own on the page, so the editor offers it in the
// block's settings (with its `hint`). A choice may carry `labels` for its options.
const L = (max, label, ph) => ({ kind: 'line', max, label, ph: ph || `Add ${label.toLowerCase()}` });
const R = (max, label, ph) => ({ kind: 'rich', max, label, ph: ph || `Add ${label.toLowerCase()}` });
// A card linked to a service in Your services (round C): the service's id, or for a summary card the
// ids of the services it sums up. The card then takes its name, length, price and links from the list.
const SVC = { kind: 'service', label: 'Service in Your services' };
const SVCS = { kind: 'services', max: 12, label: 'Services this card sums up' };
// Where a linked card shows its service's length: in its own place, in the heading ("Sports massage,
// 30 minutes") or not at all, so a card keeps the look it had (round C build review S6).
const SVCLEN = { kind: 'choice', options: ['own', 'heading', 'hidden'], def: 'own', labels: { own: 'In its own place', heading: 'In the heading', hidden: 'Not shown' }, label: 'The length on this card' };
const PIC = (label = 'Picture') => ({ kind: 'picture', label });
const BTNS = (max = 2) => ({ kind: 'links', max, label: 'Buttons' });
const HEAD = L(160, 'Heading', 'Add a heading');
// A WhatsApp number: digits only, with the country code and without the leading 0 of a local
// number (447700900123, not 07700 900123). Anything else is dropped.
const WA = { kind: 'line', max: 24, digits: true, label: 'WhatsApp number with country code', ph: 'e.g. 447700900123' };
const WA_HINT = 'Start with the country code (44 for the UK) and leave out the first 0, for example 447700900123.';
export function cleanWhatsapp(v) {
  // "+44 (0)7700 900123" is written that way in the UK; the (0) is not dialled from abroad.
  let s = cleanLine(v, 40).replace(/\(0\)/g, '').replace(/[\s().-]/g, '');
  if (s.startsWith('+')) s = s.slice(1); else if (s.startsWith('00')) s = s.slice(2);
  return /^[1-9]\d{7,14}$/.test(s) ? s : '';
}

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
export const COLUMN_TYPES = ['text', 'image', 'cta', 'contact', 'credentials', 'facts', 'reviews', 'form', 'booking', 'video'];

// The public registers a professional's registration can be checked on (UK). `site` is where the
// register is searched; the number shown beside it is the person's own. These are quick picks:
// choosing one fills in the governing body's name, its short label and the link to its register,
// which the business can then change, and anyone outside the UK, or with a different body, types
// their own (owner, 22 Nov: no country setting). Each link is the body's own register search, or
// its page on checking the register, checked on 22 Nov 2026.
export const REGULATORS = {
  gmc: { short: 'GMC', name: 'General Medical Council', href: 'https://www.gmc-uk.org/registration-and-licensing/the-medical-register' },
  nmc: { short: 'NMC PIN', name: 'Nursing and Midwifery Council', href: 'https://www.nmc.org.uk/registration/search-the-register/' },
  gdc: { short: 'GDC', name: 'General Dental Council', href: 'https://olr.gdc-uk.org/searchregister' },
  hcpc: { short: 'HCPC', name: 'Health and Care Professions Council', href: 'https://www.hcpc-uk.org/check-the-register/' },
  gphc: { short: 'GPhC', name: 'General Pharmaceutical Council', href: 'https://www.pharmacyregulation.org/registers' },
  // Registers for professions the law does not regulate, each accredited by the Professional
  // Standards Authority: counselling and psychotherapy, and complementary therapies such as sports
  // massage.
  bacp: { short: 'BACP', name: 'British Association for Counselling and Psychotherapy', href: 'https://www.bacp.co.uk/search/Register' },
  ukcp: { short: 'UKCP', name: 'UK Council for Psychotherapy', href: 'https://www.psychotherapy.org.uk/about-ukcp/our-register/' },
  ncps: { short: 'NCPS', name: 'National Counselling and Psychotherapy Society', href: 'https://ncps.com/find-a-counsellor/search-the-directory' },
  cnhc: { short: 'CNHC', name: 'Complementary and Natural Healthcare Council', href: 'https://search.cnhcregister.org.uk/' },
};
export const REGULATOR_IDS = Object.keys(REGULATORS);
// A registration's own governing body, typed by the business ('own' in the quick picks).
export const OWN_REGULATOR = 'own';
// A register's address: a full https address, nothing else (no page of this site, no email).
export function cleanRegisterHref(v) {
  const s = cleanHref(v);
  return /^https:\/\//.test(s) ? s : '';
}
// The governing body a registration is checked with: what the business typed, or else the quick
// pick it chose. Websites saved before the governing body could be typed have only the pick, so
// they draw exactly as they did (an unknown pick was always taken as the GMC).
export function registerOf(x) {
  const item = x && typeof x === 'object' ? x : {};
  if (item.bodyName || item.bodyShort || item.bodyHref) return { short: item.bodyShort || '', name: item.bodyName || '', href: cleanRegisterHref(item.bodyHref) };
  if (item.body === OWN_REGULATOR) return { short: '', name: '', href: '' };
  return REGULATORS[item.body] || REGULATORS.gmc;
}
// A CQC location ID, as CQC writes it: 1-101641587.
export const CQC_ID = /^1-\d{6,12}$/;
export const CQC_RATINGS = { outstanding: 'Outstanding', good: 'Good', 'requires-improvement': 'Requires improvement', inadequate: 'Inadequate' };
// Whether a regulator section uses the CQC: its one-line rating layout, CQC's own widget, or a
// person registered with a body whose practices the CQC registers (doctors, nurses, dentists,
// pharmacists). A CQC detail already given in Details and booking counts too. Therapists (the
// HCPC and the accredited registers) and anyone naming their own governing body are not asked.
// The app's Make it yours and the editor's placeholder use this same rule (walk, 23 Nov).
export const CQC_BODIES = ['gmc', 'nmc', 'gdc', 'gphc'];
const hasText = (v) => typeof v === 'string' && v.trim() !== '';
export const usesCqc = (b, pro = {}) => !!b && b.type === 'regulator' && (b.variant === 'line' || b.data?.widget === true
  || (b.data?.items || []).some((x) => CQC_BODIES.includes(x?.body ?? 'gmc'))
  || !!(pro && (hasText(pro.cqcId) || hasText(pro.cqcRating) || hasText(pro.cqcDate))));

export const BLOCK_TYPES = {
  hero: {
    label: 'Opening', hint: 'The first thing people see: a heading, a line or two, buttons and a picture.',
    variants: {
      split: 'Words beside a photo', centred: 'Centred', 'photo-behind': 'Words over a photo', panel: 'With a details panel', poster: 'Big type', stacked: 'Photo on top', minimal: 'Words only',
      // Openings built around movement. Each still reads well with movement turned off.
      marquee: 'Moving headline', wordmark: 'Giant name', open: 'Name opens to a photo', orbit: 'Circling photos', collage: 'Floating photos', mask: 'Photo inside the letters', arch: 'Arch window', blob: 'Colour block, photo in a moving shape',
      inset: 'Framed photo with a glass card', stage: 'Rising screen', filmstrip: 'Rolling photos', bento: 'Tiles', curtain: 'Split screen',
      // Openings in three dimensions, and one that comes apart as people scroll on.
      carousel: 'Turning carousel of photos (3D)', depth: 'Photos at different depths (3D)', shatter: 'Photo that breaks into tiles as you scroll',
      // Openings that are alive from the first second, made for a page drenched in colour.
      backword: 'Photo floating over a giant word (3D)', lens: 'Round window with a magnifying glass',
      // Signature openings (release 7).
      reveal: 'Edge to edge photo that opens like a curtain', statement: 'One large statement, nothing else',
      pinned: 'Photo that stays put while the story scrolls beside it',
      // Release 7, doctor clinics: the first screen answers is it open, how do I book, how do I call.
      actions: 'Words and a photo, with large quick actions over an Open now card',
      // Release 7, consultant doctors: a portrait set in type (the letters of a name) until a
      // photo is added, and a photo that opens from a small circle in the middle.
      portrait: 'Words beside a portrait (letters until you add a photo)',
      aperture: 'Large words, then a photo that opens from a circle',
      // Release 7, consultant doctors (sleep): a night photo that lightens to dawn as people
      // scroll, by layers that only change how see-through they are.
      dawn: 'A night photo that lightens to dawn as people scroll',
      // Release 7, consultant doctors (skin): three tall windows onto one photo, at different
      // heights, with the details as a ledger along the foot.
      triptych: 'Three tall windows onto one photo, the details along the foot',
      // Release 7, consultant doctors (men's health): plain questions in the first screen, each
      // opening softly; and (brain and nerves) simple branching lines drawn slowly behind the words.
      questions: 'Questions first, each opening softly',
      branches: 'Branching lines drawn slowly behind the words',
      // Batch 2 (counselling): the words above a wide photo of still water and its reflection,
      // which settles slowly as the page opens.
      reflection: 'Still water: the words above a photo and its reflection',
    },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, rotate: { ...L(160, 'Changing words', 'e.g. brands, websites, films'), panel: true, hint: 'A few words with commas between them. They take turns at the end of the heading.' }, word: L(12, 'Big word', 'e.g. Fresh'), intro: R(1200, 'Introduction'), picture: PIC(), pictures: { kind: 'pictures', max: 6, label: 'More photos' },
      video: { kind: 'video', label: 'Video' }, buttons: BTNS(2), details: { kind: 'bool', label: 'Show opening hours, address and phone' },
      // A booking bar under the buttons: a date (and how many people), then one button that opens
      // the booking page, WhatsApp or an email with the request written out. The page never sends
      // anything itself.
      bar: { kind: 'choice', options: ['none', 'page', 'whatsapp', 'email'], def: 'none', labels: { none: 'No booking bar', page: 'Opens my booking page', whatsapp: 'Sends a WhatsApp message', email: 'Sends an email' }, label: 'Booking bar' },
      barButton: L(40, 'Booking bar button', 'Check availability'), barPeople: { kind: 'bool', label: 'Ask how many people' },
      barWhatsapp: { ...WA, panel: true, hint: `Only used by a booking bar that sends a WhatsApp message. ${WA_HINT}` },
      mark: { ...L(80, 'Words to mark', 'e.g. time to talk'), panel: true, hint: 'A few words from the heading or the first lines, drawn with a line under them. Leave it empty for none.' },
      // The longer story under the opening's first screen. Only the "pinned" layout draws it.
      story: R(4000, 'Story', 'Add your story'),
      // Quick actions (the "actions" layout): up to four large buttons, each a link with a short
      // line under it ("Online, at any time"). A Call action with no phone number set is left out.
      actions: { kind: 'items', max: 4, label: 'Quick actions', add: 'Add an action', item: { link: { kind: 'link', label: 'Action' }, detail: L(60, 'Line under it', 'e.g. Online, at any time') }, sample: { link: { label: 'Book an appointment', href: '@booking' }, detail: '' } },
      // "Open now, closes at 6pm", worked out from the opening hours in Details and booking.
      openNow: { kind: 'bool', label: 'Say whether you are open now' },
      // What to do when closed (for a doctor: NHS 111, and 999 in an emergency).
      closed: R(400, 'When you are closed', 'e.g. When we are closed, call NHS 111. In an emergency, call 999.'),
      // The portrait layout: the letters set large in the portrait until a photo is added, and
      // the frame's shape.
      monogram: { ...L(3, 'Letters in the portrait', 'e.g. EM'), panel: true, hint: 'Up to three letters, set large where a photo would be, until you add a photo.' },
      // A thin line drawn once under the heading as the page opens: a calm heart trace or a sound
      // wave (the same lines the steps can have beside them).
      trace: { kind: 'choice', options: ['none', 'heart', 'wave'], def: 'none', labels: { none: 'No line', heart: 'A calm heart trace', wave: 'A sound wave' }, label: 'Line drawn under the heading', panel: true },
      // A short line under the buttons that goes to the page's If you need help now card, so a
      // phone's first screen says where help is (release 7). Still, and shown only with that card.
      // The questions of the "questions first" layout, each with its answer.
      questions: { kind: 'items', max: 6, label: 'Questions', add: 'Add a question', item: { question: L(160, 'Question', 'e.g. Is this worth checking?'), answer: R(800, 'Answer') }, sample: { question: 'New question', answer: '' } },
      help: { ...L(120, 'Help line', 'e.g. Need help now? Numbers to call, day or night'), panel: true, hint: 'A short line under the buttons that takes people to the If you need help now card on this page. It is shown only when the page has that card, and it never moves.' },
      frame: { kind: 'choice', options: ['arch', 'circle', 'square'], def: 'arch', labels: { arch: 'Arch', circle: 'Circle', square: 'Square' }, label: 'Portrait frame' },
    },
  },
  text: {
    label: 'Text', hint: 'A heading and paragraphs. Can sit beside a picture.',
    variants: { plain: 'Plain', sidehead: 'Heading on the side', lede: 'Large opening words', boxed: 'Highlighted box', 'picture-left': 'Picture on the left', 'picture-right': 'Picture on the right', lit: 'Lights up as you scroll' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, body: R(20000, 'Text', 'Add your words'), picture: PIC(), buttons: BTNS(2), mark: { ...L(80, 'Words to mark', 'e.g. time to talk'), panel: true, hint: 'A few words from the heading or the first lines, drawn with a line under them. Leave it empty for none.' } },
  },
  image: {
    label: 'Picture', hint: 'One photo with a caption.',
    variants: { normal: 'In the column', wide: 'Wide', 'full-bleed': 'Edge to edge', framed: 'Framed' },
    fields: { picture: PIC(), caption: L(300, 'Caption') },
  },
  gallery: {
    label: 'Photo gallery', hint: 'Several photos in a grid, a mosaic or a strip.',
    variants: { grid: 'Grid', masonry: 'Mixed heights', mosaic: 'One large, four small', strip: 'Scrolling strip', reel: 'Rolling reel', gather: 'Photos fly together as you scroll', sideways: 'Slides sideways as people scroll down' },
    fields: { heading: HEAD, intro: R(600, 'Introduction'), pictures: { kind: 'pictures', max: 24, label: 'Photos' } },
  },
  services: {
    label: 'Services and prices', hint: 'What you offer, with prices, times and booking links.',
    variants: { menu: 'Menu with dotted lines', cards: 'Cards', numbered: 'Numbered list', table: 'Price table', board: 'Price board', feature: 'Large with photos', rows: 'Big rows, photo on hover', flip: 'Cards that turn over (3D)', pinned: 'Names set large, the photo beside them stays and changes', rail: 'Cards that travel sideways as people scroll down' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 40, label: 'Services', add: 'Add a service', item: {
        service: SVC, services: SVCS, lengthShows: SVCLEN, name: L(100, 'Name', 'Name of the service'), description: R(600, 'Description'), price: L(60, 'Price', 'Price'), duration: L(60, 'Time', 'Time'),
        offer: L(120, 'Offer'), picture: PIC(), link: { kind: 'link', label: 'Booking link' }, pay: { kind: 'link', label: 'Pay link' },
        // Shown on the sideways cards (a speciality's consultant and usual wait).
        who: L(80, 'Who you will see', 'e.g. Dr Amelia Hart'), wait: L(40, 'Usual wait', 'e.g. 5 days'),
        // Shown on the sideways cards too: how long people usually take to recover.
        recovery: L(60, 'Typical recovery', 'e.g. 6 to 12 weeks'),
      }, sample: { name: 'New service', description: '', price: '', duration: '' } },
      // A band of large words that rolls slowly above the cards of the sideways layout.
      band: { ...L(200, 'Moving words above the cards', 'e.g. Facials, Peels, Skin boosters'), panel: true, hint: 'A few words with commas between them, rolling slowly above the cards that travel sideways. Leave it empty for none.' },
    },
  },
  order: {
    label: 'Order list', hint: 'People choose how many of each, see the total, and send you the order.',
    variants: { list: 'Rows', cards: 'Cards with photos' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 40, label: 'Things to order', add: 'Add one', item: {
        name: L(100, 'Name', 'Name'), description: R(600, 'Description'), price: L(60, 'Price', 'Price, such as £9.50'), picture: PIC(),
      }, sample: { name: 'New item', description: '', price: '' } },
      // How the order reaches you: by email unless WhatsApp is chosen.
      send: { kind: 'choice', options: ['whatsapp', 'email'], def: 'email', labels: { whatsapp: 'By WhatsApp', email: 'By email' }, label: 'Orders are sent' },
      whatsapp: { ...WA, panel: true, hint: `Only used when orders are sent by WhatsApp. ${WA_HINT}` },
      button: L(40, 'Button text', 'Send order'), pay: { kind: 'link', label: 'Pay link' }, note: L(240, 'Small print'),
    },
  },
  team: {
    label: 'Team', hint: 'The people behind the business, with photos and short bios.',
    variants: { grid: 'Grid', rows: 'Rows', single: 'One person, large', circles: 'Round photos', carousel: 'Carousel that slides sideways', rail: 'Cards that travel sideways as people scroll down' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 24, label: 'People', add: 'Add a person', item: {
        name: L(100, 'Name', 'Name'), role: L(120, 'Role', 'Role'), quals: L(160, 'Qualifications', 'e.g. qualifications and registration'), bio: R(2000, 'About them'), picture: PIC('Photo'), link: { kind: 'link', label: 'Link' },
        book: { kind: 'link', label: 'Their own booking link' },
      }, sample: { name: 'New person', role: '', bio: '' } },
      // A Book button for each person: their own booking link, else the website's, else Call or Contact.
      bookEach: { kind: 'bool', label: 'A Book button for each person' },
    },
  },
  reviews: {
    label: 'Reviews', hint: 'What customers say about you.',
    variants: { cards: 'Cards', 'big-quote': 'One big quote', list: 'List', wall: 'Quote wall', ticker: 'Rolling reviews', one: 'One at a time', drift: 'Wall of columns that drift past each other' },
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
    variants: { card: 'Card', inline: 'In a row', split: 'Heading beside details', band: 'Coloured band', map: 'Card with a drawn map, today marked', hours: 'Opening hours as a table, today marked' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      business: { kind: 'bool', label: 'Use my business details' },
      address: { kind: 'plain', max: 300, label: 'Address', ph: 'Add an address' }, hours: { kind: 'plain', max: 400, label: 'Opening hours', ph: 'Add opening hours' },
      phone: L(60, 'Phone'), email: L(254, 'Email'), map: { kind: 'link', label: 'Map link' }, buttons: BTNS(2),
      // Worked out on the visitor's device from the opening hours ("Open now, closes at 6pm"), in
      // the business's own time zone.
      openNow: { kind: 'bool', label: 'Say whether you are open now' },
      // What to do when closed (for a doctor: NHS 111, and 999 in an emergency).
      closed: R(400, 'When you are closed', 'e.g. When we are closed, call NHS 111. In an emergency, call 999.'),
    },
  },
  cta: {
    label: 'Call to action', hint: 'A short message with a button, such as “Book now”.',
    variants: { band: 'Band', card: 'Card', minimal: 'Minimal', split: 'Words and buttons side by side', giant: 'Giant type' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, body: R(800, 'Text'), buttons: BTNS(2), mark: { ...L(80, 'Words to mark', 'e.g. time to talk'), panel: true, hint: 'A few words from the heading or the first lines, drawn with a line under them. Leave it empty for none.' } },
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
    variants: { list: 'List', badges: 'Badges', strip: 'One line', row: 'Names set as type, with fine lines between' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, items: { kind: 'items', max: 16, label: 'Items', add: 'Add one', item: { text: L(160, 'Text', 'e.g. Fully insured'), link: { kind: 'link', label: 'Link, such as to a public register' } }, sample: { text: 'New item' } } },
  },
  facts: {
    label: 'Key facts', hint: 'A few numbers or short facts, such as “25 years”.',
    variants: { row: 'In a row', large: 'Large', ruled: 'With lines', tiles: 'Tiles', circles: 'Coloured circles', ticker: 'Rolling band of numbers', band: 'Big numbers in a band, with fine lines between' },
    fields: { kicker: L(100, 'Short label'), heading: HEAD, items: { kind: 'items', max: 6, label: 'Facts', add: 'Add a fact', item: { value: L(24, 'Number or word', 'e.g. 25'), label: L(80, 'What it means', 'e.g. years in business') }, sample: { value: '10', label: 'New fact' } },
      // Once a number has counted up, it beats once, like a pulse.
      beat: { kind: 'bool', label: 'Numbers beat once after counting up' },
      // A gentle wave line drawn once through the band as it comes into view (release 7).
      wave: { kind: 'bool', label: 'A gentle wave drawn through the band' } },
  },
  notice: {
    label: 'Announcement', hint: 'A short notice, such as a holiday closure or an offer.',
    variants: { bar: 'Thin bar', ribbon: 'Ribbon', help: 'If you need help now: a card that never moves' },
    fields: {
      text: L(240, 'Notice', 'Add a short notice'), link: { kind: 'link', label: 'Link' },
      // The help card (release 7, mental health): a heading, a line, and the numbers to call,
      // each one a link that rings it. It is never moved, faded or hidden by any movement.
      heading: HEAD, intro: R(600, 'Introduction'),
      items: { kind: 'items', max: 6, label: 'Where to get help', add: 'Add a number', item: { name: L(80, 'Who', 'e.g. Samaritans'), number: L(40, 'Number to call', 'e.g. 116 123'), detail: L(160, 'Line under it', 'e.g. Free, day or night') }, sample: { name: 'New number', number: '', detail: '' } },
    },
  },
  columns: {
    label: 'Columns', hint: 'Two or three sections side by side. They stack on phones.',
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
  booking: {
    label: 'Online booking', hint: 'Your booking calendar on the page, from Cal.com or Google Calendar, or a button to your booking page.',
    variants: { calendar: 'Calendar on the page', button: 'Button only' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      useSite: { kind: 'bool', label: 'Use the booking link from Details & booking' },
      url: { kind: 'booking', label: 'Booking page address' }, button: L(40, 'Button text', 'Book online'), note: L(240, 'Small print'),
    },
  },
  marquee: {
    label: 'Moving words', hint: 'A band of short words or phrases that rolls across the page.',
    variants: { line: 'One line', double: 'Two lines, opposite ways', outline: 'Hollow letters', tags: 'Labels' },
    fields: {
      items: { kind: 'items', max: 12, label: 'Words', add: 'Add a word', item: { text: L(60, 'Word or phrase', 'e.g. Open late') }, sample: { text: 'New words' } },
      speed: { kind: 'choice', options: ['xs', 's', 'm', 'l'], def: 'm', labels: { xs: 'Very slow', s: 'Slow', m: 'Steady', l: 'Quick' }, label: 'Speed' },
    },
  },
  steps: {
    label: 'Steps', hint: 'How it works, in a few numbered steps. The line draws itself as people scroll.',
    variants: { line: 'Down a line', row: 'Side by side', big: 'Big numbers', sticky: 'A big number that stays while the steps go past', timeline: 'A timeline that fills as you read, each step with its time', route: 'A line drawn down the page as you read, the steps either side of it' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 8, label: 'Steps', add: 'Add a step', item: { when: L(40, 'When', 'e.g. First 10 minutes'), name: L(100, 'Step', 'Name of the step'), description: R(600, 'What happens'), link: { kind: 'link', label: 'Button' } }, sample: { name: 'Next step', description: '' } },
      // A thin line beside the steps that draws one more stretch as each step passes.
      // `progress` (therapy batch 1): beside sticky steps, a line that fills as the steps are read,
      // each step with its time above it (a recovery plan, week by week).
      trace: { kind: 'choice', options: ['none', 'heart', 'wave', 'progress'], def: 'none', labels: { none: 'No line', heart: 'A calm heart trace', wave: 'A sound wave', progress: 'A progress line that fills as you scroll' }, label: 'Line drawn beside the steps' },
    },
  },
  showcase: {
    label: 'Showcase', hint: 'A few pieces of work or offers, each with a photo, shown one at a time as people scroll.',
    variants: { stack: 'Stacking cards', slider: 'Slider', switch: 'List that changes the photo', plates: 'Round photos, the colour changes', layers: 'Layers that come apart as you scroll (3D)', story: 'Photo that stays while the words scroll past' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 8, label: 'Pieces', add: 'Add one', item: {
        name: L(100, 'Name', 'Name'), tag: L(60, 'Small label'), description: R(600, 'Description'), picture: PIC(), link: { kind: 'link', label: 'Link' },
      }, sample: { name: 'New piece', description: '' } },
    },
  },
  // ---- Signature sections (website design release 7) ----------------------------------------
  // Built for complete business websites. Each one reads and works with scripts off and with
  // movement turned down; the page's scripts only ever add to them.
  bookstrip: {
    label: 'Booking strip', hint: 'People choose what they want, then press Book. It uses your booking link, or your phone and Contact page when there is none.',
    variants: { strip: 'One strip: choose, then Book', cards: 'A card for each thing to book', bar: 'Slim bar with Book and Call' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(600, 'Introduction'),
      items: { kind: 'items', max: 12, label: 'Things to book', add: 'Add one', item: {
        service: SVC, services: SVCS, lengthShows: SVCLEN, name: L(80, 'Name', 'e.g. Dinner for two'), duration: L(40, 'Time', 'e.g. 90 min'), price: L(40, 'Price', 'e.g. £45'), link: { kind: 'link', label: 'Its own booking link' },
        // Payment is taken as the visitor books (payment switched on in Cal.com or Google), so
        // the item says so and needs no separate pay button.
        paid: { kind: 'bool', label: 'Pay when you book', hint: 'Tick only once payment is switched on in Cal.com or Google (Details & booking, Take payment as people book).' },
      }, sample: { name: 'New booking', duration: '', price: '' } },
      button: L(40, 'Button text', 'Book'),
      sticky: { kind: 'bool', label: 'On phones, keep a Book bar at the bottom of the screen' },
      // Off unless chosen: it makes each visitor's browser ask Cal.com for the free times as the
      // page opens. It only works with a Cal.com booking link; with any other it shows nothing.
      live: { kind: 'bool', label: 'Show how many times are free today, read from Cal.com as the page opens' },
      whatsapp: { ...WA, panel: true, hint: `Shown as a WhatsApp button when the website has no booking link. ${WA_HINT}` },
      note: L(240, 'Small print'),
    },
  },
  plans: {
    label: 'Ways to pay', hint: 'Cards for paying in full, a deposit, a membership or a package. Each has its own pay link, and the money goes straight to you.',
    variants: { cards: 'Cards side by side', ladder: 'Steps that rise', rows: 'Rows', fan: 'Cards held like a hand, that spread out as people scroll', arches: 'Arched cards, the middle one raised, rising into place' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 6, label: 'Ways to pay', add: 'Add a way to pay', item: {
        service: SVC, services: SVCS, lengthShows: SVCLEN, name: L(60, 'Name', 'e.g. Deposit'), price: L(40, 'Price', 'e.g. £20'), per: L(40, 'For what or how often', 'e.g. a month'),
        includes: R(600, 'What is included', 'A short list of what is included'), small: L(160, 'Small print', 'e.g. Balance due on the day'),
        pay: { kind: 'link', label: 'Pay link' }, popular: { kind: 'bool', label: 'Most popular' },
        // A monthly plan's link to the payment service's own page where members change their card
        // or cancel (Stripe's customer portal link, for example). Optional.
        manage: { kind: 'link', label: 'Manage your membership link' },
        // The button's words while this card has no pay link of its own (app walk, 24 Nov: a
        // package and a monthly plan both said Book). Chosen by the owner, never guessed from the
        // card's words. Book, Buy and Join go where Book would; Ask about this and Get in touch go
        // to the Contact page.
        act: { kind: 'choice', options: ['book', 'buy', 'join', 'ask', 'contact'], def: 'book', labels: { book: 'Book', buy: 'Buy', join: 'Join', ask: 'Ask about this', contact: 'Get in touch' }, label: 'Button words without a pay link' },
      }, sample: { name: 'New way to pay', price: '', includes: '' } },
      note: L(240, 'Small print'),
      // A card with no pay link yet still leads somewhere by itself (the booking page, a call or
      // Contact). Where that reads oddly (a GP's "How to pay"), it can say to ask at reception, or
      // show nothing, until a pay link is added.
      unpaid: { kind: 'choice', options: ['book', 'ask', 'none'], def: 'book', labels: { book: 'Book, call or get in touch', ask: 'Says "Ask at reception"', none: 'No button' }, label: 'Cards without a pay link' },
      // Steps that rise: each step climbs into place as the section comes into view (batch 2).
      rise: { kind: 'bool', label: 'Steps climb into place as people scroll' },
    },
  },
  spaces: {
    label: 'Spaces remaining', hint: 'Dated classes, courses, events or tables, each with the spaces left. You set the number; a date that has passed takes itself off.',
    variants: { rows: 'Rows', cards: 'Cards', tickets: 'Tickets' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 30, label: 'Dates', add: 'Add a date', item: {
        name: L(100, 'What it is', 'e.g. Pasta class'), date: { kind: 'date', label: 'Date' }, time: L(40, 'Time', 'e.g. 6.30pm'), detail: L(120, 'Detail', 'e.g. With Sam, in the studio'), price: L(40, 'Price', 'Price'),
        capacity: { kind: 'number', min: 1, max: 999, step: 1, label: 'Spaces in all' }, left: { kind: 'number', min: 0, max: 999, step: 1, quick: true, label: 'Spaces left' },
        link: { kind: 'link', label: 'Booking link' }, pay: { kind: 'link', label: 'Pay link' }, waitlist: { kind: 'link', label: 'Waiting list link' },
        // Payment is taken as the place is booked (payment switched on in Cal.com), so it says so.
        paid: { kind: 'bool', label: 'Pay when you book', hint: 'Tick only once payment is switched on in Cal.com or Google (Details & booking, Take payment as people book).' },
        // Follow a Cal.com event with seats: the website then reads the seats left from Cal.com
        // as the page opens (no key is needed), and the number set by hand is only the fallback.
        cal: { ...L(160, 'Cal.com event to follow', 'e.g. cal.com/sam/pasta-class'), panel: true, hint: 'Paste the link of a Cal.com event that has seats. Your website then shows its seats left for this date, read from Cal.com as the page opens. Leave it empty to set the number yourself.' },
      }, sample: { name: 'New date', time: '', capacity: 10, left: 10 } },
      past: { kind: 'choice', options: ['hide', 'finished'], def: 'hide', labels: { hide: 'Take them off the page', finished: 'Show them as Finished' }, label: 'Dates that have passed' },
      // Add to calendar (a Google Calendar link and a calendar file) beside each date with a time:
      // on unless switched off here.
      noCalendar: { kind: 'bool', label: 'Leave out Add to calendar' },
      note: L(240, 'Small print'),
    },
  },
  menuboard: {
    label: 'Menu board', hint: 'A menu or treatment list in groups, such as Starters, Mains and Puddings.',
    variants: { slide: 'Board that slides sideways as people scroll', columns: 'Groups side by side', tabs: 'One group at a time', index: 'An index of the groups stays beside the list, the one in view marked' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 60, label: 'Lines', add: 'Add a line', item: {
        service: SVC, services: SVCS, lengthShows: SVCLEN, group: L(40, 'Group it starts', 'e.g. Starters'), name: L(100, 'Name', 'Name'), description: L(240, 'Description'), duration: L(40, 'Time', 'e.g. 45 min'), price: L(40, 'Price', 'Price'), tag: L(24, 'Small label', 'e.g. Vegan'),
      }, sample: { name: 'New line', price: '' } },
      note: L(240, 'Small print'),
    },
  },
  tiles: {
    label: 'Tiles', hint: 'A grid of tiles in mixed sizes: photos, a few words, a big number.',
    variants: { mosaic: 'Mixed sizes', feature: 'One large, the rest small', row: 'One row of tall tiles', open: 'Tiles that open to show the price and time', rail: 'Cards that travel sideways as you scroll' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 9, label: 'Tiles', add: 'Add a tile', item: {
        service: SVC, services: SVCS, lengthShows: SVCLEN, value: L(16, 'Big number or word', 'e.g. 12'), name: L(60, 'Heading', 'Heading'), text: L(200, 'Words'), duration: L(40, 'Time', 'e.g. 45 min'), price: L(40, 'Price', 'Price'), picture: PIC(), link: { kind: 'link', label: 'Link' },
        // A friendly shape drawn on a tile without a photo (release 7).
        // Shapes, or a simple line drawing of an everyday task (therapy batch 1, occupational therapy).
        shape: { kind: 'choice', options: ['none', 'circle', 'arch', 'leaf', 'star', 'drop', 'wave', 'dressing', 'cooking', 'washing', 'stairs', 'work', 'school'], def: 'none', labels: { none: 'No shape', circle: 'A circle', arch: 'An arch', leaf: 'A leaf', star: 'A star', drop: 'A drop', wave: 'A wave', dressing: 'A drawing: a shirt on a hanger', cooking: 'A drawing: a pan on the hob', washing: 'A drawing: a basin and tap', stairs: 'A drawing: stairs with a rail', work: 'A drawing: a laptop and a mug', school: 'A drawing: a school bag' }, label: 'Shape on the tile' },
      }, sample: { name: 'New tile', text: '' } },
      // The tiles settle into place with a little bounce as they arrive (release 7).
      bounce: { kind: 'bool', label: 'Tiles settle into place with a little bounce' },
      // The tiles come in from different sides and assemble into the grid (therapy batch 1).
      assemble: { kind: 'bool', label: 'Tiles come in from different sides and fit together' },
    },
  },
  compare: {
    label: 'Before and after', hint: 'Two photos of the same thing. People drag a handle, or use the arrow keys, to compare them.',
    variants: { slider: 'Drag to compare', side: 'Side by side' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 6, label: 'Pairs', add: 'Add a pair', item: {
        name: L(100, 'Name', 'Name'), before: PIC('First photo'), after: PIC('Second photo'), beforeLabel: L(24, 'Word for the first photo', 'Before'), afterLabel: L(24, 'Word for the second photo', 'After'), description: R(400, 'Description'),
      }, sample: { name: 'New pair' } },
    },
  },
  timetable: {
    label: 'Timetable', hint: 'Classes or sessions through the week, day by day, with today marked.',
    variants: { week: 'The week across the page', days: 'Day by day' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 60, label: 'Sessions', add: 'Add a session', item: {
        day: { kind: 'choice', options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], def: 'mon', labels: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }, label: 'Day' },
        time: L(40, 'Time', 'e.g. 6.30pm'), name: L(80, 'Name', 'Name of the session'), detail: L(100, 'Detail', 'e.g. With Sam, 60 min'), level: L(24, 'Small label', 'e.g. Beginners'), link: { kind: 'link', label: 'Booking link' },
      }, sample: { day: 'mon', time: '', name: 'New session' } },
      note: L(240, 'Small print'),
    },
  },
  casestudy: {
    label: 'Case study', hint: 'One piece of work told properly: the brief, what you did and the result, with photos and a few facts.',
    variants: { spread: 'Large photo with the facts beside it', chapters: 'Brief, work and result as three chapters' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'), picture: PIC('Main photo'), pictures: { kind: 'pictures', max: 4, label: 'More photos' },
      items: { kind: 'items', max: 6, label: 'Facts', add: 'Add a fact', item: { label: L(40, 'What', 'e.g. Time taken'), value: L(60, 'Answer', 'e.g. Five days') }, sample: { label: 'New fact', value: '' } },
      brief: R(800, 'The brief'), work: R(1200, 'What we did'), result: R(800, 'The result'), buttons: BTNS(2),
    },
  },
  scenes: {
    label: 'Pinned scenes', hint: 'The photo stays put while the words change as people scroll. On phones, and with movement turned down, each scene simply follows the last.',
    variants: { split: 'Photo pinned beside the words', full: 'Full screen, each photo wipes over the last' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 6, label: 'Scenes', add: 'Add a scene', item: {
        tag: L(40, 'Small label'), name: L(100, 'Heading', 'Heading'), description: R(500, 'Words'), picture: PIC(), link: { kind: 'link', label: 'Link' },
        // A simple line drawing of a hand in place of a photo (release 7, hand and wrist).
        drawing: { kind: 'choice', options: ['none', 'hand-fingers', 'hand-wrist', 'hand-thumb', 'hand-palm'], def: 'none', labels: { none: 'No drawing (a photo)', 'hand-fingers': 'A hand, the fingers marked', 'hand-wrist': 'A hand, the wrist marked', 'hand-thumb': 'A hand, the base of the thumb marked', 'hand-palm': 'A hand, the palm marked' }, label: 'A line drawing instead of a photo' },
      }, sample: { name: 'New scene', description: '' } },
    },
  },
  // Who regulates the business, as the law and the regulators ask: the CQC rating (England's
  // providers must show it on their website) from Details and booking, with CQC's own widget when
  // chosen, and each professional's registration with a link to the public register.
  regulator: {
    label: 'Regulator and registration', hint: 'Your CQC rating and the registration of each professional, with links to check them. Pick a UK register, or type your own governing body. The rating comes from Details and booking.',
    variants: { panel: 'Rating beside the registrations', line: 'The rating on one line' },
    fields: {
      kicker: L(100, 'Short label'), heading: HEAD, intro: R(800, 'Introduction'),
      items: { kind: 'items', max: 24, label: 'Registrations', add: 'Add a registration', item: {
        name: L(100, 'Name', 'e.g. Dr Ruth Penrose'),
        // A quick pick fills in the three lines below it, which stay editable; typing in them makes
        // the registration the business's own (`unpicks`).
        body: { kind: 'choice', options: [...REGULATOR_IDS, OWN_REGULATOR], def: 'gmc', labels: { ...Object.fromEntries(REGULATOR_IDS.map((k) => [k, `${REGULATORS[k].name} (${REGULATORS[k].short.replace(/ PIN$/, '')})`])), [OWN_REGULATOR]: 'My own governing body, typed below' }, label: 'Quick pick of a UK register', hint: 'Outside the UK, or with a different body? Type your own governing body below.', fills: Object.fromEntries(REGULATOR_IDS.map((k) => [k, { bodyName: REGULATORS[k].name, bodyShort: REGULATORS[k].short, bodyHref: REGULATORS[k].href }])) },
        number: L(24, 'Registration number', 'e.g. 1234567'),
        bodyName: { ...L(120, 'Governing body', 'e.g. Health and Care Professions Council'), panel: true, unpicks: 'body' },
        bodyShort: { ...L(24, 'Short label beside the number', 'e.g. HCPC'), panel: true, unpicks: 'body' },
        bodyHref: { kind: 'line', max: 2048, url: true, label: 'Link to its public register search', ph: 'https://', hint: 'A full address starting https://, where anyone can check the number.', panel: true, unpicks: 'body' },
      }, sample: { name: 'New person', body: 'gmc', number: '' } },
      // CQC's own rating widget, drawn by CQC on the published website from the location ID in
      // Details and booking. The rating line stays for anyone whose browser does not run it.
      widget: { kind: 'bool', label: 'Also show CQC’s own rating widget' },
      note: L(240, 'Small print'),
    },
  },
  spacer: {
    label: 'Space', hint: 'Extra space, with or without a line.',
    variants: { space: 'Space', line: 'Line', ornament: 'Ornament' },
    fields: { size: { kind: 'choice', options: ['s', 'm', 'l'], def: 'm', label: 'Size' } },
  },
};
// The section types that came with website design release 7. A website on an older design
// cannot draw them, so Chapbook asks it to update first.
export const SIGNATURE_TYPES = ['bookstrip', 'plans', 'spaces', 'menuboard', 'tiles', 'compare', 'timetable', 'casestudy', 'scenes', 'regulator'];
// Layouts of older section types that came with the same release. On an older design they would
// quietly become the type's first layout, so they need the update too.
export const SIGNATURE_LAYOUTS = { hero: ['reveal', 'statement', 'pinned', 'actions', 'portrait', 'aperture', 'dawn', 'triptych', 'questions', 'branches', 'reflection'], services: ['pinned', 'rail'], steps: ['sticky', 'timeline', 'route'], plans: ['arches'], notice: ['help'], facts: ['ticker', 'band'], credentials: ['row'], contact: ['map', 'hours'], team: ['carousel', 'rail'], reviews: ['drift'], gallery: ['sideways'] };
// Settings of older section types that came with release 7: an older design ignores them.
export const SIGNATURE_FIELDS = { hero: ['mark', 'story', 'actions', 'openNow', 'closed', 'monogram', 'trace', 'help', 'questions'], text: ['mark'], cta: ['mark'], team: ['bookEach'], contact: ['openNow', 'closed'], services: ['band'], spaces: ['noCalendar'], plans: ['rise'], steps: ['trace'], facts: ['beat', 'wave'], tiles: ['bounce', 'assemble'] };
// Settings of an entry in a list that came with release 7 (an older design drops them).
export const SIGNATURE_ITEM_FIELDS = { credentials: ['link'], services: ['who', 'wait', 'recovery'], steps: ['when'], tiles: ['shape'], scenes: ['drawing'], bookstrip: ['paid'], spaces: ['paid'], plans: ['manage'] };
// A word in a heading set in italic, written *like this*. Release 7 draws it; an older design
// would show the stars.
export const HEADING_EM = /(^|[\s(\u201c"'])\*([^*\s](?:[^*]{0,60}?[^*\s])?)\*(?=$|[\s.,;:?)\u201d"'])/g;
const hasEm = (v) => typeof v === 'string' && v.includes('*') && new RegExp(HEADING_EM.source).test(v);
// A choice of "none" uses nothing new either.
const filled = (v) => v !== undefined && v !== '' && v !== false && v !== null && v !== 'none';
// A reference to a service: its id, or "n" and its place in the list for one without an id.
export const SERVICE_REF = /^[a-z0-9][a-z0-9-]{0,39}$/;
// A service's key: its id, or "n" and its place in the list for one written before ids (round C review P5).
// An id of the form n<number> is refused: it is the key of a service without an id (round C build review, minor 6).
export const serviceKey = (s, i) => (s && typeof s.id === 'string' && SERVICE_REF.test(s.id) && !/^n\d+$/.test(s.id) ? s.id : `n${i + 1}`);
// The sections whose cards can be linked to Your services, and what a linked card takes from the list.
export const SERVICE_TYPES = ['bookstrip', 'services', 'plans', 'menuboard', 'tiles'];
export const SERVICE_FIELDS = { bookstrip: ['name', 'duration', 'price', 'link', 'paid'], services: ['name', 'duration', 'price', 'pay'], plans: ['name', 'price', 'pay', 'act', 'manage'], menuboard: ['name', 'duration', 'price'], tiles: ['name', 'duration', 'price'] };
// Whether a block has a card linked to Your services, which needs design release 8 (round C): an
// older design does not know the link and would draw the card empty.
export const linksServices = (b) => !!b && ((SERVICE_TYPES.includes(b.type) && (b.data?.items || []).some((x) => x && (x.service || (Array.isArray(x.services) && x.services.length)))) || (b.data?.children || []).some(linksServices));
// Whether a block needs website design release 7 to be drawn as it is meant.
export const needsSignature = (b) => !!b && (SIGNATURE_TYPES.includes(b.type) || (SIGNATURE_LAYOUTS[b.type] || []).includes(b.variant) || (SIGNATURE_FIELDS[b.type] || []).some((k) => filled(b.data?.[k])) || (SIGNATURE_ITEM_FIELDS[b.type] || []).some((k) => (b.data?.items || []).some((x) => filled(x?.[k]))) || hasEm(b.data?.heading) || (b.data?.children || []).some(needsSignature));
// A page's own look can need release 7 too: the two new heading typefaces and the still wash
// (an older design would quietly fall back to its own font and no wash).
export const SIGNATURE_LOOK = { font: ['fine', 'noir', 'mixed', 'lyric', 'quiet'], backdrop: ['dawn'] };
export const lookNeedsSignature = (look) => !!look && (SIGNATURE_LOOK.font.includes(look.font) || SIGNATURE_LOOK.backdrop.includes(look.motion?.backdrop));
// A heading as plain words, with the stars of an italic word taken out (for labels and titles).
export const plainHeading = (v) => String(v ?? '').replace(new RegExp(HEADING_EM.source, 'g'), '$1$2');
export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// How many of an opening's "More photos" each layout shows. Layouts not listed show none.
export const HERO_PHOTO_ROOM = { orbit: 5, collage: 3, filmstrip: 6, bento: 2, blob: 1, carousel: 6, depth: 3, statement: 3 };
export const TYPE_IDS = Object.keys(BLOCK_TYPES);
// A choice field's value, or its default (`def`) when nothing is stored.
export const choiceValue = (type, data, key) => { const f = BLOCK_TYPES[type]?.fields?.[key]; const v = data?.[key]; return f?.kind === 'choice' && f.options.includes(v) ? v : f?.def ?? null; };
export const variantsOf = (type) => Object.keys(BLOCK_TYPES[type]?.variants || {});

// ---- normalising ---------------------------------------------------------------------------
function cleanField(f, v, opts) {
  switch (f.kind) {
    case 'line': return f.digits ? cleanWhatsapp(v) : f.url ? cleanRegisterHref(v) : cleanLine(v, f.max);
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
    case 'booking': return bookingTarget(v)?.href || '';
    case 'date': return cleanDate(v);
    case 'service': { const t = typeof v === 'string' ? v.trim() : ''; return SERVICE_REF.test(t) ? t : ''; }
    case 'services': return [...new Set((Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => SERVICE_REF.test(x)))].slice(0, f.max);
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
  // Only one way to pay can be the most popular: the first one marked keeps it.
  if (type === 'plans' && out.items) { let seen = false; for (const x of out.items) { if (x.popular) { if (seen) delete x.popular; seen = true; } } }
  // There can never be more spaces left than there are spaces.
  if (type === 'spaces' && out.items) for (const x of out.items) if (x.capacity != null && x.left != null && x.left > x.capacity) x.left = x.capacity;
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
// ---- movement ------------------------------------------------------------------------------
// How a page moves. Every choice is one of a fixed list, so a page file can never carry code or
// free-form styles. Movement only ever adds to a page: with scripts off, or for visitors who ask
// their device for less motion, every word and picture is simply there.
export const MOTION = {
  scroll: { label: 'As people scroll', options: { none: 'Nothing moves', rise: 'Rise into place', fade: 'Fade in', slide: 'Slide in from the sides', zoom: 'Grow into place', wipe: 'Wipe down', blur: 'Come into focus', tilt: 'Tip up', cascade: 'Arrive in a wave, corner to corner', curtain: 'Open like a curtain' } },
  heading: { label: 'Opening heading', options: { none: 'Still', words: 'Word by word', letters: 'Letter by letter', gather: 'Letters fly together', typed: 'Typed out', shimmer: 'Moving colour', rising: 'Line by line, rising from behind a mask' } },
  buttons: { label: 'Buttons', options: { none: 'Plain', lift: 'Lift', fill: 'Colour sweep', arrow: 'Arrow slides along', tile: 'Arrow in a tile', shine: 'Shine', press: 'Press down', glow: 'Glow', magnet: 'Follows the pointer' } },
  pictures: { label: 'Pictures', options: { none: 'Still', drift: 'Drift as you scroll', zoom: 'Slow zoom', tilt: 'Tilt to the pointer', unveil: 'Unveil', reveal: 'Colour appears where the pointer is', depth: 'Move at their own depth as you scroll', sheet: 'A coloured sheet slides off them' } },
  backdrop: { label: 'Behind the opening', options: { none: 'Nothing', aurora: 'Northern lights', bubbles: 'Bubbles', blobs: 'Soft shapes', waves: 'Waves', orbits: 'Orbits', grid: 'Moving grid', dots: 'Dot field', rays: 'Light rays', shapes: 'Confetti shapes', lines: 'Speed lines', ripples: 'Ripples', petals: 'Falling petals', stars: 'Constellation', spotlight: 'Spotlight', wash: 'Colour wash', grain: 'Film grain', globe: 'Turning globe (3D)', ring: 'Turning ring (3D)', terrain: 'Rolling landscape (3D)', dawn: 'A still wash from peach to your colour' } },
  follow: { label: 'Follows the scroll', options: { none: 'Nothing', bar: 'A bar across the top that fills', line: 'A line down the side that draws' } },
  pointer: { label: 'Where the pointer goes', options: { none: 'Nothing', light: 'A soft light follows it', dot: 'A dot trails it and grows over buttons and links', label: 'The main button\'s words follow it over the opening', lean: 'Cards and tiles lean towards it' } },
  opening: { label: 'The opening, as people scroll on', options: { none: 'Scrolls away as usual', cover: 'The page slides over it', recede: 'It sinks back and dims' } },
  arrive: { label: 'As the page opens', options: { none: 'It is simply there', dissolve: 'Fades in', settle: 'Lifts into place', veil: 'A sheet in your colour slides away' } },
  mark: { label: 'Marked words', options: { none: 'Plain', underline: 'A line draws itself under them', highlight: 'A soft highlight sweeps across them' } },
  pace: { label: 'Pace', options: { calm: 'Calm', steady: 'Steady', lively: 'Lively', measured: 'Measured', unhurried: 'Unhurried: slow, and still on the first screen' } },
};
export const MOTION_KEYS = Object.keys(MOTION);
// Ready-made combinations. A template's variations each start from one of these.
export const MOTION_PRESETS = {
  still: { name: 'Still', hint: 'Nothing moves.', motion: {} },
  gentle: { name: 'Gentle', hint: 'Sections rise softly into place.', motion: { scroll: 'rise', buttons: 'lift', pace: 'calm', count: true } },
  editorial: { name: 'Editorial', hint: 'Headlines arrive word by word; pictures unveil.', motion: { scroll: 'fade', heading: 'words', buttons: 'arrow', pictures: 'unveil', pace: 'calm', count: true } },
  lively: { name: 'Lively', hint: 'Quick, springy and bright.', motion: { scroll: 'rise', heading: 'words', buttons: 'fill', pictures: 'drift', pace: 'lively', count: true } },
  cinematic: { name: 'Cinematic', hint: 'Slow focus pulls and a slow zoom.', motion: { scroll: 'blur', heading: 'letters', buttons: 'shine', pictures: 'zoom', pace: 'calm', count: true } },
  playful: { name: 'Playful', hint: 'Things pop, tilt and press.', motion: { scroll: 'zoom', heading: 'words', buttons: 'press', pictures: 'tilt', pace: 'lively', count: true } },
  bold: { name: 'Bold', hint: 'Sections slide in from the sides.', motion: { scroll: 'slide', heading: 'letters', buttons: 'fill', pictures: 'unveil', pace: 'steady', count: true } },
  dreamy: { name: 'Dreamy', hint: 'Soft focus, glowing buttons, drifting pictures.', motion: { scroll: 'blur', heading: 'shimmer', buttons: 'glow', pictures: 'drift', pace: 'calm', count: true } },
  tech: { name: 'Sharp', hint: 'Wipes, a typed headline and buttons that follow the pointer.', motion: { scroll: 'wipe', heading: 'typed', buttons: 'magnet', pictures: 'tilt', pace: 'steady', count: true } },
  classic: { name: 'Classic', hint: 'A quiet fade and nothing more.', motion: { scroll: 'fade', buttons: 'lift', pace: 'calm' } },
  // Styles built for the signature websites.
  hearth: { name: 'Fireside', hint: 'The page lifts in; the heading rises line by line, sections open like a curtain and pictures move at their own depth.', motion: { scroll: 'curtain', heading: 'rising', buttons: 'fill', pictures: 'depth', arrive: 'settle', mark: 'underline', pace: 'measured', count: true } },
  gallery: { name: 'Gallery', hint: 'Tiles arrive in a wave and lean to the pointer; a sheet slides off each picture.', motion: { scroll: 'cascade', heading: 'letters', buttons: 'arrow', pictures: 'sheet', pointer: 'lean', arrive: 'dissolve', mark: 'highlight', pace: 'measured', count: true } },
  showtime: { name: 'Showtime', hint: 'A coloured sheet opens the page; everything arrives in a quick wave.', motion: { scroll: 'cascade', heading: 'words', buttons: 'press', pictures: 'depth', pointer: 'lean', arrive: 'veil', mark: 'underline', pace: 'measured', count: true } },
  // Release 7, mental health: a slow, still page. Headings rise line by line, slower than
  // anywhere else; sections fade in unhurried; nothing on the first screen waits.
  stillwater: { name: 'Still water', hint: 'A slow, still page: the heading rises line by line, slowly, and sections fade in without hurry.', motion: { scroll: 'fade', heading: 'rising', buttons: 'lift', mark: 'underline', pace: 'unhurried', count: true } },
  // Release 7, children's health: tiles that settle with a little bounce, words that rise.
  sandpit: { name: 'Sandpit', hint: 'Friendly: things rise and settle into place, the heading rises line by line.', motion: { scroll: 'rise', heading: 'rising', buttons: 'press', pictures: 'depth', arrive: 'settle', mark: 'highlight', pace: 'measured', count: true } },
  nocturne: { name: 'Nocturne', hint: 'A dark sheet draws off the opening photo; sections wipe in and the heading rises line by line.', motion: { scroll: 'wipe', heading: 'rising', buttons: 'fill', pictures: 'depth', arrive: 'veil', mark: 'underline', pace: 'measured', count: true } },
};
export function cleanMotion(v) {
  const d = isObj(v) ? v : {}, out = {};
  for (const k of MOTION_KEYS) if (typeof d[k] === 'string' && Object.hasOwn(MOTION[k].options, d[k]) && d[k] !== 'none') out[k] = d[k];
  if (out.pace === 'steady') delete out.pace;
  if (d.count === true) out.count = true;
  // A pace alone moves nothing.
  if (!Object.keys(out).some((k) => k !== 'pace')) return null;
  if (typeof d.preset === 'string' && Object.hasOwn(MOTION_PRESETS, d.preset)) out.preset = d.preset;
  // `own` marks movement the writer chose themselves, so a later change of template or palette
  // never replaces it (movement that came with a template variation follows the variation).
  if (d.own === true) out.own = true;
  return out;
}
// The movement a preset gives, optionally over a backdrop: motionFor('lively', 'bubbles').
export function motionFor(preset, backdrop) {
  const p = MOTION_PRESETS[preset];
  if (!p) return null;
  return cleanMotion({ ...p.motion, ...(backdrop ? { backdrop } : {}), preset });
}

const FONT_KEYS = ['classic', 'modern', 'editorial', 'clean', 'friendly', 'grotesk', 'mono', 'fine', 'noir', 'mixed', 'lyric', 'quiet'];
const BODY_FONT_KEYS = ['clean', 'reading', 'easy', 'classic', 'grotesk'];
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
  if (BODY_FONT_KEYS.includes(d.bodyFont)) out.bodyFont = d.bodyFont;
  const motion = cleanMotion(d.motion);
  if (motion) out.motion = motion;
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
  if (type === 'marquee') data.speed = 'm';
  if (type === 'interactive') data.height = 520;
  if (type === 'booking') data.useSite = true;
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
