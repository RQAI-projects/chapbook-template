// Page builder: turns a page (see schema.mjs) into HTML. The website build and Chapbook's editor
// both call renderPage(), so the editor shows exactly what will be published.
// Everything a writer types is escaped. Rich text allows only paragraphs, **bold**, *italic*,
// [links](…) and "- " lists. With { editable: true } every value carries a data-cb marker the
// editor uses for click-to-edit; published HTML has none.
import { normalisePage, BLOCK_TYPES, cleanHref, cleanHex, videoEmbed, INTERACTIVE_SRC, bookingTarget, MOTION, HERO_PHOTO_ROOM } from './schema.mjs';
import { professionalDetails, telHref } from '../professional.mjs';

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
  }
  if (look.font && PAGE_FONTS[look.font]) v.push(`--cb-heading-font:${PAGE_FONTS[look.font].css}`);
  if (look.bodyFont && PAGE_BODY_FONTS[look.bodyFont]) v.push(`--cb-body-font:${PAGE_BODY_FONTS[look.bodyFont].css}`);
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
  const C = { ...ctx, page, biz, editable: !!ctx.editable, h1Done: false, turns: turnColours(pageColours(page.look, ctx.base)) };
  // Every page gets one h1: the first heading that will really appear (an opening first).
  const shows = (b) => {
    if (!b.data.heading) return false;
    if (b.type === 'posts') return C.editable || (C.posts || []).length > 0;
    if (b.type === 'form') return C.editable || !!formEndpointOf(C) || !!biz.email;
    if (b.type === 'booking') return C.editable || !!bookingTarget(b.data.useSite !== false && !b.data.url ? biz.bookingUrl : b.data.url) || !!biz.phone || !!biz.email;
    return true;
  };
  const flat = page.blocks.flatMap((b) => (b.type === 'columns' ? b.data.children || [] : [b]));
  C.h1Id = (flat.find((b) => b.type === 'hero' && shows(b)) || flat.find(shows))?.id;
  // Movement (see MOTION in schema.mjs). The page's first opening carries the backdrop.
  const m = page.look.motion || null;
  C.backdrop = m?.backdrop || '';
  C.heroId = page.blocks.find((b) => b.type === 'hero')?.id;
  const blocks = page.blocks.map((b) => renderBlock(b, C)).join('');
  return `<style>${pageCss(page, ctx.base)}</style><div class="cbp${m ? ' cbm' : ''}${page.look.font ? ` cbp-font cbp-hf-${page.look.font}` : ''}${page.look.bodyFont ? ' cbp-bodyfont' : ''}" data-page="${esc(page.slug)}"${motionAttrs(m)}${C.editable ? ' data-m-edit' : ''}>${blocks}</div>`;
}

