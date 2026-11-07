// Writes template-release.json: what Chapbook's automatic website updates may replace, and the
// exact version of each file in this release. Run before releasing a template change, after
// raising RELEASE. A test fails if this file is out of date.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE = 2;
export const VERSION = '2026.11.07.2';
// Code that belongs to the template. A writer's posts, pictures and settings are never listed.
export const MANAGED = ['astro.config.mjs', 'package.json', 'package-lock.json', 'public/fonts/', 'public/icons-manifest.json', 'public/icons-sprite.svg', 'scripts/', 'src/components/', 'src/content/config.ts', 'src/data/emoji-glyphs.json', 'src/data/themes.json', 'src/env.d.ts', 'src/layouts/', 'src/lib/', 'src/pages/', 'src/plugins/', 'src/scripts/', 'src/styles/'];
const SKIP = /\.test\.mjs$/;
const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
const isManaged = (p) => MANAGED.some((m) => (m.endsWith('/') ? p.startsWith(m) : p === m));
const blobId = (body) => createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
// Only files git tracks: a stray local file must never reach a release.
export function buildManifest() {
  const tracked = git('ls-files', '--cached').split('\n').filter(Boolean);
  for (const m of MANAGED) if (!tracked.some((p) => (m.endsWith('/') ? p.startsWith(m) : p === m))) throw new Error(`Managed path has no files: ${m}`);
  const files = {};
  for (const path of tracked.sort()) {
    if (!isManaged(path) || SKIP.test(path) || !existsSync(join(root, path))) continue;
    files[path] = blobId(readFileSync(join(root, path)));
  }
  return { kind: 'chapbook-template-release', release: RELEASE, version: VERSION, managed: MANAGED, files };
}
// Every earlier version of each file, so a first update can tell an old template file from one
// its owner edited by hand.
export function buildHistory(files) {
  const history = {};
  for (const line of git('log', '--all', '--format=%H').split('\n').filter(Boolean)) {
    for (const row of git('ls-tree', '-r', line).split('\n').filter(Boolean)) {
      const [meta, path] = row.split('\t'), sha = meta.split(' ')[2];
      if (!(path in files) || files[path] === sha) continue;
      (history[path] ||= []);
      if (!history[path].includes(sha)) history[path].push(sha);
    }
  }
  return history;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = buildManifest();
  m.history = buildHistory(m.files);
  writeFileSync(join(root, 'template-release.json'), JSON.stringify(m, null, 1) + '\n');
  console.log(`template release ${m.release}: ${Object.keys(m.files).length} files`);
}
