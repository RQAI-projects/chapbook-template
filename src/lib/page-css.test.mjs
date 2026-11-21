// Each block page carries only the styles it can use (src/lib/page-css.mjs): what is kept, what is
// dropped, that blog pages are never touched, and the guards that keep the pruning safe (no script
// changes a page attribute, and class names put together at run time stay in the kept families).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cssParts, selectorList, selectorNeeds, words, scriptWords, pageAttrs, pageContext, pageCss, inlinePageCss, KEEP_PREFIXES, PAGE_ATTR } from './page-css.mjs';
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
