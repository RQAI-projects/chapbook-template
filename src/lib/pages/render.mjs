// Page builder: turns a page (see schema.mjs) into HTML. The website build and Chapbook's editor
// both call renderPage(), so the editor shows exactly what will be published.
// Everything a writer types is escaped. Rich text allows only paragraphs, **bold**, *italic*,
// [links](…) and "- " lists. With { editable: true } every value carries a data-cb marker the
// editor uses for click-to-edit; published HTML has none.
import { normalisePage, BLOCK_TYPES, SERVICE_TYPES, SERVICE_FIELDS, serviceKey, choiceValue, cleanHref, cleanHex, cleanLine, cleanDate, videoEmbed, INTERACTIVE_SRC, bookingTarget, MOTION, HERO_PHOTO_ROOM, WEEK_DAYS, HEADING_EM, plainHeading, CQC_ID, CQC_RATINGS, registerOf, payLine, usesCqc, payPage } from './schema.mjs';
import { professionalDetails, telHref, sameText, hoursLines } from '../professional.mjs';

export * from './schema.mjs';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- colour helpers ------------------------------------------------------------------------
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const readableOn = (hex) => { for (const c of ['#ffffff', '#16181d']) if (contrast(hex, c) >= 4.5) return c; return contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff'; };
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

// A colour turned round the colour wheel by `deg`, keeping how light and how strong it is.
function turnHue(hex, deg) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return hex;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r2, g2, b2] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r2, g2, b2].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
// The colours a set of things can take turns wearing: the page's accent, its deep colour and two
// neighbours of the accent, each with a text colour that reads on it.
export function turnColours(k) {
  return [k.accent, k.deep, turnHue(k.accent, 150), turnHue(k.accent, -70), turnHue(k.deep, 60)].map((c) => ({ c, on: readableOn(c) }));
}

// Heading typefaces a page can choose. Only fonts every published site already loads.
export const PAGE_FONTS = {
  classic: { label: 'Classic serif', css: "Georgia,'Times New Roman',serif" },
  modern: { label: 'Warm serif', css: "'Fraunces',Georgia,serif" },
  editorial: { label: 'Editorial serif', css: "'Newsreader',Georgia,serif" },
  clean: { label: 'Clean sans', css: "'Inter Variable','Inter',system-ui,sans-serif" },
  grotesk: { label: 'Geometric sans', css: "'Space Grotesk Variable','Space Grotesk',system-ui,sans-serif" },
  friendly: { label: 'Friendly rounded', css: "'Fredoka','Atkinson Hyperlegible',system-ui,sans-serif" },
  mono: { label: 'Typewriter', css: "ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace" },
  // Release 7: the warm serif set light (a word in italic stands out), and set heavy and italic.
  fine: { label: 'Light serif', css: "'Fraunces',Georgia,serif" },
  noir: { label: 'Heavy italic serif', css: "'Fraunces',Georgia,serif" },
  // Release 7, doctor clinics: a clean sans set tight, with one warm serif italic phrase.
  mixed: { label: 'Clean sans, one warm italic phrase', css: "'Inter Variable','Inter',system-ui,sans-serif" },
  // Release 7, consultant doctors: the warm serif set light and in italic throughout.
  lyric: { label: 'Light italic serif', css: "'Fraunces',Georgia,serif" },
  // Release 7, mental health: the reading serif set light, quiet and even.
  quiet: { label: 'Light reading serif', css: "'Newsreader',Georgia,serif" },
};

// Typefaces for running text: all easy to read at length, all already loaded by every site.
export const PAGE_BODY_FONTS = {
  clean: { label: 'Clean sans', css: "'Inter Variable','Inter',system-ui,sans-serif" },
  reading: { label: 'Reading serif', css: "'Newsreader',Georgia,serif" },
  easy: { label: 'Extra clear', css: "'Atkinson Hyperlegible',system-ui,sans-serif" },
  classic: { label: 'Classic serif', css: "Georgia,'Times New Roman',serif" },
  grotesk: { label: 'Geometric sans', css: "'Space Grotesk Variable','Space Grotesk',system-ui,sans-serif" },
};

// The page's colours. `base` is what the site already uses (theme colours with the writer's
// site-wide choices applied); a page palette, when chosen, replaces them on this page only.
// Text colours are worked out here so every combination stays readable.
export function pageColours(look = {}, base = {}) {
  const c = look.colours || {};
  const bg = c.bg || cleanHex(base.bg) || '#ffffff';
  let ink = c.ink || cleanHex(base.ink) || '#16181d';
  if (contrast(ink, bg) < 4.5) ink = readableOn(bg);
  const accent = c.accent || cleanHex(base.accent) || ink;
  const dark = lum(bg) < 0.2;
  const surface = c.surface || mix(bg, accent, dark ? 0.12 : 0.07);
  const deep = c.deep || (dark ? mix(bg, '#000000', 0.45) : mix(ink, accent, 0.18));
  const dim = contrast(mix(ink, bg, 0.22), bg) >= 4.5 ? mix(ink, bg, 0.22) : ink;
  const surfaceInk = contrast(ink, surface) >= 4.5 ? ink : readableOn(surface);
  return {
    bg, ink, accent, surface, deep, dim, dark,
    accentText: contrast(accent, bg) >= 4.5 ? accent : ink,
    surfaceAccent: contrast(accent, surface) >= 4.5 ? accent : surfaceInk,
    onAccent: readableOn(accent), onDeep: readableOn(deep), surfaceInk, surfaceDim: [0.3, 0.2, 0.1].map((t) => mix(surfaceInk, surface, t)).find((c) => contrast(c, surface) >= 4.6) || surfaceInk,
  };
}
// CSS for one page: block colours always; site colours too when the page has its own palette.
// The tripled attribute outranks the theme and the site's own colour choices.
export function pageCss(page, base = {}) {
  const look = page.look || {}, k = pageColours(look, base);
  const v = [`--cb-page-ink:${k.ink}`, `--cb-page-dim:${k.dim}`, `--cb-page-accent:${k.accentText}`, `--cb-surface:${k.surface}`, `--cb-surface-ink:${k.surfaceInk}`, `--cb-surface-dim:${k.surfaceDim}`, `--cb-surface-accent:${k.surfaceAccent}`, `--cb-deep:${k.deep}`, `--cb-on-deep:${k.onDeep}`, `--cb-on-accent:${k.onAccent}`, `--cb-accent-text:${k.accentText}`];
  if (look.colours) {
    v.push(`--bg-0:${k.bg}`, `--bg-1:${k.bg}`, `--bg-2:${k.bg}`, `--bg-3:${mix(k.bg, k.dark ? '#ffffff' : '#000000', 0.06)}`, `--header-bg:${k.bg}`, `--pro-card:${k.bg}`,
      `--ink:${k.ink}`, `--masthead-ink:${k.ink}`, `--ink-dim:${k.dim}`, `--ink-faint:${k.dim}`, `--line:color-mix(in srgb,${k.ink} 14%,transparent)`, `--line-strong:color-mix(in srgb,${k.ink} 30%,transparent)`,
      `--accent:${k.accent}`, `--teal:${k.accent}`, `--cyan:${k.accent}`, `--violet:${k.accent}`, `--accent-text:${k.accentText}`, `--pro-button-ink:${k.onAccent}`, `--badge-ink:${k.ink}`, `--selection-bg:color-mix(in srgb,${k.accent} 30%,transparent)`,
      `color-scheme:${k.dark ? 'dark' : 'light'}`);
    // A theme that tints its footer (Woodland's pale tint) would put pale words on a pale band
    // over a dark page: on a dark page the tint is mixed from the page's own colours, and its
    // words keep 4.5:1 (review, 23 Nov). Light pages keep the theme's own tint.
    if (k.dark) { const tint = mix(k.bg, k.ink, 0.06); v.push(`--footer-tint:${contrast(k.dim, tint) >= 4.5 ? tint : k.bg}`); }
  }
  // A colour-block opening (the blob) softens its smaller words with a little of the accent. Where
  // that would read under 4.5:1 on the accent (Stride Physiotherapy's own green, so far the only
  // one), they keep the full text colour. Nothing is set for any other page.
  if (look.colours && (page.blocks || []).some((b) => b?.type === 'hero' && b.variant === 'blob') && contrast(mix(k.onAccent, k.accent, 0.14), k.accent) < 4.5) v.push(`--cb-blob-dim:${k.onAccent}`);
  if (look.font && PAGE_FONTS[look.font]) v.push(`--cb-heading-font:${PAGE_FONTS[look.font].css}`);
  if (look.bodyFont && PAGE_BODY_FONTS[look.bodyFont]) {
    v.push(`--cb-body-font:${PAGE_BODY_FONTS[look.bodyFont].css}`);
    // The website's own words around a page set in another typeface than the clean sans (the
    // header and the footer) take that typeface too, so the page is one family, and a phone does
    // not fetch the clean sans as well for a few words at the top.
    if (look.bodyFont !== 'clean') v.push(`--font-body:${PAGE_BODY_FONTS[look.bodyFont].css}`, `--font-display:${PAGE_BODY_FONTS[look.bodyFont].css}`);
  }
  let css = `html[data-blog-theme][data-blog-theme][data-blog-theme]{${v.join(';')}}`;
  if (look.colours) css += `html[data-blog-theme][data-blog-theme][data-blog-theme] body{background:${k.bg};color:${k.ink}}`;
  return css;
}

