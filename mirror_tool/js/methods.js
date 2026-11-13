/* Tessera · Tile maker: methods and sources, the 17 plane groups, symmetric ornaments */
'use strict';

/* =====================================================================================
   METHODS AND SOURCES. Every way of making a pattern is labelled with where it comes from,
   so a design can be kept to one historical method or knowingly mix several.
   ===================================================================================== */
const METHODS = {
  verneuil: { label: 'Verneuil 1901', color: '#2f5d5a', short: 'two mirrors, hinged or parallel, or a single mirror, moved over a drawing',
    cite: 'M. P. Verneuil, G. Auriol &amp; A. Mucha, <i>Combinaisons ornementales se multipliant à l’infini à l’aide du miroir</i> (Paris, Librairie Centrale des Beaux-Arts, c. 1901), preface “De l’emploi du miroir”.' },
  brewster: { label: 'Brewster 1819', color: '#a8691c', short: 'three or four mirrors closing a cell: Brewster’s “polycentral kaleidoscopes”',
    cite: 'D. Brewster, <i>A Treatise on the Kaleidoscope</i> (Edinburgh, 1819; 2nd ed. <i>The Kaleidoscope, its History, Theory and Construction</i>, 1858, ch. XIII “On the construction and use of polycentral kaleidoscopes”): four mirrors forming a square or a rectangle; three reflectors at 60°, at 90°, 45°, 45° and at 90°, 60°, 30°.' },
  wallpaper: { label: 'Wallpaper group', color: '#7a4a8c', short: 'rotations, mirrors and glide reflections of the 17 plane groups: mathematics, not a period instrument',
    cite: 'The 17 plane symmetry groups, enumerated by E. S. Fedorov (1891) and G. Pólya (1924). Symmetry operations and notation (p4g, cmm…) as in the <i>International Tables for Crystallography</i>, Vol. A; orbifold symbols (4∗2, 2∗22…) after J. H. Conway.' },
  mosaic: { label: 'Mosaic', color: '#8c4a2f', short: 'an image cut into stones: Roman opus tessellatum or Gaudí’s trencadís, each piece in the nearest palette colour',
    cite: 'Roman opus tessellatum: tesserae of roughly equal size set in rows; opus vermiculatum: small tesserae set in rows following the contours of the figures (see K. M. D. Dunbabin, <i>Mosaics of the Greek and Roman World</i>, Cambridge, 1999). Trencadís: mosaic of broken ceramic tiles used by Antoni Gaudí and Josep Maria Jujol, e.g. Park Güell, Barcelona (1900–1914). Here cut by computer: rows of jittered stones, or the cells of a jittered Voronoi diagram; colours by k-means in CIELAB.' },
  unknown: { label: 'method not recorded', color: '#9a8f80', short: 'saved before methods were recorded', cite: '' },
};
const chip = (k, extra = '') => { const m = METHODS[k] || METHODS.unknown;
  return `<span class="mbadge" style="--mc:${m.color}" data-help="h-methods" title="${m.label}: ${m.short}">${m.label}${extra}</span>`; };
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

/* ---------- the 17 plane groups: operations in fractional coordinates (International Tables, Vol. A)
   and an asymmetric unit; the group's images of the asymmetric unit fill one lattice cell.
   Brewster's cells are the four mirror-only groups pmm, p3m1, p4m, p6m ---------- */
