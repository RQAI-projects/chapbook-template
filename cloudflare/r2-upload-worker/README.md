# R2 upload Worker

A tiny Cloudflare Worker that uploads files to your R2 bucket through an **R2 binding**,
so neither your backend nor the Studio ever has to touch the
`https://<account-id>.r2.cloudflarestorage.com` S3 endpoint (which can fail with a TLS
`handshake_failure`, a Cloudflare account-side cert problem rather than your network).

The Worker runs at a normal `*.workers.dev` hostname with a valid cert, so both your laptop
and your phone (the hosted Studio) can reach it.

## What it does

- `OPTIONS` -> CORS preflight. Origins are checked against an **allowlist** (the hosted
  Chapbook Studio plus localhost dev). Any other origin falls back to the canonical Studio
  origin, so arbitrary origins are never reflected. Methods `GET/PUT/POST/OPTIONS`, headers
  `Authorization, Content-Type, X-Key`.
- `PUT` / `POST` -> requires `Authorization: Bearer <UPLOAD_SECRET>` and an `X-Key` header
  (the object key). The request body is the raw file bytes. The key must sit under `videos/`
  and the content type must be an allowed media type (see hardening below). Writes to the
  bound bucket with the request's `Content-Type` and returns `{ "ok": true, "key": "<key>" }`.
- `GET /list` -> **same** `Authorization: Bearer <UPLOAD_SECRET>` gate. Enumerates the bucket's
  `videos/` prefix via the R2 binding (paging the cursor until exhausted, capped at ~1000) and
  returns `{ "videos": [ { "key", "size", "uploaded" } ] }`, newest first. Keys only: the
  Worker doesn't know the public base, so the Studio builds each URL as `${publicBase}/${key}`.
  This is how the hosted/BYOK Studio (which has no local backend) shows its video library.
- `POST /image` -> **same** `Authorization: Bearer <UPLOAD_SECRET>` gate. Body `{ "prompt": "..." }`.
  Runs Cloudflare Workers AI's **free** `@cf/black-forest-labs/flux-1-schnell` text-to-image
  model through the `env.AI` binding and returns `{ "image": "<base64>", "mimeType": "image/png" }`.
  This gives the Studio free image generation (Generate on any image block) in both modes,
  reusing the **same** Worker URL + secret, with no AI provider key and no extra config.
- Status codes: `401` on a bad/missing Bearer secret, `400` on a missing `X-Key`/prompt,
  `413` when an upload exceeds the size ceiling, `415` on a disallowed content type, `405` on
  any other method, `501` if `/image` is called but the `[ai]` binding isn't deployed yet,
  `429` when Workers AI is rate-limited or out of free quota, `502` on a write/list/image error.

It stores nothing else and has no dependencies.

## Security hardening (what the Worker enforces)

The Bearer secret is the primary gate, but a secret-holder is still held to tight limits so a
leaked or shared secret cannot be turned into arbitrary bucket writes or an XSS vector:

- **Constant-time secret compare.** The Bearer token is compared to `UPLOAD_SECRET` by hashing
  both with SHA-256 and XOR-ing the equal-length digests, so a plain `===` timing oracle can't
  be used to guess the secret byte by byte.
- **Key prefix + path-traversal rejection.** Upload keys must start with `videos/`. Leading
  slashes are stripped, and any `..`, backslash, or doubled slash is rejected. A secret-holder
  can only write under `videos/`, never overwrite an arbitrary object.
- **Content-type allowlist.** Only video and image types (plus `application/octet-stream`) are
  accepted. `text/html` and unknown types are refused with `415`, so the public bucket can never
  be seeded with an HTML/script payload served from your own domain.
- **Upload size ceiling (~600 MB).** An oversized declared `Content-Length` is rejected up front
  with `413`. The body is then streamed through a limiter (a `FixedLengthStream` in the Workers
  runtime, or a size-capped buffer under Node/tests), so a missing or lying `Content-Length`
  cannot blow past the cap. R2 needs a body of known length, which is why the buffer fallback
  hands it an `ArrayBuffer` rather than a raw stream.
