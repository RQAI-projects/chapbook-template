import test from 'node:test';
import assert from 'node:assert/strict';
import { colourParts, isLightColour, calendarTheme } from './booking-calendar.js';

const win = (color, canvas) => ({ getComputedStyle: () => ({ color }), document: { createElement: () => canvas || { getContext: () => { throw new Error('no canvas'); } } } });

test('the colours a browser reports are read without painting anything', () => {
  assert.deepEqual(colourParts('rgb(44, 36, 21)'), [44, 36, 21]);
  assert.deepEqual(colourParts('rgba(244, 247, 253, 0.8)'), [244, 247, 253]);
  assert.deepEqual(colourParts('rgb(244 247 253 / 80%)'), [244, 247, 253]);
  assert.deepEqual(colourParts('color(srgb 1 0.5 0)'), [255, 127.5, 0]);
  assert.equal(colourParts('oklch(0.9 0.02 250)'), null);
  assert.equal(colourParts(''), null);
});

test('light words mean a dark page, and so a dark calendar', () => {
  assert.equal(isLightColour([244, 247, 253]), true);
  assert.equal(isLightColour([44, 36, 21]), false);
  assert.equal(calendarTheme({}, win('rgb(244, 247, 253)')), 'dark');
  assert.equal(calendarTheme({}, win('rgb(44, 36, 21)')), 'light');
  assert.equal(calendarTheme({}, win('color(srgb 0.96 0.97 0.99)')), 'dark');
});

test('a browser that will not let a painted dot be read back is never asked for a plain colour', () => {
  // The canvas here answers white whatever is painted, as fingerprinting protection can.
  const noisy = { getContext: () => ({ fillRect() {}, getImageData: () => ({ data: [255, 255, 255, 255] }) }) };
  assert.equal(calendarTheme({}, win('rgb(44, 36, 21)', noisy)), 'light');
});

test('a colour written another way is painted and read; if that fails the calendar is light', () => {
  const canvas = { getContext: () => ({ fillRect() {}, getImageData: () => ({ data: [240, 240, 240, 255] }) }) };
  assert.equal(calendarTheme({}, win('oklch(0.95 0.01 250)', canvas)), 'dark');
  assert.equal(calendarTheme({}, win('oklch(0.95 0.01 250)')), 'light');
  assert.equal(calendarTheme({}, { getComputedStyle: () => { throw new Error('gone'); } }), 'light');
});

// A calendar that does not come (newcomer walk and its review, 23 Nov): the fallback with its call
// line shows at 5 s, is never overwritten by the callers' words, and goes away whenever the
// calendar turns up, however late.
import { watchCalendar } from './booking-calendar.js';
function simulate(readyAt, extra = () => []) {
  let now = 0; const q = [];
  const win = { setTimeout: (f, ms) => q.push({ at: now + ms, f }) };
  const target = { isConnected: true, dataset: {}, querySelectorAll: () => [] };
  const status = { text: 'Loading the booking calendar…', cls: new Set(), set textContent(v) { this.text = v; }, replaceChildren(...n) { this.text = n.map((x) => x.t).join(''); }, classList: { add(c) { status.cls.add(c); }, remove(c) { status.cls.delete(c); }, contains(c) { return status.cls.has(c); } } };
  const fail = { childNodes: [{ t: 'The calendar did not load. Open booking in a separate page, or call 01632 960 123.', cloneNode() { return this; } }] };
  const w = watchCalendar(target, status, fail, { win });
  const seen = [];
  const events = [{ at: readyAt, f: () => { target.dataset.ready = '1'; } }, ...extra(status, w)];
  for (let t = 0; t <= 120000; t += 250) { now = t; for (const e of events) if (e.at === t) e.f(); for (const x of q.filter((x) => x.at === t)) x.f(); const s = status.text; if (seen.at(-1) !== s) seen.push(s); }
  return seen;
}
const FAIL = 'The calendar did not load. Open booking in a separate page, or call 01632 960 123.';
test('a calendar ready within 5 seconds: no fallback', () => assert.deepEqual(simulate(3000), ['Loading the booking calendar…']));
test('a calendar that never comes: the fallback stays', () => assert.equal(simulate(1e9).at(-1), FAIL));
test('a calendar that comes late, even after a minute: the words go back', () => assert.deepEqual(simulate(70000), ['Loading the booking calendar…', FAIL, 'Choose a time in the calendar.']));
test('the script arrives after the fallback: its words do not replace the call line', () => {
  const seen = simulate(1e9, (st, w) => [{ at: 6000, f: () => { if (!w.showing()) st.textContent = 'Choose a time in the calendar.'; } }]);
  assert.equal(seen.at(-1), FAIL);
});
test('the script times out: the fallback, with its call line, says so', () => {
  const seen = simulate(1e9, (st, w) => [{ at: 3000, f: () => w.fail() }]);
  assert.deepEqual(seen, ['Loading the booking calendar…', FAIL]);
});

import { showCalendar } from './booking-calendar.js';
test('the page’s own layout and theme win over a typed ?theme= or ?layout= (round B2 re-review minor 1)', async () => {
  const calls = [], ns = (...a) => calls.push(a);
  const win = { Cal: Object.assign(() => {}, { instance: {}, ns: new Proxy({}, { get: () => ns }) }), getComputedStyle: () => ({ color: 'rgb(255,255,255)' }), document: {} };
  const target = { id: 'cal1', dataset: {} };
  await showCalendar(target, 'sam/x?theme=light&layout=week_view&duration=60', target, win);
  const inline = calls.find((c) => c[0] === 'inline')[1];
  assert.equal(inline.calLink, 'sam/x');
  assert.deepEqual(inline.config, { duration: '60', layout: 'month_view', theme: 'dark' });
});