const P4 = ['x,y', '-x,-y', '-y,x', 'y,-x'], P3 = ['x,y', '-y,x-y', '-x+y,-x'], P6 = [...P3, '-x,-y', 'y,-x+y', 'x-y,x'];
const GROUPS = {
  p1:   { orb: 'o',    lat: 'obl',  ops: ['x,y'], asym: [[0, 0], [1, 0], [1, 1], [0, 1]], desc: 'translations only' },
  p2:   { orb: '2222', lat: 'obl',  ops: ['x,y', '-x,-y'], asym: [[0, 0], [.5, 0], [.5, 1], [0, 1]], desc: 'half-turns' },
  pm:   { orb: '∗∗',   lat: 'rect', ops: ['x,y', '-x,y'], asym: [[0, 0], [.5, 0], [.5, 1], [0, 1]], desc: 'parallel mirrors, repeated along their own direction' },
  pg:   { orb: '××',   lat: 'rect', ops: ['x,y', '-x,y+1/2'], asym: [[0, 0], [.5, 0], [.5, 1], [0, 1]], desc: 'parallel glide reflections' },
  cm:   { orb: '∗×',   lat: 'rect', c: true, ops: ['x,y', '-x,y'], asym: [[0, 0], [.5, 0], [.5, .5], [0, .5]], desc: 'parallel mirrors with glide reflections between them' },
  pmm:  { orb: '∗2222', lat: 'rect', ops: ['x,y', '-x,-y', '-x,y', 'x,-y'], asym: [[0, 0], [.5, 0], [.5, .5], [0, .5]], desc: 'mirrors in two perpendicular directions', mirrors: 'rect' },
  pmg:  { orb: '22∗',  lat: 'rect', ops: ['x,y', '-x,-y', '-x+1/2,y', 'x+1/2,-y'], asym: [[0, 0], [.25, 0], [.25, 1], [0, 1]], desc: 'mirrors one way, glide reflections the other, half-turns between' },
  pgg:  { orb: '22×',  lat: 'rect', ops: ['x,y', '-x,-y', '-x+1/2,y+1/2', 'x+1/2,-y+1/2'], asym: [[0, 0], [.5, 0], [.5, .5], [0, .5]], desc: 'perpendicular glide reflections and half-turns, no mirrors' },
  cmm:  { orb: '2∗22', lat: 'rect', c: true, ops: ['x,y', '-x,-y', '-x,y', 'x,-y'], asym: [[0, 0], [.25, 0], [.25, .5], [0, .5]], desc: 'perpendicular mirrors, with further half-turns off the mirrors' },
  p4:   { orb: '442',  lat: 'sq',   ops: P4, asym: [[0, 0], [.5, 0], [.5, .5], [0, .5]], desc: 'quarter-turns, no mirrors' },
  p4m:  { orb: '∗442', lat: 'sq',   ops: [...P4, '-x,y', 'x,-y', 'y,x', '-y,-x'], asym: [[0, 0], [.5, .5], [0, .5]], desc: 'mirrors at 45°, quarter-turns on the mirrors', mirrors: 't45' },
  p4g:  { orb: '4∗2',  lat: 'sq',   ops: [...P4, '-x+1/2,y+1/2', 'x+1/2,-y+1/2', 'y+1/2,x+1/2', '-y+1/2,-x+1/2'], asym: [[0, 0], [.5, 0], [0, .5]], desc: 'quarter-turns off the mirrors' },
  p3:   { orb: '333',  lat: 'hex',  ops: P3, asym: [[0, 0], [.5, 0], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [0, .5]], desc: 'third-turns, no mirrors' },
  p3m1: { orb: '∗333', lat: 'hex',  ops: [...P3, '-y,-x', '-x+y,y', 'x,x-y'], asym: [[0, 0], [2 / 3, 1 / 3], [1 / 3, 2 / 3]], desc: 'third-turns, every centre on mirrors', mirrors: 't60' },
  p31m: { orb: '3∗3',  lat: 'hex',  ops: [...P3, 'y,x', 'x-y,-y', '-x,-x+y'], asym: [[0, 0], [1, 0], [2 / 3, 1 / 3]], desc: 'third-turns, some centres off the mirrors' },
  p6:   { orb: '632',  lat: 'hex',  ops: P6, asym: [[0, 0], [2 / 3, 1 / 3], [1 / 3, 2 / 3]], desc: 'sixth-turns, no mirrors' },
  p6m:  { orb: '∗632', lat: 'hex',  ops: [...P6, '-y,-x', '-x+y,y', 'x,x-y', 'y,x', 'x-y,-y', '-x,-x+y'], asym: [[0, 0], [2 / 3, 1 / 3], [.5, .5]], desc: 'mirrors at 30°, sixth-turns on the mirrors', mirrors: 't30' },
};
// period examples, so a user can find a known pattern by its group
const GROUP_EX = {
  p3: { short: 'Gaudí’s hexagonal panot (1904)', text: 'Example: Gaudí’s hexagonal <i>panot</i> (designed 1904 for the Casa Batlló, laid in the Casa Milà; made by Escofet; since 1997 on the Passeig de Gràcia, Barcelona). Its figures, an ammonite, a starfish and a seaweed, are cut in thirds across the tiles and completed where three tiles meet (seven tiles are needed to read them), so the floor turns by thirds about three kinds of centre and has no mirrors: the ammonite and the seaweed are chiral. Mirrors cannot make it.' },
};
const LATNAME = { obl: 'oblique', rect: 'rectangular', sq: 'square', hex: 'hexagonal' };
// Brewster's polycentral kaleidoscopes (1858 ed., ch. XIII, §§1–5) are exactly the mirror-only groups
const BCELLS = {
  square: { g: 'pmm', lat: 'sq', name: 'four mirrors forming a square', sec: '§1' },
  rect:   { g: 'pmm', lat: 'rect', name: 'four mirrors forming a rectangle', sec: '§2' },
  t60:    { g: 'p3m1', name: 'three reflectors at 60°', sec: '§3' },
  t45:    { g: 'p4m', name: 'three reflectors at 90°, 45° and 45°', sec: '§4' },
  t30:    { g: 'p6m', name: 'three reflectors at 90°, 60° and 30°', sec: '§5' },
};
function parseOp(str) {
  const rows = str.split(',').map(e => { let cx = 0, cy = 0, t = 0;
    e.replace(/\s/g, '').replace(/([+-]?)(\d+\/\d+|x|y|\d+)/g, (m, sg, term) => { const k = sg === '-' ? -1 : 1;
      if (term === 'x') cx += k; else if (term === 'y') cy += k; else { const [p, q] = term.split('/'); t += k * (+p) / (q ? +q : 1); } return ''; });
    return [cx, cy, t]; });
  return { M: [[rows[0][0], rows[0][1]], [rows[1][0], rows[1][1]]], t: [rows[0][2], rows[1][2]] };
}
const mul2 = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
                         [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
function effGroup() {
  if (S.method === 'brewster') { const bc = BCELLS[S.bcell], g = GROUPS[bc.g]; return { key: bc.g, g, lat: bc.lat || g.lat, bc }; }
  const g = GROUPS[S.group]; return { key: S.group, g, lat: g.lat, bc: null };
}
function latBasis(lat) {
  switch (lat) {
    case 'sq': return [[1, 0], [0, 1]];
    case 'rect': return [[1, 0], [0, S.aspect]];
    case 'hex': return [[1, 0], [-0.5, Math.sqrt(3) / 2]];
    default: return [[1, 0], [0.28, 0.86]];
  }
}
function latGeom() {
  const E = effGroup(), B = latBasis(E.lat), c = Math.cos(rad(S.lt)), s = Math.sin(rad(S.lt)), k = S.cell;
  const av = { x: k * (c * B[0][0] - s * B[0][1]), y: k * (s * B[0][0] + c * B[0][1]) };
  const bv = { x: k * (c * B[1][0] - s * B[1][1]), y: k * (s * B[1][0] + c * B[1][1]) };
  const A = [[av.x, bv.x], [av.y, bv.y]], det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const Ai = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
  const O = S.O, toS = f => ({ x: O.x + A[0][0] * f[0] + A[0][1] * f[1], y: O.y + A[1][0] * f[0] + A[1][1] * f[1] });
  let ops = E.g.ops.map(parseOp);
  if (E.g.c) ops = ops.concat(ops.map(o => ({ M: o.M, t: [o.t[0] + .5, o.t[1] + .5] })));
  ops = ops.map(o => {
    const L = mul2(mul2(A, o.M), Ai), At = [A[0][0] * o.t[0] + A[0][1] * o.t[1], A[1][0] * o.t[0] + A[1][1] * o.t[1]];
    const e = O.x - (L[0][0] * O.x + L[0][1] * O.y) + At[0], f = O.y - (L[1][0] * O.x + L[1][1] * O.y) + At[1];
    const poly = E.g.asym.map(p => toS([o.M[0][0] * p[0] + o.M[0][1] * p[1] + o.t[0], o.M[1][0] * p[0] + o.M[1][1] * p[1] + o.t[1]]));
    return { L, e, f, poly };
  });
  return { ...E, A, Ai, av, bv, toS, ops, asym: E.g.asym.map(toS) };
}
/* symmetry elements of the group, in sheet coordinates: mirror lines, glide lines, rotation centres */
function symElements(G) {
  const m = [], gl = [], cs = [], frac = v => [G.Ai[0][0] * v.x + G.Ai[0][1] * v.y, G.Ai[1][0] * v.x + G.Ai[1][1] * v.y];
  const isLat = f => { const ok = (a, b) => Math.abs(a - Math.round(a)) < 1e-6 && Math.abs(b - Math.round(b)) < 1e-6;
    return ok(f[0], f[1]) || (G.g.c && ok(f[0] - .5, f[1] - .5)); };
  for (const o of G.ops) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const L = o.L, e = o.e + G.A[0][0] * i + G.A[0][1] * j, f = o.f + G.A[1][0] * i + G.A[1][1] * j;
    const det = L[0][0] * L[1][1] - L[0][1] * L[1][0], tr = L[0][0] + L[1][1];
    if (det < 0) {
      let u = { x: L[0][0] + 1, y: L[1][0] }; if (Math.hypot(u.x, u.y) < 1e-6) u = { x: L[0][1], y: L[1][1] + 1 };
      const nu = Math.hypot(u.x, u.y); u = { x: u.x / nu, y: u.y / nu };
      const bp = e * u.x + f * u.y, p = { x: (e - bp * u.x) / 2, y: (f - bp * u.y) / 2 };
      (isLat(frac({ x: bp * u.x, y: bp * u.y })) ? m : gl).push({ p, u });
    } else if (Math.abs(tr - 2) > 1e-6) {
      const a11 = 1 - L[0][0], a12 = -L[0][1], a21 = -L[1][0], a22 = 1 - L[1][1], dd = a11 * a22 - a12 * a21;
      const ang = Math.abs(deg(Math.atan2(L[1][0], L[0][0])));
      cs.push({ p: { x: (e * a22 - a12 * f) / dd, y: (a11 * f - a21 * e) / dd }, n: Math.round(360 / ang) });
    }
  }
  return { m, gl, cs };
}
/* ---------- symmetric ornaments: their centre, and snapping it onto a site of the group ----------
   An ornament carries sym (its point group, e.g. 'D3', '≈C4') and sp = [x, y, axis]: the centre as fractions of its
   width and height and the direction of one mirror line (degrees, image axes). On the sheet only the part inside the
   shaded-free region (the asymmetric unit) is used; at a site of the group on that region's boundary the group
   rebuilds the ornament from turned or mirrored copies of its slice, which close up without seams exactly when the
   ornament's own symmetry contains the site's (see fitSites) and its centre and mirror lines lie on the site's. */