// ---- rich text -----------------------------------------------------------------------------
// Escape first, then apply the few marks we allow. Links must pass cleanHref.
export function inline(text, ctx = {}) {
  const links = [];
  let s = String(text ?? '').replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,2048})\)/g, (m, label, href) => {
    const h = cleanHref(href);
    if (!h || h.startsWith('@')) return m;
    links.push(`<a href="${esc(resolveLink(h, ctx))}">${esc(label)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  s = esc(s)
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)] || '');
}
export function richText(text, ctx = {}) {
  return String(text ?? '').split(/\n\s*\n/).map((para) => para.trim()).filter(Boolean).map((para) => {
    const lines = para.split('\n');
    if (lines.every((l) => /^[-*•]\s+/.test(l.trim()))) return `<ul>${lines.map((l) => `<li>${inline(l.trim().replace(/^[-*•]\s+/, ''), ctx)}</li>`).join('')}</ul>`;
    return `<p>${lines.map((l) => inline(l.trim(), ctx)).join('<br>')}</p>`;
  }).join('');
}
// Plain text with line breaks kept (opening hours, addresses).
const plain = (text) => esc(text).replace(/\n/g, '<br>');
// Opening hours: one typed line to a row, blank lines and spaces left out, as the Astro pages draw
// them (hoursLines; round B review, minor 2).
const hoursPlain = (text) => hoursLines(text).map(esc).join('<br>');

// ---- links ---------------------------------------------------------------------------------
function resolveLink(href, ctx) {
  const biz = ctx.biz || {};
  const at = (p) => (ctx.href ? ctx.href(p) : p);
  if (href === '@booking') return biz.bookingUrl ? at('/appointments/') : at('/contact/');
  if (href === '@phone') return biz.phone ? telHref(biz) : '';
  if (href === '@email') return biz.email ? `mailto:${biz.email}` : '';
  if (href.startsWith('/')) return at(href);
  return href;
}

// ---- the renderer --------------------------------------------------------------------------
// ctx: { site, posts:[{href,title,dateLabel,description,image}], editable, href(path),
//        resolveImage(src), allowDataImages, formEndpoint, base:{bg,ink,accent}, postsHref }
export function renderPage(rawPage, ctx = {}) {
  const page = normalisePage(rawPage, { allowData: !!ctx.allowDataImages });
  const site = ctx.site || {};
  const biz = professionalDetails(site.professional || {}, { allowDataImages: !!ctx.allowDataImages });
  // Every page gets one h1: the first opening's heading, or else the first heading on the page.
  // The writer's own email on their profile stands in when Site settings has none.
  if (!biz.email && typeof ctx.fallbackEmail === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(ctx.fallbackEmail)) biz.email = ctx.fallbackEmail.slice(0, 254);
  // Today, for dated things (spaces remaining). The website passes nothing, so it is the day the
  // site was built; a test or a preview can name the day.
  const today = cleanDate(ctx.today) || localIso();
  const C = { ...ctx, page, biz, today, editable: !!ctx.editable, h1Done: false, turns: turnColours(pageColours(page.look, ctx.base)) };
  // Every page gets one h1: the first heading that will really appear (an opening first).
  const shows = (b) => {
    if (!b.data.heading) return false;
    if (b.type === 'posts') return C.editable || (C.posts || []).length > 0;
    if (b.type === 'form') return C.editable || !!formEndpointOf(C) || !!biz.email;
    if (b.type === 'order') return C.editable || (b.data.items || []).some((x) => x.name);
    if (b.type === 'booking') return C.editable || !!bookingTarget(b.data.useSite !== false && !b.data.url ? biz.bookingUrl : b.data.url) || !!biz.phone || !!biz.email;
    return true;
  };
  const flat = page.blocks.flatMap((b) => (b.type === 'columns' ? b.data.children || [] : [b]));
  C.h1Id = (flat.find((b) => b.type === 'hero' && shows(b)) || flat.find(shows))?.id;
  // Movement (see MOTION in schema.mjs). The page's first opening carries the backdrop.
  const m = page.look.motion || null;
  C.backdrop = m?.backdrop || '';
  C.heroId = page.blocks.find((b) => b.type === 'hero')?.id;
  // The page's If you need help now card, when it has one: an opening's help line goes to it.
  C.helpId = page.blocks.find((b) => b.type === 'notice' && b.variant === 'help')?.id || '';
  // A page that opens with words only: its first photo is what a phone paints largest, so it is
  // asked for at once instead of waiting until it is scrolled near.
  const first = page.blocks[0];
  // (An opening whose first screen is its words by design, questions first or branching lines
  // drawn behind the words, keeps the words the largest paint: no photo further down jumps the queue.)
  const wordsLed = first?.type === 'hero' && ['questions', 'branches'].includes(first.variant);
  C.eagerLeft = wordsLed || (first?.type === 'hero' && (first.data.picture || first.data.video || (first.data.pictures || []).length)) ? 0 : 1;
  const blocks = page.blocks.map((b) => renderBlock(b, C)).join('');
  return `<style>${pageCss(page, ctx.base)}</style><div class="cbp${m ? ' cbm' : ''}${page.look.font ? ` cbp-font cbp-hf-${page.look.font}` : ''}${page.look.bodyFont ? ' cbp-bodyfont' : ''}" data-page="${esc(page.slug)}"${motionAttrs(m)}${C.editable ? ' data-m-edit' : ''}>${blocks}</div>`;
}

// The page's movement choices as data-m-* attributes; motion.css and page-motion.js read them.
export function motionAttrs(m) {
  if (!m) return '';
  // The unhurried pace is the measured one (nothing on the first screen waits), only slower.
  return ['scroll', 'heading', 'buttons', 'pictures', 'follow', 'pointer', 'opening', 'arrive', 'mark', 'pace'].filter((k) => m[k] && Object.hasOwn(MOTION[k].options, m[k])).map((k) => (k === 'pace' && m[k] === 'unhurried' ? ' data-m-pace="measured" data-m-unhurried' : ` data-m-${k}="${m[k]}"`)).join('') + (m.count ? ' data-m-count' : '');
}
// Moving shapes behind a block. Pure decoration: empty elements that the stylesheet arranges and
// animates in the page's own colours, hidden from screen readers.
const BACKDROP_PARTS = { dawn: 1, globe: 0, ring: 0, terrain: 0, aurora: 4, bubbles: 12, blobs: 3, waves: 3, orbits: 4, grid: 2, dots: 2, rays: 2, shapes: 12, lines: 9, ripples: 5, petals: 14, stars: 6, spotlight: 2, wash: 1, grain: 1 };
export function backdropHtml(kind, cls = '') {
  if (!Object.hasOwn(BACKDROP_PARTS, kind)) return '';
  return `<div class="cbm-bd cbm-bd-${kind}${cls}" aria-hidden="true">${['stars', 'globe', 'ring', 'terrain'].includes(kind) ? '<canvas></canvas>' : ''}${'<i></i>'.repeat(BACKDROP_PARTS[kind])}</div>`;
}
// Styles for showing a page perfectly still (thumbnails, previews, a "movement off" view):
// nothing animates, and the backdrops that only make sense moving are left out, as they are for
// visitors who ask for less motion. A rolling headline is shown whole, on as many lines as it needs.
export const STILL_CSS = '*,*::before,*::after{animation:none!important;transition:none!important}.cbm-bd-bubbles,.cbm-bd-petals,.cbm-bd-lines,.cbm-bd-ripples,.cbm-bd-stars canvas{display:none!important}.cb-mq-hero{width:auto;margin-left:0}.cb-mq-hero .cb-mq-track{width:auto;flex-wrap:wrap}.cb-mq-hero [aria-hidden=true]{display:none}.cbp .cb-mq-hero .cb-hero-h{display:block;flex:0 1 auto;min-width:0;white-space:normal;font-size:clamp(2.8rem,9vw,8rem)}.cb-mq-hero .cb-hero-h::after{display:none}';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// A steady stand-in for chance: the same piece always flies the same way, so the editor and the
// website draw the same page. Returns a number from -1 to 1.
const scatter = (i, salt = 1) => { const x = Math.sin((i + 1) * 12.9898 * salt + salt * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
// A picture's address inside a style attribute: url('…') with the characters that could end it encoded.
const cssUrl = (src) => `url('${String(src).replace(/[\\'"()\s<>]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}')`;

const ED = (C, attr, key) => (C.editable ? ` ${attr}="${esc(key)}"` : '');
const PH = (C, b, path) => {
  const f = fieldPh(b.type, path);
  return C.editable ? ` data-cb-empty data-ph="${esc(f)}"` : '';
};
function fieldPh(type, path) {
  const parts = path.split('.');
  let f = BLOCK_TYPES[type]?.fields?.[parts[0]];
  if (f?.kind === 'items') f = f.item[parts[2]];
  return f?.ph || 'Add text';
}
// One editable text value. Empty values disappear from the published page.
function T(C, b, path, value, tag = 'p', cls = '', attrs = '') {
  const c = cls ? ` class="${cls}"` : '';
  const at = svcAt(C, b, path) || ED(C, 'data-cb', `${b.id}:${path}`);
  if (!value) return C.editable ? `<${tag}${c}${attrs}${at}${PH(C, b, path)}></${tag}>` : '';
  return `<${tag}${c}${attrs}${at}>${esc(value)}</${tag}>`;
}
// A value a linked card takes from Your services (round C): in the editor it is not typed into
// here; pressing it opens the service ("<block>:items.<n>"), so the list is the only place it lives.
const svcAt = (C, b, path) => {
  if (!C.editable || !b._svcFields) return '';
  const m = /^items\.(\d+)\.([a-z]+)$/i.exec(path);
  return m && b._svcFields[+m[1]]?.has(m[2]) ? ` data-cb-svc="${esc(`${b.id}:items.${m[1]}`)}"` : '';
};
function RT(C, b, path, value, cls = 'cb-rich') {
  if (!value) return C.editable ? `<div class="${cls}"${ED(C, 'data-cb', `${b.id}:${path}`)} data-cb-rich${PH(C, b, path)}></div>` : '';
  return `<div class="${cls}"${ED(C, 'data-cb', `${b.id}:${path}`)}${C.editable ? ' data-cb-rich' : ''}>${richText(value, C)}</div>`;
}
function PL(C, b, path, value, cls = '') {
  if (!value) return C.editable ? `<p class="${cls}"${ED(C, 'data-cb', `${b.id}:${path}`)} data-cb-plain${PH(C, b, path)}></p>` : '';
  return `<p class="${cls}"${ED(C, 'data-cb', `${b.id}:${path}`)}${C.editable ? ' data-cb-plain' : ''}>${plain(value)}</p>`;
}
const imgSrc = (C, src) => (C.resolveImage ? C.resolveImage(src) : (C.href && src.startsWith('/') ? C.href(src) : src));
function credit(p, cls = 'cb-credit') {
  const cr = p?.credit;
  if (!cr || !['by', 'by-sa'].includes(cr.license)) return '';
  const who = cr.creator ? esc(cr.creator) : 'Photo';
  const lic = `${cr.license === 'by' ? 'CC BY' : 'CC BY-SA'}${cr.version ? ` ${esc(cr.version)}` : ''}`;
  const what = cr.page ? `<a href="${esc(cr.page)}" rel="noopener">${who}</a>` : who;
  const licence = cr.licenceUrl ? `<a href="${esc(cr.licenceUrl)}" rel="noopener license">${lic}</a>` : lic;
  return `<small class="${cls}">Photo: ${what}, ${licence}</small>`;
}
// Where a photo's point of interest sits, in the words CSS uses, for copies drawn as backgrounds.
const focusPos = (p) => (p?.focus ? (p.focus === 'top' ? '50% 20%' : p.focus === 'bottom' ? '50% 80%' : p.focus === 'left' ? '20% 50%' : '80% 50%') : '');
const picVars = (C, p) => `--cb-pic:${esc(cssUrl(imgSrc(C, p.src)))}${focusPos(p) ? `;--cb-pos:${focusPos(p)}` : ''}`;
// A picture. `eager` for the first screen; `cls` on the <img>.
function P(C, b, path, p, cls = '', { eager = false, credits = true, sizes = PHONE_SIZES } = {}) {
  if (p && !eager && !C.editable && C.eagerLeft > 0) { eager = true; C.eagerLeft = 0; }
  if (!p) return C.editable ? `<div class="cb-pic-empty ${cls}"${ED(C, 'data-cb-img', `${b.id}:${path}`)} role="img" aria-label="Add a picture"><span>Add a picture</span></div>` : '';
  const focus = p.focus ? ` style="object-position:${p.focus === 'top' ? '50% 20%' : p.focus === 'bottom' ? '50% 80%' : p.focus === 'left' ? '20% 50%' : '80% 50%'}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(imgSrc(C, p.src))}"${srcsetOf(C, p, sizes)} alt="${esc(p.alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${focus}${ED(C, 'data-cb-img', `${b.id}:${path}`)}>${credits ? credit(p) : ''}`;
}
// A photo with a smaller copy for phones: the browser takes the copy on a small screen. Each copy
// is described by its own width when the photo says it (`phoneW`, `w`); older photos are taken as
// 800 and 1600 pixels wide, as they always were. On a phone a photo is about the page's width less
// its side margins (92% of the screen).
export const PHONE_SIZES = '(max-width: 760px) 92vw, 60vw';
export const photoSrcset = (p, at = (s) => s) => (p?.phone ? `${at(p.phone)} ${p.phoneW || 800}w, ${at(p.src)} ${p.w || 1600}w` : '');
const srcsetOf = (C, p, sizes = PHONE_SIZES) => (p.phone ? ` srcset="${esc(photoSrcset(p, (s) => imgSrc(C, s)))}" sizes="${esc(sizes)}"` : '');
// A photo shown across the whole content width (the still water opening): as wide as the section
// allows, so a computer screen of about 761 to 1060 pixels never takes the phone copy (review 2).
const SECTION_MAX = { narrow: '44rem', normal: '72rem', wide: '90rem' };
export const fullWidthSizes = (width) => (width === 'full' ? '100vw' : `(max-width: 760px) 92vw, min(${SECTION_MAX[width] || '72rem'}, 92vw)`);
// A button or link. Hidden on the published page when it has nowhere to go.
function BTN(C, b, path, link, cls = 'cb-btn') {
  const href = link?.href ? resolveLink(link.href, C) : '';
  const label = link?.label || '';
  if ((!href || !label) && !C.editable) return '';
  const needs = C.editable && (!href || !label) ? ' data-cb-incomplete' : '';
  return `<a class="${cls}" href="${esc(href || '#')}"${svcAt(C, b, path) || ED(C, 'data-cb-link', `${b.id}:${path}`)}${needs}>${esc(label || 'Button')}</a>`;
}
function BTNS(C, b, buttons = [], cls = 'cb-actions') {
  const out = buttons.map((l, i) => BTN(C, b, `buttons.${i}`, l, i ? 'cb-btn cb-btn-2' : 'cb-btn')).join('');
  const add = C.editable && buttons.length < 2 ? `<button type="button" class="cb-add-btn" data-cb-add="${esc(b.id)}:buttons">Add a button</button>` : '';
  return out || add ? `<div class="${cls}">${out}${add}</div>` : '';
}
// Booking and paying (owner, 22 Nov). "Pays securely through Stripe" beside a pay button whose
// address the website recognises (nothing for any other address); plain words where a visitor
// books and pays in two steps; "Pay when you book" where payment is taken as they book.
const payNote = (href) => { const w = payLine(href); return w ? `<span class="cb-paysafe">${esc(w)}</span>` : ''; };
const thenPay = (pay, place = 'time') => `<span class="cb-thenpay">Book your ${place}, then ${/deposit/i.test(pay?.label || '') ? 'pay the deposit' : 'pay'}.</span>`;
export const PAY_WHEN_BOOK = 'Pay when you book';
// "Pay when you book" is only said where there is a booking page to pay on: the item's own
// booking link or the website's. With only a phone to call it would promise what cannot happen
// (newcomer walk, 23 Nov). The strip then also says it once, under the choices.
const paysOnBooking = (C, x) => !!x?.paid && !!((x.link?.href && x.link.href !== '@booking') || C.biz?.bookingUrl);
export const PAY_WHEN_BOOK_LINE = 'You pay when you book.';
const PAID_HINT = 'Pay when you book shows on your website once your booking link is set in Details & booking.';
// Only once the business has ticked that booking emails and the day-before reminder are switched
// on in its booking service (Details and booking).
export const REMINDER_LINE = 'You will get an email to confirm your booking, and a reminder the day before.';
// It needs a booking link too: with only a phone to call, nothing would send those emails.
const remindLine = (C) => (C.biz?.reminders && C.biz?.bookingUrl ? `<p class="cb-small cb-remind">${REMINDER_LINE}</p>` : '');
// Guides shown only in the editor, beside a section that plays a known part (its role).
// (Checked on the providers' own help pages, 22 Nov 2026: Stripe's "After the payment" redirect,
// PayPal payment links' Auto-return, Square's "Redirect to a website after checkout".)
// The website's own address, or '' while it is not a real https one (the design's placeholder
// your-domain.com never counts, as in the app's connection.js).
export const realSiteUrl = (url) => { const u = cleanHref(url || ''); if (!/^https:/.test(u)) return ''; try { return new URL(u).hostname.toLowerCase() === 'your-domain.com' ? '' : u; } catch { return ''; } };
const thanksAddress = (C) => { const u = realSiteUrl(C.site?.url); return u ? `${u.replace(/\/+$/, '')}/thank-you/` : 'your website’s address with /thank-you/ on the end'; };
// The consumer guide (the 14 days) belongs beside the consumer sample only. An NHS practice's own
// section, or plain terms for organisations, gets a short guide of its own (review 2, 23 Nov).
const CANCEL_GUIDE = 'A starting point, not legal advice. Check the UK rules on cancelling services booked online, by phone or by email (Business Companion’s guide to distance sales, from Trading Standards), then change these words to your own policy. These rights are for consumers, people booking for themselves. When a customer wants a session to start within the 14 days, ask them to confirm that. If customers are not told about the right to cancel, it can run up to a year longer.';
const sectionWords = (b) => { const d = b?.data || {}; return [d.heading, d.intro, ...(d.items || []).flatMap((x) => [x.question, x.answer])].join(' '); };
const ROLE_GUIDES = {
  cancel: (C, b) => (/\bNHS App\b/.test(sectionWords(b)) ? 'A starting point. Change these words to how patients move or cancel appointments with your practice.'
    : /engagement letter/i.test(sectionWords(b)) ? 'A starting point, not legal advice. Keep these words in line with your engagement letter, which sets your terms.'
      : CANCEL_GUIDE),
  thanks: (C) => `This page is not in your menu. Send people here after they pay: in Stripe, edit the payment link, open After the payment and choose to send customers to your website, then paste ${thanksAddress(C)}. In PayPal, on a payment link’s Confirmation tab, turn on Auto-return and paste the same address. A Square checkout link can do the same (Redirect to a website after checkout).`,
};
// A repeating list. Each item carries its own marker so the editor can move or remove it.
function LIST(C, b, key, items, each, tag = 'div', cls = '') {
  const body = items.map((it, i) => each(it, i, (inner, itag = 'article', icls = '') => `<${itag}${icls ? ` class="${icls}"` : ''}${ED(C, 'data-cb-item', `${b.id}:${key}.${i}`)}>${inner}</${itag}>`)).join('');
  if (!body && !C.editable) return '';
  return `<${tag} class="${cls}"${ED(C, 'data-cb-list', `${b.id}:${key}`)}>${body}</${tag}>`;
}
// The small line above a heading. On the published page it is left out when it only repeats the
// heading (a new website often starts with its name in both); the editor still shows it.
const K = (C, b, d) => (!C.editable && sameText(d.kicker, d.heading) ? '' : T(C, b, 'kicker', d.kicker, 'p', 'cb-kicker'));
const hTag = (C, b, tag = 'h2') => { if (b.id === C.h1Id && !C.h1Done) { C.h1Done = true; return 'h1'; } return tag; };
function H(C, b, d, tag = 'h2', cls = 'cb-h', attrs = '') {
  return withMark(C, d, emHeading(C, T(C, b, 'heading', d.heading, hTag(C, b, tag), cls, attrs)));
}
// A word in a heading written *like this* is set in italic on the published page. The editor
// keeps the stars, so the heading can still be typed into as it is, but shows the word as it
// will look and the stars faint, so they never read as stray characters (newcomer walk, 23 Nov).
// The heading's words are read back as plain text, stars included, so nothing else changes.
function emHeading(C, html) {
  if (!html.includes('*')) return html;
  const to = C.editable ? '$1<span class="cb-emk" title="Words between stars are set like this on your website">*</span><em>$2</em><span class="cb-emk">*</span>' : '$1<em>$2</em>';
  return html.split(/(<[^>]*>)/).map((part) => (part.startsWith('<') ? part : part.replace(new RegExp(HEADING_EM.source, 'g'), to))).join('');
}
// "Words to mark": on the published page the first place those words appear (in the heading, or
// else in the words under it) is wrapped in <mark>, which the stylesheet underlines or highlights
// and the page's script draws in. The words themselves are never changed, and the editor leaves
// the heading as plain text so it can be typed into.
function withMark(C, d, html) {
  const want = C.editable || !d?.mark || C.marked?.has(d) ? '' : esc(d.mark);
  if (!want) return html;
  let done = false;
  const out = html.split(/(<[^>]*>)/).map((part) => {
    if (done || part.startsWith('<')) return part;
    const at = part.toLowerCase().indexOf(want.toLowerCase());
    if (at < 0) return part;
    done = true;
    return `${part.slice(0, at)}<mark class="cb-mark">${part.slice(at, at + want.length)}</mark>${part.slice(at + want.length)}`;
  }).join('');
  if (done) (C.marked ||= new Set()).add(d);
  return out;
}

function bizDetails(C, d, own = false) {
  const biz = C.biz;
  if (own) return { address: d.address || '', hours: d.hours || '', phone: d.phone || '', email: d.email || '' };
  return { address: biz.location, hours: biz.hours, phone: biz.phone, email: biz.email };
}
// "Open now, closes at 6pm": worked out on the visitor's device from the opening hours, in the
// business's own time zone, so it is right whenever and wherever the page is read. Without the
// script it is simply not there. The editor shows what it will do.
function openLine(C, hoursText, cls = 'cb-opennow') {
  if (C.editable) return `<p class="cb-note" data-cb-hint>${hoursText ? 'On your website a line here says whether you are open now, worked out from your opening hours.' : 'On your website a line here will say whether you are open now, once your opening hours are added in Details and booking.'}</p>`;
  if (!hoursText) return '';
  return `<p class="${cls}" data-open="${esc(String(hoursText).split('\n').map((l) => l.trim()).filter(Boolean).join('|'))}" data-tz="${esc(C.biz.timeZone || 'Europe/London')}" hidden></p>`;
}
// What to do when the business is closed (NHS 111 and 999 for a doctor), set apart as a note.
const closedNote = (C, b, d) => (d.closed || C.editable ? RT(C, b, 'closed', d.closed, 'cb-rich cb-closed') : '');

// The facts list used by contact blocks and the hero's details panel.
function factsList(C, b, d, { own = false, cls = 'cb-facts', skip = '' } = {}) {
  const f = bizDetails(C, d, own);
  if (skip) f[skip] = '';
  const row = (label, key, html) => (html ? `<div><dt>${label}</dt><dd>${html}</dd></div>` : '');
  const val = (key, html, isPlain) => {
    if (own) {
      if (!f[key] && !C.editable) return '';
      if (key === 'hours' && !C.editable) return `<p>${hoursPlain(f[key])}</p>`;
      return isPlain ? PL(C, b, key, f[key]) : T(C, b, key, f[key], 'span');
    }
    return html;
  };
  const tel = f.phone ? `tel:${String(f.phone).replace(/[^+\d]/g, '')}` : '';
  const html = [
    row('Address', 'address', val('address', f.address ? `<p>${plain(f.address)}</p>` : '', true)),
    row('Opening hours', 'hours', val('hours', f.hours ? `<p class="cb-hours">${hoursPlain(f.hours)}</p>` : '', true)),
    row('Phone', 'phone', own ? (f.phone && !C.editable ? `<a href="${esc(tel)}">${esc(f.phone)}</a>` : val('phone')) : (tel ? `<a href="${esc(tel)}">${esc(f.phone)}</a>` : '')),
    row('Email', 'email', own ? (f.email && !C.editable ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : val('email')) : (f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : '')),
  ].join('');
  if (!html) return C.editable && !own ? `<p class="cb-note" data-cb-hint>Your address, hours, phone and email from Details & booking appear here.</p>` : '';
  return `<dl class="${cls}">${html}</dl>`;
}

// ---- blocks --------------------------------------------------------------------------------
const R_ = {};

// A video in the opening. Behind the words it plays silently on a loop (with a pause button, and
// paused for people who ask for less motion); elsewhere it has the usual controls. The picture is
// its poster. YouTube and Vimeo can't sit behind words, so they show as a player instead.
// The giant word's width in em, in capitals at its weight and letter spacing: each letter's own
// width, measured in Space Grotesk (the font the deep band was drawn for) at weight 800 with
// -.045em letter spacing, plus 3.3% so the sample's "Ease" keeps its size. Never less than four
// average letters (2.24em), as before, so a short word is not drawn larger than the band.
const LETTER_EM = { A: .608, B: .639, C: .619, D: .621, E: .526, F: .505, G: .637, H: .631, I: .226, J: .551, K: .6, L: .513, M: .865, N: .646, O: .652, P: .577, Q: .652, R: .606, S: .58, T: .561, U: .648, V: .592, W: .881, X: .619, Y: .598, Z: .549, 0: .623, 1: .42, 2: .567, 3: .582, 4: .61, 5: .573, 6: .592, 7: .526, 8: .573, 9: .592, ' ': .26 };
export function wordEm(word) {
  let em = 0;
  for (const ch of Array.from(String(word || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase())) em += LETTER_EM[ch] ?? .66;
  return Math.max(2.24, Math.round(em * 1000) / 1000);
}
function heroVideo(C, b, d, behind) {
  const e = videoEmbed(d.video);
  const mark = ED(C, 'data-cb-video', `${b.id}:video`);
  const poster = d.picture ? ` poster="${esc(imgSrc(C, d.picture.src))}"` : '';
  if (!e) return '';
  if (e.kind === 'file') {
    // The poster may be a free photo whose licence needs a credit.
    if (behind) return `<video class="cb-hero-video" src="${esc(imgSrc(C, e.src))}"${poster} muted loop playsinline${C.editable ? '' : ' autoplay'} preload="metadata" aria-hidden="true"${mark}></video>${credit(d.picture)}`;
    return `<video class="cb-hero-video" src="${esc(imgSrc(C, e.src))}"${poster} controls playsinline preload="metadata"${mark}></video>${credit(d.picture)}`;
  }
  if (C.editable) return `<div class="cb-video-hold"${mark}><span>${esc(e.host)} video</span></div>`;
  return `<iframe class="cb-hero-video" src="${esc(e.src)}" title="${esc(d.heading || `${e.host} video`)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

// "Changing words": the last part of the opening heading swaps between a few words.
const rotWords = (d) => String(d.rotate || '').split(/[,;|]/).map((w) => w.trim()).filter(Boolean).slice(0, 6);
function heroHeading(C, b, d, cls = 'cb-h cb-hero-h', attrs = '') {
  const words = rotWords(d);
  // While editing, the heading stays plain text and the changing words are listed beneath it.
  if (C.editable) return `${H(C, b, d, 'h2', cls, attrs)}${words.length ? `<p class="cb-rot-edit" data-cb-hint>Changing words: ${esc(words.join(' · '))}</p>` : ''}`;
  if (!words.length || !d.heading) return H(C, b, d, 'h2', cls, attrs);
  const tag = hTag(C, b);
  // Written as a plain list ("brands, websites, films"), so with scripts off or movement turned
  // down every word is there to read. The page's script then shows them one at a time.
  return `<${tag} class="${cls}"${attrs}>${esc(d.heading)} <span class="cb-rot">${words.map((w, i) => `<span${i ? '' : ' class="is-on"'}>${esc(w)}</span>`).join('<span class="cb-rot-sep">, </span>')}</span></${tag}>`;
}
// The opening's extra photos, as a list the editor can add to.
function morePics(C, b, d, cls, eachCls = '') {
  const pics = (d.pictures || []).slice(0, HERO_PHOTO_ROOM[b.variant] || 0);
  return LIST(C, b, 'pictures', pics, (p, i, wrap) => wrap(P(C, b, `pictures.${i}`, p, '', { credits: false }), 'figure', eachCls), 'div', cls);
}
const creditsOf = (list) => { const c = list.map((p) => credit(p)).filter(Boolean); return c.length ? `<p class="cb-credits">${[...new Set(c)].join(' ')}</p>` : ''; };
// The extra photos an opening layout really shows (the rest wait for a layout with room).
const shownMore = (b, d) => (d.pictures || []).slice(0, HERO_PHOTO_ROOM[b.variant] || 0);

// Openings built round a photo. On the published page one with no photo or film is drawn as its
// words alone, so no room is kept for a picture that was never added. The editor is not touched:
// it goes on showing the "Add a picture" prompt in the photo's place.
const PHOTO_LED = ['split', 'photo-behind', 'stacked', 'blob', 'inset', 'open', 'orbit', 'collage', 'arch', 'curtain', 'reveal', 'dawn', 'triptych', 'reflection'];
// Of those, the ones whose whole frame is shaped for the photo. Without one they take the plain
// "words" frame instead of their own.
const PHOTO_FRAMED = ['photo-behind', 'inset', 'open', 'curtain', 'dawn', 'triptych'];
const heroBare = (C, b) => !C.editable && b.type === 'hero' && !b.data.picture && !b.data.video && !shownMore(b, b.data).length;
// The class name an opening is drawn with.
const heroFrame = (C, b) => (b.type === 'hero' && PHOTO_FRAMED.includes(b.variant) && heroBare(C, b) ? 'words' : b.variant);

// The quick actions opening (doctor clinics): the words, a photo, and over it a panel of up to
// four large actions (Book, Register, Call, Repeat prescription) sitting on a card that says
// whether the business is open now, with today's hours and what to do when closed. Each action is
// an ordinary link: a Call with no phone number set, or any action with nowhere to go, is left
// out, so no button is ever dead. On a phone the card and the actions come straight under the
// heading, before the photo, so the first screen answers: is it open, how do I book, how do I call.
function heroActions(C, b, d, { head, intro, btns, media }) {
  const list = d.actions || [];
  const item = (x, i) => {
    const href = x.link?.href ? resolveLink(x.link.href, C) : '';
    const label = x.link?.label || '';
    const tel = x.link?.href === '@phone';
    const detail = x.detail || (tel && C.biz.phone ? C.biz.phone : '');
    if (C.editable) return `<li class="cb-act-li"${ED(C, 'data-cb-item', `${b.id}:actions.${i}`)}><a class="cb-act-item" href="${esc(href || '#')}"${ED(C, 'data-cb-link', `${b.id}:actions.${i}.link`)}${!href || !label ? ' data-cb-incomplete' : ''}><span class="cb-act-label">${esc(label || 'Action')}</span>${T(C, b, `actions.${i}.detail`, x.detail, 'span', 'cb-act-detail')}<i class="cb-act-go" aria-hidden="true"></i></a></li>`;
    if (!href || !label) return '';
    const away = /^https:/.test(href);
    return `<li class="cb-act-li"><a class="cb-act-item${tel ? ' is-call' : ''}" href="${esc(href)}"${away ? ' rel="noopener"' : ''}><span class="cb-act-label">${esc(label)}</span>${detail ? `<span class="cb-act-detail">${esc(detail)}</span>` : ''}<i class="cb-act-go" aria-hidden="true"></i></a></li>`;
  };
  const items = list.map(item).join('');
  const acts = items || C.editable ? `<ul class="cb-act-list"${ED(C, 'data-cb-list', `${b.id}:actions`)}>${items}</ul>` : '';
  const hours = C.biz.hours || '';
  const today = hours ? `<p class="cb-act-hours">${hoursPlain(hours)}</p>` : (C.editable ? '<p class="cb-note" data-cb-hint>Your opening hours from Details and booking appear here.</p>' : '');
  const now = d.openNow ? openLine(C, hours, 'cb-opennow cb-act-now') : '';
  const card = now || today || d.closed || C.editable ? `<div class="cb-act-card">${now}${today}${closedNote(C, b, d)}</div>` : '';
  const fig = media ? `<figure class="cb-hero-pic cb-act-pic">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>` : '';
  const panel = card || acts ? `<div class="cb-act-panel">${card}${acts}</div>` : '';
  return `<div class="cb-act${fig ? '' : ' cb-solo'}"><div class="cb-act-words">${head}${intro}${btns}</div>${panel}${fig}</div>${d.picture ? creditsOf([d.picture]) : ''}`;
}

R_.hero = (C, b) => {
  let d = b.data;
  const v = b.variant, bare = heroBare(C, b);
  // The main photo is missing but others were added: on the published page the first of them
  // takes its place, so the layout is not left with a hole in the middle.
  if (!C.editable && !d.picture && !d.video && !bare) { const [first, ...rest] = shownMore(b, d); d = { ...d, picture: first, pictures: rest }; }
  if (bare && PHOTO_LED.includes(v)) {
    const inner = `${K(C, b, d)}${heroHeading(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-lead')}${BTNS(C, b, d.buttons)}${heroBar(C, b, d)}${d.details ? factsList(C, b, d, { cls: 'cb-facts cb-hero-facts' }) : ''}`;
    return inner ? `<div class="cb-hero-words">${inner}</div>` : '';
  }
  // Two openings draw the heading their own way, so the shared one must not be made for them
  // (making it would use up the page's one h1).
  const ownHeading = v === 'marquee' || v === 'mask' || v === 'wordmark' || v === 'open';
  const head = ownHeading ? '' : `${K(C, b, d)}${heroHeading(C, b, d)}`;
  const intro = withMark(C, d, RT(C, b, 'intro', d.intro, 'cb-rich cb-lead'));
  // The booking bar, when there is one, always sits under the buttons, whatever the layout, and
  // then whether the business is open now.
  const nowLine = d.openNow && v !== 'actions' ? openLine(C, C.biz.hours, 'cb-opennow cb-hero-now') : '';
  // A short still line that goes to the page's If you need help now card (release 7), so the
  // first screen of a phone already says where help is. Only when the page has that card.
  const helpLine = d.help && (C.editable || C.helpId) ? `<p class="cb-hero-help">${C.editable ? T(C, b, 'help', d.help, 'span') : `<a href="#help-now"><span class="cb-hero-help-dot" aria-hidden="true"></span>${esc(d.help)}</a>`}</p>` : '';
  const btns = `${BTNS(C, b, d.buttons)}${heroBar(C, b, d)}${nowLine}${helpLine}`;
  // A line drawn under the heading as the page opens (a sound wave, or a calm heart trace).
  const heroTrace = choiceValue('hero', d, 'trace');
  const traceLine = heroTrace === 'heart' || heroTrace === 'wave' ? `<span class="cb-trace cb-trace-${heroTrace} cb-trace-hero" aria-hidden="true"><span class="cb-trace-ghost">${traceSvg(heroTrace, 5)}</span><span class="cb-trace-win"><span class="cb-trace-in">${traceSvg(heroTrace, 5)}</span></span></span>` : '';
  const words = `${head}${traceLine}${intro}${btns}`;
  const details = d.details ? factsList(C, b, d, { cls: 'cb-facts cb-hero-facts' }) : '';
  const pic = (cls = 'cb-hero-pic') => (v === 'minimal' ? '' : `<figure class="${cls}">${d.video ? heroVideo(C, b, d, cls.includes('cb-hero-bg')) : P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`);
  const media = d.picture || d.video || C.editable;
  const band = media ? pic('cb-hero-pic cb-hero-band') : '';
  const more = d.pictures || [];
  // A video file can fill the background; a YouTube or Vimeo video plays under the words instead.
  const fileBehind = d.video && videoEmbed(d.video)?.kind === 'file';
  const player = d.video && !fileBehind && v === 'photo-behind' ? `<div class="cb-hero-player">${heroVideo(C, b, d, false)}</div>` : '';
  const toggle = fileBehind && (v === 'photo-behind' || v === 'inset' || v === 'open') && !C.editable ? '<button type="button" class="cb-video-toggle" aria-label="Pause the video">Pause</button>' : '';
  if (v === 'split') return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div>${pic()}</div>`;
  if (v === 'actions') return heroActions(C, b, d, { head, intro, btns, media });
  // Words and a photo side by side; on a wide screen the photo stays put while the story under the
  // first screen scrolls past it (S1). Phones and "reduce motion" get the plain split.
  if (v === 'pinned') {
    const fig = media ? `<figure class="cb-hero-pic cb-pinhero-pic">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>` : '';
    return `<div class="cb-pinhero${fig ? '' : ' cb-solo'}">${fig}<div class="cb-pinhero-words"><div class="cb-pinhero-first">${words}${details}</div>${RT(C, b, 'story', d.story, 'cb-rich cb-pinhero-story')}${d.picture ? creditsOf([d.picture]) : ''}</div></div>`;
  }
  if (v === 'centred') return `<div class="cb-hero-words">${words}${details}</div>${media ? pic() : ''}`;
  if (v === 'photo-behind') {
    const bg = fileBehind || !d.video ? pic('cb-hero-bg') : `<figure class="cb-hero-bg">${P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`;
    return `${bg}<div class="cb-hero-words">${words}${details}${player}</div>${toggle}`;
  }
  if (v === 'panel') return `<div class="cb-hero-grid"><div class="cb-hero-words">${head}${intro}</div><aside class="cb-hero-panel">${factsList(C, b, d, { cls: 'cb-facts' })}${btns}</aside></div>${band}`;
  if (v === 'poster') return `${head}<div class="cb-poster-foot">${intro}<div>${btns}${details}</div></div>${band}`;
  if (v === 'stacked') return `${pic('cb-hero-pic cb-hero-top')}<div class="cb-hero-card">${words}${details}</div>`;

  // ---- openings built around movement ----
  if (v === 'marquee') {
    // The heading rolls across the screen. It is written once for readers and search engines;
    // the copies that make the loop are hidden from screen readers.
    let strip;
    if (C.editable || !d.heading) strip = `<div class="cb-mq cb-mq-hero cb-mq-still"><div class="cb-mq-track">${H(C, b, d, 'h2', 'cb-h cb-hero-h')}</div></div>`;
    else {
      // One copy is about 92px a letter at its largest, plus the mark between copies; enough of
      // them to cover a 2800px screen and one more for the loop.
      const len = [...d.heading].length, copies = clamp(Math.ceil(2800 / (len * 92 + 140)) + 1, 3, 20);
      const tag = hTag(C, b);
      strip = `<div class="cb-mq cb-mq-hero" style="--mq-shift:${(-100 / copies).toFixed(4)}%;--mq-dur:${clamp(Math.round(len * 0.55), 9, 60)}s"><div class="cb-mq-track"><${tag} class="cb-h cb-hero-h">${esc(d.heading)}</${tag}>${`<span class="cb-h cb-hero-h" aria-hidden="true">${esc(d.heading)}</span>`.repeat(copies - 1)}</div></div>`;
    }
    return `${K(C, b, d)}${strip}<div class="cb-poster-foot">${intro}<div>${btns}${details}</div></div>${band}`;
  }
  if (v === 'wordmark') {
    // A short name set as wide as the page. The size is worked out from its length here and
    // trimmed to an exact fit by the page's script; a long heading wraps like the Big type opening.
    const len = [...String(d.heading || '')].length;
    const fit = len && len <= 22 ? ` style="--fit:${clamp(160 / Math.max(len, 3), 6, 34).toFixed(2)}"` : '';
    return `${K(C, b, d)}${H(C, b, d, 'h2', `cb-h cb-hero-h cb-wordmark${fit ? '' : ' cb-wordmark-long'}`, fit)}<div class="cb-wm-foot${media ? '' : ' cb-solo'}"><div class="cb-wm-words">${intro}${btns}${details}</div>${media ? pic('cb-hero-pic cb-wm-pic') : ''}</div>`;
  }
  if (v === 'open') {
    // The name starts together in the middle; its two halves move to opposite corners as the
    // photo opens between them. Written once, in order, so it reads as one heading.
    const bg = fileBehind || !d.video ? pic('cb-hero-bg cb-open-bg') : `<figure class="cb-hero-bg cb-open-bg">${P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`;
    let heading;
    if (C.editable || !d.heading) heading = H(C, b, d, 'h2', 'cb-h cb-hero-h cb-open-h cb-open-plain');
    else {
      const parts = d.heading.split(/\s+/).filter(Boolean), cut = Math.ceil(parts.length / 2), tag = hTag(C, b);
      const second = parts.slice(cut).join(' ');
      // A short name starts together in the middle and travels; a long one would not fit there.
      heading = `<${tag} class="cb-h cb-hero-h cb-open-h${[...d.heading].length > 20 ? ' cb-open-long' : ''}"><span class="cb-open-a">${esc(parts.slice(0, cut).join(' '))}</span>${second ? ` <span class="cb-open-b">${esc(second)}</span>` : ''}</${tag}>`;
    }
    return `<div class="cb-open">${bg}${heading}<div class="cb-open-foot">${K(C, b, d)}${intro}${btns}${details}</div>${toggle}</div>`;
  }
  if (v === 'carousel') {
    // Photos stand in a ring that turns. Fewer than three would not make a ring, so they are
    // shown as the plain photo band instead.
    const all = [d.picture, ...shownMore(b, d)].filter(Boolean);
    let ring;
    if (C.editable) ring = `<div class="cb-car cb-car-still"><figure>${P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>${morePics(C, b, d, 'cb-car-more')}</div>`;
    else if (all.length < 3) ring = band;
    else ring = `<div class="cb-car" style="--n:${all.length}"><div class="cb-car-ring">${all.map((p, i) => `<figure style="--i:${i}"><img src="${esc(imgSrc(C, p.src))}"${srcsetOf(C, p)} alt="${esc(p.alt)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`).join('')}</div></div>`;
    return `<div class="cb-hero-words">${words}${details}</div>${ring}${all.length < 3 && !C.editable ? '' : creditsOf(all)}`;
  }
  if (v === 'depth') {
    if (!media && !more.length) return `<div class="cb-hero-words">${words}${details}</div>`;
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-depth"><span class="cb-depth-glow"></span>${media ? `<figure class="cb-depth-main">${d.video ? heroVideo(C, b, d, fileBehind) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>` : ''}${morePics(C, b, d, 'cb-depth-more')}</div></div>${creditsOf([d.picture, ...shownMore(b, d)])}`;
  }
  if (v === 'shatter') {
    // The photo is also laid out as a grid of tiles, each showing its own part of it. The page's
    // script flies them apart as the opening scrolls away; without it the photo is simply whole.
    let photo = band;
    if (d.picture && !d.video && !C.editable) {
      const cols = 6, rows = 4, tiles = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        tiles.push(`<i style="--c:${c};--r:${r};--dx:${Math.round((c - (cols - 1) / 2) * 90 + scatter(i, 2) * 60)}px;--dy:${Math.round((r - (rows - 1) / 2) * 110 + scatter(i, 3) * 70 - 40)}px;--dz:${Math.round(scatter(i, 5) * 260)}px;--rx:${Math.round(scatter(i, 7) * 80)}deg;--ry:${Math.round(scatter(i, 11) * 80)}deg"></i>`);
      }
      photo = `<figure class="cb-hero-pic cb-hero-band cb-shatter" data-scroll="exit" style="${picVars(C, d.picture)}">${P(C, b, 'picture', d.picture, '', { eager: true })}<span class="cb-tiles" aria-hidden="true">${tiles.join('')}</span></figure>`;
    }
    return `${head}<div class="cb-poster-foot">${intro}<div>${btns}${details}</div></div>${photo}`;
  }
  if (v === 'backword') {
    // One short word drawn as wide as the page, with the photo (or a film) floating in front of
    // it among a few loose shapes. The shapes are decoration only, so the editor leaves them out.
    // On a deep band the word is sized to the photo's column by its own letters (--bw-em, see
    // signature.css), so a wide word ("Move") fits as well as a narrow one.
    const em = b.style && b.style.bg === 'dark' ? `;--bw-em:${wordEm(d.word)}` : '';
    const word = T(C, b, 'word', d.word, 'p', 'cb-bw-word', ` style="--len:${Math.max(4, Array.from(d.word || '').length)}${em}"`);
    // With nothing to show, the words stand alone. A film file plays silently in the frame; a
    // YouTube or Vimeo film needs its controls, so it gets a plain frame and no loose shapes.
    if (!media) return `${word}<div class="cb-hero-words">${words}${details}</div>`;
    const plain = d.video && !fileBehind;
    const bits = C.editable || plain ? '' : `<span class="cb-bw-bits" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
    const frame = `<figure class="cb-hero-pic cb-bw-pic">${d.video ? heroVideo(C, b, d, fileBehind) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>`;
    return `${word}<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-bw-wrap"><div class="cb-bw${plain ? ' cb-bw-plain' : ''}"><span class="cb-bw-disc"></span>${frame}${bits}</div></div></div>${creditsOf([d.picture])}`;
  }
  if (v === 'lens') {
    // A round window on the photo. A magnifying glass glides over it, then follows the pointer.
    // A film plays in the window instead, without the glass.
    if (!media) return `<div class="cb-hero-words">${words}${details}</div>`;
    const still = d.picture && !d.video, plain = d.video && !fileBehind;
    const glass = still && !C.editable ? '<span class="cb-lens-glass" aria-hidden="true"><i></i></span>' : '';
    const frame = `<figure class="cb-hero-pic cb-lens-pic">${d.video ? heroVideo(C, b, d, fileBehind) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>`;
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-lens${plain ? ' cb-lens-plain' : ''}"${still ? ` style="${picVars(C, d.picture)}"` : ''}><span class="cb-lens-ring" aria-hidden="true"></span>${frame}${glass}</div></div>${creditsOf([d.picture])}`;
  }
  if (v === 'blob') {
    const dot = more.length || C.editable ? morePics(C, b, d, 'cb-blob-more', 'cb-blob-dot') : '';
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-blob"><span class="cb-blob-ring"></span>${pic('cb-hero-pic cb-blob-pic')}${dot}</div></div>${creditsOf(shownMore(b, d))}`;
  }
  if (v === 'inset') {
    // A video file fills the frame; a YouTube or Vimeo video cannot, so its picture does.
    const bg = fileBehind || !d.video ? pic('cb-hero-bg cb-inset-bg') : `<figure class="cb-hero-bg cb-inset-bg">${P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`;
    return `<div class="cb-inset">${bg}<div class="cb-hero-words">${words}</div>${details ? `<aside class="cb-inset-card">${details}</aside>` : ''}${toggle}</div>`;
  }
  if (v === 'orbit') {
    const sats = more.length || C.editable
      ? morePics(C, b, d, 'cb-orbit-sats').replace('class="cb-orbit-sats"', `class="cb-orbit-sats" style="--n:${Math.max(more.slice(0, HERO_PHOTO_ROOM.orbit).length, 1)}"`)
      : '<div class="cb-orbit-sats cb-orbit-dots" style="--n:3"><i></i><i></i><i></i></div>';
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-orbit"><span class="cb-orbit-ring"></span><span class="cb-orbit-ring"></span><figure class="cb-orbit-core">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>${sats}</div></div>${creditsOf([d.picture, ...shownMore(b, d)])}`;
  }
  if (v === 'collage') {
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-collage"><span class="cb-collage-shape"></span><span class="cb-collage-shape"></span><figure class="cb-collage-main">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>${morePics(C, b, d, 'cb-collage-more')}</div></div>${creditsOf([d.picture, ...shownMore(b, d)])}`;
  }
  if (v === 'mask') {
    // The photo shows through the letters. The editor also shows the photo as a small tile to click.
    const style = d.picture ? ` style="--cb-mask:${esc(cssUrl(imgSrc(C, d.picture.src)))}"` : '';
    const thumb = C.editable ? `<figure class="cb-mask-thumb">${P(C, b, 'picture', d.picture, '', { credits: false })}<figcaption>The photo inside the letters</figcaption></figure>` : '';
    return `${K(C, b, d)}${heroHeading(C, b, d, 'cb-h cb-hero-h cb-mask-h', style)}<div class="cb-poster-foot">${intro}<div>${btns}${details}</div></div>${thumb}${creditsOf([d.picture])}`;
  }
  if (v === 'arch') {
    // The badge's words run once round a circle: short labels repeat, long ones are cut at a word.
    let label = (d.kicker || C.site?.name || C.site?.masthead || 'Welcome').replace(/\s+/g, ' ').trim();
    if ([...label].length > 40) label = [...label].slice(0, 41).join('').replace(/\s+\S*$/, '');
    let ring = ''; do { ring += `${label} \u2022 `; } while ([...ring].length + [...label].length + 3 <= 46);
    const ringSize = clamp(276 / ([...ring].length * 0.7), 6, 10).toFixed(2);
    const badge = `<svg class="cb-arch-badge" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><path id="cba-${esc(b.id)}" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/></defs><circle cx="60" cy="60" r="58"/><text style="font-size:${ringSize}px"><textPath href="#cba-${esc(b.id)}" textLength="276" lengthAdjust="spacing">${esc(ring.toUpperCase())}</textPath></text><path class="cb-arch-star" d="M60 44l4.2 11.8L76 60l-11.8 4.2L60 76l-4.2-11.8L44 60l11.8-4.2z"/></svg>`;
    return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div><div class="cb-arch"><span class="cb-arch-shape"></span>${pic('cb-hero-pic cb-arch-pic')}${badge}</div></div>`;
  }
  if (v === 'stage') return `<div class="cb-hero-words">${words}${details}</div>${media ? `<div class="cb-stage"><span class="cb-stage-glow"></span>${pic('cb-hero-pic cb-stage-pic')}</div>` : ''}`;
  if (v === 'filmstrip') {
    const all = [d.picture, ...more].filter(Boolean);
    let film;
    if (C.editable) film = `<div class="cb-film cb-film-still"><div class="cb-film-row"><figure>${P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>${morePics(C, b, d, 'cb-film-more')}</div></div>`;
    else if (all.length < 2) film = band;
    else {
      const tile = (p, hidden) => `<figure${hidden ? ' aria-hidden="true"' : ''}><img src="${esc(imgSrc(C, p.src))}"${srcsetOf(C, p)} alt="${hidden ? '' : esc(p.alt)}" loading="lazy" decoding="async"></figure>`;
      const n = Math.max(2, Math.ceil(8 / all.length));
      const row = (list, firstReal) => { let out = ''; for (let k = 0; k < n * 2; k++) out += list.map((p) => tile(p, !(firstReal && k === 0))).join(''); return out; };
      film = `<div class="cb-film" style="--mq-dur:${all.length * n * 7}s"><div class="cb-film-row">${row(all, true)}</div><div class="cb-film-row cb-film-rev">${row([...all].reverse(), false)}</div></div>`;
    }
    return `<div class="cb-hero-words">${words}${details}</div>${film}${all.length < 2 && !C.editable ? '' : creditsOf(all)}`;
  }
  if (v === 'bento') {
    const info = d.details ? factsList(C, b, d, { cls: 'cb-facts' }) : '';
    const tiles = `${more.length || C.editable ? morePics(C, b, d, 'cb-bento-more', 'cb-bento-tile cb-bento-pic') : ''}${info ? `<div class="cb-bento-tile cb-bento-info">${info}</div>` : ''}`;
    return `<div class="cb-bento"><div class="cb-bento-top${media ? '' : ' cb-solo'}"><div class="cb-bento-tile cb-bento-words">${words}</div>${media ? `<figure class="cb-bento-tile cb-bento-pic cb-bento-main">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>` : ''}</div>${tiles ? `<div class="cb-bento-row">${tiles}</div>` : ''}</div>${creditsOf([d.picture, ...shownMore(b, d)])}`;
  }
  if (v === 'curtain') return `<div class="cb-curtain"><div class="cb-curtain-words"><div class="cb-hero-words">${words}${details}</div></div>${media ? pic('cb-hero-pic cb-curtain-pic') : ''}</div>`;
  // Large words, then a photo from edge to edge that opens out like a curtain as the page opens.
  // A photo that opens from a small circle until it fills the width, like a camera's aperture,
  // as it comes into view (the photo sits under the words, so it opens where it is seen). One
  // number (--ap, from the scroll) grows the circle and shrinks the photo inside by as much, so
  // the photo itself stays still. Without movement, it is simply the photo.
  if (v === 'aperture') return `<div class="cb-reveal cb-aperture"><div class="cb-hero-words cb-reveal-words">${words}${details}</div>${media ? `<figure class="cb-hero-pic cb-ap-pic"${C.editable ? '' : ' data-scroll="enter" data-scroll-span="0.85"'}><span class="cb-ap-ring"><span class="cb-ap-in">${d.video ? heroVideo(C, b, d, fileBehind) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</span></span></figure>${creditsOf([d.picture])}` : ''}${toggle}</div>`;
  // Words beside a portrait. Until the person adds a photo of their own, the portrait is set in
  // type: the letters of their name, large, in a frame (never a made-up face).
  if (v === 'portrait') {
    const frame = choiceValue('hero', d, 'frame');
    const letters = String(d.monogram || initials(plainHeading(d.heading))).slice(0, 3);
    const face = d.picture ? P(C, b, 'picture', d.picture, '', { eager: true, credits: false }) : `<span class="cb-mono"${ED(C, 'data-cb-img', `${b.id}:picture`)} aria-hidden="true">${T(C, b, 'monogram', letters, 'span', 'cb-mono-letters')}${C.editable ? '<span class="cb-mono-add">Add a picture</span>' : ''}</span>`;
    return `<div class="cb-prt cb-frame-${frame}"><figure class="cb-prt-pic">${face}</figure><div class="cb-hero-words">${words}${details}</div></div>${d.picture ? creditsOf([d.picture]) : ''}`;
  }
  // Night to day (S2 with M5): the night photo, then layers over it that only grow less
  // see-through as the page scrolls (a dawn sky, a warm glow low down) while the stars fade; the
  // words drift up a little. On a computer the opening stays put for a while as it lightens; on a
  // phone it lightens as it scrolls away. Without movement it is simply the night photo.
  if (v === 'dawn') {
    const bg = fileBehind || !d.video ? pic('cb-hero-bg cb-dawn-night') : `<figure class="cb-hero-bg cb-dawn-night">${P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`;
    return `<div class="cb-dawn"${C.editable ? '' : ' data-scroll="through"'}><div class="cb-dawn-stay">${bg}<span class="cb-dawn-stars" aria-hidden="true"></span><span class="cb-dawn-sky" aria-hidden="true"></span><span class="cb-dawn-glow" aria-hidden="true"></span><div class="cb-hero-words cb-dawn-words">${words}${details}</div>${toggle}</div></div>`;
  }
  // Three tall windows onto one photo (release 7, skin): the words beside them and the details
  // as a ledger along the foot. The windows stand at different heights while the photo lies
  // still behind all three, so it reads as one picture; they rise into place once as the page
  // opens. The copies in the second and third windows are hidden from screen readers.
  if (v === 'triptych') {
    const one = d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false });
    const copy = one.replace(/ alt="[^"]*"/, ' alt=""').replace(' fetchpriority="high"', '');
    const pics = C.editable || d.video ? `<figure class="cb-hero-pic cb-tri-one">${one}</figure>` : `<div class="cb-tri-pic">${[0, 1, 2].map((k) => `<figure class="cb-tri-strip"${k ? ' aria-hidden="true"' : ''}>${k ? copy : one}</figure>`).join('')}</div>`;
    const ledger = d.details ? `<div class="cb-tri-ledger">${factsList(C, b, d, { cls: 'cb-facts cb-tri-facts' })}</div>` : '';
    return `<div class="cb-tri"><div class="cb-hero-words cb-tri-words">${words}</div>${pics}</div>${ledger}${d.picture ? creditsOf([d.picture]) : ''}`;
  }
  // Questions first (release 7, men's health): the words beside a few plain questions, each of
  // which opens softly when pressed; the first stands open. Search engines read them as questions.
  if (v === 'questions') {
    const qs = d.questions || [];
    const one = (x, i, w) => w(`<details${C.editable || i === 0 ? ' open' : ''}><summary>${T(C, b, `questions.${i}.question`, x.question, 'span', 'cb-q')}</summary>${RT(C, b, `questions.${i}.answer`, x.answer, 'cb-rich cb-a')}</details>`, 'div', 'cb-faq-item');
    const list = qs.length || C.editable ? `<div class="cb-ask-qs">${LIST(C, b, 'questions', qs, one, 'div', 'cb-faq cb-faq-accordion cb-ask-list')}</div>` : '';
    return `<div class="cb-ask${list ? '' : ' cb-solo'}"><div class="cb-hero-words cb-ask-words">${words}${details}</div>${list}</div>`;
  }
  // Branching lines drawn slowly behind the words (release 7, brain and nerves): the stem first,
  // then each level of branches, then the dots where they divide. Drawn whole when still.
  // Still water (batch 2, counselling): the words, then a wide photo of still water that shows its
  // own reflection, whole (fix round, 23 Nov: a mirrored copy under a photo that already has its
  // reflection looked doubled). As the page opens the water settles: the photo comes to rest, and a
  // softened copy of the water below the horizon (decoration only, hidden from screen readers)
  // fades as its ripples die away. With movement turned down the photo is simply there.
  if (v === 'reflection') {
    const sizes = fullWidthSizes(b.style && b.style.width);
    const ripple = d.picture && !d.video && !C.editable ? `<span class="cb-rf-ripple" aria-hidden="true"><img src="${esc(imgSrc(C, d.picture.src))}"${srcsetOf(C, d.picture, sizes)} alt="" decoding="async"${focusPos(d.picture) ? ` style="object-position:${focusPos(d.picture)}"` : ''}></span>` : '';
    const water = media ? `<figure class="cb-hero-pic cb-rf-water">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false, sizes })}${ripple}</figure>` : '';
    return `<div class="cb-rf${water ? '' : ' cb-solo'}"><div class="cb-hero-words cb-rf-words">${words}${details}</div>${water}</div>${d.picture ? creditsOf([d.picture]) : ''}`;
  }
  if (v === 'branches') return `<div class="cb-br"><div class="cb-br-art" aria-hidden="true"><span class="cb-br-ghost">${branchSvg()}</span><span class="cb-br-win"><span class="cb-br-in">${branchSvg()}</span></span></div><div class="cb-hero-words cb-br-words">${words}${details}</div></div>`;
  if (v === 'reveal') return `<div class="cb-reveal"><div class="cb-hero-words cb-reveal-words">${words}${details}</div>${media ? `<figure class="cb-hero-pic cb-reveal-pic"><span class="cb-reveal-in">${d.video ? heroVideo(C, b, d, fileBehind) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</span></figure>${creditsOf([d.picture])}` : ''}${toggle}</div>`;
  // One statement that fills the first screen. No photo, by design.
  if (v === 'statement') {
    // Up to three photos in rounded frames float beside the statement, each at its own depth as
    // the page scrolls (M5). Without photos it is the statement alone, as before.
    const shots = [d.picture, ...shownMore(b, d)].filter(Boolean);
    if (C.editable && (d.picture || (d.pictures || []).length)) return `<div class="cb-statement-wrap has-float"><div class="cb-statement">${words}${details}</div><div class="cb-float cb-float-edit"><figure class="cb-float-pic">${P(C, b, 'picture', d.picture, '', { credits: false })}</figure>${morePics(C, b, d, 'cb-float-more', 'cb-float-pic')}</div></div>`;
    if (C.editable || !shots.length) return `<div class="cb-statement">${words}${details}</div>`;
    const figs = shots.map((p, k) => `<figure class="cb-float-pic">${P(C, b, k ? `pictures.${k - 1}` : 'picture', p, '', { eager: !k, credits: false })}</figure>`).join('');
    return `<div class="cb-statement-wrap has-float"><div class="cb-statement">${words}${details}</div><div class="cb-float">${figs}</div></div>${creditsOf(shots)}`;
  }
  return `<div class="cb-hero-words">${words}${details}</div>`; // minimal
};

// ---- the booking bar and the order list -------------------------------------------------------
// Both only ever open something on the visitor's own device (the booking page, WhatsApp or their
// email app) with the request written out; the page itself sends nothing. The page's script
// (page-actions.js) adds the details as they are chosen. Without it, each is one plain button to
// the same place. A booking bar with nowhere to send is left off the published page; an order
// list with nowhere to send is shown as a plain price list.
const MAIL_OK = /^[^\s@<>"'?&#%]+@[^\s@<>"'?&#%]+\.[^\s@<>"'?&#%]+$/;
const mailOf = (C) => (MAIL_OK.test(C.biz.email || '') ? C.biz.email : '');
const siteName = (C) => cleanLine(C.site?.name || C.site?.masthead || '', 80);
export const waHref = (digits, text) => `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const mailHref = (to, subject, body) => `mailto:${to}?${[subject ? `subject=${encodeURIComponent(subject)}` : '', body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&')}`;
const BAR_NOTE = {
  page: 'Opens the booking page. Nothing is booked until you confirm there.',
  whatsapp: 'Opens WhatsApp with your request written out. Nothing is sent until you press send.',
  email: 'Opens your email with your request written out. Nothing is sent until you press send.',
};
const BAR_MISSING = {
  page: 'Add your booking link in Details & booking and this bar opens it.',
  whatsapp: 'Add your WhatsApp number in this section’s settings and this bar opens WhatsApp.',
  email: 'Add your email address in Details & booking and this bar opens an email to you.',
};
// Where a booking bar sends people, or null when that is missing.
export function barTarget(d, C) {
  if (d.bar === 'page') { const t = C.biz?.bookingUrl ? bookingTarget(C.biz.bookingUrl) : null; return t ? { to: t.href, cal: t.kind === 'cal', plain: t.href } : null; }
  if (d.bar === 'whatsapp') return d.barWhatsapp ? { to: d.barWhatsapp, plain: waHref(d.barWhatsapp, 'Hello, I would like to check availability.') } : null;
  if (d.bar === 'email') { const to = mailOf(C); return to ? { to, plain: mailHref(to, 'Checking availability') } : null; }
  return null;
}
function heroBar(C, b, d) {
  const kind = choiceValue('hero', d, 'bar');
  if (!BAR_NOTE[kind]) return '';
  const t = barTarget({ ...d, bar: kind }, C);
  const label = d.barButton || 'Check availability', uid = esc(b.id);
  // What the bar asks for: a date, unless it opens a booking page that cannot be told one (only
  // Cal.com can); how many people, only when the request is written out for WhatsApp or email.
  const askDate = kind !== 'page' || !!t?.cal, askPeople = kind !== 'page' && d.barPeople;
  const fields = (off) => (askDate ? `<div class="cb-bar-field"><label for="bd-${uid}">Date</label><input id="bd-${uid}" type="date"${off}></div>` : '')
    + (askPeople ? `<div class="cb-bar-field cb-bar-people"><label for="bp-${uid}">People</label><select id="bp-${uid}"${off}>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i === 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}<option value="13">13 or more</option></select></div>` : '');
  const note = `<p class="cb-small cb-bar-note">${BAR_NOTE[kind]}</p>`;
  if (C.editable) {
    const missing = t ? '' : `<p class="cb-note" data-cb-hint>${BAR_MISSING[kind]}</p>`;
    const button = T(C, b, 'barButton', label, 'span', 'cb-btn');
    return `<div class="cb-bar-wrap">${askDate || askPeople ? `<div class="cb-bar cb-bar-still">${fields(' disabled tabindex="-1"')}${button}</div>` : `<p class="cb-bar-only">${button}</p>`}${note}${missing}</div>`;
  }
  if (!t) return '';
  const away = kind === 'whatsapp' ? ' target="_blank" rel="noopener"' : kind === 'page' ? ' rel="noopener"' : '';
  const plain = `<a class="cb-btn" href="${esc(t.plain)}"${away}>${esc(label)}</a>`;
  // A booking page that cannot be told a date is just its button.
  if (!askDate && !askPeople) return `<div class="cb-bar-wrap"><p class="cb-bar-only">${plain}</p>${note}</div>`;
  // Not a form: until the page's script takes it over, the button is a plain link to the same
  // place, so a press before then still goes somewhere sensible.
  return `<div class="cb-bar-wrap"><div class="cb-bar" role="group" aria-label="${esc(label)}" data-bar="${kind}" data-bar-to="${esc(t.to)}"${t.cal ? ' data-bar-cal' : ''} data-site="${esc(siteName(C))}" hidden>${fields('')}${plain.replace('class="cb-btn"', 'class="cb-btn cb-bar-go"')}</div><p class="cb-bar-plain">${plain}</p>${note}</div>`;
}

const ORDER_NOTE = {
  whatsapp: 'Nothing is sent until you press send in WhatsApp. This is a request, not a payment.',
  email: 'Nothing is sent until you press send in your email app. This is a request, not a payment.',
};
R_.order = (C, b) => {
  const d = b.data, v = b.variant, uid = esc(b.id);
  const send = choiceValue('order', d, 'send');
  const to = send === 'whatsapp' ? d.whatsapp || '' : mailOf(C);
  // Something with no name cannot be ordered, so it is left off the published list.
  const items = (d.items || []).filter((x) => C.editable || x.name);
  if (!items.length && !C.editable) return '';
  const live = !C.editable && !!to;
  const step = (x) => (C.editable
    ? '<div class="cb-order-step" aria-hidden="true"><button type="button" disabled tabindex="-1">−</button><span class="cb-order-qty">0</span><button type="button" disabled tabindex="-1">+</button></div>'
    : live ? `<div class="cb-order-step" hidden><button type="button" class="cb-order-less" aria-label="One fewer: ${esc(x.name)}">−</button><output class="cb-order-qty" aria-live="off" aria-label="How many: ${esc(x.name)}">0</output><button type="button" class="cb-order-more" aria-label="One more: ${esc(x.name)}">+</button></div>` : '');
  const one = (x, i, w) => w(`${v === 'cards' && (x.picture || C.editable) ? `<figure class="cb-order-pic">${P(C, b, `items.${i}.picture`, x.picture)}</figure>` : ''}<div class="cb-order-body">${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-order-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-order-desc')}</div>${T(C, b, `items.${i}.price`, x.price, 'p', 'cb-order-price')}${step(x)}`, 'li', 'cb-order-item');
  const list = LIST(C, b, 'items', items, one, 'ul', `cb-order-items cb-order-${v}`);
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  const small = `${to || C.editable ? `<p class="cb-small cb-order-note">${ORDER_NOTE[send]}</p>` : ''}${T(C, b, 'note', d.note, 'p', 'cb-small')}`;
  const label = d.button || 'Send order';
  const NAME_HINT = 'Needed, so they know whose order it is.';
  if (C.editable) {
    const missing = to ? '' : `<p class="cb-note" data-cb-hint>${send === 'whatsapp' ? 'Add your WhatsApp number in this section’s settings so people can send you their order.' : 'Add your email address in Details & booking so people can send you their order.'}</p>`;
    const foot = `<div class="cb-order-foot"><p class="cb-order-total">The total shows here as people choose.</p><div class="cb-order-who"><label>Your name</label><p class="cb-small cb-order-hint">${NAME_HINT}</p><input type="text" disabled tabindex="-1"><label>Notes (optional)</label><textarea rows="2" disabled tabindex="-1"></textarea></div><p class="cb-order-go">${T(C, b, 'button', label, 'span', 'cb-btn')}${BTN(C, b, 'pay', { label: d.pay?.label || 'Pay now', href: d.pay?.href || '' }, 'cb-btn cb-btn-2 cb-order-pay')}</p><p class="cb-note" data-cb-hint>Pay now appears after an order is written out, when it has a pay link.</p></div>`;
    return `${head}<div class="cb-order">${list}${foot}${small}${missing}</div>`;
  }
  if (!live) return `${head}<div class="cb-order">${list}</div>${T(C, b, 'note', d.note, 'p', 'cb-small')}`;
  const plain = send === 'whatsapp' ? waHref(to, 'Hello, I would like to place an order.') : mailHref(to, 'An order');
  const away = send === 'whatsapp' ? ' target="_blank" rel="noopener"' : '';
  const payHref = d.pay?.href ? resolveLink(d.pay.href, C) : '';
  const pay = payHref ? `<a class="cb-btn cb-btn-2 cb-order-pay" href="${esc(payHref)}" rel="noopener" hidden>${esc(d.pay.label || 'Pay now')}</a>${payLine(payHref) ? `<span class="cb-paysafe cb-order-safe" hidden>${esc(payLine(payHref))}</span>` : ''}` : '';
  // Send is a plain link to the same place until the page's script takes it over.
  const foot = `<div class="cb-order-foot" hidden><p class="cb-order-total" role="status" aria-live="polite">Nothing chosen yet</p><div class="cb-order-who"><label for="on-${uid}">Your name</label><p class="cb-small cb-order-hint" id="oh-${uid}">${NAME_HINT}</p><input id="on-${uid}" class="cb-order-who-name" type="text" autocomplete="name" maxlength="80" aria-describedby="oh-${uid}"><label for="ot-${uid}">Notes (optional)</label><textarea id="ot-${uid}" class="cb-order-who-notes" rows="2" maxlength="600"></textarea></div><p class="cb-order-go"><a class="cb-btn cb-order-send" href="${esc(plain)}"${away} aria-disabled="true">${esc(label)}</a>${pay}</p><p class="cb-small cb-order-need">Choose at least one item</p><p class="cb-order-status" role="status" aria-live="polite"></p></div>`;
  return `${head}<div class="cb-order" data-order="${send}" data-order-to="${esc(to)}" data-site="${esc(siteName(C))}">${list}${foot}<p class="cb-order-plain"><a class="cb-btn" href="${esc(plain)}"${away}>${esc(label)}</a></p>${small}</div>`;
};

R_.text = (C, b) => {
  const d = b.data, v = b.variant;
  const head = `${K(C, b, d)}${H(C, b, d)}`;
  const body = `${withMark(C, d, RT(C, b, 'body', d.body))}${BTNS(C, b, d.buttons)}`;
  if (v === 'sidehead') return `<div class="cb-side"><div class="cb-side-head">${head}</div><div>${body}</div></div>`;
  // With no picture, the published page gives the words the whole width.
  if ((v === 'picture-left' || v === 'picture-right') && !d.picture && !C.editable) return `${head}${body}`;
  if (v === 'picture-left' || v === 'picture-right') return `<div class="cb-pic-text"><figure class="cb-pic-frame">${P(C, b, 'picture', d.picture)}</figure><div>${head}${body}</div></div>`;
  // Large words that go from faint to full colour as the reader scrolls past them.
  if (v === 'lit') return `${head}${RT(C, b, 'body', d.body, 'cb-rich cb-lit')}${BTNS(C, b, d.buttons)}`;
  return `${head}${body}`;
};

R_.image = (C, b) => {
  const d = b.data;
  const cap = T(C, b, 'caption', d.caption, 'span', 'cb-cap');
  // A picture block with no picture is left off the published page (its caption, if one was
  // written, still shows).
  if (!d.picture && !C.editable) return cap ? `<figure class="cb-figure"><figcaption>${cap}</figcaption></figure>` : '';
  return `<figure class="cb-figure">${P(C, b, 'picture', d.picture, '', { credits: false })}${cap || credit(d.picture) ? `<figcaption>${cap}${credit(d.picture)}</figcaption>` : ''}</figure>`;
};

R_.gallery = (C, b) => {
  const d = b.data, pics = d.pictures || [];
  const tile = (p, i) => (p.video
    ? `<video src="${esc(imgSrc(C, p.video))}" poster="${esc(imgSrc(C, p.src))}" controls playsinline preload="none" aria-label="${esc(p.alt || 'Video')}"${ED(C, 'data-cb-video', `${b.id}:pictures.${i}.video`)}></video>`
    : P(C, b, `pictures.${i}`, p, '', { credits: false }));
  // A gallery with no photos and no words is left off the published page.
  if (!pics.length && !d.heading && !d.intro && !C.editable) return '';
  const head = `<div class="cb-head">${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  // A reel that rolls by itself. The copies that make the loop are hidden from screen readers.
  if (b.variant === 'reel' && !C.editable && pics.length > 1) {
    const one = (p, hidden) => `<figure${hidden ? ' aria-hidden="true"' : ''}>${p.video ? `<video src="${esc(imgSrc(C, p.video))}" poster="${esc(imgSrc(C, p.src))}" muted loop playsinline preload="none"${hidden ? ' tabindex="-1"' : ' controls'} aria-label="${esc(p.alt || 'Video')}"></video>` : `<img src="${esc(imgSrc(C, p.src))}"${srcsetOf(C, p)} alt="${hidden ? '' : esc(p.alt)}" loading="lazy" decoding="async">`}</figure>`;
    const sets = Math.max(2, Math.ceil(9 / pics.length) + 1);
    let track = pics.map((p) => one(p, false)).join('');
    for (let k = 1; k < sets; k++) track += pics.map((p) => one(p, true)).join('');
    return `${head}<div class="cb-mq cb-mq-pics" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${pics.length * 6}s"><div class="cb-mq-track">${track}</div></div>${creditsOf(pics)}`;
  }
  const list = LIST(C, b, 'pictures', pics, (p, i, wrap) => wrap(`${tile(p, i)}${p.alt || credit(p) ? `<figcaption>${credit(p)}</figcaption>` : ''}`, 'figure'), 'div', 'cb-gallery');
  // A row of photos that slides sideways as the page scrolls down, and is swiped on a phone.
  if (b.variant === 'sideways' && !C.editable && pics.length > 1) {
    const row = pics.map((p, i) => `<figure>${tile(p, i)}${p.alt ? `<figcaption>${esc(p.alt)}</figcaption>` : ''}</figure>`).join('');
    return `${head}<div class="cb-hs cb-gal-side" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="${esc(plainHeading(d.heading) || 'Photos')}, scrolls sideways"><div class="cb-hs-track">${row}</div></div><span class="cb-hs-bar" aria-hidden="true"><i></i></span></div></div>${creditsOf(pics)}`;
  }
  // Photos that start scattered and fly together into the grid as the block scrolls into view.
  // Each photo's starting place is fixed by its position in the list.
  if (b.variant === 'gather' && !C.editable) {
    let i = -1;
    const flown = list.replace(/<figure>/g, () => { i++; return `<figure style="--dx:${Math.round(scatter(i, 2) * 46)}vw;--dy:${Math.round(scatter(i, 3) * 60)}vh;--dz:${Math.round(scatter(i, 5) * 500)}px;--rz:${Math.round(scatter(i, 7) * 50)}deg">`; });
    return `${head}${flown.replace('<div class="cb-gallery"', '<div class="cb-gallery" data-scroll="enter"')}`;
  }
  return `${head}${list}`;
};

function serviceLinks(C, b, i, s) {
  const book = s.link ? BTN(C, b, `items.${i}.link`, choiceLink(C, b, s, s.link), 'cb-link') : '';
  const pay = s.pay ? BTN(C, b, `items.${i}.pay`, s.pay, 'cb-btn cb-btn-small') : '';
  // Booking and paying are two steps here, so they say so; a recognised pay page is named.
  const known = pay && s.pay?.href ? payNote(s.pay.href) : '';
  const words = known && book ? thenPay(s.pay) : '';
  return book || pay ? `<p class="cb-svc-links">${book}${pay}${words || known ? `<span class="cb-paynote">${words}${known}</span>` : ''}</p>` : '';
}
R_.services = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  const name = (s, i, tag = 'h3') => T(C, b, `items.${i}.name`, s.name, tag, 'cb-svc-name');
  const desc = (s, i) => RT(C, b, `items.${i}.description`, s.description, 'cb-rich cb-svc-desc');
  const price = (s, i, cls = 'cb-price') => T(C, b, `items.${i}.price`, s.price, 'span', cls);
  const time = (s, i) => T(C, b, `items.${i}.duration`, s.duration, 'span', 'cb-time');
  const offer = (s, i) => T(C, b, `items.${i}.offer`, s.offer, 'p', 'cb-offer');
  const pic = (s, i, cls = 'cb-svc-pic') => (s.picture ? `<figure class="${cls}">${P(C, b, `items.${i}.picture`, s.picture)}</figure>` : '');
  let list;
  if (v === 'menu') list = LIST(C, b, 'items', items, (s, i, w) => w(`<div class="cb-menu-line">${name(s, i)}<i aria-hidden="true"></i>${price(s, i)}</div>${desc(s, i)}${time(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}`), 'div', 'cb-svc cb-svc-menu');
  else if (v === 'cards') list = LIST(C, b, 'items', items, (s, i, w) => w(`${pic(s, i)}<div class="cb-card-body">${name(s, i)}${desc(s, i)}<p class="cb-meta">${time(s, i)}${price(s, i)}</p>${offer(s, i)}${serviceLinks(C, b, i, s)}</div>`), 'div', 'cb-svc cb-svc-cards');
  else if (v === 'numbered') list = LIST(C, b, 'items', items, (s, i, w) => w(`<span class="cb-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div>${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div><p class="cb-meta">${price(s, i)}${time(s, i)}</p>`, 'li'), 'ol', 'cb-svc cb-svc-numbered');
  else if (v === 'table') list = LIST(C, b, 'items', items, (s, i, w) => w(`<div>${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div>${time(s, i)}${price(s, i)}`, 'div'), 'div', 'cb-svc cb-svc-table');
  else if (v === 'rows') list = LIST(C, b, 'items', items, (s, i, w) => focusable(C, s.picture, w(`<span class="cb-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="cb-row-main">${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div><p class="cb-meta">${time(s, i)}${price(s, i)}</p>${pic(s, i, 'cb-row-pic')}`)), 'div', 'cb-svc cb-svc-rows');
  else if (v === 'flip') list = LIST(C, b, 'items', items, (s, i, w) => {
    // The front shows the photo, name and price; the back the details. It turns when pointed at
    // or focused (so a tap or the Tab key turns it too). In the editor both sides lie flat.
    const card = w(`<div class="cb-flip-in"><div class="cb-flip-front">${pic(s, i)}<div class="cb-card-body">${name(s, i)}<p class="cb-meta">${time(s, i)}${price(s, i)}</p></div></div><div class="cb-flip-back">${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div></div>`);
    return C.editable ? card : card.replace(/^<article/, '<article tabindex="0"');
  }, 'div', 'cb-svc cb-svc-flip');
  else if (v === 'board') list = LIST(C, b, 'items', items, (s, i, w) => w(`<div class="cb-menu-line">${name(s, i)}<i aria-hidden="true"></i>${price(s, i)}</div>${desc(s, i)}${time(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}`), 'div', 'cb-svc cb-svc-board');
  else if (v === 'pinned') return pinnedList(C, b, d, items, { name, desc, price, time, offer });
  else if (v === 'rail') return railList(C, b, d, items, { name, desc, price, time, offer });
  else list = LIST(C, b, 'items', items, (s, i, w) => w(`${s.picture || C.editable ? `<figure class="cb-svc-pic">${P(C, b, `items.${i}.picture`, s.picture)}</figure>` : ''}<div class="cb-feature-body">${name(s, i)}${desc(s, i)}<p class="cb-meta">${time(s, i)}${price(s, i)}</p>${offer(s, i)}${serviceLinks(C, b, i, s)}</div>`, 'article', s.picture || C.editable ? '' : 'cb-solo'), 'div', 'cb-svc cb-svc-feature');
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${list}`;
};

// Names set large, one to a screen, with a photo beside them that stays put and changes to match
// the one being read (the page's script does that on a wide screen, with movement allowed). Each
// entry keeps its own photo: that is what shows on phones, with movement turned down, with
// scripts off and in the editor. The stage holds copies, hidden from screen readers.
function pinnedList(C, b, d, items, f) {
  const one = (s, i, w) => w(`${s.picture || C.editable ? `<figure class="cb-pin-pic">${P(C, b, `items.${i}.picture`, s.picture)}</figure>` : ''}<div class="cb-pin-body"><p class="cb-pin-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>${f.name(s, i)}<p class="cb-pin-meta">${f.time(s, i)}${f.price(s, i)}</p>${f.desc(s, i)}${f.offer(s, i)}${serviceLinks(C, b, i, s)}</div>`, 'li', `cb-pin-item${i ? '' : ' is-on'}`);
  const shots = C.editable ? [] : items.map((s, i) => [s, i]).filter(([s]) => s.picture);
  const stage = shots.length > 1 ? `<div class="cb-pin-stage" aria-hidden="true">${shots.map(([s, i], k) => `<img${k ? '' : ' class="is-on"'} data-i="${i}" src="${esc(imgSrc(C, s.picture.src))}"${srcsetOf(C, s.picture)} alt="" loading="lazy" decoding="async"${focusPos(s.picture) ? ` style="object-position:${focusPos(s.picture)}"` : ''}>`).join('')}</div>` : '';
  const list = LIST(C, b, 'items', items, one, 'ol', 'cb-pin-list');
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div><div class="cb-pin${stage ? ' has-stage' : ''}"${stage ? ' data-pinlist' : ''}>${list}${stage}</div>${creditsOf(items.map((s) => s.picture).filter(Boolean))}`;
}

// Cards that travel sideways as the page scrolls down (S5 with M4): on a wide screen the row stays
// put and slides by as much as the reader scrolls, under a band of large words that rolls slowly
// on its own (M6). Phones swipe the row, one card at a time. The band only repeats the cards'
// names, so it is hidden from screen readers; with "reduce motion" it is left out.
const railWords = (d) => String(d.band || '').split(/[,;|]/).map((w) => w.trim()).filter(Boolean).slice(0, 12);
function railList(C, b, d, items, f) {
  const two = (n) => String(n).padStart(2, '0');
  // A card with who you will see and the usual wait (a speciality) sets those out as a short
  // table with the fee, instead of the time and price line.
  const facts = (s, i) => {
    // A condition's card can say how long people usually take to recover, set out first and large.
    if (!(s.who || s.wait || s.recovery) && !(C.editable && items.some((x) => x.who || x.wait || x.recovery))) return `<p class="cb-rail-meta">${f.time(s, i)}${f.price(s, i)}</p>`;
    const row = (k, label, v, cls = '') => (v || C.editable ? `<div${cls ? ` class="${cls}"` : ''}><dt>${label}</dt><dd>${T(C, b, `items.${i}.${k}`, v, 'span')}</dd></div>` : '');
    // The typical recovery is also marked on a short track of the year (or two years), so the
    // cards can be compared at a glance. Decoration: the words say the same.
    const span = recoverySpan(s.recovery);
    const track = span ? `<span class="cb-rec" aria-hidden="true" data-end="${span.end}" style="--a:${span.a};--b:${span.b}"><i></i></span>` : '';
    const recRow = s.recovery || C.editable ? `<div class="cb-rail-rec"><dt>Typical recovery</dt><dd>${T(C, b, `items.${i}.recovery`, s.recovery, 'span')}${track}</dd></div>` : '';
    return `<dl class="cb-rail-facts">${recRow}${row('who', 'With', s.who)}${row('wait', 'Usual wait', s.wait)}${row('price', 'Fee', s.price)}</dl>`;
  };
  const card = (s, i, w) => w(`${s.picture || C.editable ? `<figure class="cb-rail-pic">${P(C, b, `items.${i}.picture`, s.picture, '', { credits: false })}</figure>` : ''}<div class="cb-rail-body"><p class="cb-rail-n" aria-hidden="true">${two(i + 1)}</p>${f.name(s, i)}${facts(s, i)}${f.desc(s, i)}${f.offer(s, i)}${serviceLinks(C, b, i, s)}</div>`, 'article', `cb-rail-card${s.picture || C.editable ? '' : ' cb-solo'}${s.who || s.wait || s.recovery ? ' has-facts' : ''}`);
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  const words = railWords(d);
  if (C.editable) return `${head}${words.length ? `<p class="cb-note" data-cb-hint>Moving words above the cards: ${esc(words.join(', '))}</p>` : ''}${LIST(C, b, 'items', items, card, 'div', 'cb-rail cb-rail-still')}`;
  if (!items.length) return head;
  const setW = words.join('').length * 44 + words.length * 116;
  const sets = clamp(Math.ceil(2800 / Math.max(setW, 1)) + 1, 2, 40), dur = clamp(Math.round(setW / 38), 40, 60);
  const band = words.length ? `<div class="cb-rail-band" aria-hidden="true"><div class="cb-mq" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${dur}s"><div class="cb-mq-track">${`<span class="cb-mq-set">${words.map((t) => `<span class="cb-mq-item">${esc(t)}</span>`).join('')}</span>`.repeat(sets)}</div></div></div>` : '';
  const cards = items.map((s, i) => card(s, i, (inner, tag, cls) => `<${tag} class="${cls}">${inner}</${tag}>`)).join('');
  return `${head}<div class="cb-hs cb-rail" data-hs><div class="cb-hs-pin">${band}<div class="cb-hs-view" tabindex="0" role="region" aria-label="${esc(plainHeading(d.heading) || 'Treatments')}, scrolls sideways"><div class="cb-hs-track cb-rail-track">${cards}</div></div><span class="cb-hs-bar" aria-hidden="true"><i></i></span></div></div>${creditsOf(items.map((s) => s.picture).filter(Boolean))}`;
}

// "4 to 6 weeks", "3 to 6 months", "1 year": where that sits on a track of a year (or two years,
// when it runs past one). Null when the words give no length of time a track can show.
export function recoverySpan(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)(?:\s*(?:to|-|and)\s*(\d+(?:\.\d+)?))?\s*(day|week|month|year)s?\b/i);
  if (!m) return null;
  const unit = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 }[m[3].toLowerCase()];
  const lo = Number(m[1]) * unit, hi = Number(m[2] || m[1]) * unit;
  if (!(hi > 0) || hi > 24 || lo > hi) return null;
  const max = hi > 12 ? 24 : 12;
  return { a: +(lo / max).toFixed(3), b: +(hi / max).toFixed(3), end: max === 12 ? '12 months' : '2 years' };
}

// The words on a person's own Book button: "Book with Hannah", "Book with Dr Osei".
export function bookWith(name) {
  const n = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!n.length) return 'Book';
  const title = /^(dr|mr|mrs|ms|miss|prof)\.?$/i.test(n[0]) ? n[0].replace(/\.$/, '') : '';
  return title && n.length > 1 ? `Book with ${title} ${n[n.length - 1]}` : `Book with ${title ? n[0] : n[0]}`;
}
R_.team = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  // No photo yet: a tile with the person's initials, so the team still looks finished.
  const face = (p, i) => (p.picture ? P(C, b, `items.${i}.picture`, p.picture) : `<span class="cb-initials"${ED(C, 'data-cb-img', `${b.id}:items.${i}.picture`)} aria-hidden="true">${esc(initials(p.name))}</span>`);
  // Each person's own Book button, when chosen: their own booking link, else the website's, else
  // a call or the Contact page, so it is never a button that goes nowhere.
  const book = (p, i) => {
    if (!d.bookEach) return '';
    const label = p.book?.label || bookWith(p.name);
    if (C.editable) return `<p class="cb-person-book">${BTN(C, b, `items.${i}.book`, { label, href: p.book?.href || '@booking' }, 'cb-btn cb-btn-small')}</p>`;
    const way = bookWays(C, { own: p.book ? choiceLink(C, b, p, p.book) : null, label })[0];
    return `<p class="cb-person-book">${wayLink(way.kind === 'book' ? way : { ...way, label: way.kind === 'contact' ? `Ask about ${(String(p.name || '').trim().split(/\s+/)[0]) || 'an appointment'}` : way.label }, 'cb-btn cb-btn-small')}</p>`;
  };
  const one = (p, i, w) => w(`<figure class="cb-portrait">${face(p, i)}</figure><div class="cb-person">${T(C, b, `items.${i}.name`, p.name, 'h3', 'cb-person-name')}${T(C, b, `items.${i}.role`, p.role, 'p', 'cb-person-role')}${T(C, b, `items.${i}.quals`, p.quals, 'p', 'cb-person-quals')}${RT(C, b, `items.${i}.bio`, p.bio, 'cb-rich cb-bio')}${p.link ? BTN(C, b, `items.${i}.link`, p.link, 'cb-link') : ''}${book(p, i)}</div>`);
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  // The team as cards that travel sideways as the page scrolls down (S9 as M4), the same strip as
  // the services rail: phones swipe it, and the editor shows the plain grid.
  if (v === 'rail' && !C.editable && items.length > 1) {
    const cards = items.map((p, i) => one(p, i, (inner) => `<article class="cb-team-card">${inner}</article>`)).join('');
    return `${head}<div class="cb-hs cb-team-rail" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="${esc(plainHeading(d.heading) || 'Our team')}, scrolls sideways"><div class="cb-hs-track cb-team cb-team-railtrack">${cards}</div></div><span class="cb-hs-bar" aria-hidden="true"><i></i></span></div></div>`;
  }
  return `${head}${LIST(C, b, 'items', items, one, 'div', `cb-team cb-team-${v === 'rail' ? 'grid cb-team-railgrid' : v}`)}`;
};

// A row whose photo appears only when it is pointed at can be reached with the Tab key too, so
// the photo is there for people who do not use a pointer. Never in the editor.
const focusable = (C, on, html) => (on && !C.editable ? html.replace(/^<article/, '<article tabindex="0"') : html);
const initials = (name) => String(name || '').replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0] || '').join('').toUpperCase() || '+';
const stars = (n) => (n ? `<p class="cb-stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</p>` : '');
R_.reviews = (C, b) => {
  const d = b.data, items = d.items || [];
  const one = (r, i, w) => w(`${stars(r.stars)}<blockquote>${RT(C, b, `items.${i}.quote`, r.quote, 'cb-rich cb-quote')}</blockquote><footer>${T(C, b, `items.${i}.name`, r.name, 'cite', 'cb-who')}${T(C, b, `items.${i}.detail`, r.detail, 'span', 'cb-who-detail')}</footer>`, 'figure', 'cb-review');
  const more = d.source ? `<p class="cb-more">${BTN(C, b, 'source', d.source, 'cb-link')}</p>` : '';
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>`;
  // Reviews that roll past. Read once by screen readers; the copies that make the loop are hidden.
  if (b.variant === 'ticker' && !C.editable && items.length > 1) {
    const set = (hidden) => items.map((r, i) => one(r, i, (inner, tag, cls) => `<${tag} class="${cls}"${hidden ? ' aria-hidden="true"' : ''}>${hidden ? inner.replace(/<a /g, '<a tabindex="-1" ') : inner}</${tag}>`)).join('');
    const sets = Math.ceil(8 / items.length) + 1;
    return `${head}<div class="cb-mq cb-mq-cards" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${items.length * 11}s"><div class="cb-mq-track">${set(false)}${set(true).repeat(sets - 1)}</div></div>${more}`;
  }
  // A wall of three columns that drift past each other. Each review is written once; the copies
  // that make the loop are hidden from screen readers. Fewer than three reviews are plain cards.
  if (b.variant === 'drift' && !C.editable && items.length > 2) {
    const cols = [[], [], []];
    items.forEach((r, i) => cols[i % 3].push([r, i]));
    const col = (list, k) => { const set = (hidden) => list.map(([r, i]) => one(r, i, (inner, tag, cls) => `<${tag} class="${cls}"${hidden ? ' aria-hidden="true"' : ''}>${hidden ? inner.replace(/<a /g, '<a tabindex="-1" ') : inner}</${tag}>`)).join(''); return `<div class="cb-rv-col" style="--mq-dur:${list.length * 9 + k * 5}s"><div class="cb-rv-run">${set(false)}${set(true)}</div></div>`; };
    return `${head}<div class="cb-rv-drift">${cols.map(col).join('')}</div>${more}`;
  }
  return `${head}${LIST(C, b, 'items', items, one, 'div', `cb-reviews cb-reviews-${['ticker', 'drift'].includes(b.variant) ? 'cards' : b.variant}`)}${more}`;
};

