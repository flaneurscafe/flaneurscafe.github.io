/* Tessera · Tile maker: status, render loop, controls, Gaudí’s panot, the tiled surface */
'use strict';

/* ---------- status ---------- */
function updateStatus() {
  const st = $('status'); let html, warn = false, grp = '', r_anchor = 'h-seam';
  if (S.mode === 'lattice') {
    const r = latStatus(); st.innerHTML = r.html + ` <a data-help="h-methods" style="color:var(--teal);cursor:pointer">Sources</a>`;
    st.classList.remove('warn'); $('groupLbl').textContent = r.grp; return;
  }
  if (S.mode === 'hinge') {
    const a = S.alpha, r = analyse(a);
    if (r.closed) {
      html = `α = 180°/${r.n} = ${fmt(a)}°. The two chains of images agree behind the hinge: a rosette with symmetry D<sub>${r.n}</sub>, ${2 * r.n} copies of the wedge.`;
      grp = `D${sub(r.n)} · ${2 * r.n} images`;
      const k = Math.round(360 / a); if (k <= 8 && k >= 3 && near(a, 360 / k, 0.05)) html += ` (This is also Verneuil's dial mark ${k}.)`;
    } else if (r.k) {
      warn = true;
      html = `α = 360°/${r.k} = ${fmt(a)}° — Verneuil's dial mark ${r.k}. Since 360/α is odd, the image chains meet behind the hinge with opposite handedness: a seam (red) unless the motif is symmetric about the bisector, in which case the true group is D<sub>${r.k}</sub>.`;
      grp = 'seam behind the hinge'; r_anchor = 'h-dial';
    } else {
      warn = true;
      html = `α = ${fmt(a)}° is not an aliquot part of 180°: the images do not close up (Brewster's "want of symmetry"). Seam marked in red.`;
      grp = 'seam behind the hinge';
    }
  } else if (S.mode === 'parallel') {
    html = `Two parallel mirrors ${Math.round(S.d)} px apart: an endless border with vertical mirror lines only (frieze <i>∗∞∞</i>). Period ${Math.round(2 * S.d)} px.`;
    grp = 'frieze ∗∞∞';
  } else {
    html = 'One mirror: the sheet and its reflection, bilateral symmetry D<sub>1</sub>. At 45° to a border it turns the border through a right angle (Verneuil\'s CC).';
    grp = 'D₁';
  }
  st.innerHTML = html + (S.mode === 'hinge' ? ` <a data-help="${r_anchor}" style="color:var(--teal);cursor:pointer">Why?</a>` : ''); st.classList.toggle('warn', warn); $('groupLbl').textContent = grp;
}
const fmt = v => (Math.round(v * 100) / 100).toString();
const sub = n => String(n).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[c]).join('');

/* ---------- render loop ---------- */
let pending = false, srcDirty = true;
function redraw(srcChanged) {
  if (srcChanged) srcDirty = true;
  if (pending) return; pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (srcDirty) { renderSource(); srcDirty = false; }
    renderSheet(); renderResult(); renderTiles(); updateStatus(); syncControls();
  });
}

