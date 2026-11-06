import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildManifest } from './make-template-release.mjs';

test('template-release.json matches the files in this template', () => {
  const saved = JSON.parse(readFileSync(new URL('../template-release.json', import.meta.url)));
  const now = buildManifest();
  const { history, ...current } = saved;
  assert.deepEqual(current, now, 'run: node scripts/make-template-release.mjs');
  assert.ok(Object.keys(now.files).length >= 100, 'a release lists the whole template');
});
test('content written by the site owner is never managed', () => {
  const { files } = buildManifest();
  for (const p of Object.keys(files)) assert.ok(!/^(src\/content\/blog|public\/site-images|src\/data\/(site|profile|topics)\.json)/.test(p), p);
});
