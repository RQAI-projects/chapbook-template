// Run (from the repo root):  node --test cloudflare/r2-upload-worker/worker.test.mjs
//
// Exercises the Worker's routes against an in-memory fake R2 binding (no network, no real
// R2, no Workers AI). A fake env + real worker.fetch(request, env) calls, mirroring how the
// Studio hits the deployed Worker. Covers the (H8) hardening: constant-time auth, the videos/
// key prefix + path-traversal rejection, the content-type allowlist, the upload size cap, the
// /image prompt cap, and the CORS allowlist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { fakeBucket } from './fake-r2.mjs';

const SECRET = 'media-sek-123';

// A fake Workers AI binding: records the last run() options and returns a canned image.
function fakeAI(result = { image: 'BASE64DATA' }) {
  const calls = [];
  return {
    calls,
    async run(model, opts) { calls.push({ model, opts }); return typeof result === 'function' ? result(model, opts) : result; },
  };
}

function envWith(bucket, extra = {}) {
  return { UPLOAD_SECRET: SECRET, BUCKET: bucket || fakeBucket(), ...extra };
}
const authHeaders = { Authorization: `Bearer ${SECRET}` };
const call = (env, url, init) => worker.fetch(new Request(url, init), env);

test('upload auth: constant-time secret compare — wrong/missing/over-long tokens all 401, correct → 200', async () => {
  const env = envWith(fakeBucket());
  const put = (headers) => call(env, 'https://w/', {
    method: 'PUT',
    headers: { 'X-Key': 'videos/a.mp4', 'content-type': 'video/mp4', ...headers },
    body: Buffer.from('V'),
  });
  assert.equal((await put({})).status, 401, 'no auth');
  assert.equal((await put({ Authorization: 'Bearer wrong' })).status, 401, 'wrong secret');
  // A different-length token still resolves through the SHA-256 constant-time compare (equal-length
  // digests), not a fast `===` reject — it must still come back 401, not error.
  assert.equal((await put({ Authorization: 'Bearer ' + 'x'.repeat(500) })).status, 401, 'over-long wrong secret');
  assert.equal((await put(authHeaders)).status, 200, 'correct secret');
});

test('upload key must start with videos/ and reject path traversal / backslash / doubled slash (H8)', async () => {
  const bucket = fakeBucket();
  const env = envWith(bucket);
  const put = (key) => call(env, 'https://w/', {
    method: 'PUT',
    headers: { ...authHeaders, 'X-Key': key, 'content-type': 'video/mp4' },
    body: Buffer.from('V'),
  });
  assert.equal((await put('images/a.png')).status, 400, 'wrong prefix');
  assert.equal((await put('videos/../secret.mp4')).status, 400, 'traversal ..');
  assert.equal((await put('videos/a\\b.mp4')).status, 400, 'backslash');
  assert.equal((await put('videos//a.mp4')).status, 400, 'doubled slash');
  assert.equal((await put('/etc/passwd')).status, 400, 'leading slash stripped, then wrong prefix');
  assert.equal((await put('   ')).status, 400, 'blank X-Key');
  assert.equal(bucket._store.size, 0, 'nothing was stored on any rejected key');
  const ok = await put('videos/ok.mp4');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, key: 'videos/ok.mp4' });
});

test('missing X-Key → 400', async () => {
  const env = envWith(fakeBucket());
  const res = await call(env, 'https://w/', {
    method: 'PUT', headers: { ...authHeaders, 'content-type': 'video/mp4' }, body: Buffer.from('V'),
  });
  assert.equal(res.status, 400);
});

test('content-type allowlist: text/html and unknown types → 415 (never stored); media types → 200 (H8)', async () => {
  const bucket = fakeBucket();
  const env = envWith(bucket);
  const put = (ct) => call(env, 'https://w/', {
    method: 'PUT', headers: { ...authHeaders, 'X-Key': 'videos/x.bin', 'content-type': ct }, body: Buffer.from('V'),
  });
  assert.equal((await put('text/html')).status, 415, 'text/html blocked (XSS-from-bucket)');
  assert.equal((await put('text/html; charset=utf-8')).status, 415, 'parameters stripped, still blocked');
  assert.equal((await put('application/x-httpd-php')).status, 415, 'unknown type blocked');
  assert.equal(bucket._store.size, 0, 'nothing stored on rejected content-types');
  assert.equal((await put('video/mp4')).status, 200);
  assert.equal((await put('image/png')).status, 200);
  assert.equal((await put('application/octet-stream')).status, 200);
});