/* ---------- controls ---------- */
let wpFitKey = null;
function wpFitHtml(grp) {
  const st = SITES[grp] || [];
  if (!st.length) return `Group ${grp} has no rotation centres or mirrors: any ornament, symmetric or not, repeats the same way.`;
  const orn = LIB.filter(e => !e[4] && e[1] >= FIRST_PLATE);
  const parts = st.map(h => { const k = orn.filter(e => fitSites(e[5], grp).includes(h)).length; return `${SITE_MARK[h]}: <b>${h}</b> (${k})`; });
  return `To sit whole on a site, an ornament needs its symmetry: ${parts.join(' · ')}. Numbers = library ornaments that qualify. <a href="#" id="wpFitShow">Show them</a>`;
}
document.addEventListener('click', ev => { if (ev.target.id === 'wpFitShow') { ev.preventDefault(); targetSlot = -1; $('libSym').value = 'fit'; $('libKind').value = '0'; dlg.showModal(); showLib(); } });
function syncControls() {
  $('alpha').value = S.alpha; $('alphaV').textContent = fmt(S.alpha) + '°';
  $('beta').value = wrap180(S.beta); $('betaV').textContent = Math.round(wrap180(S.beta)) + '°';
  $('theta').value = wrap180(S.theta); $('thetaV').textContent = Math.round(wrap180(S.theta)) + '°';
  $('dist').value = S.d; $('distV').textContent = Math.round(S.d);
  $('zoom').value = S.zoom; $('zoomV').textContent = S.zoom.toFixed(2) + '×';
  $('cleanV').textContent = Math.round(S.clean * 100) + '%';
  const o = S.orn[S.sel];
  for (const id of ['oScale', 'oRot', 'oFlip', 'oFront', 'oCenter']) $(id).disabled = !o;
  if (o) { $('oScale').value = o.s; $('oScaleV').textContent = o.s.toFixed(2) + '×';
    $('oRot').value = o.rot; $('oRotV').textContent = Math.round(o.rot) + '°'; }
  else { $('oScaleV').textContent = '–'; $('oRotV').textContent = '–'; }
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.mode));
  $('hingeCtl').hidden = S.mode !== 'hinge'; $('parCtl').hidden = S.mode !== 'parallel'; $('lineCtl').hidden = S.mode === 'hinge' || S.mode === 'lattice';
  const lat = S.mode === 'lattice';
  document.querySelectorAll('#methSeg button').forEach(b => b.classList.toggle('on', b.dataset.k === S.method));
  document.querySelectorAll('#cellSeg button').forEach(b => b.classList.toggle('on', b.dataset.c === S.bcell));
  $('verneuilCtl').hidden = S.method !== 'verneuil'; $('brewsterCtl').hidden = S.method !== 'brewster'; $('wallCtl').hidden = S.method !== 'wallpaper';
  $('latCtl').hidden = !lat; $('seamLbl').hidden = lat; $('demo').hidden = S.mode !== 'hinge';
  if (lat) { const E = effGroup(); $('aspectRow').hidden = E.lat !== 'rect';
    $('cellSize').value = S.cell; $('cellSizeV').textContent = Math.round(S.cell);
    $('latTheta').value = wrap180(S.lt); $('latThetaV').textContent = Math.round(wrap180(S.lt)) + '°';
    $('aspect').value = S.aspect; $('aspectV').textContent = S.aspect.toFixed(2); $('wpGroup').value = S.group;
    $('wpExample').innerHTML = S.method === 'wallpaper' && GROUP_EX[S.group] ? GROUP_EX[S.group].short + ' belongs to this group.' : '';
    $('panotRow').hidden = !(S.method === 'wallpaper' && S.group === 'p3');
    if (S.method === 'wallpaper' && wpFitKey !== S.group) { wpFitKey = S.group; $('wpFit').innerHTML = wpFitHtml(S.group); } }
  else $('panotRow').hidden = true;
  const M = METHODS[S.method], sub2 = S.method === 'verneuil' ? { hinge: 'hinged pair', parallel: 'parallel pair', single: 'single mirror' }[S.mode]
    : S.method === 'brewster' ? BCELLS[S.bcell].name : S.group;
  const mc = $('methCite'); mc.style.setProperty('--mc', M.color);
  mc.innerHTML = `<b style="color:${M.color}">${M.label}</b> — ${M.short}.<span class="src">${M.cite}</span>` +
    ` <a data-help="h-methods">All sources</a>`;
  $('methBadge').innerHTML = chip(S.method, ' · ' + sub2);
  $('resTitle').textContent = S.method === 'wallpaper' ? 'Generated by the group' : S.method === 'brewster' ? 'Seen in the kaleidoscope' : 'Seen in the mirrors';
}
function bindRange(id, fn, src) { $(id).addEventListener('input', e => { fn(+e.target.value); redraw(src); }); }
bindRange('alpha', v => S.alpha = snapAlpha(v));
bindRange('beta', v => S.beta = v);
bindRange('theta', v => S.theta = v);
bindRange('dist', v => S.d = v);
bindRange('zoom', v => S.zoom = v);
bindRange('cellSize', v => S.cell = v);
bindRange('latTheta', v => S.lt = v);
bindRange('aspect', v => S.aspect = v);
for (const [grp, keys] of [['Oblique lattice', ['p1', 'p2']], ['Rectangular lattice', ['pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm']],
  ['Square lattice', ['p4', 'p4m', 'p4g']], ['Hexagonal lattice', ['p3', 'p3m1', 'p31m', 'p6', 'p6m']]]) {
  const og = document.createElement('optgroup'); og.label = grp;
  for (const k of keys) og.appendChild(new Option(`${k}  ·  ${GROUPS[k].orb}${GROUPS[k].mirrors ? '  · mirrors only' : ''}${GROUP_EX[k] ? '  · e.g. ' + GROUP_EX[k].short : ''}`, k));
  $('wpGroup').appendChild(og);
}
/* ---------- Gaudí's panot (1904), redrawn: an ammonite, a brittle star and a seaweed, each a three-fold figure,
   set on the three kinds of third-turn centre of p3. Drawn here from the description, not traced from the tile. ---------- */
