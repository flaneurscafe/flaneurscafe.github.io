/* Tessera · Mosaics: cutting an image into tesserae (Roman, following the outlines, trencadís) */
'use strict';

/* =====================================================================================
   MOSAICS: an image (ornament library, a crop of a plate, My images, or a file) cut into tesserae.
   Roman: opus tessellatum, rows of roughly square stones. Trencadís: Gaudí's broken-tile shards
   (cells of a jittered Voronoi diagram). Each tessera takes the palette colour nearest to the
   average colour of the image under it; the palette comes from k-means on those averages (CIELAB).
   A mosaic is saved as a tile (design) like any other, with its tesserae kept as polygons, so its
   colours can be edited and it exports as vectors.
   ===================================================================================== */
let PICK_TARGET = null;        // when set, the image dialog hands its choice to this callback instead of the mirror sheet
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/* colour: sRGB <-> CIELAB (D65) */
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = c => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
function rgb2lab(r, g, b) {
  r = s2l(r); g = s2l(g); b = s2l(b);
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function lab2hex([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, g = t => t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27);
  const X = g(fx) * 0.95047, Y = g(fy), Z = g(fz) * 1.08883;
  const r = l2s(3.2406 * X - 1.5372 * Y - 0.4986 * Z), gg = l2s(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), bb = l2s(0.0557 * X - 0.2040 * Y + 1.0570 * Z);
  return '#' + [r, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('');
}
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (h, s) => { const [r, g, b] = hex2rgb(h), f = v => Math.round(Math.min(255, Math.max(0, s >= 0 ? v + (255 - v) * s : v * (1 + s))));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); };
/* polygons as [[x,y],…] */
const pArea = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function clipHalf(P, nx, ny, c) {        // keep the part with nx·x + ny·y <= c
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
function clipConvex(P, C) {              // clip P by the convex polygon C (either orientation)
  const s = pArea(C) > 0 ? 1 : -1;
  for (let i = 0; i < C.length && P.length; i++) { const a = C[i], b = C[(i + 1) % C.length];
    const nx = s * (b[1] - a[1]), ny = -s * (b[0] - a[0]); P = clipHalf(P, nx, ny, nx * a[0] + ny * a[1]); }
  return P;
}
function insetPoly(P, g) {               // move every edge inwards by g (a joint of width 2g between neighbours)
  if (g <= 0 || P.length < 3) return P;
  const s = pArea(P) > 0 ? 1 : -1, n = P.length, L = [];
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -s * (b[1] - a[1]) / len, ny = s * (b[0] - a[0]) / len;      // inward normal
    L.push({ px: a[0] + nx * g, py: a[1] + ny * g, dx: b[0] - a[0], dy: b[1] - a[1] }); }
  const out = [];
  for (let i = 0; i < n; i++) { const l1 = L[(i - 1 + n) % n], l2 = L[i], den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < 1e-9) { out.push([l2.px, l2.py]); continue; }
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den; out.push([l1.px + t * l1.dx, l1.py + t * l1.dy]); }
  const a0 = Math.abs(pArea(P)), a1 = pArea(out) * s;
  if (a1 > 0.05 * a0 && out.every(q => inPoly({ x: q[0], y: q[1] }, P.map(([x, y]) => ({ x, y }))))) return out;
  const cx = P.reduce((t, q) => t + q[0], 0) / n, cy = P.reduce((t, q) => t + q[1], 0) / n, k = 0.6;   // sliver: shrink instead
  return P.map(q => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k]);
}
const SHAPE_BOX = { rect: null, square: [1, 1], hex: [1, Math.sqrt(3) / 2], tri: [1, Math.sqrt(3) / 2] };
function shapeOutline(shape, W, H) {   // rect and square: the whole box
  if (shape === 'hex') return [[W / 4, 0], [3 * W / 4, 0], [W, H / 2], [3 * W / 4, H], [W / 4, H], [0, H / 2]];
  if (shape === 'tri') return [[W / 2, 0], [W, H], [0, H]];
  return [[0, 0], [W, 0], [W, H], [0, H]];
}
/* the tesserae, as polygons in tile pixels */
function cutTesserae(o, W, H) {
  const R = rng(o.seed * 7919 + 13), out = [], t = W / o.n, irr = o.irr, j = (a) => (R() * 2 - 1) * a;
  const outline = shapeOutline(o.shape === 'rect' ? 'rect' : o.shape, W, H), minA = 0.12 * t * t;
  const keep = P => { P = clipConvex(P, outline); if (P.length >= 3 && Math.abs(pArea(P)) >= minA) out.push(P); };
  if (o.style === 'roman') {
    // opus tessellatum: rows, the stones roughly square, each cut by hand (corners not quite true)
    let y = -R() * t * 0.5;
    while (y < H) {
      const h = t * (1 + j(0.12 * irr)); let x = -R() * t;
      while (x < W) {
        const w = t * (1 + j(0.3 * irr)), c = 0.12 * irr * t;
        keep([[x + j(c), y + j(c)], [x + w + j(c), y + j(c)], [x + w + j(c), y + h + j(c)], [x + j(c), y + h + j(c)]]);
        x += w;
      }
      y += h;
    }
  } else {
    // trencadís: shards of broken tiles, the cells of a jittered Voronoi diagram
    const a = t * 1.3, seeds = [];
    for (let y = -a; y < H + a; y += a * 0.866) for (let x = -a + ((Math.round(y / (a * 0.866)) & 1) ? a / 2 : 0); x < W + a; x += a)
      seeds.push([x + j(0.45 * irr * a + 0.05 * a), y + j(0.45 * irr * a + 0.05 * a)]);
    const extra = Math.round(seeds.length * 0.35 * irr);                    // a few smaller fragments
    for (let i = 0; i < extra; i++) seeds.push([R() * W, R() * H]);
    const B = 2.6 * a, grid = new Map(), key = (x, y) => Math.floor(x / B) + ',' + Math.floor(y / B);
    seeds.forEach((s, i) => { const k = key(s[0], s[1]); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    seeds.forEach((s, i) => {
      if (s[0] < -a || s[0] > W + a || s[1] < -a || s[1] > H + a) return;
      let P = [[s[0] - B, s[1] - B], [s[0] + B, s[1] - B], [s[0] + B, s[1] + B], [s[0] - B, s[1] + B]];
      const gx = Math.floor(s[0] / B), gy = Math.floor(s[1] / B);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const k of grid.get((gx + dx) + ',' + (gy + dy)) || []) {
        if (k === i) continue; const q = seeds[k], nx = q[0] - s[0], ny = q[1] - s[1];
        P = clipHalf(P, nx, ny, (nx * (q[0] + s[0]) + ny * (q[1] + s[1])) / 2); if (!P.length) return; }
      keep(P);
    });
  }
  return out;
}
/* average colour of the image under each tessera, then k-means in CIELAB */
function colourTesserae(cells, src, W, H, o) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = o.back; x.fillRect(0, 0, W, H);
  const k0 = Math.min(W / src.width, H / src.height), dw = src.width * k0, dh = src.height * k0;     // whole image, centred
  x.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const D = x.getImageData(0, 0, W, H).data, labs = [], wts = [];
  for (const P of cells) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const st = Math.max(1, (x1 - x0) / 7), poly = P.map(([px, py]) => ({ x: px, y: py }));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0 + st / 2; yy < y1; yy += st) for (let xx = x0 + st / 2; xx < x1; xx += st) {
      if (!inPoly({ x: xx, y: yy }, poly)) continue;
      const i = 4 * (Math.min(H - 1, Math.max(0, Math.floor(yy))) * W + Math.min(W - 1, Math.max(0, Math.floor(xx))));
      r += s2l(D[i]); g += s2l(D[i + 1]); b += s2l(D[i + 2]); n++;
    }
    if (!n) { const cx = P.reduce((t, q) => t + q[0], 0) / P.length, cy = P.reduce((t, q) => t + q[1], 0) / P.length,
      i = 4 * (Math.min(H - 1, Math.max(0, Math.floor(cy))) * W + Math.min(W - 1, Math.max(0, Math.floor(cx)))); r = s2l(D[i]); g = s2l(D[i + 1]); b = s2l(D[i + 2]); n = 1; }
    labs.push(rgb2lab(l2s(r / n), l2s(g / n), l2s(b / n))); wts.push(Math.abs(pArea(P)));
  }
  // k-means++ start, then Lloyd iterations (area-weighted)
  const R = rng(o.seed * 104729 + 7), K = Math.min(o.k, labs.length), d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const C = [labs[Math.floor(R() * labs.length)].slice()];
  while (C.length < K) { const ds = labs.map(p => Math.min(...C.map(q => d2(p, q)))), tot = ds.reduce((s, v) => s + v, 0);
    if (tot <= 0) break; let r = R() * tot, i = 0; while (r > ds[i] && i < ds.length - 1) r -= ds[i++]; C.push(labs[i].slice()); }
  let asg = new Int32Array(labs.length);
  for (let it = 0; it < 20; it++) {
    let moved = false;
    labs.forEach((p, i) => { let bi = 0, bd = Infinity; C.forEach((q, j) => { const d = d2(p, q); if (d < bd) { bd = d; bi = j; } }); if (asg[i] !== bi || it === 0) { moved = true; asg[i] = bi; } });
    const S = C.map(() => [0, 0, 0, 0]);
    labs.forEach((p, i) => { const s = S[asg[i]], w = wts[i]; s[0] += p[0] * w; s[1] += p[1] * w; s[2] += p[2] * w; s[3] += w; });
    S.forEach((s, j) => { if (s[3] > 0) C[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    if (!moved) break;
  }
  // order the palette from dark to light; drop unused colours
  const used = [...new Set(asg)].sort((p, q) => C[p][0] - C[q][0]), map = new Map(used.map((j, i) => [j, i]));
  return { pal: used.map(j => lab2hex(C[j])), col: [...asg].map(j => map.get(j)) };
}
const MOS_L = 900;              // tile size in pixels (longest side)
/* pieces never overlap: where two cut pieces overlap (rows meeting the fill, shards from a jittered cut), both are trimmed
   along the separating direction of least overlap so that they meet edge to edge; slivers left over are dropped */
function separatePieces(cells, aligned) {   // aligned: keep one entry per input piece (null where a piece was trimmed away)
  const bb = P => { let a = [Infinity, Infinity, -Infinity, -Infinity]; for (const q of P) { a[0] = Math.min(a[0], q[0]); a[1] = Math.min(a[1], q[1]); a[2] = Math.max(a[2], q[0]); a[3] = Math.max(a[3], q[1]); } return a; };
  let C = cells.map(P => P && P.length >= 3 ? P : []);
  for (let pass = 0; pass < 4; pass++) {
    const B = C.map(bb), G = new Map(), cs = Math.max(4, Math.sqrt(C.reduce((s, P) => s + Math.abs(pArea(P)), 0) / Math.max(1, C.length)) * 2);
    C.forEach((P, i) => { if (!P.length) return; const b = B[i]; for (let gx = Math.floor(b[0] / cs); gx <= Math.floor(b[2] / cs); gx++) for (let gy = Math.floor(b[1] / cs); gy <= Math.floor(b[3] / cs); gy++) { const k = gx * 100003 + gy; if (!G.has(k)) G.set(k, []); G.get(k).push(i); } });
    let fixed = 0; const seen = new Set();
    for (const L of G.values()) for (let a = 0; a < L.length; a++) for (let c = a + 1; c < L.length; c++) {
      const i = L[a], j = L[c], key = i < j ? i * 1e6 + j : j * 1e6 + i; if (seen.has(key)) continue; seen.add(key);
      const bi = B[i], bj = B[j]; if (bi[2] <= bj[0] || bj[2] <= bi[0] || bi[3] <= bj[1] || bj[3] <= bi[1]) continue;
      const A = C[i], Q = C[j]; if (A.length < 3 || Q.length < 3) continue;
      let best = null;                       // the edge normal with the smallest overlap
      for (const P of [A, Q]) for (let e = 0; e < P.length; e++) {
        const p0 = P[e], p1 = P[(e + 1) % P.length]; let nx = p1[1] - p0[1], ny = p0[0] - p1[0]; const l = Math.hypot(nx, ny); if (l < 1e-9) continue; nx /= l; ny /= l;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const v of A) { const d = v[0] * nx + v[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
        for (const v of Q) { const d = v[0] * nx + v[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
        const o1 = a1 - b0, o2 = b1 - a0; if (o1 <= -0.12 || o2 <= -0.12) { best = null; break; }
        const o = Math.min(o1, o2); if (!best || o < best.o) best = { o, nx, ny, mid: o1 < o2 ? (a1 + b0) / 2 : (b1 + a0) / 2, aLow: o1 < o2 };
      }
      if (!best) continue;
      const { nx, ny, mid } = best;
      const g = 0.08;                        // a hair of joint either side, so rounding the stored corners cannot bring them back into contact
      if (best.aLow) { C[i] = clipHalf(A, nx, ny, mid - g); C[j] = clipHalf(Q, -nx, -ny, -(mid + g)); }
      else { C[j] = clipHalf(Q, nx, ny, mid - g); C[i] = clipHalf(A, -nx, -ny, -(mid + g)); }
      B[i] = C[i].length ? bb(C[i]) : [0, 0, 0, 0]; B[j] = C[j].length ? bb(C[j]) : [0, 0, 0, 0]; fixed++;
    }
    C = C.map(P => P.length >= 3 && Math.abs(pArea(P)) > 0.6 ? P : []);
    if (!fixed) break;
  }
  return aligned ? C.map(P => P.length ? P : null) : C.filter(P => P.length);
}
const cutPieces = (src, W, H, o) => separatePieces(o.style === 'verm' ? cutVermiculatum(src, W, H, o) : cutTesserae(o, W, H));
async function makeMosaicData(src, name, o) {
  let W, H;
  if (o.shape === 'rect') { const k = MOS_L / Math.max(src.width, src.height); W = Math.max(40, Math.round(src.width * k)); H = Math.max(40, Math.round(src.height * k)); }
  else { W = MOS_L; H = Math.round(MOS_L * SHAPE_BOX[o.shape][1]); }
  const cells = cutPieces(src, W, H, o);
  if (!cells.length) throw new Error('no pieces');
  const { pal, col } = colourTesserae(cells, src, W, H, o);
  const R = rng(o.seed * 31 + 5), sh = cells.map(() => +((R() * 2 - 1) * (o.style === 'trenc' ? 0.04 : 0.07)).toFixed(3));
  // keep a copy of the source (at most 720 px) so the mosaic can be cut again later, also from a project file
  const k = Math.min(1, 720 / Math.max(src.width, src.height)), sc = document.createElement('canvas');
  sc.width = Math.max(1, Math.round(src.width * k)); sc.height = Math.max(1, Math.round(src.height * k)); sc.getContext('2d').drawImage(src, 0, 0, sc.width, sc.height);
  let s0 = sc.toDataURL('image/webp', 0.85); if (!s0.startsWith('data:image/webp')) s0 = sc.toDataURL('image/png');
  return { style: o.style, shape: o.shape, n: o.n, k: o.k, irr: o.irr, gap: o.gap, mortar: o.mortar, back: o.back, seed: o.seed,
    W, H, srcName: name, src: s0, pal, col, sh, cells: cells.map(P => P.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)])) };
}
const hide = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });
const mPoly = f => { const P = []; for (let i = 0; i < f.length; i += 2) P.push([f[i], f[i + 1]]); return P; };
function mosaicPolys(m) {            // the stones as drawn: inset by half the joint (gapPx: absolute width; gap: fraction of a stone)
  const g = m.gapPx != null ? m.gapPx / 2 : m.gap * (m.W / m.n) / 2;
  if (m._polys && m._gapKey === g) return m._polys;
  hide(m, '_polys', m.cells.map(f => insetPoly(mPoly(f), g))); hide(m, '_gapKey', g); return m._polys;
}
const mColour = (m, i) => shade(m.pal[m.col[i]] || '#888888', m.sh[i] || 0);
function drawMosaic(ctx, m) {
  ctx.fillStyle = m.mortar; ctx.fillRect(0, 0, m.W, m.H);
  const P = mosaicPolys(m), out = shapeOutline(m.shapeIn || m.shape, m.W, m.H);
  ctx.save(); ctx.beginPath(); out.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
  for (let i = 0; i < P.length; i++) { const q = P[i]; ctx.fillStyle = mColour(m, i); ctx.beginPath();
    q.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
let mEncT = 0;
function renderMosaic(d, encode) {   // redraw a mosaic tile after its colours changed
  const m = d.mosaic, c = document.createElement('canvas'); c.width = m.W; c.height = m.H; drawMosaic(c.getContext('2d'), m);
  d.img = c; cRender();
  if (encode) { clearTimeout(mEncT); mEncT = setTimeout(() => {
    let s = c.toDataURL('image/webp', 0.92); if (!s.startsWith('data:image/webp')) s = c.toDataURL('image/png'); d.src = s; saveDesigns(); renderPalette(); }, 250); }
}
function mosaicDesign(m, name) {
  const shape = m.shape, edge = shape === 'hex' ? m.W / 2 : shape === 'rect' ? Math.max(m.W, m.H) / 2 : m.W;
  const c = document.createElement('canvas'); c.width = m.W; c.height = m.H; drawMosaic(c.getContext('2d'), m);
  let src = c.toDataURL('image/webp', 0.92); if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/png');
  const styleName = { roman: 'Roman mosaic (opus tessellatum)', verm: 'Roman mosaic following the outlines (opus vermiculatum)', trenc: 'Trencadís', free: 'Mosaic laid by hand' }[m.style] || 'Mosaic';
  return { id: 'd' + Date.now().toString(36) + (uid++), name, shape, w: m.W, h: m.H, src, edge, bg: m.mortar, mosaic: m,
    method: { keys: ['mosaic'], detail: `${styleName}, ${m.cells.length} pieces, ${m.pal.length} colours${m.style === 'free' ? '' : ', from ' + m.srcName}`, sym: { roman: 'Roman', verm: 'vermiculatum', trenc: 'trencadís', free: 'free form' }[m.style] || '' } };
}

/* Opus vermiculatum: rows of stones that follow the outlines in the image. The image is reduced to its palette
   colours; the borders between colour regions (and the edge of the tile) are the guide lines; a distance
   transform from them gives, at every point, how far it lies from the nearest outline. Stones are laid along
   the lines at distances t/2, 3t/2, 5t/2… from the outlines (the "andamento"), turned to follow them, nearest
   rows first, and a second pass of smaller stones fills what is left (as mosaicists fill with cut pieces). */
function cutVermiculatum(src, W, H, o) {
  const t = W / o.n, R = rng(o.seed * 7919 + 29), irr = o.irr;
  // 1. the image on its ground, in CIELAB
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = o.back; x.fillRect(0, 0, W, H);
  const k0 = Math.min(W / src.width, H / src.height), dw = src.width * k0, dh = src.height * k0;
  x.filter = `blur(${Math.max(0.5, t / 10).toFixed(1)}px)`; x.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh); x.filter = 'none';
  const D0 = x.getImageData(0, 0, W, H).data, N = W * H, L = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const l = rgb2lab(D0[4 * i], D0[4 * i + 1], D0[4 * i + 2]); L[3 * i] = l[0]; L[3 * i + 1] = l[1]; L[3 * i + 2] = l[2]; }
  // 2. palette regions: k-means on a sample of pixels, then every pixel to its nearest centre
  const K = Math.max(2, o.k), S = [];
  for (let i = 0; i < 6000; i++) { const j = Math.floor(R() * N); S.push([L[3 * j], L[3 * j + 1], L[3 * j + 2]]); }
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const C = [S[0].slice()];
  while (C.length < K) { const ds = S.map(p => Math.min(...C.map(q => d2(p, q)))), tot = ds.reduce((a, b) => a + b, 0); if (tot <= 0) break;
    let r = R() * tot, i = 0; while (r > ds[i] && i < ds.length - 1) r -= ds[i++]; C.push(S[i].slice()); }
  for (let it = 0; it < 12; it++) { const A = C.map(() => [0, 0, 0, 0]);
    for (const p of S) { let b = 0, bd = Infinity; C.forEach((q, j) => { const d = d2(p, q); if (d < bd) { bd = d; b = j; } }); const a = A[b]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }
    A.forEach((a, j) => { if (a[3]) C[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; }); }
  const lab = new Uint8Array(N);
  for (let i = 0; i < N; i++) { let b = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const d = (L[3 * i] - C[j][0]) ** 2 + (L[3 * i + 1] - C[j][1]) ** 2 + (L[3 * i + 2] - C[j][2]) ** 2; if (d < bd) { bd = d; b = j; } } lab[i] = b; }
  // 3. guide lines: borders between regions, and everything outside the tile's outline
  const outline = shapeOutline(o.shape === 'rect' ? 'rect' : o.shape, W, H), op = outline.map(([px, py]) => ({ x: px, y: py }));
  const inside = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) inside[y * W + X] = o.shape === 'rect' || inPoly({ x: X + 0.5, y: y + 0.5 }, op) ? 1 : 0;
  const BIG = 1e9, D = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const i = y * W + X;
    const edge = !inside[i] || X === 0 || y === 0 || X === W - 1 || y === H - 1 || lab[i] !== lab[i + 1] || lab[i] !== lab[i + W];
    D[i] = edge ? 0 : BIG; }
  // 4. distance to the nearest guide line (chamfer 3-4, two passes; divided by 3 gives pixels)
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const i = y * W + X; let v = D[i];
    if (X > 0) v = Math.min(v, D[i - 1] + 3); if (y > 0) { v = Math.min(v, D[i - W] + 3); if (X > 0) v = Math.min(v, D[i - W - 1] + 4); if (X < W - 1) v = Math.min(v, D[i - W + 1] + 4); } D[i] = v; }
  for (let y = H - 1; y >= 0; y--) for (let X = W - 1; X >= 0; X--) { const i = y * W + X; let v = D[i];
    if (X < W - 1) v = Math.min(v, D[i + 1] + 3); if (y < H - 1) { v = Math.min(v, D[i + W] + 3); if (X < W - 1) v = Math.min(v, D[i + W + 1] + 4); if (X > 0) v = Math.min(v, D[i + W - 1] + 4); } D[i] = v; }
  for (let i = 0; i < N; i++) D[i] /= 3;
  // direction of the rows: along the lines of equal distance (perpendicular to its gradient, smoothed)
  const dirAt = (px, py) => { const r = Math.max(2, Math.round(t / 2)); let gx = 0, gy = 0;
    for (const [ax, ay] of [[r, 0], [0, r], [r, r], [r, -r]]) {
      const x1 = Math.min(W - 1, Math.max(0, Math.round(px + ax))), y1 = Math.min(H - 1, Math.max(0, Math.round(py + ay))), x0 = Math.min(W - 1, Math.max(0, Math.round(px - ax))), y0 = Math.min(H - 1, Math.max(0, Math.round(py - ay)));
      const dv = D[y1 * W + x1] - D[y0 * W + x0], n2 = ax * ax + ay * ay; gx += dv * ax / n2; gy += dv * ay / n2; }
    const g = Math.hypot(gx, gy); return g < 1e-6 ? [1, 0] : [-gy / g, gx / g]; };
  // 5. lay the stones: occupancy raster, nearest rows first
  const occ = new Uint8Array(N), out = [];
  const tryStone = (px, py, s, maxOver) => {
    const pi = Math.round(py) * W + Math.round(px); if (px < 0 || py < 0 || px >= W || py >= H || occ[pi] || !inside[pi]) return false;
    const [ux, uy] = dirAt(px, py), vx = -uy, vy = ux, a = s * (1 + (R() * 2 - 1) * 0.1 * irr) / 2, b = s / 2, j = () => (R() * 2 - 1) * 0.08 * irr * s;
    const P = [[px - ux * a - vx * b + j(), py - uy * a - vy * b + j()], [px + ux * a - vx * b + j(), py + uy * a - vy * b + j()],
               [px + ux * a + vx * b + j(), py + uy * a + vy * b + j()], [px - ux * a + vx * b + j(), py - uy * a + vy * b + j()]];
    let x0 = W, y0 = H, x1 = 0, y1 = 0; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    const pts = []; let over = 0; const sgn = pArea(P) > 0 ? 1 : -1;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const qx = xx + 0.5, qy = yy + 0.5; let ok = true;
      for (let k = 0; k < 4 && ok; k++) { const A = P[k], B = P[(k + 1) % 4]; if (sgn * ((B[0] - A[0]) * (qy - A[1]) - (B[1] - A[1]) * (qx - A[0])) < 0) ok = false; }
      if (!ok) continue; const ii = yy * W + xx; pts.push(ii); if (occ[ii] || !inside[ii]) over++; }
    if (!pts.length || over > maxOver * pts.length) return false;
    for (const ii of pts) occ[ii] = 1; out.push(P); return true;
  };
  const rows = new Map();
  for (let i = 0; i < N; i++) { if (!inside[i]) continue; const k = Math.floor(D[i] / t), f = D[i] - (k + 0.5) * t;
    if (Math.abs(f) <= 0.7) (rows.get(k) || rows.set(k, []).get(k)).push(i); }
  for (const k of [...rows.keys()].sort((a, b) => a - b)) for (const i of rows.get(k)) tryStone(i % W + 0.5, Math.floor(i / W) + 0.5, t * 0.97, 0.06);
  // 6. fill the gaps with smaller cut pieces
  const st = Math.max(1, Math.round(t * 0.3));
  for (const s of [t * 0.66, t * 0.45]) for (let y = st / 2; y < H; y += st) for (let X = st / 2; X < W; X += st) tryStone(X, y, s, 0.12);
  return out.map(P => clipConvex(P, outline)).filter(P => P.length >= 3 && Math.abs(pArea(P)) > 0.08 * t * t);
}
