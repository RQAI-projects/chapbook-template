// Each block page carries only the styles it can use, set in its own head, so a phone paints the
// page without first waiting for the whole website's stylesheets (about 57 KB gzipped, of which a
// block page used about 6).
//
// After the build, for every page drawn by the page editor's renderer (a `.cbp` root), each
// stylesheet link Astro wrote is replaced, in the same place, by a <style> holding only the rules
// that could ever match that page. A rule is dropped only when one of its selectors' class names
// can never be on that page: it is in neither the page's HTML nor any of the website's scripts
// (which add classes such as `is-in` as visitors scroll). So every rule that could apply is kept,
// in its original order, and the page looks exactly as it did; nothing is loaded late, so nothing
// flashes or shifts. Blog pages and every other page keep their stylesheet links untouched.
//
// It is deliberately cautious:
// - A rule is kept whole if any one of its selectors survives (a selector list is never rewritten:
//   a list holding a selector a browser does not know is ignored whole, and must stay so).
// - Class names inside brackets, strings or brackets of a pseudo-class (`:not(.x)`, `:is(.a,.b)`,
//   `:has(.x)`) never count against a rule.
// - Names the scripts put together at run time keep their families (`cbm-follow-*` and `cbm-pointer-*` for the movement
//   engine; `pswp*`, `gx-*` and `cqc-*` for the photo viewer and the CQC widget).
// - @font-face, @property, @page and the like are kept; @media, @supports, @layer and @container
//   are pruned inside; @keyframes are kept when a kept rule (or a script) names them.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KEEP_PREFIXES = ['cbm-follow-', 'cbm-pointer-', 'pswp', 'gx-', 'cqc-'];
const NESTING_AT = new Set(['media', 'supports', 'layer', 'container', 'document', '-moz-document', 'scope', 'starting-style']);

/** Splits CSS into its top-level parts: { prelude, block } for a rule or block at-rule, or
 *  { prelude, block: null } for a statement such as `@charset "x";`. Strings, comments and
 *  brackets are stepped over, so a brace inside `content:"{"` or `url(...)` never counts. */
export function cssParts(css) {
  const parts = [];
  let i = 0;
  const n = css.length;
  const skipString = (j) => { const q = css[j]; j++; while (j < n && css[j] !== q) { if (css[j] === '\\') j++; j++; } return j + 1; };
  const skipComment = (j) => { const e = css.indexOf('*/', j + 2); return e < 0 ? n : e + 2; };
  while (i < n) {
    // The prelude runs to the first `{` or `;` outside strings, comments and brackets.
    let j = i, depth = 0;
    while (j < n) {
      const c = css[j];
      if (c === '"' || c === "'") { j = skipString(j); continue; }
      if (c === '/' && css[j + 1] === '*') { j = skipComment(j); continue; }
      if (c === '(' || c === '[') depth++;
      else if ((c === ')' || c === ']') && depth > 0) depth--;
      else if (depth === 0 && (c === '{' || c === ';' || c === '}')) break;
      j++;
    }
    const prelude = css.slice(i, j).trim();
    if (j >= n) { if (prelude) parts.push({ prelude, block: null }); break; }
    if (css[j] === ';' || css[j] === '}') { if (prelude) parts.push({ prelude, block: null }); i = j + 1; continue; }
    // A block: find its closing brace.
    let k = j + 1, level = 1, paren = 0;
    while (k < n && level > 0) {
      const c = css[k];
      if (c === '"' || c === "'") { k = skipString(k); continue; }
      if (c === '/' && css[k + 1] === '*') { k = skipComment(k); continue; }
      if (c === '(') paren++;
      else if (c === ')' && paren > 0) paren--;
      else if (paren === 0 && c === '{') level++;
      else if (paren === 0 && c === '}') level--;
      k++;
    }
    parts.push({ prelude, block: css.slice(j + 1, k - 1) });
    i = k;
  }
  return parts;
}