R_.faq = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  const q = (x, i) => T(C, b, `items.${i}.question`, x.question, 'span', 'cb-q');
  const a = (x, i) => RT(C, b, `items.${i}.answer`, x.answer, 'cb-rich cb-a');
  // In the editor every answer stays open, so it can be clicked and changed.
  const one = v === 'accordion'
    ? (x, i, w) => w(`<details${C.editable ? ' open' : ''}><summary>${q(x, i)}</summary>${a(x, i)}</details>`, 'div', 'cb-faq-item')
    : (x, i, w) => w(`<h3>${q(x, i)}</h3>${a(x, i)}`, 'div', 'cb-faq-item');
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${LIST(C, b, 'items', items, one, 'div', `cb-faq cb-faq-${v}`)}`;
};

R_.contact = (C, b) => {
  const d = b.data, own = !d.business;
  const facts = factsList(C, b, d, { own });
  const map = d.map ? BTN(C, b, 'map', d.map, 'cb-link') : '';
  // "Open now, closes at 6pm": worked out on the visitor's device from the opening hours, so it
  // is right whenever the page is read. Without the script it is simply not there.
  const hoursText = bizDetails(C, d, own).hours || '';
  const openNow = d.openNow ? openLine(C, hoursText) : '';
  const head = `${K(C, b, d)}${H(C, b, d)}${openNow}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}`;
  // With a booking page whose emails the business has ticked as switched on, confirmation emails
  // come from the booking service: where to look when one does not arrive (owner, 22 Nov). Without
  // the tick a contact section draws exactly as before.
  const spam = C.biz.bookingUrl && C.biz.reminders ? `<p class="cb-small cb-spam">${C.biz.phone ? 'No email? Check your spam folder, or call us.' : 'No email? Check your spam folder.'}</p>` : '';
  const acts = `${closedNote(C, b, d)}${d.business ? socials(C) : ''}${BTNS(C, b, d.buttons)}${map ? `<p class="cb-map">${map}</p>` : ''}${spam}`;
  if (!facts && !d.heading && !d.intro && !(d.buttons || []).length && !C.editable) return '';
  // Opening hours as a table, one line of the hours to a row, so the page's script can mark today.
  // (While the owner's own hours are being typed in the editor they stay one editable block.)
  if (b.variant === 'hours' || b.variant === 'map') {
    const f = bizDetails(C, d, own);
    const lines = String(f.hours || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const table = lines.length && !(own && C.editable) ? `<table class="cb-hours-table" data-hours><caption class="cb-sr">Opening hours</caption><tbody>${lines.map((l) => { const m = l.match(/^([^:]{2,40}):\s+(.+)$/) || l.match(/^(\D{2,40}?),\s*(.+)$/) || l.match(/^(\D{2,40}?)\s+(\d.*)$/); return m ? `<tr><th scope="row">${esc(m[1].trim())}</th><td>${esc(m[2].trim())}</td></tr>` : `<tr><td colspan="2">${esc(l)}</td></tr>`; }).join('')}</tbody></table>` : '';
    const rest = table ? factsList(C, b, d, { own, cls: 'cb-facts', skip: 'hours' }) : facts;
    if (b.variant === 'hours') return `<div class="cb-find cb-find-hours"><div class="cb-find-words">${head}${rest}${acts}</div>${table ? `<div class="cb-find-table">${table}</div>` : ''}</div>`;
    // A drawn map: decoration only, in the page's colours. The real map is the link.
    const streets = Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    return `<div class="cb-find cb-find-map"><div class="cb-find-card">${head}${rest}${table}${acts}</div><div class="cb-find-plan" aria-hidden="true">${streets}<span class="cb-find-pin"></span></div></div>`;
  }
  if (b.variant === 'split') return `<div class="cb-side"><div class="cb-side-head">${head}${acts}</div>${facts}</div>`;
  if (b.variant === 'card') return `<div class="cb-contact-card">${head}${facts}${acts}</div>`;
  return `${head}${facts}${acts}`;
};

// The site's social profiles (Site settings), as plain links. https only.
const SOCIAL_NAMES = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', x: 'X', twitter: 'X', tiktok: 'TikTok', youtube: 'YouTube', github: 'GitHub', mastodon: 'Mastodon', bluesky: 'Bluesky' };
function socials(C) {
  const s = C.site?.socials && typeof C.site.socials === 'object' ? C.site.socials : {};
  const links = Object.entries(SOCIAL_NAMES).map(([k, label]) => {
    const h = typeof s[k] === 'string' ? cleanHref(s[k]) : '';
    return /^https:/.test(h) ? `<a href="${esc(h)}" rel="me noopener">${label}</a>` : '';
  }).filter(Boolean);
  return links.length ? `<p class="cb-socials">${[...new Set(links)].join('')}</p>` : '';
}

R_.cta = (C, b) => {
  const d = b.data;
  const words = `${K(C, b, d)}${H(C, b, d)}${withMark(C, d, RT(C, b, 'body', d.body))}`;
  if (b.variant === 'split') return `<div class="cb-cta-split"><div>${words}</div>${BTNS(C, b, d.buttons)}</div>`;
  if (b.variant === 'card') return `<div class="cb-cta-card">${words}${BTNS(C, b, d.buttons)}</div>`;
  if (b.variant === 'giant') return `${K(C, b, d)}${H(C, b, d, 'h2', 'cb-h cb-giant-h')}<div class="cb-giant-foot">${withMark(C, d, RT(C, b, 'body', d.body))}${BTNS(C, b, d.buttons)}</div>`;
  return `${words}${BTNS(C, b, d.buttons)}`;
};

const formEndpointOf = (C) => (typeof C.formEndpoint === 'string' && /^https:\/\//.test(C.formEndpoint) && !C.formEndpoint.includes('/your-id') ? C.formEndpoint : '');
R_.form = (C, b) => {
  const d = b.data;
  const ep = formEndpointOf(C);
  const words = `${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}`;
  if (!ep && !C.editable) {
    // No form service yet: offer the email address instead, if there is one.
    // The owner's own line under the form (often what not to send) is kept under the button.
    const email = C.biz.email ? `<div class="cb-actions"><a class="cb-btn" href="mailto:${esc(C.biz.email)}">Email ${esc(C.biz.email)}</a></div>` : '';
    // With no form, a note about "this form" speaks of the email instead (newcomer walk, 23 Nov).
    const small = email && d.note ? `<p class="cb-small">${esc(String(d.note).replace(/\bthrough this form\b/gi, 'by email').replace(/\bin this form\b/gi, 'in your email'))}</p>` : '';
    return email ? `${words}${email}${small}` : '';
  }
  const uid = esc(b.id);
  const fields = `<label for="n-${uid}">Name</label><input id="n-${uid}" name="name" type="text" required autocomplete="name"${C.editable ? ' tabindex="-1"' : ''}>`
    + `<label for="e-${uid}">Email</label><input id="e-${uid}" name="email" type="email" required autocomplete="email"${C.editable ? ' tabindex="-1"' : ''}>`
    + `<label for="m-${uid}">Message</label><textarea id="m-${uid}" name="message" rows="5" required${C.editable ? ' tabindex="-1"' : ''}></textarea>`;
  const btn = C.editable ? T(C, b, 'button', d.button || 'Send message', 'span', 'cb-btn') : `<button class="cb-btn" type="submit">${esc(d.button || 'Send message')}</button>`;
  const note = T(C, b, 'note', d.note, 'p', 'cb-small');
  const warn = !ep && C.editable ? `<p class="cb-note" data-cb-hint>This form isn't connected yet. Add a form address in More settings, under Contact form address.</p>` : '';
  const status = C.editable ? '' : '<p class="cb-form-status" role="status" aria-live="polite" hidden></p>';
  const form = `<form class="cb-form" method="POST" action="${esc(ep || '#')}">${fields}${btn}${note}</form>${status}${warn}`;
  return b.variant === 'split' ? `<div class="cb-side"><div class="cb-side-head">${words}</div><div>${form}</div></div>` : `${words}${form}`;
};