// The page's movement choices as data-m-* attributes; motion.css and page-motion.js read them.
export function motionAttrs(m) {
  if (!m) return '';
  return ['scroll', 'heading', 'buttons', 'pictures', 'opening', 'pace'].filter((k) => m[k] && Object.hasOwn(MOTION[k].options, m[k])).map((k) => ` data-m-${k}="${m[k]}"`).join('') + (m.count ? ' data-m-count' : '');
}
// Moving shapes behind a block. Pure decoration: empty elements that the stylesheet arranges and
// animates in the page's own colours, hidden from screen readers.
const BACKDROP_PARTS = { globe: 0, ring: 0, terrain: 0, aurora: 4, bubbles: 12, blobs: 3, waves: 3, orbits: 4, grid: 2, dots: 2, rays: 2, shapes: 12, lines: 9, ripples: 5, petals: 14, stars: 6, spotlight: 2, wash: 1, grain: 1 };
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
  if (!value) return C.editable ? `<${tag}${c}${attrs}${ED(C, 'data-cb', `${b.id}:${path}`)}${PH(C, b, path)}></${tag}>` : '';
  return `<${tag}${c}${attrs}${ED(C, 'data-cb', `${b.id}:${path}`)}>${esc(value)}</${tag}>`;
}
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
function P(C, b, path, p, cls = '', { eager = false, credits = true } = {}) {
  if (!p) return C.editable ? `<div class="cb-pic-empty ${cls}"${ED(C, 'data-cb-img', `${b.id}:${path}`)} role="img" aria-label="Add a picture"><span>Add a picture</span></div>` : '';
  const focus = p.focus ? ` style="object-position:${p.focus === 'top' ? '50% 20%' : p.focus === 'bottom' ? '50% 80%' : p.focus === 'left' ? '20% 50%' : '80% 50%'}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(imgSrc(C, p.src))}" alt="${esc(p.alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${focus}${ED(C, 'data-cb-img', `${b.id}:${path}`)}>${credits ? credit(p) : ''}`;
}
// A button or link. Hidden on the published page when it has nowhere to go.
function BTN(C, b, path, link, cls = 'cb-btn') {
  const href = link?.href ? resolveLink(link.href, C) : '';
  const label = link?.label || '';
  if ((!href || !label) && !C.editable) return '';
  const needs = C.editable && (!href || !label) ? ' data-cb-incomplete' : '';
  return `<a class="${cls}" href="${esc(href || '#')}"${ED(C, 'data-cb-link', `${b.id}:${path}`)}${needs}>${esc(label || 'Button')}</a>`;
}
function BTNS(C, b, buttons = [], cls = 'cb-actions') {
  const out = buttons.map((l, i) => BTN(C, b, `buttons.${i}`, l, i ? 'cb-btn cb-btn-2' : 'cb-btn')).join('');
  const add = C.editable && buttons.length < 2 ? `<button type="button" class="cb-add-btn" data-cb-add="${esc(b.id)}:buttons">Add a button</button>` : '';
  return out || add ? `<div class="${cls}">${out}${add}</div>` : '';
}
// A repeating list. Each item carries its own marker so the editor can move or remove it.
function LIST(C, b, key, items, each, tag = 'div', cls = '') {
  const body = items.map((it, i) => each(it, i, (inner, itag = 'article', icls = '') => `<${itag}${icls ? ` class="${icls}"` : ''}${ED(C, 'data-cb-item', `${b.id}:${key}.${i}`)}>${inner}</${itag}>`)).join('');
  if (!body && !C.editable) return '';
  return `<${tag} class="${cls}"${ED(C, 'data-cb-list', `${b.id}:${key}`)}>${body}</${tag}>`;
}
const K = (C, b, d) => T(C, b, 'kicker', d.kicker, 'p', 'cb-kicker');
const hTag = (C, b, tag = 'h2') => { if (b.id === C.h1Id && !C.h1Done) { C.h1Done = true; return 'h1'; } return tag; };
function H(C, b, d, tag = 'h2', cls = 'cb-h', attrs = '') {
  return T(C, b, 'heading', d.heading, hTag(C, b, tag), cls, attrs);
}

function bizDetails(C, d, own = false) {
  const biz = C.biz;
  if (own) return { address: d.address || '', hours: d.hours || '', phone: d.phone || '', email: d.email || '' };
  return { address: biz.location, hours: biz.hours, phone: biz.phone, email: biz.email };
}
// The facts list used by contact blocks and the hero's details panel.
function factsList(C, b, d, { own = false, cls = 'cb-facts' } = {}) {
  const f = bizDetails(C, d, own);
  const row = (label, key, html) => (html ? `<div><dt>${label}</dt><dd>${html}</dd></div>` : '');
  const val = (key, html, isPlain) => {
    if (own) {
      if (!f[key] && !C.editable) return '';
      return isPlain ? PL(C, b, key, f[key]) : T(C, b, key, f[key], 'span');
    }
    return html;
  };
  const tel = f.phone ? `tel:${String(f.phone).replace(/[^+\d]/g, '')}` : '';
  const html = [
    row('Address', 'address', val('address', f.address ? `<p>${plain(f.address)}</p>` : '', true)),
    row('Opening hours', 'hours', val('hours', f.hours ? `<p class="cb-hours">${plain(f.hours)}</p>` : '', true)),
    row('Phone', 'phone', own ? (f.phone && !C.editable ? `<a href="${esc(tel)}">${esc(f.phone)}</a>` : val('phone')) : (tel ? `<a href="${esc(tel)}">${esc(f.phone)}</a>` : '')),
    row('Email', 'email', own ? (f.email && !C.editable ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : val('email')) : (f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : '')),
  ].join('');
  if (!html) return C.editable && !own ? `<p class="cb-note" data-cb-hint>Your address, hours, phone and email from Site settings appear here.</p>` : '';
  return `<dl class="${cls}">${html}</dl>`;
}

