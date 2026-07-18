// Test fixture (NOT a test): a minimal in-memory R2 bucket implementing the surface the
// Worker uses — put(key, body, opts) / get(key) / delete(key) / list({prefix,cursor,limit}).
// Used by worker.test.mjs so the tests run with no network and no real R2.
export function fakeBucket(seed = {}) {
  const store = new Map();
  for (const [k, v] of Object.entries(seed)) {
    const buf = Buffer.isBuffer(v) ? v : Buffer.from(String(v));
    store.set(k, { body: buf, size: buf.length, etag: `e-${buf.length}`, uploaded: new Date(), httpMetadata: {} });
  }
  const toBuf = async (body) => {
    if (body == null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (body instanceof ArrayBuffer) return Buffer.from(body);
    if (typeof body === 'string') return Buffer.from(body);
    // Mirror real R2: a raw ReadableStream of unknown length (e.g. the output of
    // request.body.pipeThrough(...)) is REJECTED. The Worker must hand R2 a known-length body —
    // an ArrayBuffer, or the readable half of a FixedLengthStream. This guard is what makes the
    // "put failed: Provided readable stream must have a known length" bug fail loudly in tests.
    if (body instanceof ReadableStream || (body && typeof body.getReader === 'function')) {
      throw new Error('Provided readable stream must have a known length (request/response body or readable half of FixedLengthStream)');
    }
    if (typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer());
    return Buffer.from(await new Response(body).arrayBuffer());
  };
  return {
    _store: store,
    async put(key, body, opts) {
      const buf = await toBuf(body);
      store.set(key, { body: buf, size: buf.length, etag: `e-${buf.length}`, uploaded: new Date(), httpMetadata: opts?.httpMetadata || {} });
      return { key, size: buf.length, etag: `e-${buf.length}` };
    },
    async get(key) {
      const o = store.get(key);
      if (!o) return null;
      return { key, size: o.size, etag: o.etag, uploaded: o.uploaded, httpMetadata: o.httpMetadata, body: o.body };
    },
    async delete(key) { store.delete(key); },
    async list({ prefix, cursor, limit = 1000 } = {}) {
      const keys = [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const slice = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return {
        objects: slice.map((k) => ({ key: k, size: store.get(k).size, etag: store.get(k).etag, uploaded: store.get(k).uploaded })),
        truncated,
        cursor: truncated ? slice[slice.length - 1] : undefined,
      };
    },
  };
}
