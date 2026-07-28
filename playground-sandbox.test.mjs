import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('published interactive blocks execute in opaque-origin sandboxed iframes', async () => {
  const source = await readFile(new URL('./src/layouts/Base.astro', import.meta.url), 'utf8');
  const start = source.indexOf('function initPlaygrounds()');
  const end = source.indexOf('function initSvgDraw()', start);
  const init = source.slice(start, end);

  assert.match(init, /document\.createElement\('iframe'\)/);
  assert.match(init, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(init, /allow-same-origin/);
  assert.match(init, /default-src 'none'/);
  assert.match(init, /style \? style\.previousElementSibling/);
  assert.match(init, /widgetCss/);
  assert.match(init, /playground\.replaceWith\(frame\)/);
  assert.doesNotMatch(init, /new Function/);
});