const PANOT = { ink: '#3d5446', mid: '#62806c', bg: '#a9bba8' };
function tube(x, pts, wf) {           // filled band along a centre line, half-width wf(t)
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = wf(i / (n - 1));
    L.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); R.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
  }
  x.beginPath(); L.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); for (let i = n - 1; i >= 0; i--) x.lineTo(R[i].x, R[i].y); x.closePath(); x.fill();
}
function ammonite(x, r) {             // three interleaved whorls, ribbed, inside a knobbed rim
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80, rho = r * (0.1 + 0.8 * t), ph = 2 * Math.PI * (1.05 * t + k / 3); pts.push({ x: rho * Math.cos(ph), y: rho * Math.sin(ph) }); }
    x.fillStyle = PANOT.ink; tube(x, pts, t => r * 0.075 * (0.35 + t));
    x.strokeStyle = PANOT.mid; x.lineWidth = r * 0.018;
    for (let i = 8; i <= 80; i += 4) { const t = i / 80, rho = r * (0.1 + 0.8 * t), ph = 2 * Math.PI * (1.05 * t + k / 3), w = r * 0.075 * (0.35 + t) * 0.9;
      x.beginPath(); x.moveTo((rho - w) * Math.cos(ph), (rho - w) * Math.sin(ph)); x.lineTo((rho + w) * Math.cos(ph + 0.05), (rho + w) * Math.sin(ph + 0.05)); x.stroke(); }
  }
  x.fillStyle = PANOT.ink; x.beginPath(); x.arc(0, 0, r * 0.1, 0, 7); x.fill();
  for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24; x.beginPath(); x.arc(r * 0.99 * Math.cos(a), r * 0.99 * Math.sin(a), r * (i % 2 ? 0.025 : 0.04), 0, 7); x.fill(); }
}
function brittleStar(x, r) {          // disc with six curling arms, long and shorter in turn (three-fold)
  x.fillStyle = PANOT.ink;
  for (let k = 0; k < 6; k++) {
    const long = k % 2 === 0, len = r * (long ? 0.96 : 0.8), th = Math.PI * k / 3, bend = long ? 0.8 : 0.55, pts = [];
    for (let i = 0; i <= 50; i++) { const t = i / 50, ph = th + bend * t * t; pts.push({ x: len * t * Math.cos(ph), y: len * t * Math.sin(ph) }); }
    x.fillStyle = PANOT.ink; tube(x, pts, t => r * (long ? 0.105 : 0.09) * (1 - 0.8 * t));
    x.fillStyle = PANOT.mid;
    for (let i = 6; i < 48; i += 5) { const q = pts[i], a = pts[i + 1], dx = a.x - q.x, dy = a.y - q.y, d = Math.hypot(dx, dy), w = r * (long ? 0.105 : 0.09) * (1 - 0.8 * i / 50) + r * 0.035;
      for (const sg of [1, -1]) { x.beginPath(); x.arc(q.x - sg * dy / d * w, q.y + sg * dx / d * w, r * 0.017, 0, 7); x.fill(); } }
  }
  x.fillStyle = PANOT.ink; x.beginPath(); x.arc(0, 0, r * 0.24, 0, 7); x.fill();
  x.fillStyle = PANOT.mid; x.beginPath();
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + 2 * Math.PI * k / 3; x.moveTo(0, 0); x.arc(0, 0, r * 0.13, a - 0.35, a + 0.35); }
  x.fill();
}
function seaweed(x, r) {              // three sargassum fronds: curved stems, alternate leaves, air bladders
  for (let k = 0; k < 3; k++) {
    const th = 2 * Math.PI * k / 3 + 0.4, pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, ph = th + 0.9 * t; pts.push({ x: r * 0.95 * t * Math.cos(ph), y: r * 0.95 * t * Math.sin(ph) }); }
    x.fillStyle = PANOT.ink; tube(x, pts, t => r * 0.035 * (1 - 0.6 * t));
    for (let j = 1; j <= 7; j++) {
      const i = Math.round(6 + j * 7), q = pts[Math.min(i, 59)], a = pts[Math.min(i + 1, 60)], dir0 = Math.atan2(a.y - q.y, a.x - q.x), sg = j % 2 ? 1 : -1, ln = r * (0.26 - 0.022 * j);
      const ang = dir0 + sg * 0.9;
      x.save(); x.translate(q.x, q.y); x.rotate(ang); x.fillStyle = j % 3 === 0 ? PANOT.mid : PANOT.ink;
      x.beginPath(); x.ellipse(ln / 2, 0, ln / 2, ln * 0.2, 0, 0, 7); x.fill(); x.restore();
    }
    x.fillStyle = PANOT.ink; const e = pts[60];
    for (const [dx, dy, rr] of [[0, 0, 0.06], [0.07, 0.05, 0.04], [-0.06, 0.06, 0.035]]) { x.beginPath(); x.arc(e.x + dx * r, e.y + dy * r, rr * r, 0, 7); x.fill(); }
  }
  x.beginPath(); x.arc(0, 0, r * 0.07, 0, 7); x.fill();
}
function panot() {
  if (S.mode !== 'lattice') S.vmode = S.mode;
  Object.assign(S, { method: 'wallpaper', mode: 'lattice', group: 'p3', lt: 0, cell: 300, zoom: 0.8, O: { x: 430, y: 270 } });
  const k = S.cell, r = 0.28 * k, h = Math.sqrt(3) / 2;
  // the three classes of third-turn centre of p3, relative to the lattice point O (lattice basis (k,0), (-k/2, k·√3/2))
  // three separate ornaments, each drawn with three-fold symmetry (C3) about its own centre and set on one of the centres
  const C = [{ f: brittleStar, x: 0, y: 0, name: 'starfish' }, { f: ammonite, x: k / 2, y: k * h / 3, name: 'ammonite' }, { f: seaweed, x: 0, y: 2 * k * h / 3, name: 'seaweed' }];
  const Q = 2, R = Math.ceil(r * 1.12 * Q);
  S.orn = C.map(m => {
    const c = document.createElement('canvas'); c.width = c.height = 2 * R;
    const x = c.getContext('2d'); x.lineCap = 'round'; x.setTransform(Q, 0, 0, Q, R, R); m.f(x, r);
    return { n: 0, img: c, cx: 0, cy: 0, cw: c.width, ch: c.height, x: S.O.x + m.x, y: S.O.y + m.y, s: 1 / Q, rot: 0, flip: false, lib: null,
      label: 'panot · ' + m.name, sym: 'C3', sp: [0.5, 0.5, null] };
  });
  S.sel = 0; targetSlot = -1; setTileBg(PANOT.bg); syncSnap();
  renderSlots(); redraw(true);
}
$('panotBtn').onclick = panot;
function syncSnap() { $('snapSym').checked = T.snapSym; }
$('snapSym').onchange = e => { T.snapSym = e.target.checked; };
$('wpGroup').onchange = e => { S.group = e.target.value; fitRegionToOrnament(); redraw(); };
document.querySelectorAll('#cellSeg button').forEach(b => b.onclick = () => { S.bcell = b.dataset.c; fitRegionToOrnament(); redraw(); });
function fitRegionToOrnament() {     // put the fundamental region over the selected ornament
  const o = S.orn[S.sel] || S.orn[0]; if (!o || S.mode !== 'lattice') return;
  const G = latGeom(), cx = G.asym.reduce((t, q) => t + q.x, 0) / G.asym.length, cy = G.asym.reduce((t, q) => t + q.y, 0) / G.asym.length;
  S.O = { x: S.O.x + o.x - cx, y: S.O.y + o.y - cy };
}
function setMethod(k) {
  if (k === S.method) return;
  if (S.mode !== 'lattice') S.vmode = S.mode;
  S.method = k;
  if (k === 'verneuil') { S.mode = S.vmode || 'hinge'; if (T.before && S.mode === 'hinge') { setTileShape(T.before); T.before = null; } }
  else { S.mode = 'lattice'; fitRegionToOrnament(); }
  redraw();
}
document.querySelectorAll('#methSeg button').forEach(b => b.onclick = () => setMethod(b.dataset.k));
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#methCite a[data-help], #methBadge [data-help], #cLegend [data-help], #cPalette [data-help]');
  if (a) { e.preventDefault(); openHelp(a.dataset.help); } });