test('size cap: an oversized declared Content-Length → 413 up front (H8)', async () => {
  const env = envWith(fakeBucket());
  const res = await call(env, 'https://w/', {
    method: 'PUT',
    headers: {
      ...authHeaders,
      'X-Key': 'videos/huge.mp4',
      'content-type': 'video/mp4',
      'content-length': String(600 * 1024 * 1024 + 1), // one byte over the ~600 MB ceiling
    },
    body: Buffer.from('V'),
  });
  assert.equal(res.status, 413);
});

test('size cap: NO Content-Length + an over-cap body → 413 JSON, nothing stored (H8)', async () => {
  const bucket = fakeBucket();
  // env.MAX_UPLOAD_BYTES is the test seam — a tiny 8-byte cap here; production leaves the var
  // unset so the deployed ceiling stays the 600 MB default. Node Requests built from a Buffer
  // carry no content-length header (see the valid-upload test), so this exercises the
  // size-capped buffering path: the TransformStream errors mid-read and the Worker must turn
  // that rejection into the SAME 413 JSON as the declared-length path — not an unhandled throw.
  const env = envWith(bucket, { MAX_UPLOAD_BYTES: '8' });
  const put = (bytes, key) => call(env, 'https://w/', {
    method: 'PUT', headers: { ...authHeaders, 'X-Key': key, 'content-type': 'video/mp4' }, body: Buffer.from(bytes),
  });
  const res = await put('123456789', 'videos/big.mp4'); // 9 bytes > the 8-byte cap
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { ok: false, error: 'upload too large' });
  assert.equal(bucket._store.size, 0, 'the oversized body was never stored');
  // An under-cap body against the same env still uploads — the override caps, it doesn't break.
  assert.equal((await put('12345', 'videos/small.mp4')).status, 200);
  assert.ok(bucket._store.has('videos/small.mp4'));
});

test('valid upload stores the bytes under the videos/ key and returns {ok,key}', async () => {
  const bucket = fakeBucket();
  const env = envWith(bucket);
  // No Content-Length header → exercises the size-capped buffer fallback (FixedLengthStream is
  // absent under Node), which hands R2 a known-length ArrayBuffer. If the Worker passed R2 a raw
  // stream instead, fake-r2 would throw "known length" and this would be a 502.
  const res = await call(env, 'https://w/', {
    method: 'PUT', headers: { ...authHeaders, 'X-Key': 'videos/clip.mp4', 'content-type': 'video/mp4' }, body: Buffer.from('MP4BYTES'),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, key: 'videos/clip.mp4' });
  assert.ok(bucket._store.has('videos/clip.mp4'));
  assert.equal(bucket._store.get('videos/clip.mp4').body.toString(), 'MP4BYTES');
  assert.equal(bucket._store.get('videos/clip.mp4').httpMetadata.contentType, 'video/mp4');
});

test('GET /list: needs auth, returns only videos/ keys, newest first', async () => {
  const bucket = fakeBucket();
  // Seed with explicit timestamps so the newest-first ordering is deterministic.
  bucket._store.set('videos/old.mp4', { body: Buffer.from('a'), size: 1, etag: 'e1', uploaded: new Date('2020-01-01'), httpMetadata: {} });
  bucket._store.set('videos/new.mp4', { body: Buffer.from('bb'), size: 2, etag: 'e2', uploaded: new Date('2026-01-01'), httpMetadata: {} });
  bucket._store.set('images/pic.png', { body: Buffer.from('c'), size: 1, etag: 'e3', uploaded: new Date('2025-01-01'), httpMetadata: {} });
  const env = envWith(bucket);
  assert.equal((await call(env, 'https://w/list', {})).status, 401, 'no auth');
  const res = await call(env, 'https://w/list', { headers: authHeaders });
  assert.equal(res.status, 200);
  const { videos } = await res.json();
  assert.equal(videos.length, 2, 'only the videos/ prefix is listed');
  assert.ok(videos.every((v) => v.key.startsWith('videos/')));
  assert.equal(videos[0].key, 'videos/new.mp4', 'newest first');
  assert.deepEqual(Object.keys(videos[0]).sort(), ['key', 'size', 'uploaded']);
});

