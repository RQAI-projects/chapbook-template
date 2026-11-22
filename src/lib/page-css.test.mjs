// Each block page carries only the styles it can use (src/lib/page-css.mjs): what is kept, what is
// dropped, that blog pages are never touched, and the guards that keep the pruning safe (no script
// changes a page attribute, and class names put together at run time stay in the kept families).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cssParts, selectorList, selectorNeeds, words, scriptWords, pageAttrs, pageContext, pageCss, inlinePageCss, KEEP_PREFIXES, PAGE_ATTR, lateFonts, deferLate, blogMotionPlan } from './page-css.mjs';
import { renderPage } from './pages/render.mjs';

const page = (html, scripts = '') => pageContext(html, scriptWords(scripts));
const BLOCK = '<html data-blog-theme="clinic"><head></head><body><header class="site-header" data-header="practice"></header><div class="cbp cbm" data-m-scroll="rise" data-m-count><section class="cb cb-t-hero cb-hero--reveal"><h1 class="cb-hero-h">Hi</h1></section></div></body></html>';

test('CSS is split into its parts, stepping over strings, comments and brackets', () => {
  const css = '@charset "utf-8";.a{content:"}{"}/* } */.b{background:url(data:x;y{z})}@media (min-width:1px){.c{color:red}.d{color:blue}}';
  const parts = cssParts(css);
  assert.deepEqual(parts.map((p) => p.prelude), ['@charset "utf-8"', '.a', '/* } */.b', '@media (min-width:1px)']);
  assert.equal(parts[1].block, 'content:"}{"');
  assert.equal(parts[2].block, 'background:url(data:x;y{z})');
  assert.equal(cssParts(parts[3].block).length, 2);
  assert.deepEqual(selectorList('.a, .b:is(.c,.d) ,[x="1,2"]'), ['.a', '.b:is(.c,.d)', '[x="1,2"]']);
});

test('a selector needs the classes outside brackets, strings and pseudo-class arguments', () => {
  assert.deepEqual(selectorNeeds('.a .b:not(.c) > .d::before').classes, ['a', 'b', 'd']);
  assert.deepEqual(selectorNeeds('a[href$=".pdf"]:is(.x,.y)').classes, []);
  assert.deepEqual(selectorNeeds('.cbp[data-m-scroll="rise" i] .cb').attrs, [{ name: 'data-m-scroll', op: '=', value: 'rise', fold: true }]);
  assert.equal(selectorNeeds('.md\\:x'), null);
});

test('rules for classes the page never has are dropped; everything that could match is kept, in order', () => {
  const css = '.cb-hero-h{color:red}.cb-tiles{color:blue}.cb-hero-h:not(.is-gone){margin:0}.cb-tiles,.cb-hero-h{padding:1px}.zz-none .cb-hero-h{x:1}.md\\:x{y:1}h1{z:1}:root{--a:1}';
  const kept = pageCss(css, page(BLOCK));
  assert.equal(kept, '.cb-hero-h{color:red}.cb-hero-h:not(.is-gone){margin:0}.cb-tiles,.cb-hero-h{padding:1px}.md\\:x{y:1}h1{z:1}:root{--a:1}');
});

test('classes a script adds are kept; names a script only looks for are not', () => {
  const css = '.cb-hero-h.is-in{opacity:1}.cb-hero-h.cb-only-looked-for{opacity:.5}';
  const scripts = "e.classList.add('is-in');document.querySelectorAll('.cb-only-looked-for, .cb-x')";
  assert.equal(pageCss(css, page(BLOCK, scripts)), '.cb-hero-h.is-in{opacity:1}');
  assert.ok(scriptWords("a.className='cbm-pause x'").has('cbm-pause'));
  assert.ok(!scriptWords("q('.cb-card')").has('cb-card'));
  // Names put together at run time keep their whole family.
  assert.equal(pageCss('.cbm-follow-line{a:1}.cbm-pointer-dot{b:1}', page(BLOCK)), '.cbm-follow-line{a:1}.cbm-pointer-dot{b:1}');
});

