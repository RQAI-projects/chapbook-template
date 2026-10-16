import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAT_GLYPHS, flatGlyphForTopic, iconPaths } from './presentation.js';
import { iconInner } from '../icons.js';
import { TOPIC_DEFAULTS } from './index.js';

test('every default 3D badge has a real flat icon for quieter templates', () => {
  for (const glyph of Object.values(TOPIC_DEFAULTS).flat().filter(Boolean)) assert.ok(iconInner(FLAT_GLYPHS[glyph]), glyph);
  assert.equal(flatGlyphForTopic({ atlas: ['globe', 'taj-mahal'] }, 'atlas'), 'world');
  assert.equal(flatGlyphForTopic({ atlas: 'globe' }, 'atlas'), 'world');
  assert.equal(flatGlyphForTopic({}, 'unknown'), '');
});
test('3D icon conversion retains circles, outlines, stems and paths', () => {
  const paths = iconPaths('<path d="M0 0h24v24H0z"/><circle cx="12" cy="12" r="9"/><ellipse cx="5" cy="6" rx="3" ry="2"/><line x1="2" y1="3" x2="4" y2="5"/><rect x="1" y="2" width="3" height="4"/><polyline points="1,2 3,4 5,6"/><polygon points="1,2 3,4 5,6"/><path d="M2 2L3 3"/>');
  assert.equal(paths.length,7);
  assert.match(paths[0],/a9 9/);
  assert.equal(paths[2],'M2 3L4 5');
  assert.equal(paths.at(-1),'M2 2L3 3');
});