// A post's picture address. The website hands each post's picture over as { src, alt } (what
// postCover gives); a plain address is taken too. Anything else means no picture.
const postPicture = (p) => { const im = p && p.image; return typeof im === 'string' ? im : (im && typeof im.src === 'string' ? im.src : ''); };
R_.posts = (C, b) => {
  const d = b.data, n = d.count || 3, posts = (C.posts || []).slice(0, n);
  if (!posts.length && !C.editable) return '';
  const more = `<a class="cb-link" href="${esc(C.postsHref || (C.href ? C.href('/posts/') : '/posts/'))}"${ED(C, 'data-cb', `${b.id}:more`)}>${esc(d.more || 'All posts')}</a>`;
  const list = posts.length
    ? posts.map((p, i) => `<a class="cb-post${i === 0 && b.variant === 'feature' ? ' cb-post-lead' : ''}" href="${esc(p.href)}">${b.variant !== 'list' && postPicture(p) ? `<img src="${esc(postPicture(p))}" alt="" loading="lazy">` : ''}<span class="cb-post-date">${esc(p.dateLabel || '')}</span><h3>${esc(p.title)}</h3>${p.description && b.variant !== 'list' ? `<p>${esc(p.description)}</p>` : ''}</a>`).join('')
    : `<p class="cb-note" data-cb-hint>Your newest posts appear here.</p>`;
  return `<div class="cb-head cb-head-row">${H(C, b, d)}${more}</div><div class="cb-posts cb-posts-${b.variant}">${list}</div>`;
};

