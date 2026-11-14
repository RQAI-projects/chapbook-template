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