// ---- blocks --------------------------------------------------------------------------------
const R_ = {};

// A video in the opening. Behind the words it plays silently on a loop (with a pause button, and
// paused for people who ask for less motion); elsewhere it has the usual controls. The picture is
// its poster. YouTube and Vimeo can't sit behind words, so they show as a player instead.
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

R_.hero = (C, b) => {
  const d = b.data, v = b.variant;
  // Two openings draw the heading their own way, so the shared one must not be made for them
  // (making it would use up the page's one h1).
  const ownHeading = v === 'marquee' || v === 'mask' || v === 'wordmark' || v === 'open';
  const head = ownHeading ? '' : `${K(C, b, d)}${heroHeading(C, b, d)}`;
  const intro = RT(C, b, 'intro', d.intro, 'cb-rich cb-lead');
  const btns = BTNS(C, b, d.buttons);
  const words = `${head}${intro}${btns}`;
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
    return `${K(C, b, d)}${H(C, b, d, 'h2', `cb-h cb-hero-h cb-wordmark${fit ? '' : ' cb-wordmark-long'}`, fit)}<div class="cb-wm-foot"><div class="cb-wm-words">${intro}${btns}${details}</div>${media ? pic('cb-hero-pic cb-wm-pic') : ''}</div>`;
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
    else ring = `<div class="cb-car" style="--n:${all.length}"><div class="cb-car-ring">${all.map((p, i) => `<figure style="--i:${i}"><img src="${esc(imgSrc(C, p.src))}" alt="${esc(p.alt)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`).join('')}</div></div>`;
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
    const word = T(C, b, 'word', d.word, 'p', 'cb-bw-word', ` style="--len:${Math.max(4, Array.from(d.word || '').length)}"`);
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
      const tile = (p, hidden) => `<figure${hidden ? ' aria-hidden="true"' : ''}><img src="${esc(imgSrc(C, p.src))}" alt="${hidden ? '' : esc(p.alt)}" loading="lazy" decoding="async"></figure>`;
      const n = Math.max(2, Math.ceil(8 / all.length));
      const row = (list, firstReal) => { let out = ''; for (let k = 0; k < n * 2; k++) out += list.map((p) => tile(p, !(firstReal && k === 0))).join(''); return out; };
      film = `<div class="cb-film" style="--mq-dur:${all.length * n * 7}s"><div class="cb-film-row">${row(all, true)}</div><div class="cb-film-row cb-film-rev">${row([...all].reverse(), false)}</div></div>`;
    }
    return `<div class="cb-hero-words">${words}${details}</div>${film}${all.length < 2 && !C.editable ? '' : creditsOf(all)}`;
  }
  if (v === 'bento') {
    const info = d.details ? factsList(C, b, d, { cls: 'cb-facts' }) : '';
    const tiles = `${more.length || C.editable ? morePics(C, b, d, 'cb-bento-more', 'cb-bento-tile cb-bento-pic') : ''}${info ? `<div class="cb-bento-tile cb-bento-info">${info}</div>` : ''}`;
    return `<div class="cb-bento"><div class="cb-bento-top"><div class="cb-bento-tile cb-bento-words">${words}</div>${media ? `<figure class="cb-bento-tile cb-bento-pic cb-bento-main">${d.video ? heroVideo(C, b, d, false) : P(C, b, 'picture', d.picture, '', { eager: true, credits: false })}</figure>` : ''}</div>${tiles ? `<div class="cb-bento-row">${tiles}</div>` : ''}</div>${creditsOf([d.picture, ...shownMore(b, d)])}`;
  }
  if (v === 'curtain') return `<div class="cb-curtain"><div class="cb-curtain-words"><div class="cb-hero-words">${words}${details}</div></div>${media ? pic('cb-hero-pic cb-curtain-pic') : ''}</div>`;
  return `<div class="cb-hero-words">${words}${details}</div>`; // minimal
};