// ---- regulator and registration ----
// The CQC rating from Details and booking: the rating, the day it was given and a link to the
// report on CQC's website. Nothing is shown that the business has not set; the editor says what
// to add. CQC's own widget, when chosen and a location ID is set, is drawn by page-actions.js on
// the published website into a holder beside the line (never in the editor's preview).
const CQC_HOME = 'https://www.cqc.org.uk/';
const cqcPage = (id) => (CQC_ID.test(id || '') ? `https://www.cqc.org.uk/location/${id}` : '');
const longDay = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return ''; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return `${d.getUTCDate()} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
function cqcRating(C, b, d) {
  const biz = C.biz, rating = CQC_RATINGS[biz.cqcRating] || '', page = cqcPage(biz.cqcId);
  // Not registered with the CQC (chosen in Details and booking): nothing to show or ask for.
  // The empty box is drawn only for a section that uses the CQC (a sports massage or counselling
  // section is never asked for a rating).
  if (!rating && !page) return C.editable && biz.cqcRating !== 'none' && usesCqc(b, biz) ? '<div class="cb-reg-cqc cb-reg-empty"><p class="cb-reg-label">Care Quality Commission</p><p class="cb-note" data-cb-hint>Add your CQC location ID, your latest overall rating and its date in Details and booking. Providers in England must show their rating on their website.</p></div>' : '';
  const when = longDay(biz.cqcDate);
  const word = rating ? `<p class="cb-reg-rating"><span class="cb-reg-small">Overall rating</span> <strong class="cb-reg-word cb-reg-${esc(biz.cqcRating)}">${esc(rating)}</strong></p>${when ? `<p class="cb-reg-date">Rated ${esc(when)}</p>` : ''}` : '';
  const link = `<a class="cb-link cb-reg-report" href="${esc(page || CQC_HOME)}" rel="noopener">${rating ? 'Read the CQC report' : 'See our CQC rating and report'}</a>`;
  const widget = d.widget && page && !C.editable ? `<div class="cb-reg-widget" data-cqc="${esc(biz.cqcId)}"></div>` : '';
  if (C.editable && d.widget && page) return `<div class="cb-reg-cqc"><p class="cb-reg-label">Care Quality Commission</p>${word}${link}<p class="cb-note" data-cb-hint>CQC’s own rating widget appears here on your published website.</p></div>`;
  return `<div class="cb-reg-cqc${widget ? ' has-widget' : ''}"><p class="cb-reg-label">Care Quality Commission</p><div class="cb-reg-line">${word}${link}</div>${widget}</div>`;
}
R_.regulator = (C, b) => {
  const d = b.data, items = d.items || [];
  const cqc = cqcRating(C, b, d);
  if (b.variant === 'line') {
    if (!cqc) return '';
    return `<div class="cb-reg cb-reg-oneline">${d.heading || C.editable ? `<p class="cb-reg-title"${ED(C, 'data-cb', `${b.id}:heading`)}>${esc(plainHeading(d.heading) || '')}</p>` : ''}${cqc}</div>`;
  }
  // Each person with their register and number; under the list, one link to each register used,
  // where anyone can check those numbers.
  // The governing body is the quick pick or the business's own (registerOf), so a register
  // anywhere can be named; one saved with only a pick draws exactly as before.
  const one = (x, i, w) => {
    const reg = registerOf(x);
    const num = x.number || C.editable ? `<span class="cb-reg-num">${reg.short ? `<span class="cb-reg-body">${esc(reg.short)}</span> ` : ''}${T(C, b, `items.${i}.number`, x.number, 'span')}</span>` : '';
    return w(`${T(C, b, `items.${i}.name`, x.name, 'span', 'cb-reg-name')}${num}`, 'li', 'cb-reg-person');
  };
  const people = LIST(C, b, 'items', items, one, 'ul', 'cb-reg-list');
  // One link to each register used, once, where anyone can check those numbers.
  const bodies = [...new Map(items.map(registerOf).filter((r) => r.href).map((r) => [`${r.href} ${r.name}`, r])).values()];
  const checks = bodies.length ? `<p class="cb-reg-checks">${bodies.map((r) => `<a class="cb-link cb-reg-check" href="${esc(r.href)}" rel="noopener"${C.editable ? ' tabindex="-1"' : ''}>${r.name ? `Check the ${esc(r.name)} register` : 'Check the register'}</a>`).join('')}</p>` : '';
  if (!cqc && !people && !C.editable) return '';
  return `<div class="cb-reg${cqc ? '' : ' cb-reg-nocqc'}"><div class="cb-reg-side">${HEAD(C, b, d)}${cqc}</div><div class="cb-reg-people">${people}${checks}</div></div>${T(C, b, 'note', d.note, 'p', 'cb-small')}`;
};

R_.credentials = (C, b) => {
  const d = b.data;
  // An entry may link out, such as to the public register where a registration can be checked.
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>${LIST(C, b, 'items', d.items || [], (x, i, w) => w(`${T(C, b, `items.${i}.text`, x.text, 'span')}${x.link ? BTN(C, b, `items.${i}.link`, x.link, 'cb-link cb-creds-link') : ''}`, 'li'), 'ul', `cb-creds cb-creds-${b.variant}`)}`;
};

R_.facts = (C, b) => {
  const d = b.data;
  // A band of numbers that rolls past. Written once for readers; the copies are hidden.
  if (b.variant === 'ticker' && !C.editable && (d.items || []).filter((x) => x.value || x.label).length > 1) {
    const facts = d.items.filter((x) => x.value || x.label);
    const width = facts.reduce((n, x) => n + ((x.value || '').length * 30 + (x.label || '').length * 9 + 90), 0);
    const sets = clamp(Math.ceil(2800 / width) + 1, 2, 30);
    const set = (hidden) => `<span class="cb-mq-set"${hidden ? ' aria-hidden="true"' : ''}>${facts.map((x) => `<span class="cb-mq-item cb-ft"><span class="cb-ft-value">${esc(x.value || '')}</span><span class="cb-ft-label">${esc(x.label || '')}</span></span>`).join('')}</span>`;
    return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div><div class="cb-mq cb-mq-facts" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${clamp(Math.round(width / 60), 14, 80)}s"><div class="cb-mq-track">${set(false)}${set(true).repeat(sets - 1)}</div></div>`;
  }
  // A gentle wave drawn once through the band as it comes into view (release 7, hormones).
  const wave = d.wave ? `<span class="cb-trace cb-trace-gentle cb-trace-band" aria-hidden="true"${C.editable ? '' : ' data-scroll="enter"'}><span class="cb-trace-ghost">${traceSvg('gentle', 6)}</span><span class="cb-trace-win"><span class="cb-trace-in">${traceSvg('gentle', 6)}</span></span></span>` : '';
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>${wave}${LIST(C, b, 'items', d.items || [], (x, i, w) => w(`${T(C, b, `items.${i}.value`, x.value, 'span', 'cb-fact-value')}${T(C, b, `items.${i}.label`, x.label, 'span', 'cb-fact-label')}`, 'div', 'cb-fact'), 'div', `cb-factlist cb-factlist-${b.variant}${d.beat ? ' cb-beat' : ''}${d.wave ? ' cb-on-wave' : ''}`)}`;
};

R_.notice = (C, b) => {
  const d = b.data;
  // If you need help now (release 7): numbers to call, each a link that rings it. It never moves:
  // it is the one thing on the page that must be there at once, for everyone (see .cb-still).
  if (b.variant === 'help') {
    const tel = (n) => `tel:${String(n || '').replace(/[^+\d]/g, '')}`;
    const one = (x, i, w) => w(`${T(C, b, `items.${i}.name`, x.name, 'p', 'cb-help-name')}${x.number && !C.editable ? `<a class="cb-help-num" href="${esc(tel(x.number))}">${esc(x.number)}</a>` : T(C, b, `items.${i}.number`, x.number, 'p', 'cb-help-num')}${T(C, b, `items.${i}.detail`, x.detail, 'p', 'cb-help-detail')}`, 'li', 'cb-help-item');
    if (!d.heading && !(d.items || []).length && !C.editable) return '';
    return `<div class="cb-help">${H(C, b, d, 'h2', 'cb-h cb-help-h')}${RT(C, b, 'intro', d.intro, 'cb-rich cb-help-intro')}${LIST(C, b, 'items', d.items || [], one, 'ul', 'cb-help-list')}</div>`;
  }
  if (!d.text && !C.editable) return '';
  return `<p class="cb-notice-text">${T(C, b, 'text', d.text, 'span')}${d.link ? ` ${BTN(C, b, 'link', d.link, 'cb-link')}` : ''}</p>`;
};

R_.columns = (C, b) => {
  const kids = (b.data.children || []).map((k) => `<div class="cb-col cb-t-${k.type} cb-${k.type}--${k.variant}${k.style.bg !== 'none' && k.style.bg !== 'picture' ? ` cb-bg-${k.style.bg}` : ''}"${ED(C, 'data-cb-block', k.id)}${C.editable ? ` data-cb-parent="${esc(b.id)}"` : ''}>${R_[k.type](C, k)}</div>`).join('');
  return `<div class="cb-cols">${kids}</div>`;
};

R_.video = (C, b) => {
  const d = b.data, e = videoEmbed(d.src);
  let media = '';
  if (e?.kind === 'file') media = `<video controls preload="metadata" src="${esc(imgSrc(C, e.src))}"></video>`;
  else if (e) media = C.editable ? `<div class="cb-video-hold" data-cb-hint><span>${esc(e.host)} video</span></div>` : `<iframe src="${esc(e.src)}" title="${esc(d.heading || d.caption || `${e.host} video`)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  else if (C.editable) media = `<div class="cb-video-hold" data-cb-video="${esc(b.id)}"><span>Add a video</span></div>`;
  else return '';
  return `${H(C, b, d)}<figure class="cb-video">${media}${T(C, b, 'caption', d.caption, 'figcaption')}</figure>`;
};

R_.interactive = (C, b) => {
  const d = b.data;
  if (!d.src || !INTERACTIVE_SRC.test(d.src)) return C.editable ? `${H(C, b, d)}<div class="cb-video-hold" data-cb-interactive="${esc(b.id)}"><span>Choose an interactive</span></div>` : '';
  const h = d.height || 520;
  return `${H(C, b, d)}<div class="cb-interactive"><iframe src="${esc(imgSrc(C, d.src))}" title="${esc(d.title || d.heading || 'Interactive')}" loading="lazy" sandbox="allow-scripts allow-forms" style="height:${h}px"></iframe></div>`;
};

// What a calendar that did not load says instead (newcomer walk, 23 Nov): kept hidden in the page,
// and shown by the page's script about 5 seconds after "Show available times" if no calendar came.
export function calendarFail(C, href) {
  const call = C.biz.phone ? `, or call <a href="${esc(telHref(C.biz))}">${esc(C.biz.phone)}</a>` : mailOf(C) ? `, or email <a href="mailto:${esc(mailOf(C))}">${esc(mailOf(C))}</a>` : '';
  return `<p class="cb-booking-fail" hidden>The calendar did not load. <a href="${esc(href)}" rel="noopener">Open booking in a separate page</a>${call}.</p>`;
}
// Booking: the calendar loads only when a visitor asks for it, so nobody's browser contacts the
// booking service just by opening the page. The website's script (BlockPage) does the loading.
R_.booking = (C, b) => {
  const d = b.data;
  const raw = d.useSite !== false && !d.url ? C.biz.bookingUrl : d.url;
  const t = raw ? bookingTarget(raw) : null;
  const head = `${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}`;
  const label = d.button || 'Book online';
  const note = T(C, b, 'note', d.note, 'p', 'cb-small');
  if (!t) {
    if (C.editable) return `${head}<div class="cb-booking-hold" data-cb-hint><p>Add your booking link in Details & booking, or paste one in this section’s settings. Cal.com is free and links to Gmail, Outlook or Apple calendars.</p></div>`;
    // No booking page yet: offer the phone or email instead, if there is one.
    const alt = C.biz.phone ? `<a class="cb-btn" href="${esc(telHref(C.biz))}">Call ${esc(C.biz.phone)}</a>` : C.biz.email ? `<a class="cb-btn" href="mailto:${esc(C.biz.email)}">Email to book</a>` : '';
    return alt ? `${head}<div class="cb-actions">${alt}</div>` : '';
  }
  const button = C.editable ? T(C, b, 'button', label, 'span', 'cb-btn') : `<a class="cb-btn" href="${esc(t.href)}" rel="noopener">${esc(label)}</a>`;
  if (b.variant === 'button' || t.kind === 'link') return `${head}<div class="cb-booking-card"><div class="cb-actions">${button}</div>${note}${remindLine(C)}</div>`;
  const where = t.provider;
  const panel = C.editable
    ? `<div class="cb-booking-hold" data-cb-hint><p>Your ${esc(where)} calendar appears here on your website when a visitor taps “Show available times”.</p></div>`
    : `<div class="cb-booking-cal" data-booking-kind="${esc(t.kind)}" data-booking-src="${esc(t.kind === 'cal' ? t.embed : t.frame)}"><button type="button" class="cb-btn cb-booking-load">Show available times</button><p class="cb-small">This loads ${esc(where)}, which handles your booking. <a href="${esc(t.href)}" rel="noopener">Open it in a new page instead</a>.</p><p class="cb-booking-status" role="status" aria-live="polite"></p>${calendarFail(C, t.href)}<div class="cb-booking-frame" hidden></div></div>`;
  return `${head}${panel}${note}${remindLine(C)}`;
};

// A band of words that rolls across the page. Written once for readers; the copies that make
// the loop are hidden from screen readers. In the editor it stands still so it can be changed.
R_.marquee = (C, b) => {
  const d = b.data, items = d.items || [], v = b.variant;
  const one = (x, i, w) => w(T(C, b, `items.${i}.text`, x.text, 'span'), 'span', 'cb-mq-item');
  if (C.editable) return `<div class="cb-mq cb-mq-still">${LIST(C, b, 'items', items, one, 'div', 'cb-mq-track')}</div>`;
  const text = items.map((x) => x.text).filter(Boolean);
  if (!text.length) return '';
  const chars = text.join('').length + text.length * 3;
  // How wide one set is at its largest, roughly, so there are enough sets to cover a 2800px
  // screen and one more for the loop.
  const setWidth = v === 'tags' ? text.join('').length * 9 + text.length * 56 : text.join('').length * 44 + text.length * 116;
  const sets = clamp(Math.ceil(2800 / setWidth) + 1, 2, 80);
  const speed = choiceValue('marquee', d, 'speed');
  const dur = speed === 'xs' ? clamp(Math.round(setWidth / 38), 40, 60) : Math.round(clamp(chars * (v === 'tags' ? 0.28 : 0.5), 8, 90) * ({ s: 1.7, m: 1, l: 0.6 }[speed] || 1));
  const set = (hidden) => `<span class="cb-mq-set"${hidden ? ' aria-hidden="true"' : ''}>${text.map((t) => `<span class="cb-mq-item">${esc(t)}</span>`).join('')}</span>`;
  const row = (second) => `<div class="cb-mq${second ? ' cb-mq-rev' : ''}" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${dur}s"><div class="cb-mq-track">${set(second)}${set(true).repeat(sets - 1)}</div></div>`;
  return v === 'double' ? row(false) + row(true) : row(false);
};

R_.steps = (C, b) => {
  const d = b.data, items = d.items || [];
  // A step can end in the button that does it ("Register", "Book a first visit").
  const go = (x, i) => (x.link ? `<p class="cb-step-go">${BTN(C, b, `items.${i}.link`, x.link, 'cb-btn cb-btn-small')}</p>` : '');
  // With a progress line (a recovery plan), each step shows its time above it.
  const prog = b.variant === 'sticky' && choiceValue('steps', d, 'trace') === 'progress';
  const when = (x, i) => (prog && (x.when || C.editable) ? T(C, b, `items.${i}.when`, x.when, 'p', 'cb-step-when') : '');
  const one = (x, i, w) => w(`<span class="cb-step-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="cb-step-body">${when(x, i)}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-step-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-step-desc')}${go(x, i)}</div>`, 'li', `cb-step${i || b.variant !== 'sticky' ? '' : ' is-on'}`);
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  const list = LIST(C, b, 'items', items, one, 'ol', `cb-steps cb-steps-${b.variant}`);
  // A thin line (a calm heart trace, or a sound wave) with one stretch for each step. It is
  // decoration, so it is hidden from screen readers. Beside sticky steps it draws one more
  // stretch as each step passes; elsewhere it sits under the heading and draws as it comes into
  // view. Without movement it is simply there, whole.
  const trace = choiceValue('steps', d, 'trace');
  const svg = trace === 'heart' || trace === 'wave' ? traceSvg(trace, Math.max(items.length, 1)) : '';
  const line = (cls, extra = '') => (svg ? `<span class="cb-trace cb-trace-${trace} ${cls}"${extra} aria-hidden="true"><span class="cb-trace-ghost">${svg}</span><span class="cb-trace-win"><span class="cb-trace-in">${svg}</span></span></span>` : '');
  // Sticky steps: one large number stays put beside the steps and changes as each one passes. It
  // is decoration (every step has its own number), so it is hidden from screen readers.
  // A timeline (S14, release 7): each step with its time beside a line that fills as the page is
  // read, a dot lighting as the line reaches it. Without movement the line is simply full.
  if (b.variant === 'timeline') {
    const n = Math.max(items.length, 1);
    const row = (x, i, w) => w(`${T(C, b, `items.${i}.when`, x.when, 'p', 'cb-tline-when')}<span class="cb-tline-dot" aria-hidden="true"></span><div class="cb-step-body">${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-step-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-step-desc')}${go(x, i)}</div>`, 'li', 'cb-step cb-tline-item');
    const tl = LIST(C, b, 'items', items, row, 'ol', 'cb-steps cb-steps-timeline');
    return `${head}<div class="cb-tline" style="--n:${n}"${C.editable ? '' : ' data-scroll="read"'}><span class="cb-tline-rail" aria-hidden="true"><i></i></span>${tl}</div>`;
  }
  // A route (batch 2, consultants): one line drawn down the page as the steps are read, each step
  // at a numbered point on it, the steps either side of the line on a wide screen. The line and
  // its points are decoration (each step has its words and number); without movement it is whole.
  if (b.variant === 'route') {
    const two = (k) => String(k).padStart(2, '0');
    const row = (x, i, w) => w(`<span class="cb-route-n" aria-hidden="true">${two(i + 1)}</span><div class="cb-step-body">${T(C, b, `items.${i}.when`, x.when, 'p', 'cb-route-when')}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-step-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-step-desc')}${go(x, i)}</div>`, 'li', 'cb-step cb-route-item');
    const rl = LIST(C, b, 'items', items, row, 'ol', 'cb-steps cb-steps-route');
    return `${head}<div class="cb-route" style="--n:${Math.max(items.length, 1)}"${C.editable ? '' : ' data-scroll="read"'}><span class="cb-route-line" aria-hidden="true"><i></i></span>${rl}</div>`;
  }
  // A progress line (therapy batch 1): beside the steps, a line that fills as they are read, with
  // a marker at its end; the big number still changes as each step passes. Decoration, so hidden
  // from screen readers; without movement the line is simply full.
  const track = prog ? `<span class="cb-stk-prog" aria-hidden="true"><i class="cb-stk-fill"></i><i class="cb-stk-mark"></i></span>` : '';
  if (b.variant === 'sticky' && !C.editable && items.length > 1) {
    const n = items.length, two = (k) => String(k).padStart(2, '0');
    const steps = prog ? `<div class="cb-stk-steps">${track}${list}</div>` : list;
    return `${head}<div class="cb-stk${svg ? ' has-trace' : ''}${prog ? ' has-prog' : ''}" data-stk${prog ? ' data-scroll="read"' : ''} style="--n:${n}">${line('cb-trace-top', ' data-scroll="enter"')}<div class="cb-stk-rail" aria-hidden="true"><span class="cb-stk-num">${items.map((_, k) => `<span${k ? '' : ' class="is-on"'}>${two(k + 1)}</span>`).join('')}</span><span class="cb-stk-of">of ${two(n)}</span>${svg ? line('cb-stk-trace') : prog ? '' : '<span class="cb-stk-bar"><i></i></span>'}</div>${steps}</div>`;
  }
  if (prog) return `${head}<div class="cb-stk-steps">${track}${list}</div>`;
  return `${head}${line('cb-trace-top', C.editable ? '' : ' data-scroll="enter"')}${list}`;
};
// The drawn line: a calm heart trace (one beat a stretch) or a sound wave (one swell a stretch),
// 100 wide and 40 high for each stretch, drawn with a hairline that never thickens when stretched.
// Simple line studies of a hand for the pinned scenes (release 7, hand and wrist): an outline only,
// with light lines at the joints and across the palm, never a photo of a hand and nothing that
// looks like an injury. Two poses; each study marks one area with a soft ring in the accent.
// Made with signature/doctors3 (hand2.py) as rounded shapes joined and smoothed; the little
// finger's and the thumb's bases smoothed again by signature/therapy1/hands/fix.py (22 Nov).
const HAND_POSES = {"open":{"outline":"M230.3 476.7L228.0 450.0L231.9 405.8L233.1 402.7L247.9 376.7L256.0 340.2L256.0 336.4L256.0 326.9L255.9 312.5L254.8 298.3L252.5 284.9L249.8 273.6L248.1 266.7L247.4 264.1L248.0 260.4L250.2 252.8L253.7 242.2L256.1 235.0L257.0 232.1L267.9 201.6L268.1 197.0L267.2 194.4L265.5 192.2L261.2 189.7L258.8 189.4L256.0 189.8L253.5 191.0L251.4 192.8L242.6 212.1L227.7 248.2L226.3 249.3L224.5 249.1L223.5 247.1L232.3 160.9L231.6 155.8L230.0 153.2L227.7 151.1L224.9 149.8L221.9 149.4L218.8 149.8L216.0 151.1L213.8 153.2L212.2 155.7L199.8 228.8L198.7 230.3L197.0 230.5L195.4 228.7L185.6 148.2L184.0 144.5L181.8 141.9L178.6 140.1L174.8 139.4L170.6 140.2L167.5 142.2L165.1 145.2L163.8 149.3L169.3 237.8L169.1 239.3L168.2 240.3L166.4 240.5L165.0 239.2L151.0 196.9L140.4 168.0L138.3 165.7L135.7 164.2L132.7 163.4L129.6 163.6L126.7 164.6L124.2 166.4L122.4 168.9L121.4 171.8L121.5 176.5L133.9 221.2L145.4 266.6L137.8 331.5L136.5 332.5L134.9 332.4L130.1 327.9L115.7 311.9L106.0 298.7L102.2 295.6L99.1 294.5L95.7 294.3L93.2 294.8L90.2 296.3L88.2 297.9L86.2 300.6L84.7 306.2L85.7 310.9L90.3 319.4L103.7 339.8L114.0 352.6L125.2 364.6L127.0 366.2L131.6 370.2L138.5 376.5L144.9 383.6L150.3 391.3L154.5 398.6L157.0 403.4L157.9 405.5L158.4 410.4L159.4 420.8L160.7 435.4L161.6 445.3L161.9 449.3L160.5 476.6","creases":["M156.1 222.6Q148.2 227.2 139.1 227.6","M148.9 200.6Q141.6 205.2 133.0 205.6","M189.8 210.0Q180.8 213.0 171.4 211.6","M186.9 184.1Q178.5 187.1 169.6 185.7","M223.0 217.7Q213.9 218.7 205.3 215.3","M225.7 193.3Q217.1 194.4 209.1 191.1","M250.1 243.0Q241.9 242.3 235.3 237.4","M256.4 225.1Q248.6 224.5 242.5 219.7","M150 318Q196 306 244 292","M156 340Q198 334 230 312","M190 392Q176 370 176 338"]},"together":{"outline":"M230.3 476.6L228.0 450.0L231.9 405.7L233.0 402.7L247.9 376.6L256.0 340.2L256.0 336.4L256.0 326.9L255.9 312.5L254.7 298.2L252.5 284.8L249.6 273.3L247.5 266.3L246.0 263.8L245.9 256.8L247.4 241.1L250.2 218.6L252.1 203.2L252.9 197.1L252.3 194.4L250.8 192.0L248.3 189.8L245.4 188.7L242.6 188.6L239.9 189.3L237.5 190.7L235.6 192.8L234.2 196.2L223.6 249.7L223.0 250.2L221.1 249.8L224.2 162.2L223.7 159.2L222.4 156.4L220.4 154.1L217.7 152.5L214.3 151.8L210.7 152.2L207.9 153.5L205.6 155.6L204.0 158.2L203.2 161.2L197.6 217.2L196.7 217.7L194.0 150.9L192.7 147.5L190.2 144.5L187.0 142.7L183.2 142.0L179.6 142.6L176.2 144.5L173.7 147.5L172.4 150.9L170.1 227.5L169.2 227.1L163.2 171.3L162.0 167.2L160.1 164.6L157.5 162.6L154.4 161.5L151.1 161.4L148.1 162.2L144.8 164.3L142.6 167.1L141.5 170.1L142.9 206.0L146.4 260.7L138.9 321.1L138.0 321.1L135.0 315.8L128.2 302.0L121.4 285.3L118.4 281.6L115.4 279.8L112.4 279.0L109.7 279.0L106.2 279.8L103.2 281.6L101.1 283.9L99.7 286.3L98.9 289.7L99.1 293.3L104.1 310.7L110.0 326.9L117.1 342.7L125.4 358.1L134.6 372.8L135.6 374.1L138.0 377.4L141.8 382.6L146.0 388.4L150.6 394.7L155.0 402.6L158.2 414.3L160.1 429.8L161.3 442.3L161.8 448.6L161.9 449.3L160.5 476.6","creases":["M165.3 223.9Q156.6 226.9 147.5 225.4","M162.8 201.6Q154.7 204.4 146.2 202.9","M192.7 212.4Q183.5 214.7 174.2 212.6","M191.9 187.0Q183.3 189.2 174.6 187.0","M218.7 218.7Q209.6 220.3 200.9 217.5","M219.8 194.7Q211.3 196.4 203.1 193.6","M244.2 243.1Q236.0 244.0 228.6 240.5","M246.8 224.2Q239.1 225.2 232.1 221.9","M150 318Q196 306 244 292","M156 340Q198 334 230 312","M190 392Q176 370 176 338"]}};
export const HAND_STUDIES = {
  'hand-fingers': { pose: 'open', ring: [208, 268, 24] },
  'hand-wrist': { pose: 'together', ring: [196, 426, 30] },
  'hand-thumb': { pose: 'open', ring: [176, 384, 21] },
  'hand-palm': { pose: 'together', ring: [214, 312, 24] },
};
export function handSvg(kind) {
  const s = HAND_STUDIES[kind];
  if (!s) return '';
  const p = HAND_POSES[s.pose], [x, y, r] = s.ring;
  return `<svg class="cb-hand cb-hand-${kind}" viewBox="64 112 236 384" aria-hidden="true" focusable="false"><path class="cb-hand-crease" d="${p.creases.join('')}"/><path class="cb-hand-line" d="${p.outline}"/><g class="cb-hand-focus"><circle class="cb-hand-halo" cx="${x}" cy="${y}" r="${r}"/><circle class="cb-hand-ring" cx="${x}" cy="${y}" r="${r}"/></g></svg>`;
}
// Simple branching lines for an opening (release 7, brain and nerves): a stem on the left that
// divides again and again as it goes right, like a tree in fog. One path for each level, so they
// can be drawn one after another; small dots where lines divide.
const BRANCH_LEVELS = ["M0 310Q125 294 250 310","M250 310Q317 241 412 221M250 310Q323 361 404 396","M412 221Q434 157 489 117M412 221Q480 215 548 213M404 396Q468 396 533 399M404 396Q455 433 473 493","M489 117Q498 74 511 33M489 117Q529 89 571 64M548 213Q593 185 643 167M548 213Q593 227 638 239M533 399Q582 400 621 371M533 399Q579 410 622 431M473 493Q511 516 549 538M473 493Q485 536 500 577","M511 33Q509 4 510 -25M511 33Q530 8 546 -19M571 64Q586 32 611 8M571 64Q604 46 642 46M643 167Q670 142 693 113M643 167Q681 173 716 158M638 239Q669 228 702 235M638 239Q669 257 698 278M621 371Q643 345 674 333M621 371Q653 378 684 372M622 431Q657 427 692 430M622 431Q653 447 673 475M549 538Q579 551 611 547M549 538Q568 562 591 585M500 577Q512 610 539 631M500 577Q498 609 497 641","M510 -25Q500 -44 503 -66M546 -19Q554 -40 566 -60M611 8Q623 -13 634 -34M642 46Q662 24 691 17M642 46Q667 42 692 47M693 113Q699 85 719 64M693 113Q715 100 737 85M716 158Q741 155 764 145M702 235Q726 244 751 240M698 278Q715 295 734 311M674 333Q690 316 700 295M674 333Q693 317 717 316M684 372Q708 370 729 359M684 372Q707 376 728 385M692 430Q715 423 738 417M692 430Q716 443 742 444M673 475Q695 490 721 498M673 475Q681 498 699 513M611 547Q633 544 654 548M591 585Q615 591 632 609M591 585Q606 604 610 628M539 631Q559 642 570 663M497 641Q504 663 509 686M497 641Q492 663 484 684"];
const BRANCH_NODES = [[412,221,1],[489,117,2],[511,33,3],[546,-19,4],[571,64,3],[611,8,4],[642,46,4],[691,17,5],[692,47,5],[548,213,2],[643,167,3],[693,113,4],[719,64,5],[737,85,5],[716,158,4],[764,145,5],[638,239,3],[702,235,4],[751,240,5],[698,278,4],[734,311,5],[404,396,1],[533,399,2],[621,371,3],[674,333,4],[700,295,5],[717,316,5],[684,372,4],[729,359,5],[728,385,5],[622,431,3],[692,430,4],[738,417,5],[742,444,5],[673,475,4],[721,498,5],[699,513,5],[473,493,2],[549,538,3],[611,547,4],[654,548,5],[591,585,4],[632,609,5],[500,577,3]];
export function branchSvg() {
  const lv = BRANCH_LEVELS.map((d, k) => `<path class="cb-br-l cb-br-l${k}" d="${d}"/>`).join('');
  const dots = BRANCH_NODES.map(([x, y, k]) => `<circle class="cb-br-dot cb-br-d${k}" cx="${x}" cy="${y}" r="${k < 3 ? 5 : k < 5 ? 3.6 : 2.6}"/>`).join('');
  return `<svg class="cb-br-svg" viewBox="0 0 800 600" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false">${lv}${dots}</svg>`;
}

