// Page builder: turns a page (see schema.mjs) into HTML. The website build and Chapbook's editor
// both call renderPage(), so the editor shows exactly what will be published.
// Everything a writer types is escaped. Rich text allows only paragraphs, **bold**, *italic*,
// [links](…) and "- " lists. With { editable: true } every value carries a data-cb marker the
// editor uses for click-to-edit; published HTML has none.
import { normalisePage, BLOCK_TYPES, cleanHref, cleanHex, videoEmbed, INTERACTIVE_SRC } from './schema.mjs';
import { professionalDetails, telHref } from '../professional.mjs';

export * from './schema.mjs';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- colour helpers ------------------------------------------------------------------------
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const readableOn = (hex) => { for (const c of ['#ffffff', '#16181d']) if (contrast(hex, c) >= 4.5) return c; return contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff'; };
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

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
  return {
    bg, ink, accent, surface, deep, dim, dark,
    accentText: contrast(accent, bg) >= 4.5 ? accent : (contrast(accent, surface) >= 4.5 ? accent : ink),
    onAccent: readableOn(accent), onDeep: readableOn(deep), surfaceInk: contrast(ink, surface) >= 4.5 ? ink : readableOn(surface),
  };
}
// CSS for one page: block colours always; site colours too when the page has its own palette.
// The tripled attribute outranks the theme and the site's own colour choices.
export function pageCss(page, base = {}) {
  const look = page.look || {}, k = pageColours(look, base);
  const v = [`--cb-surface:${k.surface}`, `--cb-surface-ink:${k.surfaceInk}`, `--cb-deep:${k.deep}`, `--cb-on-deep:${k.onDeep}`, `--cb-on-accent:${k.onAccent}`, `--cb-accent-text:${k.accentText}`];
  if (look.colours) {
    v.push(`--bg-0:${k.bg}`, `--bg-1:${k.bg}`, `--bg-2:${k.bg}`, `--bg-3:${mix(k.bg, k.dark ? '#ffffff' : '#000000', 0.06)}`, `--header-bg:${k.bg}`, `--pro-card:${k.bg}`,
      `--ink:${k.ink}`, `--masthead-ink:${k.ink}`, `--ink-dim:${k.dim}`, `--ink-faint:${k.dim}`, `--line:color-mix(in srgb,${k.ink} 14%,transparent)`, `--line-strong:color-mix(in srgb,${k.ink} 30%,transparent)`,
      `--accent:${k.accent}`, `--teal:${k.accent}`, `--cyan:${k.accent}`, `--violet:${k.accent}`, `--accent-text:${k.accentText}`, `--pro-button-ink:${k.onAccent}`, `--badge-ink:${k.ink}`, `--selection-bg:color-mix(in srgb,${k.accent} 30%,transparent)`,
      `color-scheme:${k.dark ? 'dark' : 'light'}`);
  }
  if (look.font && PAGE_FONTS[look.font]) v.push(`--cb-heading-font:${PAGE_FONTS[look.font].css}`);
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
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1<em>$2</em>');
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
  const h1 = page.blocks.find((b) => b.type === 'hero') || page.blocks.find((b) => b.data.heading || (b.type === 'columns' && b.data.children?.some((k) => k.data.heading)));
  const h1Id = h1?.type === 'columns' ? h1.data.children.find((k) => k.data.heading).id : h1?.id;
  const C = { ...ctx, page, biz, editable: !!ctx.editable, h1Id, h1Done: false };
  const blocks = page.blocks.map((b) => renderBlock(b, C)).join('');
  return `<style>${pageCss(page, ctx.base)}</style><div class="cbp${page.look.font ? ' cbp-font' : ''}" data-page="${esc(page.slug)}">${blocks}</div>`;
}

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
function T(C, b, path, value, tag = 'p', cls = '') {
  const c = cls ? ` class="${cls}"` : '';
  if (!value) return C.editable ? `<${tag}${c}${ED(C, 'data-cb', `${b.id}:${path}`)}${PH(C, b, path)}></${tag}>` : '';
  return `<${tag}${c}${ED(C, 'data-cb', `${b.id}:${path}`)}>${esc(value)}</${tag}>`;
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
function credit(p) {
  const cr = p?.credit;
  if (!cr || !['by', 'by-sa'].includes(cr.license)) return '';
  const who = cr.creator ? esc(cr.creator) : 'Photo';
  const lic = cr.license === 'by' ? 'CC BY' : 'CC BY-SA';
  const what = cr.page ? `<a href="${esc(cr.page)}" rel="noopener">${who}</a>` : who;
  return `<small class="cb-credit">Photo: ${what}, ${lic}</small>`;
}
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
function H(C, b, d, tag = 'h2', cls = 'cb-h') {
  if (b.id === C.h1Id && !C.h1Done) { C.h1Done = true; tag = 'h1'; }
  return T(C, b, 'heading', d.heading, tag, cls);
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

R_.hero = (C, b) => {
  const d = b.data, v = b.variant;
  const head = `${K(C, b, d)}${H(C, b, d, 'h2', 'cb-h cb-hero-h')}`;
  const intro = RT(C, b, 'intro', d.intro, 'cb-rich cb-lead');
  const btns = BTNS(C, b, d.buttons);
  const words = `${head}${intro}${btns}`;
  const details = d.details ? factsList(C, b, d, { cls: 'cb-facts cb-hero-facts' }) : '';
  const pic = (cls = 'cb-hero-pic') => (v === 'minimal' ? '' : `<figure class="${cls}">${P(C, b, 'picture', d.picture, '', { eager: true })}</figure>`);
  const band = d.picture || C.editable ? pic('cb-hero-pic cb-hero-band') : '';
  if (v === 'split') return `<div class="cb-hero-grid"><div class="cb-hero-words">${words}${details}</div>${pic()}</div>`;
  if (v === 'centred') return `<div class="cb-hero-words">${words}${details}</div>${d.picture || C.editable ? pic() : ''}`;
  if (v === 'photo-behind') return `${pic('cb-hero-bg')}<div class="cb-hero-words">${words}${details}</div>`;
  if (v === 'panel') return `<div class="cb-hero-grid"><div class="cb-hero-words">${head}${intro}</div><aside class="cb-hero-panel">${factsList(C, b, d, { cls: 'cb-facts' })}${btns}</aside></div>${band}`;
  if (v === 'poster') return `${head}<div class="cb-poster-foot">${intro}<div>${btns}${details}</div></div>${band}`;
  if (v === 'stacked') return `${pic('cb-hero-pic cb-hero-top')}<div class="cb-hero-card">${words}${details}</div>`;
  return `<div class="cb-hero-words">${words}${details}</div>`; // minimal
};

R_.text = (C, b) => {
  const d = b.data, v = b.variant;
  const head = `${K(C, b, d)}${H(C, b, d)}`;
  const body = `${RT(C, b, 'body', d.body)}${BTNS(C, b, d.buttons)}`;
  if (v === 'sidehead') return `<div class="cb-side"><div class="cb-side-head">${head}</div><div>${body}</div></div>`;
  if (v === 'picture-left' || v === 'picture-right') return `<div class="cb-pic-text"><figure class="cb-pic-frame">${P(C, b, 'picture', d.picture)}</figure><div>${head}${body}</div></div>`;
  return `${head}${body}`;
};

R_.image = (C, b) => {
  const d = b.data;
  const cap = T(C, b, 'caption', d.caption, 'span', 'cb-cap');
  return `<figure class="cb-figure">${P(C, b, 'picture', d.picture, '', { credits: false })}${cap || credit(d.picture) ? `<figcaption>${cap}${credit(d.picture)}</figcaption>` : ''}</figure>`;
};

R_.gallery = (C, b) => {
  const d = b.data, pics = d.pictures || [];
  const list = LIST(C, b, 'pictures', pics, (p, i, wrap) => wrap(`${P(C, b, `pictures.${i}`, p, '', { credits: false })}${p.alt || credit(p) ? `<figcaption>${credit(p)}</figcaption>` : ''}`, 'figure'), 'div', 'cb-gallery');
  return `<div class="cb-head">${H(C, b, d)}${RT(C, b, 'intro', d.intro, 'cb-rich cb-intro')}</div>${list}`;
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

const initials = (name) => String(name || '').replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0] || '').join('').toUpperCase() || '+';
const stars = (n) => (n ? `<p class="cb-stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</p>` : '');
R_.reviews = (C, b) => {
  const d = b.data, items = d.items || [];
  const one = (r, i, w) => w(`${stars(r.stars)}<blockquote>${RT(C, b, `items.${i}.quote`, r.quote, 'cb-rich cb-quote')}</blockquote><footer>${T(C, b, `items.${i}.name`, r.name, 'cite', 'cb-who')}${T(C, b, `items.${i}.detail`, r.detail, 'span', 'cb-who-detail')}</footer>`, 'figure', 'cb-review');
  const more = d.source ? `<p class="cb-more">${BTN(C, b, 'source', d.source, 'cb-link')}</p>` : '';
  return `<div class="cb-head">${K(C, b, d)}${H(C, b, d)}</div>${LIST(C, b, 'items', items, one, 'div', `cb-reviews cb-reviews-${b.variant}`)}${more}`;
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
  const acts = `${BTNS(C, b, d.buttons)}${map ? `<p class="cb-map">${map}</p>` : ''}`;
  if (!facts && !d.heading && !d.intro && !(d.buttons || []).length && !C.editable) return '';
  if (b.variant === 'split') return `<div class="cb-side"><div class="cb-side-head">${head}${acts}</div>${facts}</div>`;
  if (b.variant === 'card') return `<div class="cb-contact-card">${head}${facts}${acts}</div>`;
  return `${head}${facts}${acts}`;
};

R_.cta = (C, b) => {
  const d = b.data;
  const words = `${K(C, b, d)}${H(C, b, d)}${RT(C, b, 'body', d.body)}`;
  if (b.variant === 'split') return `<div class="cb-cta-split"><div>${words}</div>${BTNS(C, b, d.buttons)}</div>`;
  if (b.variant === 'card') return `<div class="cb-cta-card">${words}${BTNS(C, b, d.buttons)}</div>`;
  return `${words}${BTNS(C, b, d.buttons)}`;
};

R_.form = (C, b) => {
  const d = b.data;
  const ep = typeof C.formEndpoint === 'string' && /^https:\/\//.test(C.formEndpoint) && !C.formEndpoint.includes('/your-id') ? C.formEndpoint : '';
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

R_.spacer = (C, b) => (b.variant === 'ornament' ? '<p class="cb-ornament" aria-hidden="true"><span></span><span></span><span></span></p>' : b.variant === 'line' ? '<hr>' : '');

function renderBlock(b, C) {
  const inner = R_[b.type](C, b);
  if (!inner && !C.editable) return '';
  const s = b.style;
  const cls = `cb cb-t-${b.type} cb-${b.type}--${b.variant} cb-bg-${s.bg} cb-w-${s.width} cb-sp-${s.space} cb-al-${s.align}${b.type === 'spacer' ? ` cb-size-${b.data.size || 'm'}` : ''}`;
  const backdrop = s.bg === 'picture' && b.data.backdrop ? `<img class="cb-backdrop" src="${esc(imgSrc(C, b.data.backdrop.src))}" alt="" loading="lazy"${ED(C, 'data-cb-img', `${b.id}:backdrop`)}>` : '';
  return `<section class="${cls}"${ED(C, 'data-cb-block', b.id)}>${backdrop}<div class="cb-in">${inner}</div></section>`;
}
export { renderBlock as _renderBlock };
