// Movement for block pages: the parts of motion.css that need a script (things arriving as the
// reader scrolls, the opening heading, counting numbers, pointer effects, the constellation and
// the Pause button). The page reads perfectly well without this file: it only ever adds.
//
// It never builds HTML from text. Words are moved into new elements with textContent, so nothing
// a writer typed can become markup. It takes the document and window to work on, so Chapbook's
// editor can run it on its preview from outside (no script runs inside that preview).

const TARGETS = [
  '.cb-kicker', '.cb-h', '.cb-rich', '.cb-actions', '.cb-facts', '.cb-figure', '.cb-pic-frame', '.cb-hero-pic', '.cb-hero-panel', '.cb-hero-card',
  '.cb-poster-foot', '.cb-giant-foot', '.cb-mq', '.cb-film', '.cb-orbit', '.cb-collage', '.cb-arch', '.cb-stage', '.cb-svc > *', '.cb-team > *', '.cb-reviews > *',
  '.cb-gallery > *', '.cb-fact', '.cb-faq-item', '.cb-post', '.cb-creds > li', '.cb-form', '.cb-booking-cal', '.cb-booking-card', '.cb-video', '.cb-interactive',
  '.cb-contact-card', '.cb-cta-card', '.cb-cta-split > *', '.cb-notice-text', '.cb-more', '.cb-map', '.cb-socials', '.cb-step', '.cb-show-item', '.cb-credits', '.cb-small', '.cb-head-row > a',
].join(',');
// Layouts that bring themselves in; the scroll effect leaves them alone.
const OWN_ENTRANCE = '.cb-bento, .cb-curtain, .cb-open, .cb-hero-bg, .cb-backdrop, .cbm-bd, .cb-mask-thumb, .cb-plates-bg, .cb-plates-wipe';
const PICTURES = '.cb-pic-frame, .cb-figure, .cb-svc-pic, .cb-portrait, .cb-show-pic, .cb-gallery > figure, .cb-hero-pic:not(.cb-hero-bg):not(.cb-stage-pic):not(.cb-arch-pic):not(.cb-curtain-pic)';
const KEEPS_MOVING = '.cb-car:not(.cb-car-still), .cb-depth, .cb-bw, .cb-lens, .cbm-bd canvas, .cb-mq:not(.cb-mq-still), .cb-film:not(.cb-film-still), .cbm-bd, .cb-orbit, .cb-collage, .cb-arch-badge, .cb-mask-h, .cb-rot, .cb-blob, .cb-inset-bg, .cb-open-bg, .cb-factlist-circles';
const PAUSE_KEY = 'cbm-paused';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// `clock` is where timers and animation frames come from. It is the page's own window, except in
// Chapbook's editor: its Play preview runs no script of its own (timers never fire there), so it
// borrows the editor's. A document being edited (data-m-edit) is left alone.
export function initPageMotion(doc = document, win = window, { clock = win } = {}) {
  const root = doc.querySelector('.cbp');
  if (!root) return () => {};
  // Started again on a page that is already running: the earlier run is stopped first, so nothing
  // is ever wrapped, observed or added twice.
  if (typeof root.__cbmStop === 'function') root.__cbmStop();
  const html = doc.documentElement;
  const media = (q) => { try { return win.matchMedia(q).matches; } catch { return false; } };
  const reduce = media('(prefers-reduced-motion: reduce)');
  const editing = root.hasAttribute('data-m-edit');
  if (editing) return () => {};
  const finePointer = media('(hover: hover) and (pointer: fine)');
  const look = (k) => root.getAttribute(`data-m-${k}`) || '';
  const undo = [];
  // False once this run has been stopped; anything still waiting (a frame, a font) checks it.
  let alive = true;
  undo.push(() => { alive = false; });
  const frame = (fn) => clock.requestAnimationFrame(() => { if (alive) fn(); });
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); undo.push(() => target.removeEventListener(type, fn, opts)); };
  const timers = new Set();
  const later = (fn, ms) => { const t = clock.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  undo.push(() => { for (const t of timers) clock.clearTimeout(t); timers.clear(); });
  const paused = () => html.classList.contains('cbm-paused');
  const wakers = [];   // loops to restart when the visitor presses Play again
  const blocks = [...root.children].filter((n) => n.classList?.contains('cb'));
  // The page's opening: its first Opening block, which need not be the very first block.
  const hero = blocks.find((b) => b.classList.contains('cb-opening')) || null;
  const pace = { calm: [1050, 110], lively: [600, 55] }[look('pace')] || [750, 70];

  // ---- the giant name: trimmed to fill the width exactly ------------------------------------
  for (const h of root.querySelectorAll('.cb-wordmark:not(.cb-wordmark-long)')) {
    // Measured at a known size with transitions off, so the answer never depends on a size that
    // is still on its way to changing (some designs give everything a very short transition).
    const fit = () => {
      const box = h.parentElement.getBoundingClientRect().width;
      if (!(box > 0)) return;
      const before = { transition: h.style.transition, fontSize: h.style.fontSize };
      h.style.transition = 'none'; h.style.fontSize = '100px';
      const range = doc.createRange(); range.selectNodeContents(h);
      const text = range.getBoundingClientRect().width;
      h.style.fontSize = before.fontSize;
      void h.offsetWidth;
      h.style.transition = before.transition;
      // The size is a share of the box's width, so the box itself cancels out: text 100px tall
      // that is `text` wide fills the box at (100 / text) of its width, less a hair for safety.
      if (text > 0) h.style.setProperty('--fit', clamp(9850 / text, 4, 40).toFixed(3));
    };
    fit();
    doc.fonts?.ready?.then(() => { if (alive) fit(); }).catch(() => {});
    on(win, 'resize', fit, { passive: true });
  }

  // ---- the opening the page slides over: its height, so a tall one is seen in full first ------
  if (hero && look('opening') === 'cover') {
    const measure = () => root.style.setProperty('--hero-h', `${Math.round(hero.getBoundingClientRect().height)}px`);
    measure();
    on(win, 'resize', measure, { passive: true });
    if ('ResizeObserver' in win) { const ro = new win.ResizeObserver(measure); ro.observe(hero); undo.push(() => ro.disconnect()); }
    undo.push(() => root.style.removeProperty('--hero-h'));
  }

  // ---- changing words in the opening heading ------------------------------------------------
  if (!reduce) {
    for (const rot of root.querySelectorAll('.cb-rot')) {
      const words = [...rot.children].filter((w) => !w.classList.contains('cb-rot-sep'));
      if (words.length < 2) continue;
      rot.classList.add('is-live');
      let i = Math.max(0, words.findIndex((w) => w.classList.contains('is-on')));
      const tick = clock.setInterval(() => {
        if (paused() || doc.hidden) return;
        const old = words[i]; i = (i + 1) % words.length; const next = words[i];
        old.classList.remove('is-on'); old.classList.add('is-off');
        next.classList.remove('is-off'); next.classList.add('is-on');
        later(() => old.classList.remove('is-off'), 560);
      }, 2600);
      undo.push(() => { clock.clearInterval(tick); rot.classList.remove('is-live'); words.forEach((w, k) => { w.classList.remove('is-off'); w.classList.toggle('is-on', k === 0); }); });
    }
  }

  // ---- the opening heading: word by word, letter by letter, typed ---------------------------
  const headingStyle = look('heading');
  let splitHeading = null;
  if (!reduce && hero && ['words', 'letters', 'typed', 'gather'].includes(headingStyle)) {
    const h = hero.querySelector('.cb-hero-h');
    if (h && !h.closest('.cb-mq') && !h.classList.contains('cb-mask-h') && !h.classList.contains('cb-open-h') && !h.isContentEditable) {
      const original = [...h.childNodes].map((n) => n.cloneNode(true));
      // The changing words are a list in the markup ("brands, websites, films"), so the text as
      // written is already the right thing to say.
      const label = h.textContent.replace(/\s+/g, ' ').trim();
      const frag = doc.createDocumentFragment();
      let k = 0;
      const span = (cls, text) => { const s = doc.createElement('span'); s.className = cls; if (text !== undefined) s.textContent = text; return s; };
      const letters = headingStyle !== 'words';
      const holder = letters ? span('cbm-hold') : frag;
      if (letters) { holder.setAttribute('aria-hidden', 'true'); frag.append(holder); }
      for (const node of [...h.childNodes]) {
        if (node.nodeType === 3) {
          for (const part of node.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { holder.append(doc.createTextNode(' ')); continue; }
            if (letters) {
              const group = span('cbm-lg');
              for (const ch of Array.from(part)) {
                const l = span('cbm-l', ch); l.style.setProperty('--k', String(k++));
                // Letters that fly together each start somewhere of their own.
                if (headingStyle === 'gather') { l.style.setProperty('--gx', `${Math.round((Math.random() - 0.5) * 640)}px`); l.style.setProperty('--gy', `${Math.round((Math.random() - 0.5) * 360)}px`); l.style.setProperty('--gr', `${Math.round((Math.random() - 0.5) * 120)}deg`); }
                group.append(l);
              }
              holder.append(group);
            } else {
              const w = span('cbm-w'), inner = span('', part);
              inner.style.setProperty('--k', String(k++)); w.append(inner); holder.append(w);
            }
          }
        } else if (node.nodeType === 1) {
          // The changing words stay one piece.
          if (letters) { node.classList.add('cbm-l'); node.style.setProperty('--k', String(k++)); holder.append(node); }
          else { const w = span('cbm-w'), inner = span(''); inner.style.setProperty('--k', String(k++)); inner.append(node); w.append(inner); holder.append(w); }
        }
      }
      if (headingStyle === 'typed') { const caret = span('cbm-caret'); holder.append(caret); later(() => caret.remove(), k * 46 + 3200); }
      h.replaceChildren(frag);
      if (letters && label) h.setAttribute('aria-label', label);
      splitHeading = h;
      undo.push(() => { h.replaceChildren(...original); h.removeAttribute('aria-label'); h.classList.remove('is-in'); });
    }
  }

  // ---- things arriving as the reader scrolls -------------------------------------------------
  const scroll = look('scroll'), unveil = look('pictures') === 'unveil';
  let seen = null;
  if (!reduce && (scroll || unveil) && 'IntersectionObserver' in win) {
    const marked = [];
    blocks.forEach((block) => {
      const isHero = block === hero;
      const blockBox = block.getBoundingClientRect();
      const mid = blockBox.left + blockBox.width / 2;
      if (scroll) {
        for (const el of block.querySelectorAll(TARGETS)) {
          if (el.closest(OWN_ENTRANCE) || el.parentElement.closest('[data-m]')) continue;
          if (el === splitHeading || el.matches('.pe-add-cell, .pe-add, .cb-add-btn')) continue;
          const pic = isHero && el.matches('.cb-hero-pic, .cb-orbit, .cb-collage, .cb-arch, .cb-stage, .cb-film');
          if (pic && unveil && el.matches(PICTURES)) continue;   // unveiled below instead
          el.setAttribute('data-m', pic ? 'pic' : '');
          if (scroll === 'slide') {
            const r = el.getBoundingClientRect(), c = r.left + r.width / 2;
            const x = r.width > blockBox.width * 0.7 || Math.abs(c - mid) < blockBox.width * 0.08 ? 0 : c < mid ? 1 : -1;
            el.style.setProperty('--m-x', String(x)); el.style.setProperty('--m-ax', String(Math.abs(x)));
          }
          marked.push(el);
        }
      }
      if (unveil) {
        for (const el of block.querySelectorAll(PICTURES)) {
          if (el.closest(OWN_ENTRANCE) || el.getAttribute('data-m') === 'pic' || !el.querySelector('img, video')) continue;
          el.setAttribute('data-mp', '');
          if (!el.hasAttribute('data-m')) marked.push(el);
        }
      }
    });
    root.classList.add('cbm-ready');
    const settle = (el, wait) => later(() => {
      el.removeAttribute('data-m'); el.removeAttribute('data-mp'); el.classList.remove('is-in');
      for (const p of ['--m-i', '--m-x', '--m-ax']) el.style.removeProperty(p);
    }, wait);
    const order = new Map(marked.map((el, i) => [el, i]));
    seen = new win.IntersectionObserver((entries) => {
      const vh = win.innerHeight || html.clientHeight;
      const arriving = entries.filter((e) => e.isIntersecting && (e.intersectionRatio >= 0.1 || e.intersectionRect.height > vh * 0.2)).sort((a, b) => order.get(a.target) - order.get(b.target));
      arriving.forEach((e, i) => {
        const el = e.target, inHero = hero && hero.contains(el);
        // In the opening, things follow the heading; elsewhere they follow each other.
        const step = Math.min(i, 9) + (inHero && splitHeading ? 3 : 0);
        el.style.setProperty('--m-i', String(step));
        el.classList.add('is-in');
        seen.unobserve(el);
        settle(el, pace[0] * 2.2 + step * pace[1] + 300);
      });
    }, { threshold: [0, 0.1, 0.25], rootMargin: '0px 0px -5% 0px' });
    // Two frames, so the hidden starting state is painted before anything is asked to move.
    frame(() => frame(() => { for (const el of marked) seen.observe(el); }));
    undo.push(() => {
      seen.disconnect();
      for (const el of marked) { el.removeAttribute('data-m'); el.removeAttribute('data-mp'); el.classList.remove('is-in'); for (const p of ['--m-i', '--m-x', '--m-ax']) el.style.removeProperty(p); }
    });
  } else root.classList.add('cbm-ready');
  undo.push(() => root.classList.remove('cbm-ready'));
  if (splitHeading) frame(() => frame(() => splitHeading.classList.add('is-in')));

  // ---- things that fly apart or together as the reader scrolls --------------------------------
  // Each marked element is given --p, from 0 to 1: how far it has come into view ("enter") or
  // gone on its way out ("exit"). The stylesheet does the rest. Without this, --p is never set
  // and everything sits in its finished place.
  if (!reduce) {
    const moving = [...root.querySelectorAll('[data-scroll]')];
    if (moving.length) {
      for (const el of moving) el.classList.add('is-live');
      let queued = false;
      const place = () => {
        queued = false;
        const vh = win.innerHeight || html.clientHeight;
        for (const el of moving) {
          const r = el.getBoundingClientRect();
          if (r.bottom < -vh || r.top > vh * 2) continue;
          const p = el.getAttribute('data-scroll') === 'exit'
            ? clamp((vh * 0.4 - (r.top + r.height / 2)) / (vh * 0.62), 0, 1)
            : clamp((vh * 0.95 - r.top) / (vh * 0.6), 0, 1);
          el.style.setProperty('--p', p.toFixed(3));
        }
      };
      const ask = () => { if (!queued) { queued = true; frame(place); } };
      on(win, 'scroll', ask, { passive: true }); on(win, 'resize', ask, { passive: true });
      place();
      undo.push(() => { for (const el of moving) { el.classList.remove('is-live'); el.style.removeProperty('--p'); } });
    }
  }

  // ---- shapes in three dimensions ------------------------------------------------------------
  // A globe of dots, a ring, a rolling landscape: points in space, turned a little each frame and
  // drawn smaller and fainter the further away they are. Drawn once and left still for visitors
  // who ask for less motion.
  for (const kind of ['globe', 'ring', 'terrain']) for (const bd of root.querySelectorAll(`.cbm-bd-${kind}`)) shape3d(bd, kind);
  function shape3d(bd, kind) {
    const canvas = bd.querySelector('canvas'), ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const style = win.getComputedStyle(bd);
    const ink = style.getPropertyValue('--bd-ink').trim() || '#888', accent = style.getPropertyValue('--bd-a').trim() || ink;
    const pts = [];
    if (kind === 'globe') { const n = 460; for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; pts.push([Math.cos(a) * r, y, Math.sin(a) * r, i % 9 === 0]); } }
    else if (kind === 'ring') { for (let u = 0; u < 44; u++) for (let v = 0; v < 12; v++) { const a = (u / 44) * Math.PI * 2, b = (v / 12) * Math.PI * 2, R = 0.72 + 0.27 * Math.cos(b); pts.push([R * Math.cos(a), 0.27 * Math.sin(b), R * Math.sin(a), (u + v) % 7 === 0]); } }
    else { for (let z = 0; z < 20; z++) for (let x = 0; x < 40; x++) pts.push([(x / 39 - 0.5) * 3.4, 0, z / 19 * 2.4, (x + z) % 11 === 0]); }
    let w = 0, h = 0, raf = 0, visible = true, t = 0, turn = 0, tilt = 0, last = 0;
    const size = () => { const r = canvas.getBoundingClientRect(), dpr = Math.min(win.devicePixelRatio || 1, 2); w = r.width; h = r.height; canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const paint = () => {
      ctx.clearRect(0, 0, w, h);
      if (kind === 'terrain') {
        for (const [x, , z, hot] of pts) {
          const y = Math.sin(x * 2.1 + t * 0.9) * 0.16 + Math.cos(z * 3.2 - t * 0.7) * 0.13 + Math.sin((x + z) * 1.4 + t * 0.5) * 0.08;
          const depth = 1 / (0.9 + z * 0.85), sx = w / 2 + x * depth * w * 0.36, sy = h * 0.2 + (0.62 - y) * depth * h * 0.95;
          ctx.globalAlpha = clamp(depth * (hot ? 1 : 0.62), 0, 1); ctx.fillStyle = hot ? accent : ink;
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, depth * 2.3), 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const ay = t * 0.28 + turn, ax = (kind === 'ring' ? 1.05 : 0.38) + tilt, cy = Math.cos(ay), sy0 = Math.sin(ay), cx = Math.cos(ax), sx0 = Math.sin(ax), R = Math.min(w, h) * 0.42;
        for (const [x0, y0, z0, hot] of pts) {
          const x = x0 * cy + z0 * sy0, z1 = -x0 * sy0 + z0 * cy, y = y0 * cx - z1 * sx0, z = y0 * sx0 + z1 * cx;
          const depth = 2.4 / (2.4 + z), near = (1 - z) / 2;
          ctx.globalAlpha = clamp(0.18 + near * (hot ? 0.82 : 0.55), 0, 1); ctx.fillStyle = hot ? accent : ink;
          ctx.beginPath(); ctx.arc(w / 2 + x * R * depth, h / 2 + y * R * depth, Math.max(0.6, (0.7 + near * 1.6) * (hot ? 1.5 : 1)), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    const draw = (now) => {
      raf = 0;
      if (!alive || !visible || doc.hidden || paused()) return;
      t += Math.min(0.05, (now - (last || now)) / 1000); last = now;
      paint();
      raf = clock.requestAnimationFrame(draw);
    };
    const wake = () => { last = 0; if (!raf && !reduce) raf = clock.requestAnimationFrame(draw); };
    size(); paint();
    if ('ResizeObserver' in win) { const ro = new win.ResizeObserver(() => { size(); paint(); wake(); }); ro.observe(canvas); undo.push(() => ro.disconnect()); }
    on(win, 'resize', () => { size(); paint(); wake(); }, { passive: true });
    if ('IntersectionObserver' in win) { const io = new win.IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }); io.observe(bd); undo.push(() => io.disconnect()); }
    if (finePointer && kind !== 'terrain') {
      on(bd.parentElement, 'pointermove', (e) => { const r = bd.getBoundingClientRect(); turn = ((e.clientX - r.left) / r.width - 0.5) * 1.2; tilt = ((e.clientY - r.top) / r.height - 0.5) * 0.5; });
      on(bd.parentElement, 'pointerleave', () => { turn = 0; tilt = 0; });
    }
    on(doc, 'visibilitychange', wake);
    wakers.push(wake);
    wake();
    undo.push(() => { clock.cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, w, h); });
  }

  // ---- numbers that count up ----------------------------------------------------------------
  if (!reduce && root.hasAttribute('data-m-count') && 'IntersectionObserver' in win) {
    const counted = new win.IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        counted.unobserve(e.target);
        countUp(e.target);
      }
    }, { threshold: 0.6 });
    for (const el of root.querySelectorAll('.cb-fact-value')) if (parseCount(el.textContent)) counted.observe(el);
    undo.push(() => counted.disconnect());
  }
  function parseCount(text) {
    const m = String(text).trim().match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
    if (!m) return null;
    const [, before, digits, after] = m;
    const plain = digits.replace(/,/g, ''), value = Number(plain);
    if (!Number.isFinite(value) || value === 0) return null;
    // A year is a name, not an amount.
    if (!before && /^\d{4}$/.test(digits) && value >= 1800 && value <= 2100) return null;
    return { before, after, value, decimals: (plain.split('.')[1] || '').length, grouped: digits.includes(',') };
  }
  function countUp(el) {
    const final = el.textContent, c = parseCount(final);
    if (!c) return;
    // While the digits run, assistive technology is given the finished number once.
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', final.trim());
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    const show = (v) => `${c.before}${c.grouped ? v.toLocaleString('en-GB', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }) : v.toFixed(c.decimals)}${c.after}`;
    const start = clock.performance.now(), length = 1500;
    let frame = 0, done = false;
    const finish = () => { if (done) return; done = true; clock.cancelAnimationFrame(frame); el.textContent = final; el.style.removeProperty('min-width'); el.removeAttribute('aria-label'); el.removeAttribute('role'); };
    const step = (now) => {
      const t = clamp((now - start) / length, 0, 1);
      if (t >= 1) return finish();
      el.textContent = show(c.value * (1 - (1 - t) ** 3));
      frame = clock.requestAnimationFrame(step);
    };
    frame = clock.requestAnimationFrame(step);
    undo.push(finish);
  }

  // ---- words that light up as the reader scrolls --------------------------------------------
  if (!reduce) {
    const lit = [];
    for (const box of root.querySelectorAll('.cb-lit')) {
      if (box.isContentEditable || box.querySelector('[contenteditable]')) continue;
      const original = [...box.childNodes].map((n) => n.cloneNode(true));
      const words = [];
      const walker = doc.createTreeWalker(box, 4 /* text */);
      const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
      for (const t of texts) {
        const frag = doc.createDocumentFragment();
        for (const part of t.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(doc.createTextNode(part)); continue; }
          const s = doc.createElement('span'); s.className = 'cbm-lw'; s.textContent = part; words.push(s); frag.append(s);
        }
        t.replaceWith(frag);
      }
      if (words.length) lit.push({ box, words, shown: 0 });
      undo.push(() => box.replaceChildren(...original));
    }
    if (lit.length) {
      let queued = false;
      const paint = () => {
        queued = false;
        const vh = win.innerHeight || html.clientHeight;
        for (const item of lit) {
          const r = item.box.getBoundingClientRect();
          if (r.bottom < -vh || r.top > vh * 2) continue;
          // Lit from when the block's top is most of the way up the screen until its bottom has
          // come into view, so the last words light even when the block ends the page.
          const p = r.bottom <= vh ? 1 : clamp((vh * 0.85 - r.top) / Math.max(r.height - vh * 0.15, vh * 0.25), 0, 1);
          const count = Math.round(p * item.words.length);
          if (count === item.shown) continue;
          const [from, to] = count > item.shown ? [item.shown, count] : [count, item.shown];
          for (let i = from; i < to; i++) item.words[i].classList.toggle('on', count > item.shown);
          item.shown = count;
        }
      };
      const ask = () => { if (!queued) { queued = true; frame(paint); } };
      on(win, 'scroll', ask, { passive: true }); on(win, 'resize', ask, { passive: true });
      ask();
    }
  }

  // ---- pointer effects (a mouse or trackpad only) -------------------------------------------
  if (!reduce && finePointer) {
    if (look('pictures') === 'tilt') {
      for (const el of root.querySelectorAll('.cb-hero-pic:not(.cb-hero-bg):not(.cb-stage-pic), .cb-pic-frame, .cb-svc-cards > article, .cb-reviews-cards .cb-review, .cb-bento-pic, .cb-collage-main')) {
        el.setAttribute('data-mt', '');
        on(el, 'pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--rx', `${((0.5 - (e.clientY - r.top) / r.height) * 9).toFixed(2)}deg`);
          el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 11).toFixed(2)}deg`);
        });
        on(el, 'pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
        undo.push(() => { el.removeAttribute('data-mt'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
      }
    }
    if (look('buttons') === 'magnet') {
      for (const el of root.querySelectorAll('.cb-btn')) {
        on(el, 'pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1)}px`);
          el.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.4).toFixed(1)}px`);
        });
        on(el, 'pointerleave', () => { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); });
      }
    }
    // Photos at different depths: the whole scene leans towards the pointer.
    for (const scene of root.querySelectorAll('.cb-depth, .cb-bw')) {
      const block = scene.closest('.cb') || scene;
      on(block, 'pointermove', (e) => {
        const r = block.getBoundingClientRect();
        scene.style.setProperty('--sy', `${(((e.clientX - r.left) / r.width - 0.5) * 22).toFixed(1)}deg`);
        scene.style.setProperty('--sx', `${((0.5 - (e.clientY - r.top) / r.height) * 14).toFixed(1)}deg`);
        scene.classList.add('is-live');
      });
      on(block, 'pointerleave', () => scene.classList.remove('is-live'));
      undo.push(() => { scene.classList.remove('is-live'); scene.style.removeProperty('--sx'); scene.style.removeProperty('--sy'); });
    }
    // Magnifying glass: it goes where the pointer is, and stays where it was left.
    for (const lens of root.querySelectorAll('.cb-lens')) {
      if (!lens.querySelector('.cb-lens-glass')) continue;
      on(lens, 'pointermove', (e) => {
        const r = lens.getBoundingClientRect();
        lens.style.setProperty('--lx', clamp((e.clientX - r.left) / r.width, 0.2, 0.8).toFixed(3));
        lens.style.setProperty('--ly', clamp((e.clientY - r.top) / r.height, 0.2, 0.8).toFixed(3));
        lens.classList.add('is-live');
      });
      undo.push(() => { lens.classList.remove('is-live'); lens.style.removeProperty('--lx'); lens.style.removeProperty('--ly'); });
    }
    // Spotlight: the light goes where the pointer is.
    for (const bd of root.querySelectorAll('.cbm-bd-spotlight')) {
      const block = bd.parentElement;
      on(block, 'pointermove', (e) => {
        const r = block.getBoundingClientRect();
        bd.style.setProperty('--sx', `${(e.clientX - r.left).toFixed(0)}px`);
        bd.style.setProperty('--sy', `${(e.clientY - r.top).toFixed(0)}px`);
        bd.classList.add('cbm-live');
      });
      undo.push(() => { bd.classList.remove('cbm-live'); bd.style.removeProperty('--sx'); bd.style.removeProperty('--sy'); });
    }
  }
  // The list that changes its photo keeps the last one pointed at.
  for (const list of root.querySelectorAll('.cb-show-switch')) {
    const pick = (e) => { const item = e.target.closest?.('.cb-show-item'); if (!item || item.parentElement !== list) return; for (const x of list.children) x.classList?.toggle('is-on', x === item); };
    on(list, 'pointerover', pick); on(list, 'focusin', pick);
  }
  // Sliders (showcase slider, round photos, reviews one at a time): arrow buttons and a count.
  // People can also swipe or scroll them. The one nearest the middle is the one that is "on".
  if (!editing) {
    for (const list of root.querySelectorAll('.cb-show-slider, .cb-show-plates, .cb-reviews-one')) {
      const items = [...list.children].filter((n) => n.matches('.cb-show-item, .cb-review'));
      if (items.length < 2) continue;
      const plates = list.classList.contains('cb-show-plates') ? list.closest('.cb-plates') : null;
      const nav = doc.createElement('div'); nav.className = 'cb-show-nav';
      const count = doc.createElement('span'); count.className = 'cb-show-count'; count.setAttribute('aria-live', 'polite');
      let current = -1;
      const nearest = () => {
        const mid = list.getBoundingClientRect().left + list.clientWidth / 2;
        let best = 0, gap = Infinity;
        items.forEach((it, k) => { const r = it.getBoundingClientRect(), g = Math.abs(r.left + r.width / 2 - mid); if (g < gap) { gap = g; best = k; } });
        return best;
      };
      const go = (k) => { const it = items[clamp(k, 0, items.length - 1)]; list.scrollTo({ left: it.offsetLeft - list.offsetLeft - (list.clientWidth - it.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' }); };
      const button = (label, dir) => { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = dir < 0 ? '←' : '→'; on(b, 'click', () => go(nearest() + dir)); return b; };
      const prev = button('Previous', -1), next = button('Next', 1);
      nav.append(prev, count, next);
      const sync = () => {
        const k = nearest();
        prev.disabled = k === 0; next.disabled = k === items.length - 1;
        if (k === current) return;
        current = k;
        count.textContent = `${k + 1} of ${items.length}`;
        items.forEach((it, n) => it.classList.toggle('is-on', n === k));
        if (plates) wipe(plates, items[k]);
      };
      let waiting = 0;
      on(list, 'scroll', () => { if (!waiting) waiting = clock.requestAnimationFrame(() => { waiting = 0; sync(); }); }, { passive: true });
      sync();
      list.after(nav);
      undo.push(() => { nav.remove(); items.forEach((it, n) => it.classList.toggle('is-on', n === 0)); });
    }
  }
  // Round photos: the band takes the colour of the plate in the middle, wiping out from it.
  function wipe(plates, item) {
    const c = item.getAttribute('data-plate-c'), ink = item.getAttribute('data-plate-on');
    const veil = plates.querySelector('.cb-plates-wipe'), bg = plates.querySelector('.cb-plates-bg');
    if (!/^#[0-9a-f]{6}$/i.test(c || '') || !/^#[0-9a-f]{6}$/i.test(ink || '') || !veil || !bg) return;
    if (plates.style.getPropertyValue('--plate-c').trim() === c && !veil.classList.contains('is-on')) return;
    // A wipe already under way finishes first; the band then goes to wherever the visitor ended
    // up. That keeps large colour changes to about one a second, however fast the band is swiped.
    if (veil.classList.contains('is-on')) { plates.__next = item; return; }
    const settle = () => {
      plates.style.setProperty('--plate-c', c); veil.classList.remove('is-on'); veil.style.removeProperty('--wipe-c');
      const next = plates.__next; plates.__next = null;
      if (alive && next && next !== item) wipe(plates, next);
    };
    plates.style.setProperty('--plate-on', ink);
    if (reduce) return settle();
    const box = veil.getBoundingClientRect(), pic = (item.querySelector('.cb-show-pic') || item).getBoundingClientRect();
    veil.classList.remove('is-on');
    veil.style.setProperty('--wipe-c', c);
    veil.style.setProperty('--wx', `${(((pic.left + pic.width / 2 - box.left) / box.width) * 100).toFixed(1)}%`);
    veil.style.setProperty('--wy', `${(((pic.top + pic.height / 2 - box.top) / box.height) * 100).toFixed(1)}%`);
    void veil.offsetWidth;            // restart the wipe from nothing
    veil.classList.add('is-on');
    later(settle, 900);
  }

  // ---- constellation -------------------------------------------------------------------------
  if (!reduce) for (const bd of root.querySelectorAll('.cbm-bd-stars')) constellation(bd);
  function constellation(bd) {
    const canvas = bd.querySelector('canvas'), ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const style = win.getComputedStyle(bd);
    const ink = style.getPropertyValue('--bd-ink').trim() || '#888', accent = style.getPropertyValue('--bd-a').trim() || ink;
    let w = 0, h = 0, points = [], frame = 0, visible = true, pointer = null;
    const size = () => {
      const r = bd.getBoundingClientRect(), dpr = Math.min(win.devicePixelRatio || 1, 2);
      w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round((w * h) / 16000), 24, 90);
      points = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: 1 + Math.random() * 1.6, hot: i % 7 === 0 }));
    };
    const draw = () => {
      frame = 0;
      if (!alive || !visible || doc.hidden || paused()) return;
      {
        ctx.clearRect(0, 0, w, h);
        for (const p of points) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          if (pointer) { const dx = pointer.x - p.x, dy = pointer.y - p.y, d = Math.hypot(dx, dy); if (d < 150 && d > 1) { p.x += (dx / d) * 0.35; p.y += (dy / d) * 0.35; } }
        }
        ctx.lineWidth = 1; ctx.strokeStyle = ink;
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) { ctx.globalAlpha = (1 - d / 130) * 0.28; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        for (const p of points) { ctx.globalAlpha = p.hot ? 0.95 : 0.6; ctx.fillStyle = p.hot ? accent : ink; ctx.beginPath(); ctx.arc(p.x, p.y, p.hot ? p.r + 0.8 : p.r, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      frame = clock.requestAnimationFrame(draw);
    };
    const wake = () => { if (!frame) frame = clock.requestAnimationFrame(draw); };
    size(); bd.classList.add('cbm-live');
    if ('ResizeObserver' in win) { const ro = new win.ResizeObserver(() => { size(); wake(); }); ro.observe(bd); undo.push(() => ro.disconnect()); }
    on(win, 'resize', () => { size(); wake(); }, { passive: true });
    if ('IntersectionObserver' in win) { const io = new win.IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }); io.observe(bd); undo.push(() => io.disconnect()); }
    if (finePointer) {
      on(bd.parentElement, 'pointermove', (e) => { const r = bd.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
      on(bd.parentElement, 'pointerleave', () => { pointer = null; });
    }
    on(doc, 'visibilitychange', wake);
    wakers.push(wake);
    wake();
    undo.push(() => { clock.cancelAnimationFrame(frame); frame = 0; bd.classList.remove('cbm-live'); ctx.clearRect(0, 0, w, h); });
  }

  // ---- the Pause button ----------------------------------------------------------------------
  // Anything that keeps moving for more than a few seconds must be stoppable by the visitor.
  if (!reduce && !editing && (root.querySelector(KEEPS_MOVING) || ['zoom'].includes(look('pictures')) || ['glow', 'shine'].includes(look('buttons')) || look('heading') === 'shimmer')) {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'cbm-pause';
    const sync = () => { const off = paused(); button.textContent = off ? 'Play movement' : 'Pause movement'; button.setAttribute('aria-pressed', String(off)); };
    // Remembered for the visit, but only by a page in its own tab: a page shown inside another
    // (Chapbook's Play preview, a template gallery) must not pause the pages shown after it.
    let remember = false; try { remember = win.top === win; } catch { /* another site's frame */ }
    try { if (remember && win.sessionStorage.getItem(PAUSE_KEY) === '1') html.classList.add('cbm-paused'); } catch { /* private browsing */ }
    on(button, 'click', () => {
      const off = html.classList.toggle('cbm-paused');
      try { if (remember) win.sessionStorage.setItem(PAUSE_KEY, off ? '1' : '0'); } catch { /* private browsing */ }
      if (!off) for (const wake of wakers) wake();
      sync();
    });
    sync();
    doc.body.append(button);
    undo.push(() => button.remove());
  }

  const stop = () => { if (root.__cbmStop === stop) delete root.__cbmStop; while (undo.length) { try { undo.pop()(); } catch { /* keep undoing */ } } };
  root.__cbmStop = stop;
  return stop;
}

// On a published page: start now, and again after each in-site page change. The site's router
// also announces the first page once it has finished loading; that page is already running, so
// it is left alone (starting again would hide and replay everything already shown).
export function startPageMotion() {
  if (typeof document === 'undefined') return;
  let stop = null, running = null;
  const run = () => {
    const root = document.querySelector('.cbp');
    if (root && root === running) return;
    stop?.(); stop = null; running = null;
    try { stop = initPageMotion(document, window); running = root; window.__cbm = true; }
    catch (e) {
      // Whatever went wrong, the page must not be left waiting for movement that will not come.
      document.documentElement.classList.remove('cbm-js'); window.__cbm = false;
      console.warn('page movement:', e && e.message);
    }
  };
  run();
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', () => { stop?.(); stop = null; running = null; });
  // A page change inside the site swaps the document in place: say again that a script is here,
  // before the new page is painted, and let the page's own safety timer watch this start too.
  document.addEventListener('astro:after-swap', () => { window.__cbm = false; if (document.querySelector('.cbp')) document.documentElement.classList.add('cbm-js'); });
}