/** Splits a selector list at its top-level commas. */
export function selectorList(prelude) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '"' || c === "'") { const q = c; i++; while (i < prelude.length && prelude[i] !== q) { if (prelude[i] === '\\') i++; i++; } continue; }
    if (c === '(' || c === '[') depth++;
    else if ((c === ')' || c === ']') && depth > 0) depth--;
    else if (c === ',' && depth === 0) { out.push(prelude.slice(start, i)); start = i + 1; }
  }
  out.push(prelude.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** What a selector needs from the page, outside strings and pseudo-class arguments: its class
 *  names and its attribute tests. Returns null when a class name is escaped (kept, to be safe). */
export function selectorNeeds(selector) {
  let s = '', paren = 0;
  const attrs = [];
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '"' || c === "'") { const q = c; i++; while (i < selector.length && selector[i] !== q) { if (selector[i] === '\\') i++; i++; } continue; }
    if (c === '(') { paren++; continue; }
    if (c === ')' && paren > 0) { paren--; continue; }
    if (paren > 0) continue;
    if (c === '[') {
      let j = i + 1, q = '';
      while (j < selector.length && (q || selector[j] !== ']')) { const d = selector[j]; if (q) { if (d === '\\') j++; else if (d === q) q = ''; } else if (d === '"' || d === "'") q = d; j++; }
      const m = /^\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*([is])?)?\s*$/i.exec(selector.slice(i + 1, j));
      if (m) attrs.push({ name: m[1].toLowerCase(), op: m[2] || '', value: m[3] ?? m[4] ?? m[5] ?? '', fold: (m[6] || '').toLowerCase() === 'i' });
      i = j; continue;
    }
    s += c;
  }
  if (s.includes('\\')) return null;
  return { classes: [...s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]), attrs };
}

/** The class names a selector needs (see selectorNeeds). */
export const neededClasses = (selector) => selectorNeeds(selector)?.classes ?? null;

/** Every word a page could use as a class name. */
export function words(text, into = new Set()) {
  for (const m of text.matchAll(/-?[_a-zA-Z][\w-]*/g)) into.add(m[0]);
  return into;
}

/** The words a script could set as a class name. A word straight after a dot or a hash is a
 *  property or a name in a selector the script looks for (`'.cb-card'`), not a class it adds,
 *  so it does not count; everything else does (`classList.add('is-in')`, `className = 'x y'`). */
