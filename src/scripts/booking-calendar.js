// The booking calendar sits on the page's own colour, with no box of its own behind it, so the
// calendar is told whether that colour is dark or light. It is judged from the words around the
// calendar: light words mean a dark page. Any colour the browser understands is read by painting
// one dot of it.
export function calendarTheme(el, win = window) {
  try {
    const c = win.document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillStyle = win.getComputedStyle(el).color; g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255 > 0.55 ? 'dark' : 'light';
  } catch { return 'light'; }
}