test('POST /image: needs auth, needs a prompt, caps the prompt at 2000 chars, returns base64 image (H8)', async () => {
  const ai = fakeAI();
  const env = envWith(fakeBucket(), { AI: ai });
  // Unauthed → 401 (before any model run).
  assert.equal((await call(env, 'https://w/image', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) })).status, 401);
  // Missing/blank prompt → 400.
  assert.equal((await call(env, 'https://w/image', { method: 'POST', headers: authHeaders, body: JSON.stringify({}) })).status, 400);
  assert.equal((await call(env, 'https://w/image', { method: 'POST', headers: authHeaders, body: JSON.stringify({ prompt: '   ' }) })).status, 400);
  // Valid prompt → 200 with { image, mimeType }.
  const ok = await call(env, 'https://w/image', { method: 'POST', headers: authHeaders, body: JSON.stringify({ prompt: 'a cat on a wall' }) });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { image: 'BASE64DATA', mimeType: 'image/png' });
  // Over-long prompt is trimmed to the 2000-char cap before it reaches the model.
  const capped = await call(env, 'https://w/image', { method: 'POST', headers: authHeaders, body: JSON.stringify({ prompt: 'p'.repeat(5000) }) });
  assert.equal(capped.status, 200);
  assert.equal(ai.calls.at(-1).opts.prompt.length, 2000, 'prompt truncated to 2000 chars');
});

test('POST /image without the AI binding → 501 (clear message), still authed', async () => {
  const env = envWith(fakeBucket()); // no AI binding
  const res = await call(env, 'https://w/image', { method: 'POST', headers: authHeaders, body: JSON.stringify({ prompt: 'x' }) });
  assert.equal(res.status, 501);
});

test('CORS allowlist: allowlisted origins are echoed; anything else falls back to the canonical Studio origin (H8)', async () => {
  const env = envWith(fakeBucket());
  const allowFor = async (origin) => {
    const res = await call(env, 'https://w/', { method: 'OPTIONS', headers: origin ? { Origin: origin } : {} });
    assert.equal(res.status, 204);
    return res.headers.get('Access-Control-Allow-Origin');
  };
  assert.equal(await allowFor('https://chapbook.rqai.co.uk'), 'https://chapbook.rqai.co.uk', 'hosted Studio');
  assert.equal(await allowFor('http://localhost:4173'), 'http://localhost:4173', 'local dev');
  assert.equal(await allowFor('http://127.0.0.1:4173'), 'http://127.0.0.1:4173', 'local dev');
  assert.equal(await allowFor('https://evil.example.com'), 'https://chapbook.rqai.co.uk', 'disallowed origin → canonical fallback');
  assert.equal(await allowFor(''), 'https://chapbook.rqai.co.uk', 'no Origin → canonical fallback');
});

test('unsupported methods → 405 (the template exposes GET, PUT, POST, OPTIONS only — no DELETE)', async () => {
  const env = envWith(fakeBucket());
  assert.equal((await call(env, 'https://w/', { method: 'DELETE', headers: authHeaders })).status, 405);
  assert.equal((await call(env, 'https://w/', { method: 'PATCH', headers: authHeaders })).status, 405);
});

test('upload routing is root-only: authenticated POST /backup and PUT /anything → 404, never stored; root PUT still 200', async () => {
  const bucket = fakeBucket();
  const env = envWith(bucket);
  // The seam contract (core/r2.js) PUTs to the trimSlash()ed Worker URL — always pathname "/".
  // /backup is a helm-only route this template deliberately does NOT serve; any other path is
  // equally outside the contract and must 404 without storing anything.
  const hit = (method, path) => call(env, 'https://w' + path, {
    method, headers: { ...authHeaders, 'X-Key': 'videos/a.mp4', 'content-type': 'video/mp4' }, body: Buffer.from('V'),
  });
  const backup = await hit('POST', '/backup');
  assert.equal(backup.status, 404, 'POST /backup is not served');
  assert.deepEqual(await backup.json(), { ok: false, error: 'not found' });
  assert.equal((await hit('PUT', '/anything')).status, 404, 'PUT to an arbitrary path is not served');
  assert.equal((await hit('PUT', '/backup/site.tar.gz')).status, 404, 'nested non-contract path is not served');
  assert.equal(bucket._store.size, 0, 'nothing was stored via any non-root path');
  const ok = await hit('PUT', '/');
  assert.equal(ok.status, 200, 'the seam contract — PUT to the Worker root — still uploads');
  assert.ok(bucket._store.has('videos/a.mp4'));
});