bindRange('clean', v => S.clean = v, true);
bindRange('oScale', v => { if (S.orn[S.sel]) S.orn[S.sel].s = v; }, true);
bindRange('oRot', v => { if (S.orn[S.sel]) S.orn[S.sel].rot = v; }, true);
$('oFlip').onclick = () => { const o = S.orn[S.sel]; if (o) { o.flip = !o.flip; redraw(true); } };
$('oFront').onclick = () => { const o = S.orn[S.sel]; if (!o) return; S.orn.splice(S.sel, 1); S.orn.push(o); S.sel = S.orn.length - 1; renderSlots(); redraw(true); };
$('oCenter').onclick = () => { const o = S.orn[S.sel]; if (o) { o.x = S.O.x; o.y = S.O.y; redraw(true); } };
$('snap').onchange = e => S.snap = e.target.checked;
$('showLines').onchange = e => { S.showLines = e.target.checked; redraw(); };
$('showSeam').onchange = e => { S.showSeam = e.target.checked; redraw(); };
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => {
  const prev = S.mode; S.mode = b.dataset.m; S.vmode = S.mode;
  if (prev === 'hinge' && S.mode !== 'hinge') S.theta = S.beta - S.alpha / 2;
  if (prev !== 'hinge' && S.mode === 'hinge') S.beta = S.theta + S.alpha / 2;
  if (S.mode === 'parallel' && T.shape !== 'rect') { T.before = T.shape; setTileShape('rect'); }
  else if (S.mode === 'hinge' && T.shape === 'rect' && T.before) { setTileShape(T.before); T.before = null; }
  redraw();
});
for (const { v, n } of N_ANG) {
  const b = document.createElement('button'); b.textContent = fmt(v) + '°'; b.title = '180°/' + n + ' → D' + n;
  b.onclick = () => { S.alpha = v; redraw(); }; $('chipsN').appendChild(b);
}
for (const { v, k } of K_ANG) {
  const b = document.createElement('button'); b.className = 'k'; b.textContent = k + ': ' + fmt(Math.round(v * 10) / 10) + '°';
  b.title = 'Dial mark ' + k + ' = 360°/' + k; b.onclick = () => { S.alpha = v; redraw(); }; $('chipsK').appendChild(b);
}

