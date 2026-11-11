// Behaviour for block pages: the booking bar in the opening and the order list. This is not
// movement: it runs whatever movement a page has, and for visitors who ask for less motion.
//
// Neither ever sends anything. Each writes the visitor's request out and opens it on their own
// device (the booking page, WhatsApp or their email app), where they choose whether to send it.
// The page cannot know whether anything opened, so after a press it shows the request as text,
// with a button to copy it and the number or address to send it to.
//
// Before this script starts, every button is a plain link to the same place (see render.mjs), so
// an early press still goes somewhere sensible. Without it, each is one plain button.
//
// It never builds HTML from text: words go in with textContent, and the addresses it opens are
// built from the page's own data attributes, checked again here, with every part encoded.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WA = /^[1-9]\d{7,14}$/;
const MAIL = /^[^\s@<>"'?&#%]+@[^\s@<>"'?&#%]+\.[^\s@<>"'?&#%]+$/;
// How long an address opened for WhatsApp or email may be. Longer ones are cut by some phones and
// mail apps, so the message is shortened to fit (the copy box always holds all of it).
export const MAX_URL = 1800;

// ---- the pure parts (tested on their own) ---------------------------------------------------
// "2026-11-20" → "Friday 20 November 2026"; anything that is not a real date → "".
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return '';
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Today on the visitor's own calendar, as the date box wants it.
export function isoToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// A currency written as a sign (£, €, $…) or a code (GBP, kr…). Codes that mean one sign are
// read as that sign, so "£5" and "5 GBP" are the same currency.
const CODES = 'GBP|EUR|USD|AUD|CAD|NZD|CHF|SEK|NOK|DKK|ISK|PLN|CZK|HUF|JPY|INR|ZAR|kr|zł|Kč|Ft|Rs|R';
const AS_SIGN = { GBP: '£', EUR: '€', USD: '$', JPY: '¥', INR: '₹', RS: '₹' };
const MARK = String.raw`\p{Sc}|(?:${CODES})(?![\p{L}])`;
// One plain amount: a currency beside exactly one number, perhaps followed by "each".
const PLAIN = new RegExp(String.raw`^(?:(${MARK})\s?)?(\d(?:[\d.,   ]*\d)?)(?:\s?(${MARK}))?(?:\s+each)?$`, 'iu');
const markOf = (m) => { if (!m) return ''; if (/^\p{Sc}$/u.test(m)) return m; const up = m.toUpperCase(); return AS_SIGN[up] || (/^[A-Z]{3}$/.test(up) ? up : up === 'KR' ? 'kr' : m); };
// The number in pence (or cents), reading the marks the way people write them: a dot or comma
// followed by exactly three digits groups thousands ("£1,200", "€1.500"); followed by one or two
// it marks the pence; when both appear the last one marks the pence; spaces group thousands.
// Anything that does not read cleanly is null.
export function amountOf(raw) {
  const parts = String(raw).replace(/[  ]/g, ' ').split(/([ .,])/);
  const digits = parts.filter((_, i) => i % 2 === 0), seps = parts.filter((_, i) => i % 2 === 1);
  if (digits.some((d) => !/^\d+$/.test(d))) return null;
  const lastDot = seps.lastIndexOf('.'), lastComma = seps.lastIndexOf(',');
  let dec = -1;
  if (lastDot >= 0 && lastComma >= 0) dec = Math.max(lastDot, lastComma);
  else {
    const k = Math.max(lastDot, lastComma);
    if (k >= 0 && seps.filter((s) => s === seps[k]).length === 1 && digits[k + 1].length <= 2) dec = k;
  }
  if (dec >= 0 && (dec !== seps.length - 1 || digits[dec + 1].length > 2)) return null;
  const groups = seps.map((_, i) => i).filter((i) => i !== dec);
  if (groups.length && (digits[0].length > 3 || groups.some((i) => digits[i + 1].length !== 3))) return null;
  if (new Set(groups.map((i) => seps[i]).filter((s) => s !== ' ')).size > 1) return null;
  const whole = digits.slice(0, dec >= 0 ? dec + 1 : digits.length).join('');
  const part = dec >= 0 ? digits[dec + 1].padEnd(2, '0') : '00';
  return Number(whole) * 100 + Number(part);
}
// A price as typed. It counts only when it is one plain amount ("£9.50", "9,50 €", "€1.500",
// "£4 each"); "Free" and "£0" are nothing to pay. Anything else ("2 for £5", "from £20",
// "£10 to £15", "250g £4.50", "Ask us") is priced on request: pence is null.
export function parsePrice(text) {
  const s = String(text ?? '').trim();
  if (/^free$/i.test(s)) return { pence: 0, sign: '', free: true };
  const m = s.match(PLAIN);
  if (!m || (m[1] && m[3])) return { pence: null, sign: '', free: false };
  const pence = amountOf(m[2]);
  if (pence === null) return { pence: null, sign: '', free: false };
  return { pence, sign: markOf(m[1] || m[3] || ''), free: pence === 0 };
}
// 1900 pence and "£" → "£19"; 1950 → "£19.50"; 125000 → "£1,250". A code goes after: "1,500 kr".
export function formatMoney(pence, sign = '') {
  const n = `${String(Math.floor(Math.abs(pence) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${Math.abs(pence) % 100 ? `.${String(Math.abs(pence) % 100).padStart(2, '0')}` : ''}`;
  const after = sign && !/^\p{Sc}$/u.test(sign);
  return `${pence < 0 ? '-' : ''}${after ? `${n} ${sign}` : `${sign}${n}`}`;
}
export const clampQty = (n) => Math.max(0, Math.min(99, Math.round(Number(n)) || 0));
// lines: [{ name, qty, price }] where price is the price as typed. Only the chosen lines count,
// and their currency is the one they share; if they do not share one there is no single total.
export function orderTotal(lines) {
  let pence = 0, count = 0, onRequest = 0, priced = 0;
  const signs = new Set();
  for (const l of lines) {
    const qty = clampQty(l.qty);
    if (!qty) continue;
    const p = parsePrice(l.price);
    count += qty;
    if (p.pence === null) { onRequest += qty; continue; }
    priced += qty; pence += p.pence * qty;
    if (p.sign && p.pence) signs.add(p.sign);
  }
  return { pence, sign: [...signs][0] || '', count, onRequest, priced, mixed: signs.size > 1 };
}
const items = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;
// What the running total says.
export function totalText(t) {
  if (!t.count) return 'Nothing chosen yet';
  if (t.mixed) return `${items(t.count)} chosen. Prices are in more than one currency, so there is no single total.`;
  if (!t.priced) return `${items(t.count)} chosen, priced on request`;
  const more = t.onRequest ? `, plus ${t.onRequest} priced on request` : '';
  return t.pence ? `Total: ${formatMoney(t.pence, t.sign)} for ${items(t.count)}${more}` : `Total: free for ${items(t.count)}${more}`;
}
// The order written out, one plain line each. `show` leaves out the lines after that many (the
// total still counts them) to fit a message that has to be short.
export function orderMessage({ site = '', lines = [], name = '', notes = '' }, { show = Infinity } = {}) {
  const t = orderTotal(lines);
  const chosen = lines.filter((l) => clampQty(l.qty));
  const out = [site ? `Order for ${site}` : 'Order'];
  for (const l of chosen.slice(0, show)) {
    const p = parsePrice(l.price);
    out.push(`${clampQty(l.qty)} x ${l.name} (${p.free ? 'free' : p.pence === null ? 'price on request' : String(l.price).trim()})`);
  }
  if (chosen.length > show) out.push(`(${items(chosen.length - show)} more did not fit in this message.)`);
  if (t.count && !t.mixed) out.push(!t.priced ? 'Total: priced on request' : `Total: ${t.pence ? formatMoney(t.pence, t.sign) : 'free'}${t.onRequest ? `, plus ${t.onRequest} priced on request` : ''}`);
  if (String(name).trim()) out.push(`Name: ${String(name).trim()}`);
  if (String(notes).trim()) out.push(`Notes: ${String(notes).trim().replace(/\s*\n\s*/g, ' / ')}`);
  return out.join('\n');
}
// The booking bar's request in one plain sentence.
export function barMessage({ site = '', date = '', people = '' }) {
  const day = longDate(date), n = Number(people);
  const who = n >= 13 ? ' for 13 or more people' : n === 1 ? ' for 1 person' : n > 1 ? ` for ${n} people` : '';
  return `Hello${site ? ` ${site}` : ''}, I would like to check availability${who}${day ? ` on ${day}` : ''}.`;
}
export const waUrl = (digits, text) => (WA.test(String(digits)) ? `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '');
export function mailUrl(to, subject, body) {
  if (!MAIL.test(String(to))) return '';
  const q = [subject ? `subject=${encodeURIComponent(subject)}` : '', body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&');
  return `mailto:${to}${q ? `?${q}` : ''}`;
}
// The booking page, with the chosen date passed on when it is a Cal.com page (which opens on it).
export function bookingUrl(href, date, cal = false) {
  let u;
  try { u = new URL(String(href)); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password) return '';
  if (cal && longDate(date)) u.searchParams.set('date', date);
  return u.href;
}
// Where a booking bar sends the visitor, for its kind ('page', 'whatsapp', 'email').
export function barUrl(kind, to, { site = '', date = '', people = '', cal = false } = {}) {
  if (kind === 'page') return bookingUrl(to, date, cal);
  const text = barMessage({ site, date, people });
  if (kind === 'whatsapp') return waUrl(to, text);
  if (kind === 'email') return mailUrl(to, longDate(date) ? `Checking availability on ${longDate(date)}` : 'Checking availability', text);
  return '';
}
// The address that opens the order, kept under `max` characters: the notes are shortened first,
// then lines are left out from the end (the message says so, and the total still counts them).
export function orderUrl(kind, to, order, max = MAX_URL) {
  const make = (o, opts) => { const text = orderMessage(o, opts); return kind === 'whatsapp' ? waUrl(to, text) : kind === 'email' ? mailUrl(to, o.site ? `Order for ${o.site}` : 'An order', text) : ''; };
  let o = { ...order }, url = make(o);
  if (!url || url.length <= max) return url;
  let notes = String(o.notes || '').trim();
  while (notes && url.length > max) {
    notes = notes.length > 40 ? notes.slice(0, Math.floor(notes.length * 0.6)).trimEnd() : '';
    o = { ...o, notes: notes ? `${notes}...` : '' };
    url = make(o);
  }
  let show = (o.lines || []).filter((l) => clampQty(l.qty)).length;
  while (url.length > max && show > 1) { show -= 1; url = make(o, { show }); }
  return url;
}

// ---- on the page ------------------------------------------------------------------------------
// options: `open(url, target)` replaces how an address is opened (the window's own open() unless
// given); `preview: true` is for a page shown inside Chapbook (a template preview, the editor's
// Play), where nothing is opened for real, so the status says what would happen on the website;
// `clock` supplies timers for a frame whose own timers never fire (as initPageMotion takes it).
// A page being edited (data-m-edit) is left alone. Returns a stop function that puts the page back
// exactly as it was drawn, including the boot flag (html.cba-js) the bar and list rely on.
export function initPageActions(doc = document, win = window, { open, preview = false, clock = win } = {}) {
  const root = doc.querySelector('.cbp');
  if (!root || root.hasAttribute('data-m-edit')) return () => {};
  if (typeof root.__cbaStop === 'function') root.__cbaStop();
  const html = doc.documentElement;
  const undo = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); undo.push(() => target.removeEventListener(type, fn, opts)); };
  const timers = new Set();
  const later = (fn, ms) => { const t = clock.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  undo.push(() => { for (const t of timers) clock.clearTimeout(t); timers.clear(); });
  // Every attribute this run changes is put back as it was.
  const kept = new Map();
  const keep = (el, name) => { if (!el) return; const m = kept.get(el) || new Map(); if (!m.has(name)) m.set(name, el.getAttribute(name)); kept.set(el, m); };
  const setAttr = (el, name, value) => { if (!el) return; keep(el, name); if (value === null || value === false) el.removeAttribute(name); else el.setAttribute(name, value === true ? '' : value); };
  const show = (el, yes) => setAttr(el, 'hidden', !yes);
  undo.push(() => { for (const [el, m] of kept) for (const [name, v] of m) { if (v === null) el.removeAttribute(name); else el.setAttribute(name, v); } kept.clear(); });
  // The values a visitor typed are cleared again too.
  const fields = [...root.querySelectorAll('.cb-bar input, .cb-bar select, .cb-order-who input, .cb-order-who textarea')].map((f) => [f, f.value]);
  undo.push(() => { for (const [f, v] of fields) f.value = v; });
  const go = open || ((url, target) => {
    // WhatsApp opens beside the website; an email or the booking page take its place.
    const w = win.open(url, target);
    if (w && target === '_blank') { try { w.opener = null; } catch { /* another site */ } }
    if (!w) win.location.href = url;
  });
  const madeHere = [];
  undo.push(() => { for (const el of madeHere) el.remove(); madeHere.length = 0; });
  const make = (tag, cls, text) => { const el = doc.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  // After a press: the request as text with a Copy button, since the page cannot know whether
  // anything opened. Replaced by the next press.
  let n = 0;
  function sentBox(after, old, { text, copy }) {
    old?.remove();
    const box = make('div', 'cb-sent'), id = `cba-sent-${++n}`;
    const label = make('label', 'cb-sent-label', copy === 'Copy order' ? 'Your order' : 'Your request');
    label.htmlFor = id;
    const area = make('textarea', 'cb-sent-text'); area.id = id; area.readOnly = true; area.rows = Math.min(10, text.split('\n').length + 1); area.value = text;
    const button = make('button', 'cb-btn cb-btn-2 cb-sent-copy', copy); button.type = 'button';
    const done = make('span', 'cb-sent-done'); done.setAttribute('aria-live', 'polite');
    on(button, 'click', async () => {
      let ok = false;
      try { await win.navigator.clipboard.writeText(text); ok = true; } catch {
        try { area.focus(); area.select(); ok = doc.execCommand('copy'); } catch { ok = false; }
      }
      done.textContent = ok ? 'Copied.' : 'Select the text above and copy it.';
      later(() => { done.textContent = ''; }, 5000);
    });
    const row = make('p', 'cb-sent-row'); row.append(button, done);
    box.append(label, area, row);
    after.after(box); madeHere.push(box);
    return box;
  }
  const where = (kind, to) => (kind === 'whatsapp' ? `+${to}` : to);

  // ---- booking bar ----
  for (const bar of root.querySelectorAll('.cb-bar[data-bar]')) {
    const kind = bar.getAttribute('data-bar'), to = bar.getAttribute('data-bar-to') || '';
    const site = bar.getAttribute('data-site') || '', cal = bar.hasAttribute('data-bar-cal');
    const button = bar.querySelector('.cb-bar-go');
    if (!button || !barUrl(kind, to)) continue;   // nowhere safe to go: the plain button stays
    const date = bar.querySelector('input[type="date"]'), people = bar.querySelector('select');
    const wrap = bar.parentElement, plain = wrap?.querySelector('.cb-bar-plain');
    setAttr(date, 'min', isoToday());
    show(bar, true); show(plain, false);
    const status = make('p', 'cb-small cb-bar-status'); status.setAttribute('role', 'status');
    bar.after(status); madeHere.push(status);
    let box = null;
    on(button, 'click', (e) => {
      e.preventDefault();
      const chosen = { site, cal, date: date?.value || '', people: people?.value || '' };
      const url = barUrl(kind, to, chosen);
      if (!url) return;
      const what = kind === 'whatsapp' ? 'WhatsApp' : kind === 'email' ? 'your email app' : 'the booking page';
      if (preview) { status.textContent = `On your website this opens ${kind === 'page' ? 'the booking page' : `${what} with the request written out`}.`; return; }
      go(url, kind === 'whatsapp' ? '_blank' : '_self');
      if (kind === 'page') {
        status.textContent = 'We tried to open the booking page. If nothing opened, ';
        const a = make('a', '', 'open it here'); a.href = url; a.rel = 'noopener';
        status.append(a, '.');
        return;
      }
      status.textContent = `We tried to open ${what} with this request. If nothing opened, copy it and send it to ${where(kind, to)}.`;
      box = sentBox(status, box, { text: barMessage(chosen), copy: 'Copy request' });
    });
  }

  // ---- order list ----
  for (const list of root.querySelectorAll('.cb-order[data-order]')) {
    const kind = list.getAttribute('data-order'), to = list.getAttribute('data-order-to') || '', site = list.getAttribute('data-site') || '';
    if (!(kind === 'whatsapp' ? waUrl(to, '') : mailUrl(to))) continue;
    const rows = [...list.querySelectorAll('.cb-order-item')].map((li) => ({
      li, name: (li.querySelector('.cb-order-name')?.textContent || '').trim(), price: (li.querySelector('.cb-order-price')?.textContent || '').trim(),
      step: li.querySelector('.cb-order-step'), less: li.querySelector('.cb-order-less'), more: li.querySelector('.cb-order-more'), out: li.querySelector('.cb-order-qty'), qty: 0,
    })).filter((r) => r.name && r.step && r.less && r.more && r.out);
    const foot = list.querySelector('.cb-order-foot'), plain = list.querySelector('.cb-order-plain');
    const total = list.querySelector('.cb-order-total'), send = list.querySelector('.cb-order-send'), need = list.querySelector('.cb-order-need'), pay = list.querySelector('.cb-order-pay');
    const status = list.querySelector('.cb-order-status'), who = list.querySelector('.cb-order-who-name'), notes = list.querySelector('.cb-order-who-notes');
    if (!rows.length || !foot || !total || !send || !status) continue;
    const drawn = { total: total.textContent, status: status.textContent, qty: rows.map((r) => r.out.textContent) };
    const lines = () => rows.map((r) => ({ name: r.name, price: r.price, qty: r.qty }));
    const sync = () => {
      for (const r of rows) {
        r.out.textContent = String(r.qty);
        setAttr(r.less, 'disabled', r.qty === 0); setAttr(r.more, 'disabled', r.qty === 99);
        keep(r.li, 'class'); r.li.classList.toggle('is-chosen', r.qty > 0);
      }
      const t = orderTotal(lines());
      const words = totalText(t);
      if (total.textContent !== words) total.textContent = words;
      setAttr(send, 'aria-disabled', t.count ? 'false' : 'true');
      show(need, !t.count);
    };
    for (const r of rows) {
      show(r.step, true);
      on(r.more, 'click', () => { r.qty = Math.min(99, r.qty + 1); sync(); if (r.qty === 99) r.less.focus(); });
      on(r.less, 'click', () => { r.qty = Math.max(0, r.qty - 1); sync(); if (!r.qty) r.more.focus(); });
    }
    show(foot, true); show(plain, false);
    let box = null;
    on(send, 'click', (e) => {
      e.preventDefault();
      if (!orderTotal(lines()).count) { status.textContent = 'Choose at least one item first.'; return; }
      if (who && !who.value.trim()) { status.textContent = 'Add your name, so they know who the order is from.'; who.focus(); return; }
      const order = { site, lines: lines(), name: who?.value || '', notes: notes?.value || '' };
      const what = kind === 'whatsapp' ? 'WhatsApp' : 'your email app';
      if (preview) { status.textContent = `On your website this opens ${kind === 'whatsapp' ? 'WhatsApp' : 'an email'} with the order written out.`; return; }
      const url = orderUrl(kind, to, order);
      if (!url) return;
      go(url, kind === 'whatsapp' ? '_blank' : '_self');
      status.textContent = `We tried to open ${what} with this order. If nothing opened, copy it and send it to ${where(kind, to)}.`;
      box = sentBox(status, box, { text: orderMessage(order), copy: 'Copy order' });
      show(pay, true);
    });
    sync();
    undo.push(() => {
      for (const [i, r] of rows.entries()) { r.qty = 0; r.out.textContent = drawn.qty[i]; }
      total.textContent = drawn.total; status.textContent = drawn.status;
    });
  }

  // The boot flag (normally set by the page itself) says the bar and list can be shown in full.
  // Set here too, in case this starts after the page's own fallback took it away.
  // Stopping takes it away again, whoever set it: without this script, the plain buttons show.
  html.classList.add('cba-js');
  undo.push(() => html.classList.remove('cba-js'));
  const stop = () => { if (root.__cbaStop === stop) delete root.__cbaStop; while (undo.length) { try { undo.pop()(); } catch { /* keep undoing */ } } };
  root.__cbaStop = stop;
  return stop;
}

// On a published page: start now, and again after each in-site page change (as page-motion.js).
export function startPageActions() {
  if (typeof document === 'undefined') return;
  let stop = null, running = null;
  const run = () => {
    const root = document.querySelector('.cbp');
    if (root && root === running) return;
    stop?.(); stop = null; running = null;
    try { stop = initPageActions(document, window); running = root; window.__cba = true; }
    catch (e) {
      // The plain buttons come back, so every visitor still has a way to book or order.
      document.documentElement.classList.remove('cba-js'); window.__cba = false;
      console.warn('page actions:', e && e.message);
    }
  };
  run();
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', () => { stop?.(); stop = null; running = null; });
  document.addEventListener('astro:after-swap', () => { window.__cba = false; if (document.querySelector('.cbp')) document.documentElement.classList.add('cba-js'); });
}
