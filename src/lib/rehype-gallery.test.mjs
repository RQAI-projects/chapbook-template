// Unit tests for the rehype-gallery plugin (Node built-in test runner).
//   node --test src/lib/rehype-gallery.test.mjs
// Trees are built by hand in the shape remark-rehype produces (paragraphs of
// <img>s with whitespace text nodes between blocks) and serialised with
// hast-util-to-html (the same serialiser Astro's markdown pipeline uses), so
// the expected strings below are byte pins of what lands on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHtml } from 'hast-util-to-html';
import rehypeGallery from './rehype-gallery.mjs';

// ---- hast builders -------------------------------------------------------

const text = (value) => ({ type: 'text', value });
const img = (src) => ({ type: 'element', tagName: 'img', properties: { src }, children: [] });
const p = (...children) => ({ type: 'element', tagName: 'p', properties: {}, children });
const marker = (s) => p(text(s));
const root = (...children) => ({ type: 'root', children });

// run the plugin over a root and serialise the result
function render(tree) {
  rehypeGallery()(tree);
  return toHtml(tree);
}

// two-image run: the plain-gallery baseline used throughout
const twoImgs = () => [p(img('a.jpg')), text('\n'), p(img('b.jpg'))];
const GALLERY_IMGS = '<img src="a.jpg" loading="lazy"><img src="b.jpg" loading="lazy">';

// ---- no marker (baseline) ------------------------------------------------

test('two image-only paragraphs wrap into a plain gallery', () => {
  assert.equal(render(root(...twoImgs())), `<div class="gallery">${GALLERY_IMGS}</div>`);
});

test('a lone image without a marker stays an inline paragraph', () => {
  assert.equal(render(root(p(img('a.jpg')))), '<p><img src="a.jpg" loading="lazy"></p>');
});

// ---- legacy w,a marker: byte pins (must never change) --------------------

test('legacy w,a marker: gallery output is byte-identical to today', () => {
  const html = render(root(marker('[[blk-gallery:w=55,a=center]]'), text('\n'), ...twoImgs()));
  assert.equal(html, `<div class="gallery" style="--blk-w:55%" data-align="center">${GALLERY_IMGS}</div>`);
});

test('legacy w,a marker: single-image gallery--one is byte-identical to today', () => {
  const html = render(root(marker('[[blk-gallery:w=40,a=left]]'), text('\n'), p(img('a.jpg'))));
  assert.equal(html,
    '<div class="gallery gallery--one" style="--blk-w:40%" data-align="left"><img src="a.jpg" loading="lazy"></div>');
});

// ---- w,a,p marker: placement class joins the sized wrapper ---------------

test('w,a,p marker: wrapper keeps width/align and gains the placement class', () => {
  const html = render(root(marker('[[blk-gallery:w=55,a=center,p=right]]'), text('\n'), ...twoImgs()));
  assert.equal(html, `<div class="gallery img-right" style="--blk-w:55%" data-align="center">${GALLERY_IMGS}</div>`);
});

test('w,a,p marker: p=wide maps to breakout', () => {
  const html = render(root(marker('[[blk-gallery:w=80,a=center,p=wide]]'), text('\n'), ...twoImgs()));
  assert.equal(html, `<div class="gallery breakout" style="--blk-w:80%" data-align="center">${GALLERY_IMGS}</div>`);
});

// ---- placement-only marker: class, no width style ------------------------

test('p-only marker: wrapper gains the class with no width style or data-align', () => {
  const html = render(root(marker('[[blk-gallery:p=wide]]'), text('\n'), ...twoImgs()));
  assert.equal(html, `<div class="gallery breakout">${GALLERY_IMGS}</div>`);
  assert.ok(!html.includes('style='));
  assert.ok(!html.includes('data-align'));
});

test('p-only marker: p=left / p=right map to img-left / img-right', () => {
  assert.equal(render(root(marker('[[blk-gallery:p=left]]'), text('\n'), ...twoImgs())),
    `<div class="gallery img-left">${GALLERY_IMGS}</div>`);
  assert.equal(render(root(marker('[[blk-gallery:p=right]]'), text('\n'), ...twoImgs())),
    `<div class="gallery img-right">${GALLERY_IMGS}</div>`);
});

test('p-only marker: a single image becomes a placed gallery--one without width style', () => {
  const html = render(root(marker('[[blk-gallery:p=right]]'), text('\n'), p(img('a.jpg'))));
  assert.equal(html, '<div class="gallery gallery--one img-right"><img src="a.jpg" loading="lazy"></div>');
});

// ---- invalid markers stay as text ----------------------------------------

test('invalid markers are left as paragraph text, images still form a plain gallery', () => {
  for (const bad of [
    '[[blk-gallery:w=55]]',                 // width without align
    '[[blk-gallery:p=center]]',             // unknown placement
    '[[blk-gallery:w=55,a=center,p=up]]',   // unknown placement token
    '[[blk-gallery:p=wide,w=55,a=center]]', // wrong token order
    '[[blk-gallery:w=55,a=middle]]',        // unknown align
    '[[blk-gallery:]]',                     // empty
  ]) {
    const html = render(root(marker(bad), text('\n'), ...twoImgs()));
    assert.equal(html, `<p>${bad}</p>\n<div class="gallery">${GALLERY_IMGS}</div>`, `marker: ${bad}`);
  }
});

// ---- width clamping unchanged with the p token ---------------------------

test('width is clamped to 20–99 with or without a placement token', () => {
  assert.equal(render(root(marker('[[blk-gallery:w=150,a=center,p=wide]]'), text('\n'), ...twoImgs())),
    `<div class="gallery breakout" style="--blk-w:99%" data-align="center">${GALLERY_IMGS}</div>`);
  assert.equal(render(root(marker('[[blk-gallery:w=5,a=center]]'), text('\n'), ...twoImgs())),
    `<div class="gallery" style="--blk-w:20%" data-align="center">${GALLERY_IMGS}</div>`);
});