export function scriptWords(text, into = new Set()) {
  for (const m of text.matchAll(/(?<![.#\w-])-?[_a-zA-Z][\w-]*/g)) into.add(m[0]);
  return into;
}

// Attributes the renderer writes on a page and no script ever changes: the page's movement
// choices (`data-m-scroll="rise"` and the rest, read by page-motion.js, `data-m-edit` only in
// the editor) the website's look and its header shape (`data-header`). A rule testing one of them is kept only when the page has
// that attribute with that value. Every other attribute test is kept, whatever it asks.
export const PAGE_ATTR = /^data-(m-[\w-]+|blog-theme|header)$/;

/** The page attributes (PAGE_ATTR) an HTML page carries, with every value each one has. */
export function pageAttrs(html) {
  const out = new Map();
  for (const m of html.matchAll(/\s(data-(?:m-[\w-]+|blog-theme|header))(?:=(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/gi)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, new Set());
    out.get(name).add(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

function attrCanMatch({ name, op, value, fold }, attrs) {
  if (!PAGE_ATTR.test(name)) return true;
  const values = attrs.get(name);
  if (!values) return false;
  if (op !== '=' && op !== '~=') return true;
  const same = (a, b) => (fold ? a.toLowerCase() === b.toLowerCase() : a === b);
  return [...values].some((v) => (op === '=' ? same(v, value) : v.split(/\s+/).some((w) => same(w, value))));
}

const knownClass = (name, have) => have.has(name) || KEEP_PREFIXES.some((p) => name.startsWith(p));

function ruleCanMatch(prelude, page) {
  return selectorList(prelude).some((sel) => {
    const need = selectorNeeds(sel);
    return need === null || (need.classes.every((c) => knownClass(c, page.words)) && need.attrs.every((a) => attrCanMatch(a, page.attrs)));
  });
}

function prune(css, page) {
  let out = '';
  for (const { prelude, block } of cssParts(css)) {
    if (block === null) { out += `${prelude};`; continue; }
    if (prelude[0] === '@') {
      const name = (/^@([\w-]+)/.exec(prelude) || [, ''])[1].toLowerCase();
      if (NESTING_AT.has(name)) {
        const inner = prune(block, page);
        if (inner) out += `${prelude}{${inner}}`;
      } else out += `${prelude}{${block}}`;
      continue;
    }
    if (ruleCanMatch(prelude, page)) out += `${prelude}{${block}}`;
  }
  return out;
}

// @keyframes nobody names are dropped once the rest is known.
function dropUnusedKeyframes(css, extra) {
  const parts = cssParts(css);
  const isKeyframes = (p) => p.block !== null && /^@(-[a-z]+-)?keyframes\s/i.test(p.prelude);
  const rest = parts.filter((p) => !isKeyframes(p)).map((p) => (p.block === null ? `${p.prelude};` : `${p.prelude}{${p.block}}`)).join('');
  const used = words(rest, new Set(extra));
  let out = '';
  for (const p of parts) {
    if (isKeyframes(p)) {
      const name = p.prelude.replace(/^@(-[a-z]+-)?keyframes\s+/i, '').trim().replace(/^["']|["']$/g, '');
      if (!used.has(name)) continue;
    }
    out += p.block === null ? `${p.prelude};` : `${p.prelude}{${p.block}}`;
  }
  return out;
}

/** The page's context for pageCss: the words of its HTML and of the website's scripts, and its
 *  own page attributes. */
export function pageContext(html, scripts = new Set()) {
  return { words: words(html, new Set(scripts)), attrs: pageAttrs(html) };
}

/** The rules of `css` that could match a page (pageContext). */
export function pageCss(css, page) {
  return dropUnusedKeyframes(prune(css, page), page.words);
}

const STYLESHEET = /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi;
const hrefOf = (tag) => (/\bhref=["']?([^"'\s>]+)/i.exec(tag) || [])[1] || '';

/** One page: its stylesheet links to the website's own built styles become <style> blocks of
 *  the rules it can use. `readCss(href)` returns a stylesheet's text, or null to leave it. */
export function inlinePageCss(html, readCss, scripts) {
  if (!/<div class="cbp[\s"]/.test(html)) return html;
  const page = pageContext(html, scripts);
  return html.replace(STYLESHEET, (tag) => {
    const href = hrefOf(tag);
    if (!/\/_astro\/[^/]+\.css$/.test(href) || /\bmedia=/i.test(tag)) return tag;
    const css = readCss(href);
    if (css == null) return tag;
    const kept = pageCss(css, page).replace(/<\/style/gi, '<\\/style');
    return `<style data-page-css>${kept}</style>`;
  });
}

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (extname(p) === ext) out.push(p);
  }
  return out;
}

/** After `astro build`: every block page in `dist` gets its own styles. Returns what it did. */
export function splitPageCss(dist) {
  const astro = join(dist, '_astro');
  if (!existsSync(astro)) return { pages: 0 };
  const scripts = new Set();
  for (const f of walk(astro, '.js')) scriptWords(readFileSync(f, 'utf8'), scripts);
  const cache = new Map();
  const readCss = (href) => {
    const file = join(astro, href.slice(href.lastIndexOf('/_astro/') + 8));
    if (!cache.has(file)) cache.set(file, existsSync(file) ? readFileSync(file, 'utf8') : null);
    return cache.get(file);
  };
  let pages = 0;
  for (const f of walk(dist, '.html')) {
    const html = readFileSync(f, 'utf8');
    const next = inlinePageCss(html, readCss, scripts);
    if (next !== html) { writeFileSync(f, next); pages++; }
  }
  return { pages };
}

/** The Astro integration (astro.config.mjs). CHAPBOOK_PAGE_CSS=off leaves every page as Astro
 *  wrote it (used to compare the two). */
export default function pageCssIntegration() {
  return {
    name: 'chapbook-page-css',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        if (process.env.CHAPBOOK_PAGE_CSS === 'off') return;
        const { pages } = splitPageCss(fileURLToPath(dir));
        logger?.info?.(`${pages} block pages carry only their own styles`);
      },
    },
  };
}
