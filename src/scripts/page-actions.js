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

// ---- signature sections: the pure parts ------------------------------------------------------
// What a number of spaces is called: "6 spaces left", "Last 2", "Last space", "Full".
export const spacesText = (left) => (!(left > 0) ? 'Full' : left === 1 ? 'Last space' : left === 2 ? 'Last 2' : `${Math.floor(left)} spaces left`);
// Whether a line of opening hours ("Mon to Fri", "Saturday", "Tue, Thu and Sat", "Every day")
// covers a day of the week (0 is Sunday). A line that names no day covers none.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function dayInLabel(label, dow) {
  const text = String(label || '').toLowerCase();
  if (/\b(every ?day|daily|all week|7 days)\b/.test(text)) return true;
  const found = [...text.matchAll(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g)].map((m) => ({ d: DAY_KEYS.indexOf(m[1]), at: m.index, end: m.index + m[0].length }));
  for (let i = 0; i < found.length; i++) {
    const a = found[i], b = found[i + 1];
    // "Mon to Fri", "Mon - Fri", "Fri until Sun": every day from the first to the second, round the week.
    if (b && /^\s*(to|until|through|till|-|\u2013|\u2014)\s*$/.test(text.slice(a.end, b.at))) {
      for (let d = a.d; ; d = (d + 1) % 7) { if (d === dow) return true; if (d === b.d) break; }
      i++;
    } else if (a.d === dow) return true;
  }
  return false;
}
// Opening hours, read the way people write them: "Monday to Friday, 9am to 6pm", "Sat 10-2",
// "Sunday: closed", "Tue and Thu 9.30am to 1pm, 2pm to 5.30pm". A time is minutes after midnight.
const TIME = String.raw`(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?|noon|midday|midnight`;
const RANGE = new RegExp(String.raw`(${TIME})\s*(?:to|until|till|-|\u2013|\u2014)\s*(${TIME})`, 'gi');
function readTime(t) {
  const s = String(t).trim().toLowerCase();
  if (s === 'noon' || s === 'midday') return { m: 720, half: '' };
  if (s === 'midnight') return { m: 1440, half: '' };
  const m = /^(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(s);
  if (!m || +m[1] > 24 || (m[2] && +m[2] > 59)) return null;
  const half = m[3] ? m[3][0] : '';
  let h = +m[1] % (half ? 12 : 24);
  if (half === 'p') h += 12;
  return { m: h * 60 + (+m[2] || 0), half };
}
// The times a line of opening hours gives: [[open, close], …], or [] for "closed".
export function hoursSpans(line) {
  const out = [];
  for (const r of String(line || '').matchAll(RANGE)) {
    const a = readTime(r[1]), b = readTime(r[5]);
    if (!a || !b) continue;
    let open = a.m, close = b.m;
    // "9 to 5.30", "9 to 6pm", "1 to 6pm": a time with no am or pm is read the way people mean it.
    if (!a.half && !b.half && open < 7 * 60) open += 720;
    if (!b.half && close <= open && close + 720 <= 1440) close += 720;
    if (!a.half && b.half === 'p' && open + 720 < close && open < 720 && open < 7 * 60) open += 720;
    if (close > open) out.push([open, close]);
  }
  return out;
}
// Today's opening times from the lines of opening hours: [[open, close], …]; [] when closed all
// day; null when no line speaks of that day (or none can be read).
export function hoursOn(lines, dow) {
  let found = null;
  for (const line of lines || []) {
    const text = String(line || '');
    const days = text.replace(new RegExp(RANGE.source, 'gi'), ' ');
    if (!dayInLabel(days, dow)) continue;
    const spans = hoursSpans(text);
    if (spans.length) found = [...(found || []), ...spans];
    else if (/\bclosed\b/i.test(text)) found = found || [];
  }
  return found ? found.sort((x, y) => x[0] - y[0]) : null;
}
// 540 → "9am", 570 → "9.30am", 720 → "12pm", 1080 → "6pm".
export function timeText(m) {
  const h = Math.floor(m / 60) % 24, min = m % 60, half = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12;
  return m === 1440 ? 'midnight' : `${h12}${min ? `.${String(min).padStart(2, '0')}` : ''}${half}`;
}
// What a place's opening hours mean right now: { open, text }, or null when they cannot be read.
// "Open now, closes at 6pm" · "Closed now, opens at 2pm" · "Closed now, opens tomorrow at 9am" ·
// "Closed now, opens Monday at 9am".
export function openState(lines, now = new Date()) {
  const dow = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
  const today = hoursOn(lines, dow);
  if (today === null && [0, 1, 2, 3, 4, 5, 6].every((d) => hoursOn(lines, d) === null)) return null;
  const span = (today || []).find(([a, b]) => mins >= a && mins < b);
  if (span) return { open: true, text: `Open now, closes at ${timeText(span[1])}` };
  const later = (today || []).find(([a]) => a > mins);
  if (later) return { open: false, text: `Closed now, opens at ${timeText(later[0])}` };
  for (let k = 1; k <= 7; k++) {
    const d = (dow + k) % 7, next = hoursOn(lines, d);
    if (next && next.length) return { open: false, text: `Closed now, opens ${k === 1 ? 'tomorrow' : `on ${DAYS[d]}`} at ${timeText(next[0][0])}` };
  }
  return null;
}

// The address a page asks Cal.com for free times: a person's own event, between two days.
// No key is needed for this (Cal.com's own documentation says so); it only reads.
export const CAL_API = 'https://api.cal.com/v2/slots';
export const CAL_VERSION = '2024-09-04';
export function calSlotsUrl(event, start, end, timeZone = 'UTC') {
  const m = /^([A-Za-z0-9][A-Za-z0-9_.-]{0,79})\/([A-Za-z0-9][A-Za-z0-9_-]{0,119})$/.exec(String(event || ''));
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return '';
  return `${CAL_API}?eventTypeSlug=${encodeURIComponent(m[2])}&username=${encodeURIComponent(m[1])}&start=${start}&end=${end}&timeZone=${encodeURIComponent(timeZone)}`;
}
// The day after (or n days after) a date, as the same kind of text.
export function addDays(iso, n = 1) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
}
// What a booking strip says about the free times Cal.com gave: how many are left today, or
// when the next one is. `slots` is Cal.com's answer ({ "2026-11-23": [{ start }, …] }).
export function freeTimesText(slots, today, now = Date.now()) {
  if (!slots || typeof slots !== 'object') return '';
  const later = (list) => (Array.isArray(list) ? list.filter((x) => x && Date.parse(x.start) > now) : []);
  const n = later(slots[today]).length;
  if (n) return `${n} ${n === 1 ? 'time' : 'times'} free today`;
  const next = Object.keys(slots).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > today && later(slots[d]).length).sort()[0];
  if (!next) return '';
  const long = longDate(next);
  return `Next free time: ${long.replace(/ \d{4}$/, '')}`;
}
// The seats left on one day of an event with seats, from Cal.com's answer; null when the answer
// says nothing about seats (an ordinary appointment), 0 when the day has no place left.
export function seatsOn(slots, day) {
  if (!slots || typeof slots !== 'object') return null;
  const list = Array.isArray(slots[day]) ? slots[day] : [];
  const seated = list.filter((x) => x && Number.isFinite(x.seatsRemaining));
  if (!seated.length) return list.length ? null : { left: 0, total: null };
  return { left: seated.reduce((n, x) => n + Math.max(0, x.seatsRemaining), 0), total: seated.reduce((n, x) => n + (Number.isFinite(x.seatsTotal) ? x.seatsTotal : 0), 0) || null };
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
// A PayPal.me link with no amount in it (paypal.me/name) is given the order's total, so the
// customer does not have to type it: paypal.me/name/19.50GBP. Only a single total in a currency
// that is known for certain and that PayPal takes is filled in. A "$" or "¥" could be one of
// several currencies, and a price with no currency could be anything, so with those, with
// anything priced on request, or with no total, the link stays exactly as it was pasted, and so
// does every other kind of pay link.
const PAYPAL_ME = /^(https:\/\/(?:www\.)?(?:paypal\.me|paypal\.com\/paypalme))\/([A-Za-z0-9_.-]{1,40})\/?(\?[^#]*)?$/i;
const PAYPAL_CODES = new Set(['AUD', 'BRL', 'CAD', 'CHF', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'ILS', 'JPY', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'SEK', 'SGD', 'THB', 'TWD', 'USD']);
const WHOLE_ONLY = new Set(['JPY', 'HUF', 'TWD']);
export function payWithTotal(href, t) {
  const m = PAYPAL_ME.exec(String(href || '').trim());
  if (!m || !t || t.mixed || t.onRequest || !t.priced || !(t.pence > 0)) return href;
  const code = t.sign === '£' ? 'GBP' : t.sign === '€' ? 'EUR' : t.sign;
  if (!PAYPAL_CODES.has(code)) return href;
  const amount = WHOLE_ONLY.has(code) ? String(Math.round(t.pence / 100)) : (t.pence / 100).toFixed(2);
  return `${m[1]}/${m[2]}/${amount}${code}${m[3] || ''}`;
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
  // Two more options, for tests and for previews that must not age: `fetch` (how Cal.com is
  // asked) and `now` (what the time is).
  const { fetch: fetcher, now = () => new Date() } = arguments[2] || {};
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
    const payHref = pay?.getAttribute('href') || '';
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
      if (pay && payHref) setAttr(pay, 'href', payWithTotal(payHref, orderTotal(order.lines)));
      show(pay, true);
    });
    sync();
    undo.push(() => {
      for (const [i, r] of rows.entries()) { r.qty = 0; r.out.textContent = drawn.qty[i]; }
      total.textContent = drawn.total; status.textContent = drawn.status;
    });
  }

  // ---- signature sections -------------------------------------------------------------------
  let alive = true;
  undo.push(() => { alive = false; });
  const media = (q) => { try { return win.matchMedia(q).matches; } catch { return false; } };
  const reduce = media('(prefers-reduced-motion: reduce)');
  const classes = [];
  const addClass = (el, name) => { if (el && !el.classList.contains(name)) { el.classList.add(name); classes.push([el, name]); } };
  undo.push(() => { for (const [el, name] of classes) el.classList.remove(name); classes.length = 0; });
  const texts = new Map();
  const setText = (el, text) => { if (!el) return; if (!texts.has(el)) texts.set(el, el.textContent); el.textContent = text; };
  undo.push(() => { for (const [el, t] of texts) el.textContent = t; texts.clear(); });
  const safeHref = (h) => (/^https:\/\/[^\s"'<>]+$/.test(h || '') || /^\/(?!\/)[^\s"'<>]*$/.test(h || '') ? h : '');

  // Free times from Cal.com. Asked for only where the owner chose it, never in Chapbook's own
  // preview, and never more than once for the same event and days. Whatever goes wrong, the
  // page simply keeps what it already shows.
  const asked = new Map();
  const calSlots = (event, start, end) => {
    let tz = 'UTC'; try { tz = new win.Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* keep UTC */ }
    const url = calSlotsUrl(event, start, end, tz);
    const get = fetcher || (typeof win.fetch === 'function' ? win.fetch.bind(win) : null);
    if (!url || !get || preview) return Promise.resolve(null);
    if (!asked.has(url)) asked.set(url, Promise.resolve().then(() => get(url, { headers: { 'cal-api-version': CAL_VERSION }, credentials: 'omit', referrerPolicy: 'no-referrer' })).then((r) => (r && r.ok ? r.json() : null)).then((j) => (j && j.status === 'success' && j.data && typeof j.data === 'object' ? j.data : null)).catch(() => null));
    return asked.get(url);
  };

  // Booking strip: the choice says where Book goes. A choice with a booking page of its own sends
  // the button there; any other leaves it on the website's booking page.
  for (const strip of root.querySelectorAll('[data-bs]')) {
    const book = strip.querySelector('.cb-bs-book');
    if (!book) continue;
    const home = book.getAttribute('href');
    const sync = () => {
      const own = safeHref(strip.querySelector('input[type=radio]:checked')?.getAttribute('data-href'));
      setAttr(book, 'href', own || home);
      setAttr(book, 'rel', own ? 'noopener' : book.getAttribute('rel'));
    };
    on(strip, 'change', sync);
    sync();
  }
  for (const line of root.querySelectorAll('.cb-bs-live[data-cal]')) {
    const today = isoToday(now());
    calSlots(line.getAttribute('data-cal'), today, addDays(today, 14)).then((slots) => {
      const text = alive ? freeTimesText(slots, today, now().getTime()) : '';
      if (!text) return;
      setText(line, `${text}. Live from Cal.com.`);
      show(line, true);
    });
  }

  // The Book bar at the bottom of a phone screen. It is lifted out of its section (whose
  // movement would carry it along) and shown once the strip itself has scrolled away, and never
  // over the foot of the page.
  for (const bar of root.querySelectorAll('[data-bookbar]')) {
    if (!media('(max-width: 760px)')) continue;
    const home = bar.parentElement, after = bar.nextSibling, section = bar.closest('.cb');
    root.append(bar);
    undo.push(() => { if (home?.isConnected) home.insertBefore(bar, after?.parentNode === home ? after : null); else bar.remove(); });
    show(bar, true); addClass(bar, 'is-live');
    const hidden = new Set();
    const sync = () => bar.classList.toggle('is-on', !hidden.size);
    undo.push(() => bar.classList.remove('is-on'));
    if ('IntersectionObserver' in win) {
      const io = new win.IntersectionObserver((entries) => { for (const e of entries) { if (e.isIntersecting) hidden.add(e.target); else hidden.delete(e.target); } sync(); });
      // Hidden while the opening is still on screen (M15: it comes once the opening has gone),
      // while the strip itself is (its own Book button is there), and over the foot of the page.
      for (const el of [section, root.querySelector('.cb-opening'), doc.querySelector('footer.site-footer, body > footer')]) if (el) io.observe(el);
      undo.push(() => io.disconnect());
    }
    sync();
  }

  // Open now: the line under a "find us" heading says whether the place is open as the page is
  // read, from the opening hours written on it. Hours it cannot read leave the line out.
  for (const line of root.querySelectorAll('.cb-opennow[data-open]')) {
    const st = openState(String(line.getAttribute('data-open') || '').split('|'), now());
    if (!st) continue;
    setText(line, st.text); addClass(line, st.open ? 'is-open' : 'is-closed'); show(line, true);
  }

  // Spaces remaining: a date that has passed takes itself off (or says Finished), and only then
  // are the numbers shown, so no day that has gone ever shows spaces. A row that follows a
  // Cal.com event then takes its number from Cal.com, and says so.
  const spaceLists = [...root.querySelectorAll('.cb-sp[data-past]')];
  const checkSpaces = () => {
    const today = isoToday(now());
    for (const list of spaceLists) {
      const rows = [...list.children].filter((n) => n.classList.contains('cb-sp-item'));
      let showing = 0;
      for (const row of rows) {
        const date = row.getAttribute('data-date') || '';
        const left = row.querySelector('.cb-sp-left'), meter = row.querySelector('.cb-sp-meter'), acts = row.querySelector('.cb-sp-acts');
        const past = /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today && !row.classList.contains('is-past');
        if (past && list.getAttribute('data-past') !== 'finished') { show(row, false); continue; }
        if (past) {
          addClass(row, 'is-past'); setAttr(row, 'data-cal', null);
          if (left) { setText(left, 'Finished'); left.classList.remove('is-last', 'is-full'); show(left, true); }
          show(meter, false); show(acts, false);
        } else if (!row.classList.contains('is-past')) { if (left && left.textContent.trim()) show(left, true); show(meter, true); }
        showing++;
      }
      const none = list.parentElement?.querySelector('.cb-sp-none');
      if (none) show(none, !showing);
    }
  };
  if (spaceLists.length) {
    checkSpaces();
    on(doc, 'visibilitychange', () => { if (!doc.hidden) checkSpaces(); });
    const byEvent = new Map();
    for (const row of root.querySelectorAll('.cb-sp-item[data-cal][data-date]:not(.is-past):not([hidden])')) { const k = row.getAttribute('data-cal'); byEvent.set(k, [...(byEvent.get(k) || []), row]); }
    for (const [event, rows] of byEvent) {
      const days = rows.map((r) => r.getAttribute('data-date')).sort();
      calSlots(event, days[0], addDays(days[days.length - 1], 1)).then((slots) => {
        if (!alive || !slots) return;
        for (const row of rows) {
          const seats = seatsOn(slots, row.getAttribute('data-date'));
          const left = row.querySelector('.cb-sp-left');
          if (!seats || !left || row.classList.contains('is-past')) continue;
          setText(left, `${spacesText(seats.left)} `);
          const src = make('span', 'cb-sp-src', 'live from Cal.com'); left.append(src); madeHere.push(src);
          left.classList.toggle('is-full', seats.left === 0); left.classList.toggle('is-last', seats.left > 0 && seats.left <= 2);
          row.classList.toggle('is-full', seats.left === 0);
          show(left, true);
          const meter = row.querySelector('.cb-sp-meter');
          if (meter && seats.total) { keep(meter, 'style'); meter.style.setProperty('--f', Math.max(0, Math.min(1, 1 - seats.left / seats.total)).toFixed(3)); show(meter, true); }
          const none = left.closest('.cb')?.querySelector('.cb-sp-asof');
          if (none && rows.length === root.querySelectorAll('.cb-sp-item:not(.is-past):not([hidden])').length) show(none, false);
        }
      });
    }
  }

  // Before and after: one frame with a handle. The handle is a range control, so a finger, a
  // mouse and the arrow keys all move it. The first time it comes into view it moves a little
  // by itself, to show that it can (not for visitors who ask for less motion).
  for (const stage of root.querySelectorAll('[data-cmp]')) {
    const range = stage.querySelector('.cb-cmp-range');
    if (!range) continue;
    const before = stage.querySelector('.cb-cmp-tag-a')?.textContent || 'first photo';
    const put = (v) => { keep(stage, 'style'); stage.style.setProperty('--pos', `${v}%`); setAttr(range, 'aria-valuetext', `${Math.round(v)}% ${before}`); };
    addClass(stage, 'is-live'); show(range, true);
    let touched = false;
    on(range, 'input', () => { touched = true; put(Number(range.value)); });
    put(Number(range.value));
    fields.push([range, '50']);
    if (!reduce && !preview && 'IntersectionObserver' in win && typeof clock.requestAnimationFrame === 'function') {
      const io = new win.IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = clock.performance.now();
        const step = (t) => {
          const k = (t - t0) / 1000;
          if (!alive || touched || k >= 1) { if (alive && !touched) { range.value = '50'; put(50); } return; }
          // One nudge: 8% across and back again.
          const v = 50 + Math.sin(k * Math.PI) * 8;
          range.value = String(Math.round(v)); put(v);
          clock.requestAnimationFrame(step);
        };
        clock.requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(stage);
      undo.push(() => io.disconnect());
    }
  }

  // Menu board, one group at a time: a row of tabs, made from the groups' own names.
  for (const box of root.querySelectorAll('[data-tabs]')) {
    const cols = [...box.querySelectorAll('.cb-mb-col')], names = cols.map((c) => c.querySelector('.cb-mb-group'));
    if (cols.length < 2 || names.some((n) => !n || !n.id)) continue;
    const list = make('div', 'cb-mb-tablist'); list.setAttribute('role', 'tablist');
    const tabs = cols.map((col, i) => {
      const t = make('button', '', names[i].textContent); t.type = 'button'; t.id = `${names[i].id}-tab`;
      t.setAttribute('role', 'tab'); t.setAttribute('aria-controls', `${names[i].id}-panel`);
      setAttr(col, 'id', `${names[i].id}-panel`); setAttr(col, 'role', 'tabpanel'); setAttr(col, 'aria-labelledby', t.id); setAttr(col, 'tabindex', '0');
      return t;
    });
    const pick = (k, focus) => {
      tabs.forEach((t, i) => { t.setAttribute('aria-selected', String(i === k)); t.tabIndex = i === k ? 0 : -1; });
      cols.forEach((c, i) => show(c, i === k));
      if (focus) tabs[k].focus();
    };
    tabs.forEach((t, i) => {
      on(t, 'click', () => pick(i, false));
      on(t, 'keydown', (e) => {
        const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
        if (to >= 0) { e.preventDefault(); pick(to, true); }
      });
    });
    list.append(...tabs); box.prepend(list); madeHere.push(list);
    addClass(box, 'is-live');
    pick(0, false);
  }

  // Today: marked in a timetable and in a table of opening hours.
  {
    const dow = now().getDay();
    for (const day of root.querySelectorAll(`[data-tt] .cb-tt-day[data-day="${DAY_KEYS[dow]}"]`)) {
      addClass(day, 'is-today');
      const name = day.querySelector('.cb-tt-dayname');
      if (name) { const chip = make('span', 'cb-tt-now', 'Today'); name.append(chip); madeHere.push(chip); }
    }
    for (const row of root.querySelectorAll('[data-hours] tr')) {
      if (!dayInLabel((row.querySelector('th') || row).textContent, dow)) continue;
      addClass(row, 'is-today');
      const cell = row.querySelector('th') || row.querySelector('td');
      if (cell) { const mark = make('span', 'cb-sr', ' (today)'); cell.append(mark); madeHere.push(mark); }
    }
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