/* ---------- tiled surface ----------
   The tile is the mirror view cut to a regular polygon centred on the hinge, its edge normals laid
   along mirror axes. All tiles are identical: squares and hexagons are translated, triangles alternate
   with copies turned 180°. Neighbours continue each other across a joint exactly when the rosette is
   symmetric about the perpendicular bisector of that joint, i.e. when the edge normals are mirror axes
   of the rosette: n even for squares, n a multiple of 3 for triangles and hexagons (α = 180°/n). */
const T = { shape: 'hex', crop: 0.9, across: 7, joints: true, ratio: 0.3, border: false, before: null, shift: 0, vertical: false, bond: 'stack', bg: '#ffffff', snapSym: true };
const SHAPES = {
  tri:    { k: 3, maxA: 220, label: 'triangles', show: 90 },   // show: screen direction given to one edge normal, so tiles sit level
  square: { k: 4, maxA: 445, label: 'squares', show: 0 },
  hex:    { k: 6, maxA: 385, label: 'hexagons', show: 90 },
  rect:   { k: 4, maxA: 445, label: 'strips', show: 0 },      // narrow rectangles: long side across the mirror lines
};
/* Brewster's cells: the pattern is periodic, so one lattice cell is a tile that repeats by translation
   without a seam, whatever the drawing. Only shifts are used: no tile is turned or reflected, so nothing
   beyond the translations of the pattern is needed. The tile is cut from the rendered mirror view
   (RES × RES px, centred on a lattice point), so it must lie inside it. */
function latTileGeom() {
  const G = latGeom(), z = S.zoom, C = { x: RES / 2, y: RES / 2 };
  const u = { x: z * G.av.x, y: z * G.av.y }, v = { x: z * G.bv.x, y: z * G.bv.y }, lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
  let verts, shape;
  if (G.lat === 'hex') { shape = 'hex'; const R = lu / 2 / Math.cos(Math.PI / 6);
    verts = [0, 1, 2, 3, 4, 5].map(i => { const d = dir(S.lt + 30 + 60 * i); return { x: C.x + R * d.x, y: C.y + R * d.y }; }); }
  else { shape = G.lat === 'sq' ? 'square' : G.lat === 'rect' ? 'rect' : 'para';
    verts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => ({ x: C.x + (p * u.x + q * v.x) / 2, y: C.y + (p * u.y + q * v.y) / 2 })); }
  const out = verts.some(p => p.x < 1 || p.y < 1 || p.x > RES - 1 || p.y > RES - 1);
  return { lat: true, latShape: shape, verts, C, m: S.lt, a: (lu + lv) / 2, u, v, width: lu, L: lu, h: lv, G, out };
}
function tileGeom() {
  if (S.mode === 'lattice') return latTileGeom();
  if (T.shape === 'rect') return rectGeom();
  const sh = SHAPES[T.shape], a = sh.maxA * T.crop;            // a = apothem (centre to edge), in mirror-view px
  const m = S.mode === 'hinge' ? S.beta - S.alpha / 2 : S.mode === 'single' ? S.theta + 90 : S.theta + 90;   // a mirror axis direction
  const C = { x: RES / 2, y: RES / 2 }, R = a / Math.cos(Math.PI / sh.k);
  const verts = [];
  for (let i = 0; i < sh.k; i++) { const v = dir(m + 180 / sh.k + 360 * i / sh.k); verts.push({ x: C.x + R * v.x, y: C.y + R * v.y }); }
  let u, v, width;
  if (T.shape === 'square') { u = dir(m); v = dir(m + 90); u = { x: 2 * a * u.x, y: 2 * a * u.y }; v = { x: 2 * a * v.x, y: 2 * a * v.y }; width = 2 * a; }
  else if (T.shape === 'hex') { u = dir(m); v = dir(m + 60); u = { x: 2 * a * u.x, y: 2 * a * u.y }; v = { x: 2 * a * v.x, y: 2 * a * v.y }; width = 2 * a; }
  else { const sd = 2 * Math.sqrt(3) * a; u = dir(m + 90); v = dir(m + 150); u = { x: sd * u.x, y: sd * u.y }; v = { x: sd * v.x, y: sd * v.y }; width = sd; }
  return { a, m, C, verts, u, v, width, n0: dir(m) };
}
/* Strips. Parallel pair: the tile runs from one mirror line to the next-but-one (length 2d, one full repeat)
   and is centred on the middle mirror line. Shifting it by 2d along the row is a symmetry of the border, and a
   copy turned 180° about the middle of a long edge equals its reflection in that edge (the tile is symmetric
   about its middle mirror line), so stacked rows, every other one turned, are seamless for any motif.
   Hinged pair: a rectangle with both axes along mirror lines of the rosette, which needs n even. */
