// The booking calendar sits on the page's own colour, with no box of its own behind it, so the
// calendar is told whether that colour is dark or light. It is judged from the words around the
// calendar: light words mean a dark page.
//
// The colour is read straight from the browser's worked-out value when it is a plain rgb() or
// color(srgb ...) one, which it nearly always is. Only for anything else is one dot of it painted
// and read back (some browsers refuse that read-back, or give noise, to stop fingerprinting, so it
// is not the first choice). If nothing can be read the calendar is light.
export function colourParts(colour) {
  const s = String(colour || '').trim();
  let m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return m.slice(1, 4).map(Number);
  m = s.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return m.slice(1, 4).map((v) => Number(v) * 255);
  return null;
}
export const isLightColour = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;

export function calendarTheme(el, win = window) {
  try {
    const colour = win.getComputedStyle(el).color;
    let parts = colourParts(colour);
    if (!parts) {
      const c = win.document.createElement('canvas'); c.width = c.height = 1;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#000'; g.fillStyle = colour; g.fillRect(0, 0, 1, 1);
      parts = [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }
    return isLightColour(parts) ? 'dark' : 'light';
  } catch { return 'light'; }
}

// ---- Loading Cal.com's calendar ------------------------------------------------------------
// This is Cal.com's own loader, written out. It queues calls until Cal.com's script has loaded,
// and it gives every calendar on a page a name of its own, which Cal.com needs before it will
// draw a second calendar on the same page (one per person, say). Without the names only the
// first calendar appeared.
let loading;
export function loadCal(win = window) {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (win.Cal && win.Cal.instance) { resolve(); return; }
    const doc = win.document, push = (api, args) => { api.q.push(args); };
    const cal = win.Cal = win.Cal || function () {
      const args = arguments;
      if (args[0] === 'init') {
        const api = function () { push(api, arguments); };
        const name = args[1];
        api.q = api.q || [];
        if (typeof name === 'string') { cal.ns[name] = cal.ns[name] || api; push(cal.ns[name], args); push(cal, ['initNamespace', name]); } else push(cal, args);
        return;
      }
      push(cal, args);
    };
    cal.ns = cal.ns || {}; cal.q = cal.q || [];
    const script = doc.createElement('script'); script.src = 'https://app.cal.com/embed/embed.js'; script.async = true;
    const fail = (why) => { script.remove(); loading = undefined; reject(new Error(why)); };
    const timer = win.setTimeout(() => fail('timeout'), 15000);
    script.onload = () => { win.clearTimeout(timer); if (win.Cal && win.Cal.instance) resolve(); else fail('initialise'); };
    script.onerror = () => { win.clearTimeout(timer); fail('load'); };
    doc.head.append(script);
  });
  return loading;
}

// Draws the calendar for `calLink` (such as "name/consultation") inside `target`, light or dark
// to suit the words around it. Each call is a calendar of its own.
let calendars = 0;
// A link the owner typed with a query (cal.com/sam/massage?duration=60) keeps it: Cal.com's help
// ("Auto-forwarding Query Parameters", read 24 Nov 2026) passes a query parameter to the inline
// embed through its config, so each parameter goes there, beside the page's own settings. The
// page's own layout and theme come last and win over a typed ?theme= or ?layout= (round B2
// re-review minor 1), so the calendar's words stay readable on the page's colours.
export function calEmbedParts(link) {
  const s = String(link || ''), at = s.indexOf('?');
  const path = at < 0 ? s : s.slice(0, at), extra = {};
  if (at >= 0) for (const [k, v] of new URLSearchParams(s.slice(at + 1))) if (k && !(k in extra)) extra[k] = v;
  return { path, extra };
}
export async function showCalendar(target, link, around, win = window) {
  const { path: calLink, extra } = calEmbedParts(link);
  await loadCal(win);
  const Cal = win.Cal;
  if (typeof Cal !== 'function') throw new Error('unavailable');
  const name = `chapbook-${++calendars}`;
  if (!target.id) target.id = `booking-${name}`;
  Cal('init', name, { origin: 'https://cal.com' });
  // Cal.com says when the calendar has really loaded (or could not), so the page can tell a
  // calendar that is there from one that never came (watchCalendar).
  Cal.ns[name]('on', { action: 'linkReady', callback: () => { target.dataset.ready = '1'; } });
  Cal.ns[name]('on', { action: 'linkFailed', callback: () => { target.dataset.failed = '1'; } });
  Cal.ns[name]('inline', { elementOrSelector: `#${target.id}`, calLink, config: { ...extra, layout: 'month_view', theme: calendarTheme(around || target, win) } });
}

// ---- A calendar that does not come ---------------------------------------------------------
// An ad blocker, a work network or a weak signal can stop the calendar loading with no error at
// all. About 5 seconds after "Show available times", if no calendar has appeared, the page says
// so and offers the booking page on its own and a call or an email (newcomer walk, 23 Nov): the
// button is never left doing nothing. If the calendar turns up later, the words go back.
export const CALENDAR_WAIT_MS = 5000;
export const calendarReady = (target) => target.dataset.ready === '1'
  || [...target.querySelectorAll('iframe')].some((f) => f.dataset.loaded === '1' || f.offsetHeight > 300);
// fail: an element (kept hidden in the page) holding the words and links to show instead.
export function watchCalendar(target, status, fail, { win = window, wait = CALENDAR_WAIT_MS, ready = 'Choose a time in the calendar.' } = {}) {
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    if (fail) status.replaceChildren(...[...fail.childNodes].map((n) => n.cloneNode(true)));
    else status.textContent = 'The calendar did not load. Use the link above to book on its own page.';
    status.classList.add('is-failed');
  };
  // Watched until the calendar appears or the visitor leaves: one cheap look every 2 seconds.
  const check = () => {
    if (!target.isConnected) return;
    if (calendarReady(target) && target.dataset.failed !== '1') { if (shown) { shown = false; status.classList.remove('is-failed'); status.textContent = ready; } return; }
    show();
    win.setTimeout(check, 2000);
  };
  win.setTimeout(check, wait);
  // The callers' own words (loading, choose a time, could not load) never replace these.
  return { fail: show, showing: () => shown };
}