function ornSym(o) {               // centre (sheet coords), mirror directions mod 180 (sheet degrees), label without ≈
  const l = (o.sym || '').replace('≈', ''); if (!l || !o.sp) return null;
  const f = o.flip ? -1 : 1, qx = (o.sp[0] - 0.5) * o.cw * o.s * f, qy = (o.sp[1] - 0.5) * o.ch * o.s;
  const c = Math.cos(rad(o.rot)), sn = Math.sin(rad(o.rot));
  const P = { x: o.x + qx * c - qy * sn, y: o.y + qx * sn + qy * c };
  const n = symN(l), ax = [];
  if (l[0] === 'D' && o.sp[2] != null) { const a0 = (o.flip ? 180 - o.sp[2] : o.sp[2]) + o.rot; for (let k = 0; k < Math.min(n, 12); k++) ax.push(((a0 + k * 180 / n) % 180 + 180) % 180); }
  return { P, l, n, ax };
}
function latSites() {              // rotation centres and mirror lines lying on the asymmetric unit
  const G = latGeom(), E = symElements(G), poly = G.asym, eps = 0.6;
  const dSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy); };
  const onPoly = p => poly.some((a, i) => dSeg(p, a, poly[(i + 1) % poly.length]) < eps);
  const mir = []; for (const ml of E.m) { const ang = ((deg(Math.atan2(ml.u.y, ml.u.x)) % 180) + 180) % 180;
    if (!mir.some(q => Math.abs(q.ang - ang) < 0.01 && Math.abs((ml.p.x - q.p.x) * q.u.y - (ml.p.y - q.p.y) * q.u.x) < eps)) mir.push({ p: ml.p, u: ml.u, ang }); }
  const onLine = (p, ml) => Math.abs((p.x - ml.p.x) * ml.u.y - (p.y - ml.p.y) * ml.u.x) < eps;
  const pts = [];
  for (const c of E.cs) { if (!onPoly(c.p)) continue;      // a centre of order 4 is also one of order 2: keep the highest
    const same = pts.find(q => Math.hypot(q.p.x - c.p.x, q.p.y - c.p.y) < eps); if (same) { same.n = Math.max(same.n, c.n); continue; }
    pts.push({ p: c.p, n: c.n }); }
  for (const q of pts) { const ms = mir.filter(ml => onLine(q.p, ml)); q.H = (ms.length ? 'D' : 'C') + q.n; q.mirrors = ms.map(ml => ml.ang); }
  const lines = mir.filter(ml => poly.some((a, i) => onLine(a, ml) && onLine(poly[(i + 1) % poly.length], ml)))
    .map(ml => ({ ...ml, seg: poly.map((a, i) => [a, poly[(i + 1) % poly.length]]).filter(([a, b]) => onLine(a, ml) && onLine(b, ml)) }));
  return { pts, lines, key: G.key };
}
const SITE_NAME = h => ({ C2: '◆ half-turn centre', C3: '▲ third-turn centre', C4: '■ quarter-turn centre', C6: '⬢ sixth-turn centre' }[h]
  || (h === 'D1' ? 'mirror line' : h === 'D2' ? 'crossing of two mirrors' : `meeting of ${h.slice(1)} mirrors`));