test("the page's own movement choices, look and header decide the rules that test them", () => {
  const css = '.cbp[data-m-scroll=rise] .cb{a:1}.cbp[data-m-scroll="zoom"] .cb{b:1}.cbp[data-m-edit] .cb{c:1}.cbp:not([data-m-edit]) .cb{d:1}[data-m-count] .cb{e:1}html[data-blog-theme=clinic] .cb{f:1}html[data-blog-theme=table] .cb{g:1}.site-header[data-header=practice]{h:1}.site-header[data-header=spine]{i:1}.cb[data-m=pic]{j:1}.cb[aria-expanded=true]{k:1}';
  assert.equal(pageCss(css, page(BLOCK)), '.cbp[data-m-scroll=rise] .cb{a:1}.cbp:not([data-m-edit]) .cb{d:1}[data-m-count] .cb{e:1}html[data-blog-theme=clinic] .cb{f:1}.site-header[data-header=practice]{h:1}.cb[data-m=pic]{j:1}.cb[aria-expanded=true]{k:1}');
  assert.deepEqual([...pageAttrs(BLOCK).get('data-m-count')], ['']);
});

test('at-rules: media and supports pruned inside, font faces kept, keyframes kept only when named', () => {
  const css = '@font-face{font-family:X;src:url(x.woff2)}@media (min-width:761px){.cb-tiles{a:1}}@media (min-width:761px){.cb-hero-h{animation:cbm-in 1s}}@keyframes cbm-in{to{opacity:1}}@keyframes cbm-unused{to{opacity:0}}@supports (x:y){.cb-tiles{b:1}}';
  assert.equal(pageCss(css, page(BLOCK)), '@font-face{font-family:X;src:url(x.woff2)}@media (min-width:761px){.cb-hero-h{animation:cbm-in 1s}}@keyframes cbm-in{to{opacity:1}}');
});

test('a block page gets its styles in place of each of its own stylesheets; other pages are untouched', () => {
  const html = (body) => `<html><head><link rel="stylesheet" href="/_astro/a.css"><style>x{}</style><link rel="stylesheet" href="/_astro/b.css"><link rel="stylesheet" href="https://fonts.example/f.css"><link rel="stylesheet" href="/_astro/p.css" media="print"></head><body>${body}</body></html>`;
  const css = { '/_astro/a.css': '.cb-hero-h{a:1}.zz{b:1}', '/_astro/b.css': '.cbp{content:"</style>"}' };
  const out = inlinePageCss(html('<div class="cbp"><h1 class="cb-hero-h">x</h1></div>'), (h) => css[h] ?? null, new Set());
  assert.equal(out, '<html><head><style data-page-css>.cb-hero-h{a:1}</style><style>x{}</style><style data-page-css>.cbp{content:"<\\/style>"}</style><link rel="stylesheet" href="https://fonts.example/f.css"><link rel="stylesheet" href="/_astro/p.css" media="print"></head><body><div class="cbp"><h1 class="cb-hero-h">x</h1></div></body></html>');
  const blog = html('<main class="post-list"></main>');
  assert.equal(inlinePageCss(blog, (h) => css[h] ?? null, new Set()), blog);
  // A real block page from the renderer is recognised.
  const real = renderPage({ v: 1, title: 'x', slug: 'x', blocks: [{ id: 'a', type: 'text', variant: 'plain', data: { heading: 'Hi' } }] }, { site: { name: 'x' } });
  assert.match(real, /<div class="cbp[\s"]/);
});