R_.text = (C, b) => {
  const d = b.data, v = b.variant;
  const head = `${K(C, b, d)}${H(C, b, d)}`;
  const body = `${RT(C, b, 'body', d.body)}${BTNS(C, b, d.buttons)}`;
  if (v === 'sidehead') return `<div class="cb-side"><div class="cb-side-head">${head}</div><div>${body}</div></div>`;
  if (v === 'picture-left' || v === 'picture-right') return `<div class="cb-pic-text"><figure class="cb-pic-frame">${P(C, b, 'picture', d.picture)}</figure><div>${head}${body}</div></div>`;
  // Large words that go from faint to full colour as the reader scrolls past them.
  if (v === 'lit') return `${head}${RT(C, b, 'body', d.body, 'cb-rich cb-lit')}${BTNS(C, b, d.buttons)}`;
  return `${head}${body}`;
};

R_.image = (C, b) => {
  const d = b.data;
  const cap = T(C, b, 'caption', d.caption, 'span', 'cb-cap');
  return `<figure class="cb-figure">${P(C, b, 'picture', d.picture, '', { credits: false })}${cap || credit(d.picture) ? `<figcaption>${cap}${credit(d.picture)}</figcaption>` : ''}</figure>`;
};

R_.gallery = (C, b) => {
  const d = b.data, pics = d.pictures || [];
  const tile = (p, i) => (p.video
    ? `<video src="${esc(imgSrc(C, p.video))}" poster="${esc(imgSrc(C, p.src))}" controls playsinline preload="none" aria-label="${esc(p.alt || 'Video')}"${ED(C, 'data-cb-video', `${b.id}:pictures.${i}.video`)}></video>`
    : P(C, b, `pictures.${i}`, p, '', { credits: false }));
  const head = `<div class="cb-head">${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>`;
  // A reel that rolls by itself. The copies that make the loop are hidden from screen readers.
  if (b.variant === 'reel' && !C.editable && pics.length > 1) {
    const one = (p, hidden) => `<figure${hidden ? ' aria-hidden="true"' : ''}>${p.video ? `<video src="${esc(imgSrc(C, p.video))}" poster="${esc(imgSrc(C, p.src))}" muted loop playsinline preload="none"${hidden ? ' tabindex="-1"' : ' controls'} aria-label="${esc(p.alt || 'Video')}"></video>` : `<img src="${esc(imgSrc(C, p.src))}" alt="${hidden ? '' : esc(p.alt)}" loading="lazy" decoding="async">`}</figure>`;
    const sets = Math.max(2, Math.ceil(9 / pics.length) + 1);
    let track = pics.map((p) => one(p, false)).join('');
    for (let k = 1; k < sets; k++) track += pics.map((p) => one(p, true)).join('');
    return `${head}<div class="cb-mq cb-mq-pics" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${pics.length * 6}s"><div class="cb-mq-track">${track}</div></div>${creditsOf(pics)}`;
  }
  const list = LIST(C, b, 'pictures', pics, (p, i, wrap) => wrap(`${tile(p, i)}${p.alt || credit(p) ? `<figcaption>${credit(p)}</figcaption>` : ''}`, 'figure'), 'div', 'cb-gallery');
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
  const book = s.link ? BTN(C, b, `items.${i}.link`, s.link, 'cb-link') : '';
  const pay = s.pay ? BTN(C, b, `items.${i}.pay`, s.pay, 'cb-btn cb-btn-small') : '';
  return book || pay ? `<p class="cb-svc-links">${book}${pay}</p>` : '';
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
  else if (v === 'numbered') list = LIST(C, b, 'items', items, (s, i, w) => w(`<span class="cb-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div>${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div><p class="cb-meta">${price(s, i)}${time(s, i)}</p>`), 'ol', 'cb-svc cb-svc-numbered');
  else if (v === 'table') list = LIST(C, b, 'items', items, (s, i, w) => w(`<div>${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div>${time(s, i)}${price(s, i)}`, 'div'), 'div', 'cb-svc cb-svc-table');
  else if (v === 'rows') list = LIST(C, b, 'items', items, (s, i, w) => focusable(C, s.picture, w(`<span class="cb-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="cb-row-main">${name(s, i)}${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div><p class="cb-meta">${time(s, i)}${price(s, i)}</p>${pic(s, i, 'cb-row-pic')}`)), 'div', 'cb-svc cb-svc-rows');
  else if (v === 'flip') list = LIST(C, b, 'items', items, (s, i, w) => {
    // The front shows the photo, name and price; the back the details. It turns when pointed at
    // or focused (so a tap or the Tab key turns it too). In the editor both sides lie flat.
    const card = w(`<div class="cb-flip-in"><div class="cb-flip-front">${pic(s, i)}<div class="cb-card-body">${name(s, i)}<p class="cb-meta">${time(s, i)}${price(s, i)}</p></div></div><div class="cb-flip-back">${desc(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}</div></div>`);
    return C.editable ? card : card.replace(/^<article/, '<article tabindex="0"');
  }, 'div', 'cb-svc cb-svc-flip');
  else if (v === 'board') list = LIST(C, b, 'items', items, (s, i, w) => w(`<div class="cb-menu-line">${name(s, i)}<i aria-hidden="true"></i>${price(s, i)}</div>${desc(s, i)}${time(s, i)}${offer(s, i)}${serviceLinks(C, b, i, s)}`), 'div', 'cb-svc cb-svc-board');
  else list = LIST(C, b, 'items', items, (s, i, w) => w(`<figure class="cb-svc-pic">${P(C, b, `items.${i}.picture`, s.picture)}</figure><div class="cb-feature-body">${name(s, i)}${desc(s, i)}<p class="cb-meta">${time(s, i)}${price(s, i)}</p>${offer(s, i)}${serviceLinks(C, b, i, s)}</div>`), 'div', 'cb-svc cb-svc-feature');
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${list}`;
};

R_.team = (C, b) => {
  const d = b.data, v = b.variant, items = d.items || [];
  // No photo yet: a tile with the person's initials, so the team still looks finished.
  const face = (p, i) => (p.picture ? P(C, b, `items.${i}.picture`, p.picture) : `<span class="cb-initials"${ED(C, 'data-cb-img', `${b.id}:items.${i}.picture`)} aria-hidden="true">${esc(initials(p.name))}</span>`);
  const one = (p, i, w) => w(`<figure class="cb-portrait">${face(p, i)}</figure><div class="cb-person">${T(C, b, `items.${i}.name`, p.name, 'h3', 'cb-person-name')}${T(C, b, `items.${i}.role`, p.role, 'p', 'cb-person-role')}${RT(C, b, `items.${i}.bio`, p.bio, 'cb-rich cb-bio')}${p.link ? BTN(C, b, `items.${i}.link`, p.link, 'cb-link') : ''}</div>`);
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${LIST(C, b, 'items', items, one, 'div', `cb-team cb-team-${v}`)}`;
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
  return `${head}${LIST(C, b, 'items', items, one, 'div', `cb-reviews cb-reviews-${b.variant === 'ticker' ? 'cards' : b.variant}`)}${more}`;
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
  const head = `${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}`;
  const acts = `${d.business ? socials(C) : ''}${BTNS(C, b, d.buttons)}${map ? `<p class="cb-map">${map}</p>` : ''}`;
  if (!facts && !d.heading && !d.intro && !(d.buttons || []).length && !C.editable) return '';
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
  const words = `${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'body', d.body)}`;
  if (b.variant === 'split') return `<div class="cb-cta-split"><div>${words}</div>${BTNS(C, b, d.buttons)}</div>`;
  if (b.variant === 'card') return `<div class="cb-cta-card">${words}${BTNS(C, b, d.buttons)}</div>`;
  if (b.variant === 'giant') return `${K(C, b, d)}${H(C, b, d, 'h2', 'cb-h cb-giant-h')}<div class="cb-giant-foot">${RT(C, b, 'body', d.body)}${BTNS(C, b, d.buttons)}</div>`;
  return `${words}${BTNS(C, b, d.buttons)}`;
};