export function traceSvg(kind, n) {
  let path = 'M0 20';
  for (let i = 0; i < n; i++) {
    const x = i * 100, X = (k) => +(x + k).toFixed(2);
    if (kind === 'gentle') path += ` C${X(18)} 6 ${X(32)} 6 ${X(50)} 20 S${X(82)} 34 ${X(100)} 20`;
    else if (kind === 'heart') path += ` L${X(30)} 20 Q${X(35)} 15 ${X(40)} 20 L${X(47)} 20 L${X(50)} 24 L${X(53)} 4 L${X(57)} 33 L${X(60)} 20 L${X(68)} 20 Q${X(76)} 12 ${X(84)} 20 L${X(100)} 20`;
    else {
      const amps = [2, 5, 9, 14, 17, 14, 9, 5, 2, 1];
      amps.forEach((a, k) => { const w = 10, sx = x + k * w; path += ` Q${X(k * w + w / 4)} ${20 - a} ${X(k * w + w / 2)} 20 Q${X(k * w + (3 * w) / 4)} ${20 + a} ${+(sx + w).toFixed(2)} 20`; });
    }
  }
  return `<svg class="cb-trace-svg" viewBox="0 0 ${n * 100} 40" preserveAspectRatio="none" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

R_.showcase = (C, b) => {
  const d = b.data, items = d.items || [];
  const one = (x, i, w) => w(`${x.picture || C.editable ? `<figure class="cb-show-pic">${P(C, b, `items.${i}.picture`, x.picture)}</figure>` : ''}<div class="cb-show-body">${T(C, b, `items.${i}.tag`, x.tag, 'p', 'cb-show-tag')}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-show-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-show-desc')}${x.link ? BTN(C, b, `items.${i}.link`, x.link, 'cb-link') : ''}</div>`, 'article', `cb-show-item${i ? '' : ' is-on'}`);
  const head = `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  if (b.variant === 'layers') {
    // A stack of sheets seen from an angle; they come apart as the block scrolls into view, each
    // beside its own words.
    const n = Math.max(items.length, 1);
    const sheets = items.map((x, i) => `<i style="--i:${i};--n:${n}${x.picture ? `;--cb-pic:${esc(cssUrl(imgSrc(C, x.picture.src)))}` : ''}"${x.picture ? ' class="has-pic"' : ''}></i>`).join('');
    return `${head}<div class="cb-layers"${C.editable ? '' : ' data-scroll="enter"'}><div class="cb-layers-stage" aria-hidden="true"><div class="cb-layers-stack">${sheets}</div></div>${LIST(C, b, 'items', items, one, 'div', 'cb-show cb-show-layers')}</div>`;
  }
  if (b.variant === 'story') {
    // On a wide screen one photo frame stays put beside the items as they scroll past, taking
    // each item's photo as it reaches the middle of the screen. The frame holds copies, hidden
    // from screen readers; each item keeps its own photo, which is what shows with the script off,
    // for less movement, on phones and in the editor.
    const shots = C.editable ? [] : items.map((x, i) => [x, i]).filter(([x]) => x.picture);
    const frame = shots.length ? `<div class="cb-story-frame" aria-hidden="true">${shots.map(([x, i], k) => `<img${k ? '' : ' class="is-on"'} data-i="${i}" src="${esc(imgSrc(C, x.picture.src))}"${srcsetOf(C, x.picture)} alt="" loading="lazy" decoding="async"${focusPos(x.picture) ? ` style="object-position:${focusPos(x.picture)}"` : ''}>`).join('')}</div>` : '';
    return `${head}<div class="cb-story${frame ? ' has-frame' : ''}">${LIST(C, b, 'items', items, one, 'div', 'cb-show cb-show-story')}${frame}</div>`;
  }
  if (b.variant === 'switch') return `${head}${LIST(C, b, 'items', items, (x, i, w) => focusable(C, x.picture, one(x, i, w)), 'div', 'cb-show cb-show-switch')}`;
  if (b.variant === 'plates') {
    // Round photos in a row. Each has its own colour; the page's script wipes the whole band to
    // the colour of the one in the middle. Without it the band keeps the first colour.
    const turn = (i) => C.turns[i % C.turns.length];
    const plate = (x, i, w) => w(`${x.picture || C.editable ? `<figure class="cb-show-pic">${P(C, b, `items.${i}.picture`, x.picture)}</figure>` : ''}<div class="cb-show-body">${T(C, b, `items.${i}.tag`, x.tag, 'p', 'cb-show-tag')}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-show-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-show-desc')}${x.link ? BTN(C, b, `items.${i}.link`, x.link, 'cb-link') : ''}</div>`, 'article', `cb-show-item${i ? '' : ' is-on'}`)
      .replace(/<article class="cb-show-item( is-on)?"/, (m) => `${m} data-plate-c="${turn(i).c}" data-plate-on="${turn(i).on}"`);
    const first = turn(0);
    return `<div class="cb-plates" style="--plate-c:${first.c};--plate-on:${first.on}"><span class="cb-plates-bg" aria-hidden="true"></span><span class="cb-plates-wipe" aria-hidden="true"></span>${head}${LIST(C, b, 'items', items, plate, 'div', 'cb-show cb-show-plates')}</div>`;
  }
  return `${head}${LIST(C, b, 'items', items, one, 'div', `cb-show cb-show-${b.variant}`)}`;
};

// ---- Signature sections (website design release 7) ---------------------------------------------
// Sections made for complete business websites. The rules they all keep: every word is in the
// page as plain HTML, so it reads with scripts off and for screen readers; anything a visitor can
// do has a plain link behind it; a script only ever adds (choosing, sliding, marking today).

// Where a Book button goes. The booking link is set once, in the website's business details, and
// every Book button uses it. With no booking link the button becomes a call, a WhatsApp message
// or a link to the Contact page: a Book button never goes nowhere.
// Returns the ways to book, the main one first: [{ href, label, kind, away }].
export function bookWays(C, { own = null, label = 'Book', whatsapp = '' } = {}) {
  const biz = C.biz || {}, at = (p) => (C.href ? C.href(p) : p);
  if (own?.href && own.href !== '@booking') { const h = resolveLink(own.href, C); if (h) return [{ href: h, label, kind: 'book', away: /^https:/.test(h) }]; }
  if (biz.bookingUrl) return [{ href: at('/appointments/'), label, kind: 'book', away: false }];
  const out = [];
  if (biz.phone) out.push({ href: telHref(biz), label: `Call ${biz.phone}`, kind: 'call', away: false });
  if (whatsapp) out.push({ href: waHref(whatsapp, 'Hello, I would like to book.'), label: 'Message on WhatsApp', kind: 'whatsapp', away: true });
  if (!out.length) out.push({ href: at('/contact/'), label: 'Get in touch', kind: 'contact', away: false });
  return out;
}
// ---- the visitor's choice kept (app walk, 24 Nov 2026) ----
// A Book whose own link is a Cal.com or Google booking page opens the website's Appointments page
// with that choice named and its own calendar behind "Show available times", rather than leaving
// the website. The address carries the choice after "#", which the static page reads with
// scripts off too (:target). Any other own link opens directly, as before; an item without one
// goes to the Appointments page as every Book does.
const keyPart = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const choiceKey = (slug, blockId, itemId) => `book-${keyPart(slug || 'home')}-${keyPart(blockId)}-${keyPart(itemId)}`;
// The booking page behind an own link, when the Appointments page can show it: { kind, src, href, provider }.
export function choiceTarget(href) {
  const h = typeof href === 'string' ? href.trim() : '';
  if (!/^https:\/\//i.test(h)) return null;
  const t = bookingTarget(h);
  return t && (t.kind === 'cal' || t.kind === 'google') ? { kind: t.kind, src: t.kind === 'cal' ? t.embed : t.frame, href: t.href, provider: t.provider } : null;
}
// The link a Book button uses on the website for item `x` of block `b`.
// `link` is always passed (round B2 re-review M1): a person's Book must never fall back to their
// other link (Read more, LinkedIn).
function choiceLink(C, b, x, link) {
  if (C.editable || !link?.href || !choiceTarget(link.href)) return link;
  // A card linked to a service books it under the service's own key, the same from every page.
  return { ...link, href: `/appointments/#${x?._svcKey && link.href === x._svcLink ? serviceChoiceKey(x._svcKey) : choiceKey(C.page?.slug, b.id, x.id)}` };
}
const BOOKABLE = ['bookstrip', 'spaces', 'services'];
// Sections whose items carry a link that may be a booking page of their own (round B review,
// minor 3): a person's Book (team, `book`), tiles and pinned scenes (`link`). They are listed only
// when that link is a Cal.com or Google booking page, which then opens the Appointments page.
const OWN_BOOKING = { team: 'book', tiles: 'link', scenes: 'link' };
// The things on a page that a visitor books, each with the link its Book uses (its own, or '' for
// the website's): booking strip choices, dated places and treatment cards with a Book button, and
// the sections above when their own link is a booking page. `field` is the item's link field.
// The app's "What people can book" table and the Appointments page both read this list.
// → [{ key, slug, blockId, itemId, index, type, field, name, link, target }]
export function bookingChoices(rawPage, { normalised = false } = {}) {
  const page = normalised ? rawPage : normalisePage(rawPage || {}, { allowData: true });
  const out = [], slug = page.slug || 'home';
  const named = (words) => words.map((w) => String(w || '').replace(/\*+/g, '').trim()).filter(Boolean).join(', ');
  const walk = (blocks) => { for (const b of blocks || []) {
    if (b.type === 'columns') { walk(b.data?.children); continue; }
    const field = OWN_BOOKING[b.type];
    if (field) {
      if (b.type === 'team' && !b.data?.bookEach) continue;
      (b.data?.items || []).forEach((x, index) => {
        const own = typeof x?.[field]?.href === 'string' ? x[field].href : '';
        const target = choiceTarget(own);
        if (!x || !target) return;
        out.push({ key: choiceKey(slug, b.id, x.id), slug, blockId: b.id, itemId: x.id, index, type: b.type, field, name: named([x.name, x.duration]) || 'One to book', link: own, target });
      });
      continue;
    }
    if (!BOOKABLE.includes(b.type)) continue;
    (b.data?.items || []).forEach((x, index) => {
      // A card linked to Your services books under its service (serviceChoices), not here.
      if (!x || x.service || x.services?.length) return;
      if (b.type === 'bookstrip' && !x.name) return;
      if (b.type === 'spaces' && !x.name && !x.date) return;
      if (b.type === 'services' && !(x.name && x.link?.href)) return;
      const own = typeof x.link?.href === 'string' && x.link.href !== '@booking' ? x.link.href : '';
      const words = b.type === 'spaces' ? [x.name, longDate(x.date)] : [x.name, x.duration];
      out.push({ key: choiceKey(slug, b.id, x.id), slug, blockId: b.id, itemId: x.id, index, type: b.type, field: 'link', name: named(words), link: own, target: choiceTarget(own) });
    });
  } };
  walk(page.blocks);
  return out;
}
const wayLink = (w, cls = 'cb-btn') => `<a class="${cls}" href="${esc(w.href)}"${w.away ? ' rel="noopener"' : ''}${w.kind === 'whatsapp' ? ' target="_blank"' : ''} data-way="${w.kind}">${esc(w.label)}</a>`;
// The Cal.com event behind a booking address ("sam/haircut"), when it is one a page can ask
// Cal.com about: a person's own event. Teams and other addresses give ''.
export function calEvent(href) {
  const t = href ? bookingTarget(href) : null;
  return t && t.kind === 'cal' && /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(t.calLink) ? t.calLink : '';
}
const HEAD = (C, b, d, max = true) => `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${max ? RT(C, b, 'intro', d.intro, 'cb-rich cb-intro') : ''}</div>`;

// ---- booking strip ----
const BOOK_HINT = 'Book opens your booking page. Until you add a booking link in Details and booking, visitors see Call and Contact buttons here instead.';
R_.bookstrip = (C, b) => {
  const d = b.data, v = b.variant, uid = esc(b.id), items = d.items || [];
  const label = d.button || 'Book';
  const ways = bookWays(C, { label, whatsapp: d.whatsapp });
  const paid = (x) => (paysOnBooking(C, x) ? `<span class="cb-paid">${PAY_WHEN_BOOK}</span>` : '');
  const meta = (x, i) => `<span class="cb-bs-meta">${T(C, b, `items.${i}.duration`, x.duration, 'span', 'cb-bs-time')}${T(C, b, `items.${i}.price`, x.price, 'span', 'cb-bs-price')}${paid(x)}</span>`;
  // Said once, unless the strip's own words already say it (pages saved from the earlier samples
  // carry "You pay when you book." in their note, review 23 Nov).
  const saysIt = /\bwhen you book\b/i.test(`${d.note || ''} ${d.intro || ''}`);
  const payLineHere = !saysIt && items.some((x) => (x.name || C.editable) && paysOnBooking(C, x)) ? `<p class="cb-small cb-bs-paid">${PAY_WHEN_BOOK_LINE}</p>` : '';
  const note = `${payLineHere}${T(C, b, 'note', d.note, 'p', 'cb-small cb-bs-note')}${remindLine(C)}`;
  const head = v === 'bar' ? `<div class="cb-bs-words">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>` : HEAD(C, b, d);
  // Free times read from Cal.com, only when the owner asked for it and the link is a Cal.com one.
  const cal = d.live ? calEvent(C.biz?.bookingUrl) : '';
  const live = cal && !C.editable ? `<p class="cb-bs-live" data-cal="${esc(cal)}" role="status" aria-live="polite" hidden></p>` : '';
  if (C.editable) {
    const button = T(C, b, 'button', label, 'span', 'cb-btn');
    const hints = `${C.biz?.bookingUrl ? '' : `<p class="cb-note" data-cb-hint>${BOOK_HINT}</p>`}${items.some((x) => x.paid && !paysOnBooking(C, x)) ? `<p class="cb-note" data-cb-hint>${PAID_HINT}</p>` : ''}${d.sticky ? '<p class="cb-note" data-cb-hint>On phones a Book bar stays at the bottom of the screen.</p>' : ''}${d.live ? `<p class="cb-note" data-cb-hint>${calEvent(C.biz?.bookingUrl) ? 'On your website this shows how many times are free today, read from Cal.com.' : 'Free times can only be shown for a Cal.com booking link, set in Details and booking.'}</p>` : ''}`;
    if (v === 'bar') return `<div class="cb-bs cb-bs-bar">${head}<div class="cb-bs-go">${button}</div></div>${note}${hints}`;
    const list = LIST(C, b, 'items', items, (x, i, w) => w(`${T(C, b, `items.${i}.name`, x.name, 'span', 'cb-bs-name')}${meta(x, i)}${v === 'cards' ? `<span class="cb-btn cb-btn-small" aria-hidden="true">${esc(label)}</span>` : ''}`, 'div', 'cb-bs-opt'), 'div', 'cb-bs-pick');
    return `${head}<div class="cb-bs cb-bs-${v}">${list}${v === 'cards' ? '' : `<div class="cb-bs-go">${button}</div>`}</div>${note}${hints}`;
  }
  const named = items.map((x, i) => [x, i]).filter(([x]) => x.name);
  const buttons = ways.map((w, i) => wayLink(w, i ? 'cb-btn cb-btn-2' : 'cb-btn cb-bs-book')).join('');
  // On phones, a bar that stays at the bottom. The page's script puts it there; without the
  // script the strip itself is all there is.
  const sticky = d.sticky ? `<div class="cb-bookbar" data-bookbar role="region" aria-label="${esc(label)}" hidden>${ways.slice(0, 2).map((w, i) => wayLink({ ...w, label: w.kind === 'call' ? 'Call' : w.kind === 'whatsapp' ? 'WhatsApp' : w.label }, i ? 'cb-btn cb-btn-2' : 'cb-btn')).join('')}</div>` : '';
  if (v === 'bar' || !named.length) return `<div class="cb-bs cb-bs-bar">${head}<div class="cb-bs-go">${buttons}${live}</div></div>${note}${sticky}`;
  if (v === 'cards') {
    const cards = named.map(([x, i]) => { const own = bookWays(C, { own: choiceLink(C, b, x, x.link), label, whatsapp: d.whatsapp })[0]; return `<article class="cb-bs-opt"><h3 class="cb-bs-name">${esc(x.name)}</h3><p class="cb-bs-meta">${x.duration ? `<span class="cb-bs-time">${esc(x.duration)}</span>` : ''}${x.price ? `<span class="cb-bs-price">${esc(x.price)}</span>` : ''}${paid(x)}</p>${wayLink({ ...own, label: own.kind === 'book' ? label : own.label }, 'cb-btn cb-btn-small')}</article>`; }).join('');
    return `${head}<div class="cb-bs cb-bs-cards"><div class="cb-bs-pick">${cards}</div>${live}</div>${note}${sticky}`;
  }
  // One strip: a choice of what to book, then one button. Each choice carries where it goes; the
  // page's script sends the button there. Without it the button opens the booking page, where
  // the same choice is offered.
  const opts = named.map(([x, i], k) => {
    const mine = choiceLink(C, b, x, x.link), own = mine?.href && mine.href !== '@booking' ? resolveLink(mine.href, C) : '';
    const words = [x.duration, x.price].filter(Boolean).join(', ');
    return `<label class="cb-bs-opt"><input type="radio" name="bs-${uid}" value="${i}"${k ? '' : ' checked'}${own ? ` data-href="${esc(own)}"` : ''}><span class="cb-bs-name">${esc(x.name)}</span>${words || paid(x) ? `<span class="cb-bs-meta">${x.duration ? `<span class="cb-bs-time">${esc(x.duration)}</span>` : ''}${x.price ? `<span class="cb-bs-price">${esc(x.price)}</span>` : ''}${paid(x)}</span>` : ''}</label>`;
  }).join('');
  return `${head}<div class="cb-bs cb-bs-strip" data-bs><fieldset class="cb-bs-pick"><legend class="cb-sr">Choose what to book</legend>${opts}</fieldset><div class="cb-bs-go">${buttons}${live}</div></div>${note}${sticky}`;
};

// ---- ways to pay ----
// A price with an amount in it ("£35", "From £60", "70"), not "Free", "Ask" or nothing.
export const hasAmount = (price) => /\d/.test(String(price || ''));
// A price that is a question: blank, or, with no digit in it, one that asks (Ask, Quote, Quoted,
// Quotation, POA, P.O.A., Price on application, On request, TBC, To be confirmed, Enquire; whole
// words, any case). "Free", "Card" and other words keep the card's way to book, and so does any
// price with an amount ("£50 (ask about concessions)", "£45 TBC") (reviews, 23 Nov).
const ASKS = /(?<![a-z])(ask|quote|quoted|quotation|poa|p\.\s?o\.\s?a\.?|price on application|on request|tbc|to be confirmed|enquire)(?![a-z])/i;
export const asksPrice = (price) => { const p = String(price ?? '').trim(); return !p || (!/\d/.test(p) && ASKS.test(p)); };
R_.plans = (C, b) => {
  const d = b.data, items = d.items || [];
  const other = bookWays(C, { label: 'Book' })[0];
  const one = (x, i, w) => {
    // Its own pay link; a card without one still leads somewhere (the booking page, a call or
    // the Contact page), so no card ends in a button that does nothing.
    let action;
    if (C.editable) action = `${BTN(C, b, `items.${i}.pay`, { label: x.pay?.label || 'Pay now', href: x.pay?.href || '' }, 'cb-btn cb-pl-pay')}${payNote(x.pay?.href)}`;
    else if (x.pay?.href) action = `<a class="cb-btn cb-pl-pay" href="${esc(resolveLink(x.pay.href, C))}" rel="noopener">${esc(x.pay.label || 'Pay now')}</a>${payNote(x.pay.href)}`;
    else if (d.unpaid === 'ask') action = '<p class="cb-pl-ask">Ask at reception</p>';
    else if (d.unpaid === 'none') action = '';
    // The card's own button words, chosen by the owner (app walk, 24 Nov): Ask about this and Get
    // in touch go to the Contact page; Buy and Join go to the booking page, or to Contact when the
    // website books by phone (a Join that rings a number would surprise).
    else if (x.act === 'ask' || x.act === 'contact') action = wayLink({ href: C.href ? C.href('/contact/') : '/contact/', label: x.act === 'ask' ? 'Ask about this' : 'Get in touch', kind: 'contact', away: false }, 'cb-btn cb-btn-2 cb-pl-pay');
    // A card whose price asks ("Ask", "Quote", "POA", blank) is a question, not a booking: it
    // leads to the Contact page (newcomer walk, 23 Nov).
    else if (asksPrice(x.price)) action = wayLink({ href: C.href ? C.href('/contact/') : '/contact/', label: 'Get in touch', kind: 'contact', away: false }, 'cb-btn cb-btn-2 cb-pl-pay');
    else if (x.act === 'buy' || x.act === 'join') { const word = x.act === 'buy' ? 'Buy' : 'Join'; action = wayLink(other.kind === 'book' ? { ...other, label: word } : { href: C.href ? C.href('/contact/') : '/contact/', label: word, kind: 'contact', away: false }, 'cb-btn cb-btn-2 cb-pl-pay'); }
    else action = wayLink({ ...other, label: other.kind === 'contact' ? 'Ask about this' : other.label }, 'cb-btn cb-btn-2 cb-pl-pay');
    const price = x.price || x.per || C.editable ? `<p class="cb-pl-price">${T(C, b, `items.${i}.price`, x.price, 'span', 'cb-pl-amount')}${T(C, b, `items.${i}.per`, x.per, 'span', 'cb-pl-per')}</p>` : '';
    // A monthly plan's own link to the payment service's page where members change their card or
    // cancel, when the business adds one.
    const manage = x.manage?.href ? BTN(C, b, `items.${i}.manage`, { label: x.manage.label || 'Manage your membership', href: x.manage.href }, 'cb-link cb-pl-manage') : '';
    return w(`${x.popular ? '<p class="cb-pl-flag">Most popular</p>' : ''}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-pl-name')}${price}${RT(C, b, `items.${i}.includes`, x.includes, 'cb-rich cb-pl-inc')}<div class="cb-pl-foot">${action}${T(C, b, `items.${i}.small`, x.small, 'p', 'cb-small cb-pl-small')}${manage}</div>`, 'article', `cb-pl-item${x.popular ? ' is-popular' : ''}`);
  };
  let list = LIST(C, b, 'items', items, one, 'div', `cb-pl cb-pl-${b.variant}`);
  // Cards held like a hand: on a wide screen they start fanned together and spread into a row as
  // the section comes into view (the page's script sets --p; the stylesheet does the rest).
  // Arched cards (batch 2): each rises into place as the section comes into view, the middle one
  // standing higher; steps that climb (a ladder with `rise`): each step comes up from lower down,
  // the tallest from furthest. The page's script sets --p; without it they stand in place.
  if (((b.variant === 'arches') || (b.variant === 'ladder' && d.rise)) && !C.editable && items.length > 1) {
    let k = -1;
    list = list.replace(/^<div class="cb-pl cb-pl-(arches|ladder)"/, (m, v2) => `<div class="cb-pl cb-pl-${v2}${v2 === 'ladder' ? ' cb-pl-rise' : ''}" data-scroll="enter" data-scroll-span="${v2 === 'ladder' ? '0.9' : '0.75'}"`)
      .replace(/<article class="cb-pl-item/g, () => { k++; return `<article style="--k:${k}" class="cb-pl-item`; });
  }
  if (b.variant === 'fan' && !C.editable && items.length > 1) {
    const mid = (items.length - 1) / 2;
    let k = -1;
    list = list.replace(/^<div class="cb-pl cb-pl-fan"/, `<div class="cb-pl cb-pl-fan" data-scroll="enter" data-scroll-span="0.8" style="--n:${items.length}"`)
      .replace(/<article class="cb-pl-item/g, () => { k++; return `<article style="--fi:${(k - mid).toFixed(2)};--fa:${Math.abs(k - mid).toFixed(2)}" class="cb-pl-item`; });
  }
  const money = C.editable ? '<p class="cb-note" data-cb-hint>Each card takes its own pay link (Stripe, PayPal, SumUp or Square). The money goes straight to you.</p>' : '';
  return `${HEAD(C, b, d)}${list}${T(C, b, 'note', d.note, 'p', 'cb-small cb-pl-note')}${money}`;
};

// ---- spaces remaining ----
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// "2026-12-05" as its parts: { dow: 'Sat', day: 5, mon: 'Dec', year: 2026 }.
export function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return { dow: DAY3[dt.getUTCDay()], day: dt.getUTCDate(), mon: MON3[dt.getUTCMonth()], year: dt.getUTCFullYear() };
}
// ---- Add to calendar (owner, 22 Nov) ----
// A dated class or event in Spaces remaining, booked by phone or email, gets two ways to put it in
// a calendar: a Google Calendar link, and a calendar file (.ics) made when the website is built,
// for Apple, Outlook and others. Times are the business's own (its time zone, set once in Details
// and booking), written in UTC so summer time is always right. Chapbook stores and sends nothing.
// The Google link follows the long-standing calendar.google.com/calendar/render?action=TEMPLATE
// form (Google publishes no reference for it; the community reference read on 22 Nov 2026 is
// github.com/InteractionDesignFoundation/add-event-to-calendar-docs, services/google.md).
export const CALENDAR_DIR = '/add-to-calendar/';
// "6pm", "6.30pm", "18:30", "9am to 10am", "6 to 7.30pm", "noon": the start, and the end when
// given, in minutes after midnight. Null when no clock time can be read safely.
// - A clock time has am or pm ("6pm", "6.30pm"), or is plainly on the 24-hour clock: minutes with
//   an hour of 13 to 23 ("18:30") or a leading zero ("06:30"). "6.30" or "6:30" alone could be
//   morning or evening, so it is not read (no link rather than a wrong one).
// - A number with no am or pm counts as the start when "to", "till", "until" or a dash joins it to
//   a time with am or pm ("6 to 7.30pm", "6.30 to 8pm"), and as the end when joined after a clock
//   time ("10am to 12", "6pm-7.30"). Any other number ("2 sessions, 6pm", "Week 3, 6pm",
//   "1 hour from 6pm", "Arrive 5.45, start 6pm") is not a time.
// - Before a dash, a bare number that follows a word ("Week 3 - 6pm", "Session 1 - 7pm") belongs
//   to the word, so it is not a start, unless the word is a day ("Thursday 4 - 6pm"), "from",
//   "between", or one that says when ("Evenings 6-8pm", "Daily 9-10am").
// - "Midnight" is 12am and "noon" or "midday" 12pm ("10pm to midnight" is two hours).
// - Two times make a span only when joined in the same way. An end earlier than the start is the
//   next day ("11pm to 1am" is two hours), so `end` can be more than 24 hours after midnight.
// - A span longer than 16 hours is not read as one (no link rather than a wrong one).
const JOIN = /^\s*(?:to|till|until|-|\u2013|\u2014)\s*$/;
const DASH = /^\s*(?:-|\u2013|\u2014)\s*$/;
const WHEN_WORD = /^(?:(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?|from|between|daily|nightly|open|weekdays?|weekends?|mornings?|afternoons?|evenings?|nights?)$/;
export function clockSpan(text) {
  const s = String(text || '').toLowerCase().replace(/\bmidnight\b/g, '12am').replace(/\b(?:noon|midday)\b/g, '12pm');
  const toks = [];
  for (const m of s.matchAll(/(?<![\d.:£$€])(\d{1,2})(?:[.:](\d{2}))?(?![\d.:])(?:\s*(am|pm)(?![a-z]))?/g)) {
    const h = +m[1], mi = m[2] ? +m[2] : 0, ap = m[3] || '';
    if (mi > 59 || h > 23 || (ap && (h < 1 || h > 12))) { toks.push(null); continue; }
    const clock = !!ap || (!!m[2] && (h >= 13 || /^0\d$/.test(m[1])));
    toks.push({ h, mi, ap, clock, from: m.index, to: m.index + m[0].length, word: (s.slice(0, m.index).match(/([a-z]+)\s*$/) || [])[1] || '', bare: !m[2] && !ap });
  }
  const joined = (a, b) => a && b && JOIN.test(s.slice(a.to, b.from));
  // A number with no am or pm, joined to a time with am or pm after it; a bare one before a dash
  // only when no other word claims it.
  const leads = (t, b) => joined(t, b) && b.ap && !(t.bare && t.word && !WHEN_WORD.test(t.word) && DASH.test(s.slice(t.to, b.from)));
  // The first clock time, or a number that leads to one.
  let i = toks.findIndex((t, k) => t && (t.clock || leads(t, toks[k + 1])));
  if (i < 0) return null;
  const a = toks[i], b = joined(a, toks[i + 1]) ? toks[i + 1] : null;
  const at = (t) => ((t.h % 12) + (t.ap === 'pm' ? 12 : 0)) * 60 + t.mi;
  const both = (t) => [(t.h % 12) * 60 + t.mi, (t.h % 12) * 60 + t.mi + 720];
  let start, end = null;
  if (a.ap) start = at(a);
  else if (b && b.ap && a.h <= 12) {
    // "6 to 7.30pm", "11 to 1pm": the start is the last of its two readings before the end.
    end = at(b);
    const before = both(a).filter((c) => c < end);
    if (before.length) start = Math.max(...before);
    else { start = both(a)[1]; end += 1440; }
  } else start = a.h * 60 + a.mi;
  if (b && end == null) {
    if (b.ap) end = at(b);
    else if (b.h > 12) end = b.h * 60 + b.mi;
    // "10am to 12", "22:00-01:00": the first reading after the start.
    else end = both(b).find((c) => c > start) ?? both(b)[0] + 1440;
    if (end <= start) end += 1440;
  }
  if (start < 0 || start >= 1440) return null;
  if (end != null && end - start > 16 * 60) return null;
  return { start, end };
}
// "45 min", "90 minutes", "1 hour", "2 hours": a length in minutes, or null.
export function lengthOf(text) {
  const m = String(text || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hours?|hrs?)\b/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2].startsWith('h') ? 60 : 1);
  return n > 0 && n <= 24 * 60 ? Math.round(n) : null;
}
// A wall clock time in a time zone, as the moment it is (UTC). Summer time is worked out from the
// zone itself (two passes, so a time beside a clock change lands right).
const zoneOffset = (ms, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
};
export function zonedTime(iso, minutes, tz) {
  const [y, mo, d] = String(iso).split('-').map(Number);
  const wall = Date.UTC(y, mo - 1, d, 0, minutes);
  let t = wall - zoneOffset(wall, tz);
  t = wall - zoneOffset(t, tz);
  return new Date(t);
}
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const LONG_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "Tuesday 3 December", for the links' names.
export const longDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return ''; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return `${LONG_DAY[d.getUTCDay()]} ${d.getUTCDate()} ${LONG_MON[d.getUTCMonth()]}`; };
// One dated item as a calendar event, or null: it needs a name, a date that has not passed and a
// start time it can read, and it must not follow a Cal.com event (Cal.com gives its own links).
// slug and blockId make its file name and its UID, which stay the same from one publish to the
// next. No personal data: only the business's own words, address and website.
export function spaceEvent(x, { slug = 'home', blockId = '', tz = 'Europe/London', today = '', url = '', place = '', siteName = '' } = {}) {
  if (!x || !x.name || !x.date || x.cal || (today && x.date < today)) return null;
  const span = clockSpan(x.time);
  if (!span) return null;
  const minutes = span.end != null ? span.end - span.start : lengthOf(x.time) || lengthOf(x.detail) || 60;
  // The end is the start plus the length, so a class on a clock change day keeps its length.
  const start = zonedTime(x.date, span.start, tz), end = new Date(start.getTime() + minutes * 60000);
  const site = realSiteUrl(url);
  const host = site ? new URL(site).hostname : 'chapbook-website';
  // The date is part of the file name and UID, so a row used again for a new date is a new event.
  const file = `${slug}-${blockId}-${x.id || 'i'}-${x.date}`.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  return {
    file: `${file}.ics`, uid: `${file}@${host}`, start, end,
    summary: siteName ? `${x.name}, ${siteName}` : x.name,
    location: String(place || '').split('\n').map((l) => l.trim()).filter(Boolean).join(', '),
    description: [x.detail, x.price ? `Price: ${x.price}` : '', site ? `Details and changes: ${site}` : ''].filter(Boolean).join('\n'),
    url: site, name: x.name, date: x.date,
  };
}
// RFC 5545: text with its backslashes, semicolons, commas and new lines escaped; lines folded at
// 75 octets (never inside a character), each joined with CRLF.
export const icsEscape = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
export function icsFold(line) {
  const out = []; let cur = '', size = 0, limit = 75;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > limit) { out.push(cur); cur = ' '; size = 1; limit = 75; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n');
}
export function icsText(ev, { stamp = new Date() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chapbook//Add to calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${ev.uid}`, `DTSTAMP:${utcStamp(stamp)}`, `DTSTART:${utcStamp(ev.start)}`, `DTEND:${utcStamp(ev.end)}`, `SUMMARY:${icsEscape(ev.summary)}`,
    ...(ev.location ? [`LOCATION:${icsEscape(ev.location)}`] : []), ...(ev.description ? [`DESCRIPTION:${icsEscape(ev.description)}`] : []), ...(ev.url ? [`URL:${ev.url}`] : []),
    'END:VEVENT', 'END:VCALENDAR'];
  return `${lines.map(icsFold).join('\r\n')}\r\n`;
}
export function googleCalendarHref(ev) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.summary });
  if (ev.description) q.set('details', ev.description);
  if (ev.location) q.set('location', ev.location);
  // The two times stay joined by a plain slash, as the form is written.
  return `https://calendar.google.com/calendar/render?${q.toString().replace(/^action=TEMPLATE/, `action=TEMPLATE&dates=${utcStamp(ev.start)}/${utcStamp(ev.end)}`)}`;
}
// Every calendar file a website's pages need, for the website build: [{ name, text }].
export function calendarFiles(pages, { site = {}, today = localIso(), stamp = new Date() } = {}) {
  const biz = professionalDetails(site.professional || {});
  const out = [];
  for (const raw of pages || []) {
    const page = normalisePage(raw);
    for (const b of page.blocks) {
      if (b.type !== 'spaces' || b.data.noCalendar) continue;
      for (const x of b.data.items || []) {
        // A Full date shows no Add to calendar, so it has no file either.
        if (x.left === 0) continue;
        const ev = spaceEvent(x, { slug: page.slug, blockId: b.id, tz: biz.timeZone, today, url: site.url, place: biz.location, siteName: cleanLine(site.name || site.masthead || '', 80) });
        if (ev) out.push({ name: ev.file.replace(/\.ics$/, ''), text: icsText(ev, { stamp }) });
      }
    }
  }
  return out;
}
// Where a Thank you page sends people to add a class to their calendar: the first section with an
// upcoming dated item that has places left, or ''.
export function datesHrefOf(pages, { site = {}, today = localIso(), href = (p) => p } = {}) {
  const biz = professionalDetails(site.professional || {});
  for (const raw of pages || []) {
    const page = normalisePage(raw);
    for (const b of page.blocks) {
      if (b.type !== 'spaces' || b.data.noCalendar) continue;
      if ((b.data.items || []).some((x) => x.left !== 0 && spaceEvent(x, { slug: page.slug, blockId: b.id, tz: biz.timeZone, today }))) return `${href(page.slug === 'home' ? '/' : `/${page.slug}/`)}#dates-${b.id}`;
    }
  }
  return '';
}