test('guard: no script changes a page attribute, and run-time class names stay in the kept families', () => {
  const dir = new URL('../scripts/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/(?:setAttribute|toggleAttribute|removeAttribute)\(\s*['"`]([\w-]+)/g)) assert.ok(!PAGE_ATTR.test(m[1]), `${f} changes ${m[1]}`);
    for (const m of src.matchAll(/dataset\.(\w+)\s*=[^=]/g)) assert.ok(!PAGE_ATTR.test('data-' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())), `${f} sets dataset.${m[1]}`);
    for (const m of src.matchAll(/(?:className\s*=|classList\.(?:add|toggle|replace)\()\s*`([^`]*)`/g)) {
      for (const piece of m[1].split(/\s+/).filter((x) => x.includes('${'))) assert.ok(KEEP_PREFIXES.some((p) => piece.startsWith(p)), `${f} builds the class ${piece}`);
    }
  }
  assert.match(readFileSync(new URL('../../astro.config.mjs', import.meta.url), 'utf8'), /integrations:\s*\[pageCss\(\)\]/);
  assert.ok(words('a b-c').has('b-c'));
});

// ---- What the first screen does not need waits until the page has loaded -------------------
const FACE = (file, weight = 400) => `@font-face{font-family:F;font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format("woff2")}`;
const LATE_PAGE = `<html><head><link rel="preload" as="font" type="font/woff2" href="/fonts/f-600.woff2" crossorigin><style data-page-css>${FACE('f-600.woff2', 600)}${FACE('f-400.woff2')}@font-face{font-family:Inter Variable;src:url(/_astro/inter-latin.woff2) format("woff2")}.cb{color:red}</style></head><body><main><style>.x{}</style><div class="cbp"><section class="cb"><img src="/site-images/h.webp" fetchpriority="high"><img src="/site-images/f.webp" alt="" loading="lazy" decoding="async"></section><section class="cb"><figure><img src="/site-images/b.webp" srcset="/site-images/b-phone.webp 600w, /site-images/b.webp 832w" sizes="100vw" alt="A room" loading="lazy" decoding="async"></figure></section></div></main></body></html>`;

test('typefaces the first screen does not preload wait; one file for every weight stays', () => {
  const { keep, late } = lateFonts(`${FACE('f-600.woff2', 600)}${FACE('f-400.woff2')}@font-face{font-family:V;src:url(/_astro/v.woff2)}.a{b:c}`, new Set(['f-600.woff2']));
  assert.match(keep, /f-600\.woff2/);
  assert.match(keep, /_astro\/v\.woff2/);
  assert.match(keep, /\.a\{b:c\}/);
  assert.doesNotMatch(keep, /f-400/);
  assert.match(late, /^@font-face\{[^}]*f-400\.woff2[^}]*\}$/);
});

test('a block page: late faces in a noscript before it, lazy photos after the opening keep their addresses for later', () => {
  const out = deferLate(LATE_PAGE);
  // The preloaded face stays in the head; the other moves, whole, into the noscript.
  const head = out.slice(0, out.indexOf('</head>'));
  assert.match(head, /f-600\.woff2\) format/);
  assert.doesNotMatch(head, /f-400/);
  assert.match(out, /<noscript data-cb-late><style>@font-face\{font-family:F;font-weight:400;[^}]*\}<\/style><\/noscript><div class="cbp">/);
  // The opening's photos are left alone, even a lazy one; a photo further down waits.
  assert.match(out, /<img src="\/site-images\/h\.webp" fetchpriority="high">/);
  assert.match(out, /<img src="\/site-images\/f\.webp" alt="" loading="lazy"/);
  assert.match(out, /<img data-cb-src="\/site-images\/b\.webp" data-cb-srcset="\/site-images\/b-phone\.webp 600w, \/site-images\/b\.webp 832w" sizes="100vw" alt="A room" loading="lazy" decoding="async">/);
  // Its words for screen readers are untouched, and running it again changes nothing.
  assert.equal(deferLate(out), out);
  // A page that is not a block page is never touched.
  const blog = LATE_PAGE.replace('<div class="cbp">', '<div class="post">');
  assert.equal(deferLate(blog), blog);
});

test('the page puts them back after load and one painted frame, and again after a page change', () => {
  const astro = readFileSync(new URL('../components/BlockPage.astro', import.meta.url), 'utf8');
  const script = /<script is:inline data-astro-rerun>([\s\S]*?)<\/script>/.exec(astro)[1];
  assert.match(script, /noscript\[data-cb-late\]/);
  assert.match(script, /img\[data-cb-src\]/);
  assert.match(script, /addEventListener\('load',soon/);
  assert.match(script, /requestAnimationFrame\(function\(\)\{setTimeout\(late,0\)\}\)/);
  assert.match(script, /readyState==='complete'\)late\(\)/);
  // Run it on a tiny page: the face comes back as a style after the noscript, the photo its addresses.
  const els = [];
  const style = { setAttribute(k) { this[k] = true; }, hasAttribute(k) { return !!this[k]; } };
  const nos = { textContent: '<style>@font-face{x}</style>', nextElementSibling: null, after(s) { this.nextElementSibling = s; els.push(s); } };
  const attrs = { 'data-cb-src': '/b.webp', 'data-cb-srcset': '/b-phone.webp 600w' };
  const img = { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } };
  const doc = { readyState: 'complete', documentElement: { classList: { add() {}, remove() {} } }, createElement: () => Object.create(style), querySelectorAll: (q) => (q.startsWith('noscript') ? [nos] : q.startsWith('img') && attrs['data-cb-src'] ? [img] : []) };
  new Function('document', 'window', 'setTimeout', 'addEventListener', 'requestAnimationFrame', script)(doc, {}, () => 0, () => {}, () => {});
  assert.equal(els.length, 1);
  assert.equal(els[0].textContent, '@font-face{x}');
  assert.deepEqual(attrs, { src: '/b.webp', srcset: '/b-phone.webp 600w' });
});

test('GSAP leaves the shared chunks and block pages, never a blog page', () => {
  const files = new Map([
    ['blog-motion.AAA.js', 'gsap()'],
    ['hoisted.base.js', 'import"./blog-motion.AAA.js";nav()'],
    ['hoisted.page.js', 'import"./hoisted.base.js";import"./blog-motion.AAA.js";page()'],
    ['hoisted.blog.js', 'import"./hoisted.base.js";import"./blog-motion.AAA.js";posts()'],
  ]);
  const entries = new Set(['hoisted.base.js', 'hoisted.page.js', 'hoisted.blog.js']);
  const plan = blogMotionPlan(files, entries);
  assert.equal(plan.chunks.get('hoisted.base.js'), 'nav()');
  // A block page's own script loses the import (a copy); a blog page's keeps it.
  assert.deepEqual(plan.block('hoisted.page.js'), { name: 'hoisted.page.cbp.js', text: 'import"./hoisted.base.js";page()' });
  assert.equal(plan.blog('hoisted.page.js'), null);
  // A page whose script is the shared chunk itself: a block page takes it as it is now; a blog
  // page gets two lines that load it, then GSAP, so it keeps its movement.
  assert.deepEqual(plan.block('hoisted.base.js'), { name: 'hoisted.base.js', text: null });
  assert.deepEqual(plan.blog('hoisted.base.js'), { name: 'hoisted.base.blog.js', text: 'import"./hoisted.base.js";import"./blog-motion.AAA.js";' });
  // A script that needs GSAP by name keeps everything as it was.
  files.set('hoisted.rings.js', 'import{g as gsap}from"./blog-motion.AAA.js";gsap.to()');
  assert.equal(blogMotionPlan(files, entries).chunks.size, 0);
  // So does a chunk reached by a page script that does not load blog-motion itself.
  files.delete('hoisted.rings.js');
  files.set('hoisted.other.js', 'import"./hoisted.base.js";other()');
  assert.equal(blogMotionPlan(files, entries).chunks.size, 0);
});