const formEndpointOf = (C) => (typeof C.formEndpoint === 'string' && /^https:\/\//.test(C.formEndpoint) && !C.formEndpoint.includes('/your-id') ? C.formEndpoint : '');
R_.form = (C, b) => {
  const d = b.data;
  const ep = formEndpointOf(C);
  const words = `${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}`;
  if (!ep && !C.editable) {
    // No form service yet: offer the email address instead, if there is one.
    const email = C.biz.email ? `<p><a class="cb-btn" href="mailto:${esc(C.biz.email)}">Email ${esc(C.biz.email)}</a></p>` : '';
    return email ? `${words}${email}` : '';
  }
  const uid = esc(b.id);
  const fields = `<label for="n-${uid}">Name</label><input id="n-${uid}" name="name" type="text" required autocomplete="name"${C.editable ? ' tabindex="-1"' : ''}>`
    + `<label for="e-${uid}">Email</label><input id="e-${uid}" name="email" type="email" required autocomplete="email"${C.editable ? ' tabindex="-1"' : ''}>`
    + `<label for="m-${uid}">Message</label><textarea id="m-${uid}" name="message" rows="5" required${C.editable ? ' tabindex="-1"' : ''}></textarea>`;
  const btn = C.editable ? T(C, b, 'button', d.button || 'Send message', 'span', 'cb-btn') : `<button class="cb-btn" type="submit">${esc(d.button || 'Send message')}</button>`;
  const note = T(C, b, 'note', d.note, 'p', 'cb-small');
  const warn = !ep && C.editable ? `<p class="cb-note" data-cb-hint>This form isn't connected yet. Add a form address in Site settings, under Contact form.</p>` : '';
  const status = C.editable ? '' : '<p class="cb-form-status" role="status" aria-live="polite" hidden></p>';
  const form = `<form class="cb-form" method="POST" action="${esc(ep || '#')}">${fields}${btn}${note}</form>${status}${warn}`;
  return b.variant === 'split' ? `<div class="cb-side"><div class="cb-side-head">${words}</div><div>${form}</div></div>` : `${words}${form}`;
};

R_.posts = (C, b) => {
  const d = b.data, n = d.count || 3, posts = (C.posts || []).slice(0, n);
  if (!posts.length && !C.editable) return '';
  const more = `<a class="cb-link" href="${esc(C.postsHref || (C.href ? C.href('/posts/') : '/posts/'))}"${ED(C, 'data-cb', `${b.id}:more`)}>${esc(d.more || 'All posts')}</a>`;
  const list = posts.length
    ? posts.map((p, i) => `<a class="cb-post${i === 0 && b.variant === 'feature' ? ' cb-post-lead' : ''}" href="${esc(p.href)}">${p.image && (b.variant !== 'list') ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}<span class="cb-post-date">${esc(p.dateLabel || '')}</span><h3>${esc(p.title)}</h3>${p.description && b.variant !== 'list' ? `<p>${esc(p.description)}</p>` : ''}</a>`).join('')
    : `<p class="cb-note" data-cb-hint>Your newest posts appear here.</p>`;
  return `<div class="cb-head cb-head-row">${H(C, b, d)}${more}</div><div class="cb-posts cb-posts-${b.variant}">${list}</div>`;
};

R_.credentials = (C, b) => {
  const d = b.data;
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>${LIST(C, b, 'items', d.items || [], (x, i, w) => w(T(C, b, `items.${i}.text`, x.text, 'span'), 'li'), 'ul', `cb-creds cb-creds-${b.variant}`)}`;
};

R_.facts = (C, b) => {
  const d = b.data;
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>${LIST(C, b, 'items', d.items || [], (x, i, w) => w(`${T(C, b, `items.${i}.value`, x.value, 'span', 'cb-fact-value')}${T(C, b, `items.${i}.label`, x.label, 'span', 'cb-fact-label')}`, 'div', 'cb-fact'), 'div', `cb-factlist cb-factlist-${b.variant}`)}`;
};

R_.notice = (C, b) => {
  const d = b.data;
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
    if (C.editable) return `${head}<div class="cb-booking-hold" data-cb-hint><p>Add your booking link in Site settings, or paste one in this block’s settings. Cal.com is free and links to Gmail, Outlook or Apple calendars.</p></div>`;
    // No booking page yet: offer the phone or email instead, if there is one.
    const alt = C.biz.phone ? `<a class="cb-btn" href="${esc(telHref(C.biz))}">Call ${esc(C.biz.phone)}</a>` : C.biz.email ? `<a class="cb-btn" href="mailto:${esc(C.biz.email)}">Email to book</a>` : '';
    return alt ? `${head}<div class="cb-actions">${alt}</div>` : '';
  }
  const button = C.editable ? T(C, b, 'button', label, 'span', 'cb-btn') : `<a class="cb-btn" href="${esc(t.href)}" rel="noopener">${esc(label)}</a>`;
  if (b.variant === 'button' || t.kind === 'link') return `${head}<div class="cb-booking-card"><div class="cb-actions">${button}</div>${note}</div>`;
  const where = t.provider;
  const panel = C.editable
    ? `<div class="cb-booking-hold" data-cb-hint><p>Your ${esc(where)} calendar appears here on your website when a visitor taps “Show available times”.</p></div>`
    : `<div class="cb-booking-cal" data-booking-kind="${esc(t.kind)}" data-booking-src="${esc(t.kind === 'cal' ? t.calLink : t.frame)}"><button type="button" class="cb-btn cb-booking-load">Show available times</button><p class="cb-small">This loads ${esc(where)}, which handles your booking. <a href="${esc(t.href)}" rel="noopener">Open it in a new page instead</a>.</p><p class="cb-booking-status" role="status" aria-live="polite"></p><div class="cb-booking-frame" hidden></div></div>`;
  return `${head}${panel}${note}`;
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
  const dur = Math.round(clamp(chars * (v === 'tags' ? 0.28 : 0.5), 8, 90) * ({ s: 1.7, m: 1, l: 0.6 }[d.speed] || 1));
  const set = (hidden) => `<span class="cb-mq-set"${hidden ? ' aria-hidden="true"' : ''}>${text.map((t) => `<span class="cb-mq-item">${esc(t)}</span>`).join('')}</span>`;
  const row = (second) => `<div class="cb-mq${second ? ' cb-mq-rev' : ''}" style="--mq-shift:${(-100 / sets).toFixed(4)}%;--mq-dur:${dur}s"><div class="cb-mq-track">${set(second)}${set(true).repeat(sets - 1)}</div></div>`;
  return v === 'double' ? row(false) + row(true) : row(false);
};

