// Default post badges use a flat counterpart on quiet reading surfaces.
export const FLAT_GLYPHS = {
  bone: 'bone', circuit: 'cpu', scroll: 'script', 'open-book': 'book-2',
  'film-reel': 'movie', 'music-note': 'music', globe: 'world',
  'torus-knot': 'infinity', glenohumeral: 'bone', reticle: 'target',
  'taj-mahal': 'building-pavilion', 'opera-house': 'building-monument',
  'edinburgh-castle': 'building-castle',
};

// Personal sites can provide a family of defaults; the badge uses its first
// member, matching resolveGlyph, while the background can vary the family.
export function flatGlyphForTopic(defaults, topic) {
  const value = defaults[topic];
  return FLAT_GLYPHS[Array.isArray(value) ? value[0] : value] || '';
}

// Tabler symbols include primitives as well as paths. Include both in 3D mode,
// otherwise circles, outlines and stems disappear when an icon is extruded.
export function iconPaths(svg = '') {
  const out = [];
  for (const [, tag, attrs] of svg.matchAll(/<(path|circle|ellipse|line|rect|polyline|polygon)\b([^>]*)>/g)) {
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const n = key => Number(a[key] || 0);
    if (tag === 'path') { if (a.d && !/^M0 0h24v24H0z$/.test(a.d.trim())) out.push(a.d); }
    else if (tag === 'circle' || tag === 'ellipse') {
      const x=n('cx'), y=n('cy'), rx=tag==='circle'?n('r'):n('rx'), ry=tag==='circle'?n('r'):n('ry');
      if (rx>0 && ry>0) out.push(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0`);
    } else if (tag === 'line') out.push(`M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`);
    else if (tag === 'rect' && n('width')>0 && n('height')>0) out.push(`M${n('x')} ${n('y')}h${n('width')}v${n('height')}h${-n('width')}Z`);
    else if (a.points) {
      const points=a.points.trim().split(/[\s,]+/).map(Number);
      if(points.length>=4 && points.length%2===0 && points.every(Number.isFinite)) out.push(`M${points[0]} ${points[1]}L${points.slice(2).join(' ')}${tag==='polygon'?'Z':''}`);
    }
  }
  return out;
}