let snapNote = null;               // {p, text} while a drag is held on a site
function snapOrn(o, tol) {         // move (and turn) o so its centre sits on the best fitting site within tol; returns the site
  const os = ornSym(o); snapNote = null; if (!os) return null;
  const sites = latSites(), cand = [];
  for (const st of sites.pts) if (symContains(os.l, st.H)) cand.push({ st, q: st.p, d: Math.hypot(st.p.x - os.P.x, st.p.y - os.P.y), ord: symN(st.H) * (st.H[0] === 'D' ? 2 : 1) });
  if (os.l[0] === 'D') for (const ml of sites.lines) for (const [a, b] of ml.seg) {
    const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0.08, Math.min(0.92, ((os.P.x - a.x) * vx + (os.P.y - a.y) * vy) / (vx * vx + vy * vy)));
    const q = { x: a.x + t * vx, y: a.y + t * vy }; cand.push({ st: { H: 'D1', mirrors: [ml.ang] }, q, d: Math.hypot(q.x - os.P.x, q.y - os.P.y), ord: 1 });
  }
  if (!cand.length) return null;
  // within reach, the nearest wins; placed from the library (tol = ∞) the most symmetric site wins, then the nearest
  const pool = cand.filter(c => c.d <= tol); if (!pool.length) return null;
  const turn = st => {             // the nearest rotation that lays one of its mirror lines along one of the site's
    if (!st.mirrors.length || !os.ax.length) return o.rot;
    const step = 180 / Math.min(os.n, 12); let bestRot = o.rot, bd = 1e9;
    for (const phi of st.mirrors) for (let k = -12; k <= 12; k++) {
      const r = wrap180(o.rot + (phi - os.ax[0]) + k * step), dd = Math.abs(wrap180(r - o.rot)); if (dd < bd) { bd = dd; bestRot = r; } }
    return bestRot;
  };
  for (const c of pool) { c.rot = turn(c.st); c.dr = Math.round(Math.abs(wrap180(c.rot - o.rot)) / 5); }
  pool.sort((a, b) => tol === Infinity ? (b.ord - a.ord) || (a.dr - b.dr) || (a.d - b.d) : (a.d - b.d) || (a.dr - b.dr) || (b.ord - a.ord));
  const best = pool[0]; o.rot = best.rot;
  const P = ornSym(o).P; o.x += best.q.x - P.x; o.y += best.q.y - P.y;
  snapNote = { p: best.q, text: `${o.sym} on a ${SITE_NAME(best.st.H)} (${best.st.H})` };
  return best.st;
}
let BLK = document.createElement('canvas'), blkx = BLK.getContext('2d');
function renderLattice(ctx) {
  const G = latGeom(), z = S.zoom, O = S.O;
  const vx = p => RES / 2 + z * (p.x - O.x), vy = p => RES / 2 + z * (p.y - O.y);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of G.ops) for (const p of o.poly) { x0 = Math.min(x0, vx(p)); y0 = Math.min(y0, vy(p)); x1 = Math.max(x1, vx(p)); y1 = Math.max(y1, vy(p)); }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
  const bw = x1 - x0, bh = y1 - y0, direct = bw * bh > 4.5e6;
  const drawOps = (c2, ox, oy) => {
    for (const o of G.ops) {
      c2.save(); c2.setTransform(z, 0, 0, z, RES / 2 - z * O.x - ox, RES / 2 - z * O.y - oy);
      const cx = o.poly.reduce((s, p) => s + p.x, 0) / o.poly.length, cy = o.poly.reduce((s, p) => s + p.y, 0) / o.poly.length;
      c2.beginPath(); o.poly.forEach((p, i) => { const dx = p.x - cx, dy = p.y - cy, dl = Math.hypot(dx, dy) || 1, gq = 0.7 / z;
        const X = p.x + dx / dl * gq, Y = p.y + dy / dl * gq; i ? c2.lineTo(X, Y) : c2.moveTo(X, Y); }); c2.closePath(); c2.clip();
      c2.transform(o.L[0][0], o.L[1][0], o.L[0][1], o.L[1][1], o.e, o.f); c2.drawImage(src, 0, 0); c2.restore();
    }
  };
  // lattice translations that bring the block over the view
  const corners = [[0, 0], [RES, 0], [0, RES], [RES, RES]], bc = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
  for (const [cx, cy] of corners) for (const [bx, by] of bc) {
    const vxs = (cx - bx) / z, vys = (cy - by) / z, fi = G.Ai[0][0] * vxs + G.Ai[0][1] * vys, fj = G.Ai[1][0] * vxs + G.Ai[1][1] * vys;
    i0 = Math.min(i0, fi); i1 = Math.max(i1, fi); j0 = Math.min(j0, fj); j1 = Math.max(j1, fj);
  }
  i0 = Math.floor(i0) - 1; i1 = Math.ceil(i1) + 1; j0 = Math.floor(j0) - 1; j1 = Math.ceil(j1) + 1;
  if ((i1 - i0) * (j1 - j0) > 4000) { i0 = Math.max(i0, -30); i1 = Math.min(i1, 30); j0 = Math.max(j0, -30); j1 = Math.min(j1, 30); }
  if (!direct) {
    if (BLK.width !== bw || BLK.height !== bh) { BLK.width = bw; BLK.height = bh; } else blkx.clearRect(0, 0, bw, bh);
    drawOps(blkx, x0, y0);
  }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const tx = z * (i * G.av.x + j * G.bv.x), ty = z * (i * G.av.y + j * G.bv.y);
    if (direct) drawOps(ctx, -tx, -ty); else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(BLK, x0 + tx, y0 + ty); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return G;
}
/* overlay: mirrors solid, glide lines dashed, rotation centres as ◆ ▲ ■ ⬢ (as in the International Tables) */
function drawSymOverlay(ctx, G) {
  const z = S.zoom, O = S.O, E = symElements(G), half = RES / 2 / z + 40;
  const lines = new Map(), pts = new Map();
  const R = Math.ceil(half / Math.min(Math.hypot(G.av.x, G.av.y), Math.hypot(G.bv.x, G.bv.y))) + 2;
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const tx = i * G.av.x + j * G.bv.x, ty = i * G.av.y + j * G.bv.y;
    for (const [list, kind] of [[E.m, 'm'], [E.gl, 'g']]) for (const l of list) {
      const px = l.p.x + tx, py = l.p.y + ty;
      const aR = Math.round((((deg(Math.atan2(l.u.y, l.u.x)) % 180) + 180) % 180) * 10) / 10 % 180, nn = dir(aR + 90);
      const off = (px - O.x) * nn.x + (py - O.y) * nn.y; if (Math.abs(off) > half * 1.5) continue;
      const key = aR + ':' + Math.round(off * 4), prev = lines.get(key);
      if (!prev || (prev.kind === 'g' && kind === 'm')) lines.set(key, { kind, px, py, u: l.u });
    }
    for (const c of E.cs) { const x = c.p.x + tx, y = c.p.y + ty;
      if (Math.abs(x - O.x) > half || Math.abs(y - O.y) > half) continue;
      const key = Math.round(x * 10) + ',' + Math.round(y * 10); const prev = pts.get(key); if (!prev || prev.n < c.n) pts.set(key, { x, y, n: c.n }); }
  }
  ctx.save(); setView(ctx); const Lg = 1.6 * half;
  for (const l of lines.values()) {
    ctx.strokeStyle = l.kind === 'm' ? 'rgba(138,90,23,.6)' : 'rgba(47,93,90,.55)';
    ctx.lineWidth = (l.kind === 'm' ? 1.5 : 1.2) / z; ctx.setLineDash(l.kind === 'm' ? [] : [7 / z, 5 / z]);
    const s0 = (O.x - l.px) * l.u.x + (O.y - l.py) * l.u.y, fx = l.px + s0 * l.u.x, fy = l.py + s0 * l.u.y;   // foot of O on the line
    ctx.beginPath(); ctx.moveTo(fx - l.u.x * Lg, fy - l.u.y * Lg); ctx.lineTo(fx + l.u.x * Lg, fy + l.u.y * Lg); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const c of pts.values()) {
    const r = 5.5 / z; ctx.fillStyle = '#7a4a8c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 / z; ctx.beginPath();
    if (c.n === 2) ctx.ellipse(c.x, c.y, r * 0.75, r * 1.25, rad(S.lt), 0, 7);
    else { const k = c.n === 6 ? 6 : c.n === 4 ? 4 : 3; for (let q = 0; q < k; q++) { const a = rad(S.lt - 90 + 360 * q / k + (k === 4 ? 45 : 0));
      const X = c.x + r * 1.25 * Math.cos(a), Y = c.y + r * 1.25 * Math.sin(a); q ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function latStatus() {
  const E = effGroup(), g = E.g, gname = `<b>${E.key}</b> (${g.orb})`;
  if (S.method === 'brewster') {
    return { html: `<b>Brewster’s polycentral kaleidoscope</b>, ${E.bc.name} (${E.bc.sec}). Every edge of the cell is a mirror, so the reflections fill the plane without a seam, whatever the drawing. In today’s terms: wallpaper group ${gname}, ${LATNAME[E.lat]} lattice.`, grp: `${E.key} · ${g.orb}` };
  }
  const mo = g.mirrors ? `Built from mirrors alone: the same pattern as Brewster’s ${BCELLS[g.mirrors].name}.`
    : `It needs ${/glide|turn/.test(g.desc) ? 'rotations or glide reflections' : 'translations along the mirrors'} that no arrangement of plane mirrors produces.`;
  const ex = GROUP_EX[E.key] ? ` ${GROUP_EX[E.key].text}` : '';
  return { html: `Wallpaper group ${gname}: ${g.desc}; ${LATNAME[E.lat]} lattice. ${mo}${ex}`, grp: `${E.key} · ${g.orb}` };
}