function rectGeom() {
  const C = { x: RES / 2, y: RES / 2 };
  let tAng, L;
  if (S.mode === 'hinge') { tAng = S.beta - S.alpha / 2; L = 2 * SHAPES.rect.maxA * T.crop; }
  else { tAng = S.theta + 90; L = Math.min(2 * S.d * S.zoom, 2 * 445); }
  const h = Math.min(T.ratio * L, 880), t = dir(tAng), nn = dir(tAng + 90);
  if (S.mode !== 'hinge') {
    // slide the band along the mirrors (this keeps it centred on a mirror line): start where the ornaments are
    let sw = 0, sp = 0;
    for (const o of S.orn) { const w = o.cw * o.ch * o.s * o.s; sw += w; sp += w * ((o.x - S.O.x) * nn.x + (o.y - S.O.y) * nn.y); }
    const lim = Math.max(0, RES / 2 - h / 2 - 4);
    const off = Math.max(-lim, Math.min(lim, (sw ? sp / sw : 0) * S.zoom + T.shift * lim));
    C.x += off * nn.x; C.y += off * nn.y;
  }
  const verts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => ({ x: C.x + p * L / 2 * t.x + q * h / 2 * nn.x, y: C.y + p * L / 2 * t.y + q * h / 2 * nn.y }));
  return { rect: true, a: Math.min(L, h) / 2, m: tAng, C, verts, L, h, t, nn, width: L };
}
let PIX = null;                     // pixels of the clean mirror view, read at most once per frame
const pixC = document.createElement('canvas'); pixC.width = pixC.height = RES; const pixX = pixC.getContext('2d', { willReadFrequently: true });
const cleanPix = () => PIX || (onWhite(pixX), PIX = pixX.getImageData(0, 0, RES, RES).data);   // the mirror view on white paper
function longEdgesClear() {
  const g = rectGeom(), { verts } = g, img = cleanPix();
  let ink = 0, n = 0;
  for (const [A, B] of [[verts[0], verts[1]], [verts[2], verts[3]]]) {          // the two long edges
    const len = Math.hypot(B.x - A.x, B.y - A.y), steps = Math.max(2, Math.round(len));
    for (const inset of [1.5, 3]) {
      const cx = (verts[0].x + verts[2].x) / 2, cy = (verts[0].y + verts[2].y) / 2, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dl = Math.hypot(cx - mx, cy - my) || 1, ix = (cx - mx) / dl * inset, iy = (cy - my) / dl * inset;
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(A.x + (B.x - A.x) * i / steps + ix), y = Math.round(A.y + (B.y - A.y) * i / steps + iy);
        if (x < 0 || y < 0 || x >= RES || y >= RES) continue;
        const o = (y * RES + x) * 4; n++; if (img[o] + img[o + 1] + img[o + 2] < 3 * 225) ink++;
      }
    }
  }
  return n ? ink / n < 0.004 : true;
}
function repeatsEveryD() {          // does the border inside the strip repeat after one spacing d (motif symmetric)?
  const g = rectGeom(), img = cleanPix(), D = S.d * S.zoom;
  const px = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= RES || y >= RES) return null; const o = (y * RES + x) * 4; return img[o] + img[o + 1] + img[o + 2]; };
  let diff = 0, inkPts = 0, n = 0;
  for (let i = 0; i < 60; i++) for (let j = 0; j < 16; j++) {
    const a = -g.L / 2 + g.L * (i + 0.5) / 60, b = -g.h / 2 + g.h * (j + 0.5) / 16;
    const x = g.C.x + a * g.t.x + b * g.nn.x, y = g.C.y + a * g.t.y + b * g.nn.y;
    const v0 = px(x, y), v1 = px(x + D * g.t.x, y + D * g.t.y); if (v0 === null || v1 === null) continue;
    n++; if (v0 < 3 * 225 || v1 < 3 * 225) { inkPts++; if (Math.abs(v0 - v1) > 3 * 60) diff++; }
  }
  return n > 50 && inkPts > 0 && diff / inkPts < 0.06;
}
function tilesCompatible() {
  if (S.mode === 'lattice') { const g0 = latTileGeom(); return g0.out ? { ok: false, why: 'latzoom' } : { ok: true, why: 'lat' }; }
  if (T.shape === 'rect') {
    if (S.mode === 'parallel') {
      if (2 * S.d * S.zoom > 890) return { ok: false, why: 'zoom' };
      if (T.bond === 'brick' && !T.border) return repeatsEveryD() ? { ok: true, why: 'bricksym' } : longEdgesClear() ? { ok: true, why: 'brickclear' } : { ok: false, why: 'brickpar' };
      return { ok: true, why: 'par' };
    }
    if (S.mode === 'single') return { ok: false, why: 'single' };
    const r = analyse(S.alpha); if (!r.closed) return { ok: false, why: 'seam' };
    if (T.bond === 'brick' && !T.border) return { ok: false, why: 'brickhinge', n: r.n };
    return { ok: r.n % 2 === 0, n: r.n, need: 2 };
  }
  if (S.mode !== 'hinge') return { ok: false, why: 'mode' };
  const r = analyse(S.alpha);
  if (!r.closed) return { ok: false, why: 'seam' };
  const need = T.shape === 'square' ? 2 : 3;
  return { ok: r.n % need === 0, n: r.n, need };
}
function renderTiles() {
  const W = tilesC.width, H = tilesC.height, g0 = tileGeom(), { a, C, verts, u, v } = g0;
  const vert = g0.rect && T.vertical;
  const k = (vert ? H : W) / (T.across * g0.width);
  const ctx = tctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const rho = rad((g0.lat ? (g0.latShape === 'hex' ? 90 : 0) : vert ? 90 : SHAPES[T.shape].show) - g0.m);   // turn the whole floor so the tiles are level on screen
  const setView = () => { ctx.setTransform(1, 0, 0, 1, W / 2, H / 2); ctx.rotate(rho); ctx.scale(k, k); ctx.translate(-C.x, -C.y); };
  const grow = 1 + 0.9 / (k * (g0.rect ? Math.min(g0.L, g0.h) / 2 : a));                               // overlap by about a pixel: no hairline gaps
  const poly = verts.map(p => ({ x: C.x + (p.x - C.x) * grow, y: C.y + (p.y - C.y) * grow }));
  const cells = [];
  if (g0.rect) {
    const { L, h, t, nn } = g0, NI = Math.ceil(Math.max(W, H) / k / L / 2) + 2, NR = T.border ? 0 : Math.ceil(Math.max(W, H) / k / h / 2) + 2;
    for (let r = -NR; r <= NR; r++) for (let i = -NI; i <= NI; i++) {
      const sh = (T.bond === 'brick' && r % 2 !== 0) ? 0.5 : 0;     // running bond: odd rows shifted half a tile
      const ox = (i + sh) * L * t.x, oy = (i + sh) * L * t.y;
      if (r % 2 === 0) cells.push([1, 0, 0, 1, r * h * nn.x + ox, r * h * nn.y + oy]);
      else cells.push([-1, 0, 0, -1, 2 * C.x + r * h * nn.x + ox, 2 * C.y + r * h * nn.y + oy]);   // turned 180°
    }
  }
  const N = g0.rect ? -1 : Math.ceil(Math.max(W, H) / k / Math.min(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y))) + 2;
  const reach = Math.hypot(W, H) / 2 / k + 2 * a;
  const inView = (x, y) => Math.hypot(x - C.x, y - C.y) < reach;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const tx = i * u.x + j * v.x, ty = i * u.y + j * v.y;
    if (inView(C.x + tx, C.y + ty)) cells.push([1, 0, 0, 1, tx, ty]);
    if (T.shape === 'tri' && !g0.lat) {                          // the 180°-turned neighbour across the edge with normal n0
      const mx = C.x + tx + a * g0.n0.x, my = C.y + ty + a * g0.n0.y;
      if (inView(2 * mx - C.x - tx, 2 * my - C.y - ty)) cells.push([-1, 0, 0, -1, 2 * mx - tx, 2 * my - ty]);
    }
  }
  for (const M of cells) {
    ctx.save(); setView(); ctx.transform(...M);
    ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
    ctx.fillStyle = T.bg; ctx.fill(); ctx.drawImage(clean, 0, 0); ctx.restore();
  }
  if (T.joints) {
    ctx.save(); setView(); ctx.strokeStyle = 'rgba(122,106,85,.45)'; ctx.lineWidth = 1 / k;
    for (const M of cells) { ctx.save(); ctx.transform(...M); ctx.beginPath(); verts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.restore(); ctx.stroke(); }
    ctx.restore();
  }
  // note
  const c = tilesCompatible(), note = $('tileNote');
  const name = g0.lat ? { hex: 'hexagonal cells', square: 'square cells', rect: 'rectangular cells', para: 'parallelogram cells' }[g0.latShape] : SHAPES[T.shape].label;
  let txt;
  if (c.why === 'lat') txt = `Seamless for any drawing: the pattern repeats on its ${LATNAME[g0.G.lat]} lattice, so one lattice cell is a tile and identical tiles are only shifted, never turned${g0.latShape === 'hex' ? ' (the hexagon is the cell of points nearer this centre than any other lattice point)' : ''}.`;
  else if (c.why === 'latzoom') txt = `The cell is larger than the mirror view, so the tile would be cut off. Lower the Zoom or the Cell size.`;
  else if (c.why === 'bricksym') txt = `Brick bond is seamless here: the motif between the mirrors is itself symmetric, so the border repeats after every spacing and a half-strip shift changes nothing.`;
  else if (c.why === 'brickclear') txt = `Brick bond works here only because nothing in the design touches the long edges of the strip. In general a half-strip shift puts the two halves of the repeat side by side in the wrong order, so the row joints break unless the motif between the mirrors is itself symmetric.`;
  else if (c.why === 'brickpar') txt = `Brick bond breaks along the row joints: a half-strip shift puts the two halves of the border's repeat in the wrong order. It works only if the motif between the mirrors is itself symmetric, or if the design stays clear of the long edges (lower the Height or move the Position). Stacked rows are always seamless.`;
  else if (c.why === 'par') txt = `Seamless for any motif: each strip runs from one mirror line to the next-but-one (one full repeat of the border) and is centred on a mirror line, so strips continue each other end to end, and stacked rows, every other one turned 180°, meet in mirror images.`;
  else if (c.why === 'brickhinge') txt = `Brick bond breaks with strips cut from a rosette: shifting a row by half a tile puts unrelated halves side by side. Use stacked rows, or the parallel pair, where brick bond is seamless.`;
  else if (c.why === 'zoom') txt = `The repeat (twice the mirror spacing) is larger than the mirror view: zoom out the mirror view or bring the mirrors closer.`;
  else if (c.why === 'single') txt = `A single mirror gives only one reflection, with no repeat to tile. Use the parallel pair for strips.`;
  else if (c.why === 'mode') txt = `These tiles are cut around the hinge of a hinged-pair rosette. With parallel mirrors use <b>Strips</b>.`;
  else if (c.why === 'seam') txt = `This opening has a seam, so the tile itself is broken. Choose an angle 180°/n from the first row of chips.`;
  else if (c.ok) txt = `Seamless: every tile is identical, and because each joint lies across a mirror axis of the D<sub>${c.n}</sub> rosette, neighbouring tiles continue each other${T.shape === 'tri' ? ' (every other triangle is turned 180°, as when laying real tiles)' : ''}.`;
  else if (T.shape === 'rect') txt = `Strips cut from a rosette need n even (90°, 45°, 30°, 22.5°); with D<sub>${c.n}</sub> they break at the joints. Parallel mirrors make strips that always fit.`;
  else txt = `Identical ${name} need a rosette whose symmetry number n is ${c.need === 2 ? 'even' : 'a multiple of 3'}; with D<sub>${c.n}</sub> the patterns break at the joints. Try ${c.need === 2 ? '90°, 45°, 30° or 22.5°' : '60°, 30° or 15°'}.`;
  note.innerHTML = txt + ' <a data-help="h-tiles">Why?</a>'; note.classList.toggle('warn', !c.ok);
  $('tileLbl').textContent = c.ok ? `${name} · seamless` : `${name}`;
  const latM = S.mode === 'lattice';
  $('ratioLbl').hidden = $('borderLbl').hidden = T.shape !== 'rect' || latM;
  $('shiftLbl').hidden = T.shape !== 'rect' || S.mode === 'hinge' || latM;
  $('stripDir').hidden = T.shape !== 'rect' || latM;
  $('stripBond').hidden = T.shape !== 'rect' || T.border || latM;
  $('cropLbl').hidden = (T.shape === 'rect' && S.mode !== 'hinge') || latM;
  $('tileSeg').hidden = latM;
}
function setTileShape(sh) { T.shape = sh; document.querySelectorAll('#tileSeg button').forEach(x => x.classList.toggle('on', x.dataset.t === sh)); }
document.querySelectorAll('#tileSeg button').forEach(b => b.onclick = () => { T.before = null; setTileShape(b.dataset.t); redraw(); });
document.querySelectorAll('#stripBond button').forEach(b => b.onclick = () => {
  T.bond = b.dataset.b; document.querySelectorAll('#stripBond button').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
document.querySelectorAll('#stripDir button').forEach(b => b.onclick = () => {
  T.vertical = b.dataset.o === 'v'; document.querySelectorAll('#stripDir button').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
$('tileShift').addEventListener('input', e => { T.shift = +e.target.value; redraw(); });
$('tileRatio').addEventListener('input', e => { T.ratio = +e.target.value; redraw(); });
$('tileBorder').onchange = e => { T.border = e.target.checked; redraw(); };
$('tileCrop').addEventListener('input', e => { T.crop = +e.target.value; redraw(); });
$('tileN').addEventListener('input', e => { T.across = +e.target.value; redraw(); });
$('tileJoints').onchange = e => { T.joints = e.target.checked; redraw(); };
/* tile background: plain colours behind the ornaments (white, the book's papers, and its inks) */
const BGS = [['#ffffff', 'white'], ['#f3ead6', 'cream paper'], ['#e6dcc4', 'buff paper'], ['#d7dcc6', 'pale sage'], ['#e9cfc0', 'pale rose'], ['#9fa889', 'leaf green'], ['#c9845a', 'terracotta'], ['#4f5a5c', 'slate'], ['#2f2a22', 'ink black']];
function setTileBg(c) { T.bg = c; $('tileBg').value = c; document.querySelectorAll('#bgSw button').forEach(b => b.classList.toggle('on', b.dataset.c === c)); redraw(); }
for (const [c, n] of BGS) { const b = document.createElement('button'); b.dataset.c = c; b.title = n; b.style.background = c; b.onclick = () => setTileBg(c); $('bgSw').appendChild(b); }
$('tileBg').addEventListener('input', e => setTileBg(e.target.value)); setTileBg('#ffffff');