R_.steps = (C, b) => {
  const d = b.data, items = d.items || [];
  const one = (x, i, w) => w(`<span class="cb-step-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="cb-step-body">${T(C, b, `items.${i}.name`, x.name, 'h3', 'cb-step-name')}${RT(C, b, `items.${i}.description`, x.description, 'cb-rich cb-step-desc')}</div>`, 'li', 'cb-step');
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${LIST(C, b, 'items', items, one, 'ol', `cb-steps cb-steps-${b.variant}`)}`;
};

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

R_.spacer = (C, b) => (b.variant === 'ornament' ? '<p class="cb-ornament" aria-hidden="true"><span></span><span></span><span></span></p>' : b.variant === 'line' ? '<hr>' : '');

function renderBlock(b, C) {
  const inner = R_[b.type](C, b);
  if (!inner && !C.editable) return '';
  const s = b.style;
  const cls = `cb${b.id === C.heroId ? ' cb-opening' : ''} cb-t-${b.type} cb-${b.type}--${b.variant} cb-bg-${s.bg} cb-w-${s.width} cb-sp-${s.space} cb-al-${s.align}${b.type === 'spacer' ? ` cb-size-${b.data.size || 'm'}` : ''}`;
  const backdrop = s.bg === 'picture' && b.data.backdrop ? `<img class="cb-backdrop" src="${esc(imgSrc(C, b.data.backdrop.src))}" alt="" loading="lazy"${ED(C, 'data-cb-img', `${b.id}:backdrop`)}>${credit(b.data.backdrop, 'cb-credit cb-backdrop-credit')}` : '';
  // The chosen backdrop moves behind the page's opening, and more quietly behind a coloured call to action.
  let moving = '';
  if (C.backdrop && b.id === C.heroId && !['photo-behind', 'inset', 'open'].includes(b.variant) && s.bg !== 'picture') moving = backdropHtml(C.backdrop);
  else if (C.backdrop && b.type === 'cta' && ['accent', 'dark'].includes(s.bg)) moving = backdropHtml(C.backdrop, ' cbm-bd-echo');
  return `<section class="${cls}"${ED(C, 'data-cb-block', b.id)}>${backdrop}${moving}<div class="cb-in">${inner}</div></section>`;
}
export { renderBlock as _renderBlock };