// A Full date's way to ask for a place (newcomer walk, 23 Nov). A waiting list link set to the
// business's email ("@email", as the samples are) writes an email with the date's name as its
// subject, or calls when there is no email. With no waiting list link at all, a Full date still
// offers a call or an email, so a visitor is never left without a way to ask.
function waitWay(C, b, x, i) {
  const cls = 'cb-btn cb-btn-2 cb-btn-small', list = x.waitlist;
  if (list && list.href !== '@email') return BTN(C, b, `items.${i}.waitlist`, { label: list.label || 'Join the waiting list', href: list.href }, cls);
  const what = [x.name, longDate(x.date)].filter(Boolean).join(', ');
  const mail = mailOf(C), phone = C.biz.phone;
  const way = mail ? { href: mailHref(mail, `Waiting list: ${what || 'a full date'}`), label: list ? list.label || 'Join the waiting list' : 'Email to ask about a space' }
    : phone ? { href: telHref(C.biz), label: `Call ${phone} ${list ? 'to join the waiting list' : 'to ask about a space'}` } : null;
  if (C.editable) {
    if (list) return BTN(C, b, `items.${i}.waitlist`, { label: list.label || 'Join the waiting list', href: way?.href || '' }, cls);
    return `<span class="cb-note" data-cb-hint>${way ? `Full: visitors see ${esc(way.label)}. Add a waiting list link under Links to send them elsewhere.` : 'Full: add your email or phone in Details & booking so visitors can ask about a space.'}</span>`;
  }
  return way ? `<a class="${cls}" href="${esc(way.href)}">${esc(way.label)}</a>` : '';
}
// What a number of spaces is called: "6 spaces left", "Last 2", "Last space", "Full".
export const spacesWords = (left) => (left == null ? '' : left <= 0 ? 'Full' : left === 1 ? 'Last space' : left === 2 ? 'Last 2' : `${left} spaces left`);
const localIso = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
R_.spaces = (C, b) => {
  const d = b.data, v = b.variant, mode = choiceValue('spaces', d, 'past');
  const today = C.today;
  const all = (d.items || []).map((x, i) => ({ x, i, past: !!x.date && x.date < today }));
  // A date that had already passed when the website was published is not drawn at all, or is
  // drawn as Finished. One that passes afterwards is dealt with by the page's script.
  const rows = C.editable ? all : all.filter((r) => (r.x.name || r.x.date) && !(r.past && mode === 'hide'));
  if (!rows.length && !C.editable && !d.heading && !d.intro) return '';
  const site = bookWays(C, { label: 'Book' })[0];
  const one = ({ x, i, past }, w) => {
    const dp = dateParts(x.date);
    const when = dp
      ? `<time class="cb-sp-date" datetime="${esc(x.date)}"><span class="cb-sp-dow">${dp.dow}</span><span class="cb-sp-day">${dp.day}</span><span class="cb-sp-mon">${dp.mon}${dp.year !== Number(today.slice(0, 4)) ? ` ${dp.year}` : ''}</span></time>`
      : C.editable ? '<span class="cb-sp-date cb-sp-nodate" data-cb-hint>No date yet</span>' : '';
    // A row can follow a Cal.com event with seats: the page's script then asks Cal.com for the
    // seats left on that day and shows them, naming Cal.com. The number set by hand stays as
    // what shows until the answer arrives, and if it never does.
    const follow = x.date ? calEvent(/^https:\/\//i.test(x.cal || '') ? x.cal : x.cal ? `https://${x.cal}` : '') : '';
    const full = x.left === 0, words = past ? 'Finished' : spacesWords(x.left);
    // The number is only shown once the page's script has checked the date against today, so a
    // page left open, or one read with scripts off, never shows spaces for a day that has gone.
    const gate = !C.editable && !past && x.date ? ' hidden' : '';
    const taken = x.capacity && x.left != null ? clamp(1 - x.left / x.capacity, 0, 1) : null;
    const state = words || (follow && !past) ? `<p class="cb-sp-left${full ? ' is-full' : x.left != null && x.left <= 2 ? ' is-last' : ''}"${gate}>${esc(words)}</p>${taken != null && !past ? `<span class="cb-sp-meter" aria-hidden="true" style="--f:${taken.toFixed(3)}"${gate}><i></i></span>` : ''}` : '';
    let acts = '';
    if (!past) {
      if (full) acts = waitWay(C, b, x, i);
      else {
        // In the editor a date without its own link still shows its Book button, which opens the
        // website's booking page (or calls), so the owner sees where it goes and can change it.
        const book = x.link ? BTN(C, b, `items.${i}.link`, { label: x.link.label || 'Book', href: choiceLink(C, b, x, x.link).href }, 'cb-btn cb-btn-small')
          : C.editable ? BTN(C, b, `items.${i}.link`, { label: 'Book', href: '@booking' }, 'cb-btn cb-btn-small') : wayLink(site, 'cb-btn cb-btn-small');
        const pay = x.pay && !paysOnBooking(C, x) ? BTN(C, b, `items.${i}.pay`, { label: x.pay.label || 'Pay now', href: x.pay.href }, 'cb-btn cb-btn-2 cb-btn-small') : '';
        // Booking and paying in two steps say so; a recognised pay page is named.
        const known = pay && x.pay?.href ? payNote(x.pay.href) : '';
        const words = known && book ? thenPay(x.pay, 'place') : '';
        acts = `${book}${pay}${words || known ? `<span class="cb-paynote">${words}${known}</span>` : ''}`;
      }
    }
    // A class's time with the business's own time zone beside it ("6pm UK time"), when one is
    // set in Details and booking.
    const zone = x.time && C.biz.zoneLabel ? ` <span class="cb-sp-zone">${esc(C.biz.zoneLabel)}</span>` : '';
    const time = T(C, b, `items.${i}.time`, x.time, 'span', 'cb-sp-time');
    const meta = `${zone ? time.replace(/<\/span>$/, `${zone}</span>`) : time}${T(C, b, `items.${i}.detail`, x.detail, 'span', 'cb-sp-detail')}${T(C, b, `items.${i}.price`, x.price, 'span', 'cb-sp-price')}${paysOnBooking(C, x) ? `<span class="cb-paid">${PAY_WHEN_BOOK}</span>` : ''}`;
    const body = `<div class="cb-sp-body">${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-sp-name')}${meta ? `<p class="cb-sp-meta">${meta}</p>` : ''}</div>`;
    // Add to calendar: for a date with places left that is not followed from Cal.com.
    const ev = !past && !full && !d.noCalendar ? spaceEvent(x, { slug: C.page.slug || 'home', blockId: b.id, tz: C.biz.timeZone, today, url: C.site?.url, place: C.biz.location, siteName: siteName(C) }) : null;
    const name = ev ? `${x.name}, ${longDate(x.date)}` : '';
    // The disclosure names its item and date (read as "Add to calendar: Pre-race clinic, Sunday 29
    // March"), and each link's name starts from its visible words' meaning and contains them.
    const cal = ev ? `<details class="cb-sp-cal"><summary>Add to calendar<span class="cb-sr">: ${esc(name)}</span></summary><p class="cb-sp-calgo"><a href="${esc(googleCalendarHref(ev))}" target="_blank" rel="noopener" aria-label="${esc(`Add ${name}, to Google Calendar`)}">Google Calendar</a><a href="${esc(C.href ? C.href(`${CALENDAR_DIR}${ev.file}`) : `${CALENDAR_DIR}${ev.file}`)}" download="${esc(ev.file)}" aria-label="${esc(`Add ${name}, to Apple, Outlook and others`)}">Apple, Outlook and others</a></p></details>` : '';
    return w(`${when}${body}<div class="cb-sp-state">${state}</div>${acts ? `<p class="cb-sp-acts">${acts}</p>` : ''}${cal}`, 'li', `cb-sp-item${past ? ' is-past' : ''}${full ? ' is-full' : ''}`)
      .replace(/^<li /, `<li${x.date ? ` data-date="${esc(x.date)}"` : ''}${follow && !C.editable ? ` data-cal="${esc(follow)}"` : ''} `);
  };
  // (While editing, every date is listed, so each row's place in the list is its own.)
  const list = LIST(C, b, 'items', rows, (r, _k, w) => one(r, w), 'ul', `cb-sp cb-sp-${v}`)
    .replace(/^<ul /, `<ul data-past="${mode}" `);
  const tp = dateParts(today);
  // Says where the numbers come from and how fresh they are: the business sets them by hand.
  const asOf = rows.some((r) => r.x.left != null && !r.past) ? `<p class="cb-small cb-sp-asof">Spaces as last updated on ${tp.day} ${tp.mon} ${tp.year}. Booking confirms your place.</p>` : '';
  const none = C.editable ? '' : `<p class="cb-sp-none"${rows.length ? ' hidden' : ''}>No dates at the moment.</p>`;
  // Where a date's Book goes when it has no link of its own (newcomer walk, 23 Nov).
  const own = (d.items || []).some((x) => !x.link && x.left !== 0) ? ` ${C.biz.bookingUrl ? 'A date without its own link books through your booking page from Details & booking, the same one every Book button opens. Give a date its own link under Links.' : 'Until you add a booking link in Details & booking, Book becomes Call or Contact.'}` : '';
  const hint = C.editable ? `<p class="cb-note" data-cb-hint>Set the spaces left with the plus and minus buttons, then publish. A date that has passed takes itself off your website. A date can follow a Cal.com event with seats instead: your website then shows its seats left by itself.${own}</p>` : '';
  return `${HEAD(C, b, d)}${list}${none}${asOf}${T(C, b, 'note', d.note, 'p', 'cb-small cb-sp-note')}${hint}`;
};

// ---- menu board ----
// Lines in groups: a line that names a group starts it, and the lines after it belong to it.
export function menuGroups(items = []) {
  const groups = [];
  items.forEach((x, i) => { if (x.group || !groups.length) groups.push({ name: x.group || '', rows: [] }); groups[groups.length - 1].rows.push([x, i]); });
  return groups;
}
R_.menuboard = (C, b) => {
  const d = b.data, v = b.variant, uid = esc(b.id);
  const groups = menuGroups(d.items || []);
  const row = ([x, i], first) => `<li class="cb-mb-row"${ED(C, 'data-cb-item', `${b.id}:items.${i}`)}>${C.editable && !first ? T(C, b, `items.${i}.group`, x.group, 'p', 'cb-mb-newgroup') : ''}<div class="cb-mb-line">${T(C, b, `items.${i}.name`, x.name, 'span', 'cb-mb-name')}${T(C, b, `items.${i}.tag`, x.tag, 'span', 'cb-mb-tag')}<i aria-hidden="true"></i>${T(C, b, `items.${i}.duration`, x.duration, 'span', 'cb-mb-time')}${T(C, b, `items.${i}.price`, x.price, 'span', 'cb-mb-price')}</div>${T(C, b, `items.${i}.description`, x.description, 'p', 'cb-mb-desc')}</li>`;
  const cols = groups.map((g, k) => {
    const [x0, i0] = g.rows[0];
    const title = C.editable ? T(C, b, `items.${i0}.group`, x0.group, 'h3', 'cb-mb-group') : g.name ? `<h3 class="cb-mb-group" id="mb-${uid}-${k}">${esc(g.name)}</h3>` : '';
    return `<section class="cb-mb-col"${!C.editable && g.name ? ` aria-labelledby="mb-${uid}-${k}"` : ''} data-group="${k}">${title}<ul class="cb-mb-rows">${g.rows.map((r, n) => row(r, n === 0)).join('')}</ul></section>`;
  }).join('');
  if (!cols && !C.editable) return '';
  const note = T(C, b, 'note', d.note, 'p', 'cb-small cb-mb-note');
  const track = `<div class="cb-mb-track"${ED(C, 'data-cb-list', `${b.id}:items`)}>${cols}</div>`;
  // The board slides sideways as the page scrolls (a pointer or a wide screen), and is swiped on
  // a phone. It can be reached and scrolled with the keyboard too.
  if (v === 'slide' && !C.editable) return `${HEAD(C, b, d)}<div class="cb-hs cb-mb cb-mb-slide" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="${esc(plainHeading(d.heading) || 'Menu')}, scrolls sideways"><div class="cb-hs-track cb-mb-track">${cols}</div></div><span class="cb-hs-bar" aria-hidden="true"><i></i></span></div></div>${note}`;
  if (v === 'tabs' && !C.editable && groups.length > 1 && groups.every((g) => g.name)) return `${HEAD(C, b, d)}<div class="cb-mb cb-mb-tabs" data-tabs>${track}</div>${note}`;
  // An index of the groups stays beside the list on a wide screen, the group being read marked (the
  // page's script does the marking; the index is plain links to each group without it). A line
  // with a description opens to show it (M17).
  if (v === 'index' && !C.editable && groups.length > 1 && groups.every((g) => g.name)) {
    const line = (x) => `<span class="cb-mb-name">${esc(x.name || '')}</span>${x.tag ? `<span class="cb-mb-tag">${esc(x.tag)}</span>` : ''}<i aria-hidden="true"></i>${x.duration ? `<span class="cb-mb-time">${esc(x.duration)}</span>` : ''}${x.price ? `<span class="cb-mb-price">${esc(x.price)}</span>` : ''}`;
    const rows = (g) => g.rows.map(([x]) => (x.description ? `<li class="cb-mb-row cb-mbi-row"><details><summary class="cb-mb-line">${line(x)}</summary><p class="cb-mb-desc">${esc(x.description)}</p></details></li>` : `<li class="cb-mb-row"><div class="cb-mb-line">${line(x)}</div></li>`)).join('');
    const list = groups.map((g, k) => `<section class="cb-mb-col" aria-labelledby="mb-${uid}-${k}" data-group="${k}"><h3 class="cb-mb-group" id="mb-${uid}-${k}">${esc(g.name)}</h3><ul class="cb-mb-rows">${rows(g)}</ul></section>`).join('');
    const nav = groups.map((g, k) => `<li><a href="#mb-${uid}-${k}"${k ? '' : ' aria-current="true"'}><span class="cb-mbi-name">${esc(g.name)}</span><span class="cb-mbi-count" aria-hidden="true">${String(g.rows.length).padStart(2, '0')}</span></a></li>`).join('');
    return `${HEAD(C, b, d)}<div class="cb-mbi" data-mbi style="--n:${groups.length}"><nav class="cb-mbi-nav" aria-label="${esc(plainHeading(d.heading) || 'Menu')}: groups"><ol>${nav}</ol><span class="cb-mbi-bar" aria-hidden="true"><i></i></span></nav><div class="cb-mbi-list">${list}</div></div>${note}`;
  }
  return `${HEAD(C, b, d)}<div class="cb-mb cb-mb-${v === 'slide' ? 'slide cb-mb-still' : ['tabs', 'index'].includes(v) ? 'columns' : v}">${track}</div>${note}`;
};

// ---- tiles ----
// Simple line drawings of everyday tasks (therapy batch 1, occupational therapy): drawn in the
// text colour, with one part in the accent and a soft disc behind. Decoration only.
const TASKS = {
  dressing: '<path class="a" d="M48 24v-5a4 4 0 1 1 4 4"/><path d="M22 37 48 24l26 13"/><path d="M33 37h30l15 12-8 9-6-4v30H32V54l-6 4-8-9z"/><path d="M41 37l7 8 7-8M48 45v39"/>',
  cooking: '<path class="a" d="M33 36c-4-5 4-8 0-14M44 36c-4-5 4-8 0-14M55 36c-4-5 4-8 0-14"/><path d="M14 46h58"/><path d="M18 46v20a10 10 0 0 0 10 10h30a10 10 0 0 0 10-10V46"/><path d="M68 52h18"/><path d="M22 84h44"/>',
  washing: '<path d="M18 52h60a30 22 0 0 1-60 0z"/><path d="M42 74l-2 10h16l-2-10"/><path d="M48 26v-6h14v6M55 20v-6M48 26a6 6 0 0 0-6 6v4"/><path class="a" d="M42 42c-3 4-3 6 0 7 3-1 3-3 0-7z"/>',
  stairs: '<path d="M12 82h18V68h16V54h16V40h20"/><path class="a" d="M16 62 72 24"/><path d="M24 68v-11M40 54v-11M56 40v-11"/>',
  work: '<path d="M16 28h48v30H16z"/><path d="M8 64h64l-5 7H13z"/><path class="a" d="M24 38h24M24 46h16"/><path d="M74 50h12v16a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><path d="M86 54h3a4 4 0 0 1 0 8h-3"/>',
  school: '<path d="M28 34a20 20 0 0 1 40 0v42a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6z"/><path d="M42 20a6 6 0 0 1 12 0"/><path d="M28 46h40"/><path class="a" d="M38 58h20v14H38z"/>',
};
const taskSvg = (kind) => `<span class="cb-task cb-task-${kind}" aria-hidden="true"><svg viewBox="0 0 96 96" focusable="false"><circle class="cb-task-disc" cx="50" cy="54" r="34"/><g class="cb-task-line">${TASKS[kind]}</g></svg></span>`;
R_.tiles = (C, b) => {
  const d = b.data, items = d.items || [], open = b.variant === 'open';
  const meta = (x, i) => (x.duration || x.price || (C.editable && open) ? `<p class="cb-tl-meta">${T(C, b, `items.${i}.duration`, x.duration, 'span', 'cb-tl-time')}${T(C, b, `items.${i}.price`, x.price, 'span', 'cb-tl-price')}</p>` : '');
  const more = (x, i) => `${meta(x, i)}${T(C, b, `items.${i}.text`, x.text, 'p', 'cb-tl-text')}${x.link ? BTN(C, b, `items.${i}.link`, choiceLink(C, b, x, x.link), 'cb-link') : ''}`;
  // Tiles that open (S4 with M13): a photo tile shows its name; pointed at or focused, a panel
  // slides up with the price, the time and the words. On a touch screen, with "reduce motion"
  // and in the editor the panel simply stays open.
  const one = (x, i, w) => {
    const panel = open && x.picture;
    const kind = BLOCK_TYPES.tiles.fields.items.item.shape.options.includes(x.shape) ? x.shape : 'none';
    const shape = x.picture || kind === 'none' ? '' : TASKS[kind] ? taskSvg(kind) : `<span class="cb-shape cb-shape-${kind}" aria-hidden="true"><i></i></span>`;
    const html = w(`${x.picture || (C.editable && !x.value && !shape) ? `<figure class="cb-tl-pic">${P(C, b, `items.${i}.picture`, x.picture)}</figure>` : ''}${shape}<div class="cb-tl-body">${T(C, b, `items.${i}.value`, x.value, 'p', 'cb-tl-value')}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-tl-name')}${panel ? '' : more(x, i)}</div>${panel ? `<div class="cb-tl-panel">${more(x, i)}</div>` : ''}`, 'article', `cb-tl-item${x.picture ? ' has-pic' : ''}${x.value ? ' has-value' : ''}${panel ? ' has-panel' : ''}${shape ? ' has-shape' : ''}`);
    return panel && !x.link && !C.editable ? html.replace(/^<article/, '<article tabindex="0"') : html;
  };
  // Cards that travel sideways as the page scrolls on (S5 with M4), as the services rail does:
  // phones swipe them, and the editor shows them as a plain row.
  if (b.variant === 'rail' && !C.editable && items.length > 1) {
    const cards = items.map((x, i) => one(x, i, (inner, tag, cls) => `<${tag} class="${cls}">${inner}</${tag}>`)).join('');
    return `${HEAD(C, b, d)}<div class="cb-hs cb-tl-rail" data-hs><div class="cb-hs-pin"><div class="cb-hs-view" tabindex="0" role="region" aria-label="${esc(plainHeading(d.heading) || 'Tiles')}, scrolls sideways"><div class="cb-hs-track cb-tl-railtrack">${cards}</div></div><span class="cb-hs-bar" aria-hidden="true"><i></i></span></div></div>`;
  }
  const cls = `cb-tl cb-tl-${b.variant === 'rail' ? 'row cb-tl-railrow' : b.variant}${d.bounce ? ' cb-tl-bounce' : ''}${d.assemble ? ' cb-tl-assemble' : ''}`;
  return `${HEAD(C, b, d)}${LIST(C, b, 'items', items, one, 'div', cls)}`;
};

// ---- before and after ----
R_.compare = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  const one = (x, i, w) => {
    const la = x.beforeLabel || 'Before', lb = x.afterLabel || 'After';
    const cap = `${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-cmp-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-cmp-desc')}`;
    const tagA = C.editable ? T(C, b, `items.${i}.beforeLabel`, x.beforeLabel, 'span', 'cb-cmp-tag') : `<span class="cb-cmp-tag">${esc(la)}</span>`;
    const tagB = C.editable ? T(C, b, `items.${i}.afterLabel`, x.afterLabel, 'span', 'cb-cmp-tag') : `<span class="cb-cmp-tag">${esc(lb)}</span>`;
    const side = `<div class="cb-cmp-pair"><figure class="cb-cmp-one">${P(C, b, `items.${i}.before`, x.before)}${tagA}</figure><figure class="cb-cmp-one">${P(C, b, `items.${i}.after`, x.after)}${tagB}</figure></div>`;
    // Both photos are needed for a slider. The handle is a real range control, so it works with
    // a finger, a mouse and the arrow keys; until the page's script starts, and without it, the
    // two photos sit side by side.
    if (v !== 'slider' || C.editable || !x.before || !x.after) {
      if (!C.editable && !x.before && !x.after) return cap ? w(`<div class="cb-cmp-cap">${cap}</div>`, 'article', 'cb-cmp-item') : '';
      return w(`${side}<div class="cb-cmp-cap">${cap}</div>`, 'article', 'cb-cmp-item');
    }
    const soon = !C.editable && C.eagerLeft > 0 ? ' fetchpriority="high"' : ' loading="lazy"';
    if (soon.includes('high')) C.eagerLeft = 0;
    const slider = `<div class="cb-cmp-stage" data-cmp style="--pos:50%"><img class="cb-cmp-b" src="${esc(imgSrc(C, x.after.src))}"${srcsetOf(C, x.after)} alt="${esc(x.after.alt || lb)}"${soon} decoding="async"><div class="cb-cmp-a"><img src="${esc(imgSrc(C, x.before.src))}"${srcsetOf(C, x.before)} alt="${esc(x.before.alt || la)}"${soon} decoding="async"></div><span class="cb-cmp-tag cb-cmp-tag-a">${esc(la)}</span><span class="cb-cmp-tag cb-cmp-tag-b">${esc(lb)}</span><span class="cb-cmp-handle" aria-hidden="true"></span><input class="cb-cmp-range" type="range" min="0" max="100" value="50" step="1" aria-label="${esc(`${x.name ? `${x.name}: ` : ''}how much of the ${la.toLowerCase()} photo shows`)}" hidden></div>`;
    return w(`${slider}${creditsOf([x.before, x.after])}<div class="cb-cmp-cap">${cap}</div>`, 'article', 'cb-cmp-item');
  };
  const list = LIST(C, b, 'items', items, one, 'div', `cb-cmp cb-cmp-${v}`);
  return `${HEAD(C, b, d)}${list}`;
};

