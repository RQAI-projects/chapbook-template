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