- **Prompt length cap.** `/image` prompts are trimmed to 2000 characters before the model runs.
- **CORS allowlist.** Only the origins in `ALLOWED_ORIGINS` are echoed back; every other origin
  falls back to the canonical Studio origin. The Worker never reflects an arbitrary origin.

**Self-hosting the Studio on your own domain?** Add its origin to `ALLOWED_ORIGINS` near the top
of `worker.js` (there's a commented line marking the spot), then redeploy.

## Run the tests

The tests are dependency-free and run against an in-memory fake R2 binding (no network, no real
R2, no Workers AI), using Node's built-in test runner. From the **repo root**:

```sh
node --test cloudflare/r2-upload-worker/worker.test.mjs
```

They cover the hardening above: constant-time auth (wrong/missing/over-long secrets all `401`),
the `videos/` key prefix and path-traversal rejection, the content-type allowlist (`415`), the
size cap (`413`), `GET /list`, `POST /image` (auth, prompt required, 2000-char cap, `501` with no
AI binding), and the CORS allowlist. `npm test` also works (it runs `node --test`), but it will
discover every `*.test.*` file in the project, so use the explicit path above to run just this one.

## Deploy (owner steps)

You need a Cloudflare account with the bucket already created (default name in
`wrangler.toml` is `YOUR-BUCKET-NAME`, edit it if yours differs).

```sh
cd cloudflare/r2-upload-worker

# 1. Deploy the Worker (wrangler will prompt you to log in the first time).
npx wrangler deploy

# 2. Set the shared upload secret (paste a long random string, keep a copy).
npx wrangler secret put UPLOAD_SECRET

# 3. wrangler printed a URL after step 1, e.g.
#      https://r2-upload-worker.<your-subdomain>.workers.dev
#    Copy it, that's your Worker URL.
```

Generate a strong secret with, e.g.: `openssl rand -hex 32`

## Point your backend + the Studio at it

**Backend** (config file), set the media block:

```json
"media": {
  "target": "worker",
  "worker": {
    "url": "https://r2-upload-worker.<your-subdomain>.workers.dev",
    "secret": "<the UPLOAD_SECRET you set above>",
    "publicBase": "https://media.yoursite.com"
  }
}
```

`publicBase` is wherever the bucket serves objects publicly (your R2 custom domain or the
`pub-....r2.dev` URL). The uploaded file's URL becomes `${publicBase}/${key}`.

**Studio**: open **Settings -> Video storage** and, under **Use a Worker**, paste the same
**Worker URL** + **secret** (and the public base URL in the R2 fields). The video block's
"Upload to R2" button will then route through the Worker instead of the S3 endpoint,
**Media -> Video** lists your bucket's clips via the `GET /list` route (same Worker), and the
**Generate** action on any image block makes free images via the `POST /image` route (same
Worker, same secret, see below).

## Free image generation (Workers AI / FLUX), one-time enable

The `POST /image` route needs the Workers AI binding (`env.AI`). It's already declared in
`wrangler.toml`:

```toml
[ai]
binding = "AI"
```

So enabling it is a single redeploy. Your URL + `UPLOAD_SECRET` are unchanged, and the
Studio already has the Worker URL + secret, so **nothing else needs editing**:

```sh
cd cloudflare/r2-upload-worker
npx wrangler deploy
```

Image generation uses Cloudflare's **free** Workers AI daily neuron allowance. If you hit the
cap, `/image` returns `429` with a clear "rate-limited / out of free quota" message, so try again
later. To trade speed for a different look, change `IMAGE_MODEL` in `worker.js` to an SDXL id.

## Redeploy after a Worker change

The `/list` and `/image` routes (and the `[ai]` binding) are added by an edit to this folder,
so an already-deployed Worker needs one redeploy to serve them. One command, from this folder.
Your URL + `UPLOAD_SECRET` are unchanged, so nothing else needs editing:

```sh
cd cloudflare/r2-upload-worker
npx wrangler deploy
```

## Local check

`wrangler` isn't installed in this repo and is not required for the build or tests. Deploying
needs network access and a Cloudflare login, so run the deploy commands above on your machine.