// ---- timetable ----
const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
R_.timetable = (C, b) => {
  const d = b.data, items = d.items || [];
  const byDay = WEEK_DAYS.map((day) => [day, items.map((x, i) => [x, i]).filter(([x]) => (x.day || 'mon') === day)]).filter(([, list]) => list.length);
  if (!byDay.length && !C.editable) return '';
  const session = ([x, i]) => `<li class="cb-tt-item"${ED(C, 'data-cb-item', `${b.id}:items.${i}`)}>${T(C, b, `items.${i}.time`, x.time, 'span', 'cb-tt-time')}<div class="cb-tt-body">${T(C, b, `items.${i}.name`, x.name, 'p', 'cb-tt-name')}${T(C, b, `items.${i}.detail`, x.detail, 'p', 'cb-tt-detail')}</div>${T(C, b, `items.${i}.level`, x.level, 'span', 'cb-tt-level')}${x.link ? BTN(C, b, `items.${i}.link`, { label: x.link.label || 'Book', href: x.link.href }, 'cb-link cb-tt-book') : ''}</li>`;
  const cols = byDay.map(([day, list]) => `<section class="cb-tt-day" data-day="${day}"><h3 class="cb-tt-dayname">${DAY_NAMES[day]}</h3><ul class="cb-tt-list">${list.map(session).join('')}</ul></section>`).join('');
  const hint = C.editable ? '<p class="cb-note" data-cb-hint>Choose a session to change its day. On your website, today is marked.</p>' : '';
  return `${HEAD(C, b, d)}<div class="cb-tt cb-tt-${b.variant}" data-tt style="--n:${Math.max(byDay.length, 1)}"${ED(C, 'data-cb-list', `${b.id}:items`)}>${cols}</div>${T(C, b, 'note', d.note, 'p', 'cb-small cb-tt-note')}${hint}`;
};

// ---- case study ----
R_.casestudy = (C, b) => {
  const d = b.data, v = b.variant;
  const facts = LIST(C, b, 'items', d.items || [], (x, i, w) => w(`<dt>${T(C, b, `items.${i}.label`, x.label, 'span')}</dt><dd>${T(C, b, `items.${i}.value`, x.value, 'span')}</dd>`, 'div', 'cb-cs-fact'), 'dl', 'cb-cs-facts');
  const chapter = (key, title, n) => (d[key] || C.editable ? `<section class="cb-cs-part"><p class="cb-cs-n" aria-hidden="true">${String(n).padStart(2, '0')}</p><h3 class="cb-cs-title">${title}</h3>${RT(C, b, key, d[key])}</section>` : '');
  const chapters = `${chapter('brief', 'The brief', 1)}${chapter('work', 'What we did', 2)}${chapter('result', 'The result', 3)}`;
  const more = LIST(C, b, 'pictures', d.pictures || [], (p, i, w) => w(P(C, b, `pictures.${i}`, p, '', { credits: false }), 'figure'), 'div', 'cb-cs-more');
  const main = d.picture || C.editable ? `<figure class="cb-cs-main">${P(C, b, 'picture', d.picture, '', { credits: false })}</figure>` : '';
  const words = `<div class="cb-cs-words">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-lead')}${facts}${BTNS(C, b, d.buttons)}</div>`;
  if (!main && !d.heading && !d.intro && !chapters && !C.editable) return '';
  return `<div class="cb-cs cb-cs-${v}"><div class="cb-cs-top${main ? '' : ' cb-solo'}">${v === 'chapters' ? `${words}${main}` : `${main}${words}`}</div>${chapters ? `<div class="cb-cs-parts">${chapters}</div>` : ''}${more}${creditsOf([d.picture, ...(d.pictures || [])])}</div>`;
};

// ---- pinned scenes ----
R_.scenes = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  // A scene can show a simple line drawing instead of a photo (release 7, hand studies).
  const art = (x) => (x.picture ? '' : handSvg(x.drawing));
  const fig = (x, i) => (art(x) ? `<figure class="cb-sc-pic cb-sc-draw">${art(x)}</figure>` : x.picture || C.editable ? `<figure class="cb-sc-pic">${P(C, b, `items.${i}.picture`, x.picture)}</figure>` : '');
  const one = (x, i, w) => w(`${fig(x, i)}<div class="cb-sc-body">${T(C, b, `items.${i}.tag`, x.tag, 'p', 'cb-sc-tag')}${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-sc-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-sc-desc')}${x.link ? BTN(C, b, `items.${i}.link`, choiceLink(C, b, x, x.link), 'cb-link') : ''}</div>`, 'article', `cb-sc-item${i ? '' : ' is-on'}`);
  const list = LIST(C, b, 'items', items, one, 'div', 'cb-sc-list');
  // The stage that stays put holds copies of the photos, hidden from screen readers; each scene
  // keeps its own photo, which is what shows on phones, with scripts off and for less movement.
  const shots = C.editable ? [] : items.map((x, i) => [x, i]).filter(([x]) => x.picture || art(x));
  const drawn = shots.some(([x]) => !x.picture);
  const stage = shots.length > 1 ? `<div class="cb-sc-stage${drawn ? ' is-art' : ''}" aria-hidden="true">${shots.map(([x, i], k) => (x.picture ? `<img${k ? '' : ' class="is-on"'} data-i="${i}" src="${esc(imgSrc(C, x.picture.src))}"${srcsetOf(C, x.picture)} alt="" loading="lazy" decoding="async"${focusPos(x.picture) ? ` style="object-position:${focusPos(x.picture)}"` : ''}>` : `<span class="cb-sc-art${k ? '' : ' is-on'}" data-i="${i}">${art(x)}</span>`)).join('')}<span class="cb-sc-count"></span><span class="cb-sc-ticks">${items.map(() => '<i></i>').join('')}</span></div>` : '';
  return `${HEAD(C, b, d)}<div class="cb-sc cb-sc-${v}${stage ? ' has-stage' : ''}"${stage ? ` data-pin style="--n:${items.length}"` : ''}>${stage}${list}</div>`;
};

R_.spacer = (C, b) => (b.variant === 'ornament' ? '<p class="cb-ornament" aria-hidden="true"><span></span><span></span><span></span></p>' : b.variant === 'line' ? '<hr>' : '');

// ---- Your services (round C) ------------------------------------------------------------------
// A card in a booking strip, services, ways to pay, menu board or tiles section may be linked to a
// service in Your services (site.json professional.services) by its id (`service`), or, as a summary
// card, to several (`services`). The card takes its name, length, price and links from the list;
// everything else (description, photo, what is included, small print, its own page link) stays the
// card's. A section's cards stay its own, in its own order, and may mix linked and typed cards.
// A service is known by its id, or else by "n" and its place in the list (a list written before ids):
// the Book link and the Appointments page are made from the same list in the same build.
export { serviceKey };
export const serviceChoiceKey = (key) => `book-svc-${keyPart(key)}`;
export function servicesOf(biz) {
  const m = new Map();
  (biz?.services || []).forEach((s, i) => { const key = serviceKey(s, i); if (!m.has(key)) m.set(key, { ...s, key }); });
  return m;
}
// "From £35" from "£35"; the amount in a price, for the lowest of several.
const fromless = (p) => String(p || '').replace(/^\s*from\s+/i, '').trim();
// A plain price: an amount with at most a currency sign before it ("£35", "From £35", "35"), as
// { cur, n, text }; anything else ("Two for £50", "Ask") is null (round C build review, minor 3).
const plainPrice = (p) => { const m = /^([£$€]?)\s?(\d[\d,]*(?:\.\d+)?)$/.exec(fromless(p)); return m ? { cur: m[1], n: parseFloat(m[2].replace(/,/g, '')), text: fromless(p) } : null; };
// A length's unit, so "30 mins" and "60 min" read as one: 'min' or 'hour', else the word itself.
const unitWord = (u) => (/^min/i.test(u) ? 'min' : /^(h|hr|hrs|hour|hours)$/i.test(u) ? 'hour' : u.toLowerCase());
// "30 min", "60 min", "90 min" → "30 to 90 min"; one length → that length; mixed units → ''.
function lengthRange(list) {
  const ls = list.map((s) => String(s.duration || '').trim()).filter(Boolean);
  if (!ls.length) return '';
  if (ls.every((l) => l === ls[0])) return ls[0];
  const parts = ls.map((l) => /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(l));
  if (parts.some((x) => !x) || parts.some((x) => unitWord(x[2]) !== unitWord(parts[0][2]))) return '';
  const ns = parts.map((x) => parseFloat(x[1]));
  return `${Math.min(...ns)} to ${Math.max(...ns)} ${parts[0][2]}`;
}
// A Stripe payment link with the service's promotion code put in, as the standard pages do.
function promoHref(href, code) {
  if (!code) return href;
  try { const u = new URL(href); if (u.hostname === 'buy.stripe.com') u.searchParams.set('prefilled_promo_code', code); return u.href; } catch { return href; }
}
// A length as a card's heading, written out: "60 min" → "60 minutes", "1 hr" → "1 hour".
export const lengthHeading = (d) => String(d || '').replace(/^(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)$/i, (m, n) => `${n} minute${+n === 1 ? '' : 's'}`).replace(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)$/i, (m, n) => `${n} hour${+n === 1 ? '' : 's'}`);
const fieldMax = (type, k) => BLOCK_TYPES[type]?.fields?.items?.item?.[k]?.max || 200;
// The section as drawn: its linked cards filled in from the list. `_svcFields[n]` names the values
// card n takes from the list (the editor opens the service for those), `_svcKey` its booking key.
export function linkServices(b, C) {
  const items = b?.data?.items;
  if (!SERVICE_TYPES.includes(b?.type) || !Array.isArray(items) || !items.some((x) => x && (x.service || x.services?.length))) return b;
  const list = servicesOf(C.biz), take = SERVICE_FIELDS[b.type], fields = [];
  // `_cut` on a card names the words longer than the section shows, as built ("From £35", a
  // heading with its length), for the app's note (round C2 re-review, minor 5).
  let cuts = [];
  const line = (k, v) => { const t = cleanLine(v, fieldMax(b.type, k)); if (cleanLine(v, 4000).length > t.length) cuts.push({ field: k, max: fieldMax(b.type, k) }); return t; };
  // Ways to pay: when every linked card is one service in several lengths, the length is the
  // card's heading, as the samples have it ("30 minutes", "60 minutes", "90 minutes").
  const singles = items.filter((x) => x?.service && list.has(x.service)).map((x) => list.get(x.service));
  const byLength = b.type === 'plans' && singles.length > 1 && singles.every((s) => s.name === singles[0].name && s.duration) && new Set(singles.map((s) => s.duration)).size === singles.length;
  const out = [];
  items.forEach((x) => {
    if (!x || !(x.service || x.services?.length)) { out.push(x); fields.push(null); return; }
    const many = (x.services?.length ? x.services : [x.service]).map((k) => list.get(k)).filter(Boolean);
    if (!many.length) {
      if (C.editable) { out.push({ ...x, name: 'This card’s service was removed from Your services.' }); fields.push(new Set(['name'])); }
      return;
    }
    const y = { ...x }, svc = many[0], summary = !!x.services?.length;
    cuts = [];
    const set = new Set(take.filter((k) => k !== 'link'));
    if (summary) {
      // Its name: the services' one name, else the card's own, else the first service's (round C
      // build review S2), so a renamed service never leaves the card without a heading.
      const names = new Set(many.map((s) => s.name));
      if (names.size === 1) y.name = line('name', svc.name);
      else if (x.name) set.delete('name');
      else y.name = line('name', svc.name);
      if (x.lengthShows !== 'hidden') y.duration = line('duration', lengthRange(many));
      // "From" from the lowest plain amount, all in one currency; otherwise the card's own words.
      const prices = many.map((s) => plainPrice(s.price));
      if (prices.every(Boolean) && new Set(prices.map((p) => p.cur)).size === 1) {
        const low = prices.reduce((a, z) => (z.n < a.n ? z : a));
        y.price = line('price', many.length > 1 ? `From ${low.text}` : many[0].price);
      } else if (x.price) set.delete('price');
      else {
        // No price can be worked out ("Ask", "£35 per session"): the card shows none, and `_noPrice`
        // lets the app say so (round C2 re-review, minor 10).
        delete y.price;
        if (many.some((s) => s.price)) y._noPrice = true;
      }
      for (const k of ['pay', 'paid', 'act', 'manage']) set.delete(k);
    } else {
      // The length shows in its own place, in the heading ("Sports massage, 30 minutes") or not at
      // all, as the card chooses (round C build review S6: the samples keep their look). A ways-to-pay
      // section of one service in several lengths shows the length as the heading.
      const shows = x.lengthShows;
      y.name = line('name', shows === 'heading' && svc.duration ? `${svc.name}, ${lengthHeading(svc.duration)}` : byLength && shows !== 'hidden' && shows !== 'heading' ? lengthHeading(svc.duration) : svc.name);
      if (take.includes('duration')) { if (shows === 'heading' || shows === 'hidden') delete y.duration; else y.duration = line('duration', svc.duration); }
      y.price = line('price', svc.price);
      if (take.includes('pay')) {
        if (svc.paymentTyped) y.pay = { label: cleanLine(svc.payLabel || x.pay?.label || 'Pay now', 60), href: promoHref(svc.paymentTyped, svc.promoCode) };
        else if (x.pay?.label) y.pay = { label: x.pay.label }; else delete y.pay;
      }
      if (take.includes('paid')) { if (svc.paid) y.paid = true; else delete y.paid; }
      if (take.includes('act')) { if (svc.act) y.act = svc.act; else delete y.act; }
      if (take.includes('manage')) { if (svc.manage) y.manage = { label: x.manage?.label || 'Manage your membership', href: svc.manage }; else if (x.manage?.label) y.manage = { label: x.manage.label }; else delete y.manage; }
      // The booking link (round C review P1): a booking strip choice books the service; any other card
      // keeps its own link and words, and only a Book that goes to the booking takes the service's own.
      if (take.includes('link')) {
        if (svc.bookingTyped) { y.link = { label: x.link?.label || 'Book', href: svc.bookingTyped }; set.add('link'); } else delete y.link;
      } else if (x.link?.href === '@booking' && svc.bookingTyped) y.link = { ...x.link, href: svc.bookingTyped };
      if (y.link?.href && y.link.href === svc.bookingTyped) { y._svcKey = svc.key; y._svcLink = svc.bookingTyped; }
    }
    for (const k of Object.keys(y)) if (y[k] === '' || y[k] === undefined) delete y[k];
    if (cuts.length) y._cut = cuts;
    out.push(y); fields.push(set);
  });
  return { ...b, data: { ...b.data, items: out }, _svcFields: fields };
}
// The services a visitor can book on the Appointments page with their own calendar: every service
// in the list with its own Cal.com or Google booking link. → [{ key, name, link, target, paid }]
export function serviceChoices(site) {
  const biz = professionalDetails(site?.professional || {});
  return [...servicesOf(biz).values()].map((s) => ({ key: serviceChoiceKey(s.key), name: [s.name, s.duration].filter(Boolean).join(', '), link: s.bookingTyped || '', target: choiceTarget(s.bookingTyped || ''), paid: !!s.paid })).filter((c) => c.target);
}
for (const t of SERVICE_TYPES) { const draw = R_[t]; R_[t] = (C, b) => draw(C, linkServices(b, C)); }

function renderBlock(b, C) {
  const inner = R_[b.type](C, b);
  if (!inner && !C.editable) return '';
  const s = b.style;
  const frame = heroFrame(C, b);
  const cls = `cb${b.id === C.heroId ? ' cb-opening' : ''} cb-t-${b.type} cb-${b.type}--${frame} cb-bg-${s.bg} cb-w-${s.width} cb-sp-${s.space} cb-al-${s.align}${b.type === 'spacer' ? ` cb-size-${choiceValue('spacer', b.data, 'size')}` : ''}${b.type === 'notice' && b.variant === 'help' ? ' cb-still' : ''}`;
  const backdrop = s.bg === 'picture' && b.data.backdrop ? `<img class="cb-backdrop" src="${esc(imgSrc(C, b.data.backdrop.src))}"${srcsetOf(C, b.data.backdrop)} alt="" loading="lazy"${ED(C, 'data-cb-img', `${b.id}:backdrop`)}>${credit(b.data.backdrop, 'cb-credit cb-backdrop-credit')}` : '';
  // The chosen backdrop moves behind the page's opening, and more quietly behind a coloured call to action.
  let moving = '';
  if (C.backdrop && b.id === C.heroId && !['photo-behind', 'inset', 'open'].includes(frame) && s.bg !== 'picture') moving = backdropHtml(C.backdrop);
  else if (C.backdrop && C.backdrop !== 'dawn' && b.type === 'cta' && ['accent', 'dark'].includes(s.bg)) moving = backdropHtml(C.backdrop, ' cbm-bd-echo');
  // The help card is where an opening's help line goes (#help-now).
  const anchor = !C.editable && C.helpId && b.id === C.helpId ? ' id="help-now"' : !C.editable && b.type === 'spaces' ? ` id="dates-${esc(b.id)}"` : '';
  // A Thank you page's opening: one quiet line to the dated classes, when the website has some.
  const datesLine = b.role === 'thanks' && b.type === 'hero' && /^(?:\/|https:)[^\s"<>]*$/.test(C.datesHref || '') ? `<p class="cb-cal-line"><a class="cb-link" href="${esc(C.datesHref)}">Booked a date with us? Add it to your calendar</a></p>` : '';
  // A guide beside a section that plays a known part, in the editor only.
  const guide = C.editable && Object.hasOwn(ROLE_GUIDES, b.role) ? `<p class="cb-note cb-role-guide" data-cb-hint>${esc(ROLE_GUIDES[b.role](C, b))}</p>` : '';
  return `<section class="${cls}"${anchor}${ED(C, 'data-cb-block', b.id)}>${backdrop}${moving}<div class="cb-in">${inner}${datesLine}${guide}</div></section>`;
}
export { renderBlock as _renderBlock };
