/* Tessera · Mosaic maker tab: view, tools, free form, guide image, lettering, sending to Compose */
'use strict';

/* =====================================================================================
   THE MOSAIC TAB: one mosaic on a workspace. Made from an image (Roman, Roman following the
   outlines, trencadís) or laid by hand from baskets of random pieces (free form), then edited
   piece by piece, and sent to Compose as a tile or as a rectangular panel.
   The mosaic is the same object a mosaic tile keeps: W, H, shape, cells (flat polygons), col, sh, pal…
   ===================================================================================== */
const zb = $('zBoard'), ZV = { z: 1, ox: 0, oy: 0 };
const Z = { m: null, sel: new Set(), tool: 'select', brush: 0, undo: [], redo: [], last: '', linked: null, rot: 0, place: null, drag: null, box: null, hover: null };
const zMsg = (t, warn) => { const e = $('zStatus'); e.textContent = t; e.style.color = warn ? '#a33' : ''; };
const zInval = m => { hide(m, '_polys', null); hide(m, '_bb', null); };
const zSnapStr = () => Z.m ? JSON.stringify(Z.m) : '';
function zCommit() { const s = zSnapStr(); if (s === Z.last) return; if (Z.last) { Z.undo.push(Z.last); if (Z.undo.length > 40) Z.undo.shift(); } Z.redo.length = 0; Z.last = s; zSave(); zPanel(); }
function zRestore(s) { Z.m = JSON.parse(s); Z.last = s; Z.sel.clear(); Z.hover = null; zSave(); zPanel(); zRender(); }
$('zUndo').onclick = () => { if (Z.undo.length) { Z.redo.push(Z.last); zRestore(Z.undo.pop()); } };
$('zRedo').onclick = () => { if (Z.redo.length) { Z.undo.push(Z.last); zRestore(Z.redo.pop()); } };
let zSaveT = 0;
function zSave() { clearTimeout(zSaveT); zSaveT = setTimeout(() => { if (TDB.db) tdbPut('mosaicDoc', { m: Z.m, linked: Z.linked }); }, 600); }
function zUntangle(m) {     // a mosaic made before pieces were kept apart: trim the overlaps away, so the same rules hold for every mosaic
  if (!m || !m.cells.length) return 0;
  const C = separatePieces(m.cells.map(mPoly), true); let n = 0; const cells = [], col = [], sh = [];
  C.forEach((P, i) => { if (!P) { n++; return; } const f = P.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]); if (f.join() !== m.cells[i].join()) n++; cells.push(f); col.push(m.col[i]); sh.push(m.sh[i]); });
  if (n) { m.cells = cells; m.col = col; m.sh = sh; zInval(m); }
  return n; }
function zLoad(m, linked, msg) {
  zUntangle(m);
  if (Z.m && Z.last) { Z.undo.push(Z.last); if (Z.undo.length > 40) Z.undo.shift(); }
  Z.m = m; Z.linked = linked || null; Z.sel.clear(); Z.hover = null; Z.last = zSnapStr(); Z.brush = 0; zSave(); zPanel(); zFit(); if (msg) zMsg(msg);
}

/* ---------- view ---------- */
function zSize() { const r = zb.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(50, Math.round(r.width * dpr)), H = Math.max(50, Math.round(r.height * dpr));
  if (zb.width !== W || zb.height !== H) { zb.width = W; zb.height = H; } return { w: r.width, h: r.height, dpr }; }
const zWorld = (sx, sy) => ({ x: (sx - ZV.ox) / ZV.z, y: (sy - ZV.oy) / ZV.z });
const zEv = e => { const r = zb.getBoundingClientRect(); return zWorld(e.clientX - r.left, e.clientY - r.top); };
function zFit() { if (!Z.m) { zRender(); return; } const { w, h } = zSize(), m = Z.m; ZV.z = Math.min(6, 0.9 * Math.min(w / m.W, h / m.H)); ZV.ox = (w - m.W * ZV.z) / 2; ZV.oy = (h - m.H * ZV.z) / 2; zRender(); }
$('zFit').onclick = zFit;
let zPending = false;
function zRender() { if ($('mosaicView').hidden || zPending) return; zPending = true; requestAnimationFrame(() => { zPending = false; zDraw(); }); }
const zPath = (ctx, P) => { ctx.beginPath(); P.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
/* a guide image under the space, to lay pieces on; kept with the open mosaic in this browser, never exported */
const ZG = { src: null, img: null, a: 0.35, fit: 'contain', show: true, col: false, smp: null };
function zGuideRect() { const m = Z.m, im = ZG.img; if (!m || !im) return null; const iw = im.width, ih = im.height;
  if (ZG.fit === 'stretch') return [0, 0, m.W, m.H];
  const k = ZG.fit === 'cover' ? Math.max(m.W / iw, m.H / ih) : Math.min(m.W / iw, m.H / ih); return [(m.W - iw * k) / 2, (m.H - ih * k) / 2, iw * k, ih * k]; }
function zGuideSample(P) {   // the mean colour of the guide under a piece (null where the guide does not reach)
  const r = zGuideRect(); if (!r) return null;
  if (!ZG.smp) { const c = document.createElement('canvas'), k = Math.min(1, 800 / Math.max(ZG.img.width, ZG.img.height)); c.width = Math.max(1, Math.round(ZG.img.width * k)); c.height = Math.max(1, Math.round(ZG.img.height * k));
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(ZG.img, 0, 0, c.width, c.height); ZG.smp = { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }; }
  const S = ZG.smp, Q = P.map(([x, y]) => ({ x, y })); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of Q) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  let R = 0, G = 0, B = 0, n = 0; const st = Math.max((x1 - x0), (y1 - y0)) / 6 || 1;
  for (let y = y0 + st / 2; y < y1; y += st) for (let x = x0 + st / 2; x < x1; x += st) { if (!inPoly({ x, y }, Q)) continue;
    const u = Math.floor((x - r[0]) / r[2] * S.w), v = Math.floor((y - r[1]) / r[3] * S.h); if (u < 0 || v < 0 || u >= S.w || v >= S.h) continue;
    const i = 4 * (v * S.w + u); if (S.d[i + 3] < 40) continue; R += S.d[i]; G += S.d[i + 1]; B += S.d[i + 2]; n++; }
  if (!n) { const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2], u = Math.floor((cx - r[0]) / r[2] * S.w), v = Math.floor((cy - r[1]) / r[3] * S.h);
    if (u < 0 || v < 0 || u >= S.w || v >= S.h) return null; const i = 4 * (v * S.w + u); R = S.d[i]; G = S.d[i + 1]; B = S.d[i + 2]; n = 1; }
  const h = t => Math.round(t / n).toString(16).padStart(2, '0'); return '#' + h(R) + h(G) + h(B); }
function zGuideSet(src, opts) { ZG.smp = null; if (!src) { ZG.src = ZG.img = null; zGuideUI(); zGuideSave(); zRender(); return; }
  const im = new Image(); im.onload = () => { ZG.src = src; ZG.img = im; ZG.show = true; if (opts) Object.assign(ZG, opts); zGuideUI(); zRender(); if (!opts) { zGuideSave(); zMsg('Guide image loaded under the space. Lay the pieces on it; set how strongly it shows on the left.'); } };
  im.onerror = () => zMsg('That picture could not be read.', true); im.src = src; }
function zGuideSave() { if (TDB.db) tdbPut('mosaicGuide', ZG.src ? { src: ZG.src, a: ZG.a, fit: ZG.fit, show: ZG.show, col: ZG.col } : null); }
function zGuideUI() { const on = !!ZG.img; $('zGuideCtl').hidden = !on; $('zGuideHide').hidden = !on; $('zGuideDel').hidden = !on;
  $('zGuideHide').textContent = ZG.show ? 'Hide' : 'Show'; $('zGuideLoad').textContent = on ? 'Another guide image…' : 'Load a guide image…';
  $('zGuideA').value = Math.round(ZG.a * 100); $('zGuideAV').textContent = Math.round(ZG.a * 100) + ' %'; $('zGuideFit').value = ZG.fit; $('zGuideCol').checked = ZG.col; }
$('zGuideLoad').onclick = () => $('zGuideFile').click();
$('zGuideFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const im = new Image(), u = URL.createObjectURL(f);
  im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); let d = c.toDataURL('image/webp', 0.85); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', 0.85); zGuideSet(d); };
  im.onerror = () => { URL.revokeObjectURL(u); zMsg('That file is not a picture this browser can read.', true); }; im.src = u; };
$('zGuideHide').onclick = () => { ZG.show = !ZG.show; zGuideUI(); zGuideSave(); zRender(); };
$('zGuideDel').onclick = () => { zGuideSet(null); zMsg('Guide image removed; the pieces stay.'); };
$('zGuideA').oninput = () => { ZG.a = $('zGuideA').value / 100; $('zGuideAV').textContent = $('zGuideA').value + ' %'; zRender(); };
$('zGuideA').onchange = zGuideSave;
$('zGuideFit').onchange = () => { ZG.fit = $('zGuideFit').value; zGuideSave(); zRender(); };
$('zGuideCol').onchange = () => { ZG.col = $('zGuideCol').checked; zGuideSave(); };
/* turning the piece in hand */
function zSetRot(a) { a = ((Math.round(a) % 360) + 540) % 360 - 180; Z.rot = a; $('zRotA').value = a; $('zRotV').textContent = a + '°'; zRender(); }
$('zHandL').onclick = () => zSetRot(Z.rot - 15); $('zHandR').onclick = () => zSetRot(Z.rot + 15);
$('zRotA').oninput = () => zSetRot(+$('zRotA').value);
function zDraw() {
  const { dpr } = zSize(), ctx = zb.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, zb.width, zb.height);
  ctx.fillStyle = '#efe9dc'; ctx.fillRect(0, 0, zb.width, zb.height);
  if (!Z.m) { ctx.fillStyle = '#7a6d5c'; ctx.font = `${15 * dpr}px Georgia, serif`; ctx.textAlign = 'center';
    ctx.fillText('Start on the left: “From an image” or “Free form”.', zb.width / 2, zb.height / 2); return; }
  ctx.setTransform(ZV.z * dpr, 0, 0, ZV.z * dpr, ZV.ox * dpr, ZV.oy * dpr);
  const m = Z.m, out = shapeOutline(m.shape, m.W, m.H), P = mosaicPolys(m);
  ctx.save(); zPath(ctx, out); ctx.fillStyle = m.mortar; ctx.fill(); ctx.clip();
  if (ZG.img && ZG.show) { const r = zGuideRect(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = ZG.a; ctx.drawImage(ZG.img, r[0], r[1], r[2], r[3]); ctx.globalAlpha = 1; }
  for (let i = 0; i < P.length; i++) { ctx.fillStyle = mColour(m, i); zPath(ctx, P[i]); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 1.5 / ZV.z; ctx.strokeStyle = '#6b5c48'; ctx.setLineDash([6 / ZV.z, 4 / ZV.z]); zPath(ctx, out); ctx.stroke(); ctx.setLineDash([]);
  // pieces outside the space are shown faintly (they are cut off when the mosaic is used)
  ctx.globalAlpha = 0.3; for (let i = 0; i < P.length; i++) { const b = zBB(i); if (b[0] < 0 || b[1] < 0 || b[2] > m.W || b[3] > m.H) { ctx.fillStyle = mColour(m, i); zPath(ctx, P[i]); ctx.fill(); } } ctx.globalAlpha = 1;
  if (Z.sel.size) { ctx.lineWidth = 2 / ZV.z; ctx.strokeStyle = '#a3434f'; for (const i of Z.sel) if (m.cells[i]) { zPath(ctx, mPoly(m.cells[i])); ctx.stroke(); } }
  if (Z.hover != null && m.cells[Z.hover] && Z.tool !== 'place') { ctx.lineWidth = 1.5 / ZV.z; ctx.strokeStyle = 'rgba(47,93,90,.9)'; zPath(ctx, mPoly(m.cells[Z.hover])); ctx.stroke(); }
  if (Z.box) { const b = Z.box; ctx.fillStyle = 'rgba(47,93,90,.08)'; ctx.strokeStyle = '#2f5d5a'; ctx.lineWidth = 1 / ZV.z; ctx.setLineDash([4 / ZV.z, 3 / ZV.z]);
    ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.setLineDash([]); }
  if (Z.tool === 'text' && Z.text && Z.text.at) { const a = Z.text.at; ctx.globalAlpha = 0.85;
    Z.text.P.forEach((P, k) => { ctx.fillStyle = Z.text.hex ? Z.text.hex[k] : (Z.text.ink || $('zTInk').value); zPath(ctx, P.map(([x, y]) => [x + a.x, y + a.y])); ctx.fill(); }); ctx.globalAlpha = 1; }
  if (Z.tool === 'place' && Z.place && Z.place.at) { let G = zPlaced(Z.place.at), bad = false;
    if (zFreeMode()) { const F = zFreeSpot(G); if (F) G = F; else bad = true; }
    ctx.globalAlpha = bad ? 0.35 : 0.75; ctx.fillStyle = bad ? '#a3434f' : ((ZG.col && ZG.img && zGuideSample(G)) || m.pal[Z.brush] || '#888'); zPath(ctx, G); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a3434f'; ctx.lineWidth = 1 / ZV.z; zPath(ctx, G); ctx.stroke(); }
}
function zBB(i) { const m = Z.m; if (!m._bb) hide(m, '_bb', []); let b = m._bb[i];
  if (!b) { const f = m.cells[i]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); y0 = Math.min(y0, f[k + 1]); x1 = Math.max(x1, f[k]); y1 = Math.max(y1, f[k + 1]); }
    b = m._bb[i] = [x0, y0, x1, y1]; } return b; }
function zHit(w) { const m = Z.m; if (!m) return null;
  for (let i = m.cells.length - 1; i >= 0; i--) { const b = zBB(i); if (w.x < b[0] || w.x > b[2] || w.y < b[1] || w.y > b[3]) continue;
    if (inPoly(w, mPoly(m.cells[i]).map(([x, y]) => ({ x, y })))) return i; } return null; }
const zBBf = f => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); y0 = Math.min(y0, f[k + 1]); x1 = Math.max(x1, f[k]); y1 = Math.max(y1, f[k + 1]); } return [x0, y0, x1, y1]; };
const zCent = f => { let x = 0, y = 0; const n = f.length / 2; for (let k = 0; k < f.length; k += 2) { x += f[k]; y += f[k + 1]; } return [x / n, y / n]; };

/* ---------- pointer: select, move, box, paint, place, pan ---------- */
zb.addEventListener('wheel', e => { e.preventDefault(); const r = zb.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, w = zWorld(sx, sy);
  ZV.z = Math.min(20, Math.max(0.05, ZV.z * Math.exp(-e.deltaY * 0.0015))); ZV.ox = sx - w.x * ZV.z; ZV.oy = sy - w.y * ZV.z; zRender(); }, { passive: false });
zb.addEventListener('pointerdown', e => {
  if (!Z.m) return; zb.setPointerCapture(e.pointerId); const w = zEv(e), m = Z.m;
  if (e.button === 1 || e.button === 2) { Z.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: ZV.ox, oy: ZV.oy }; return; }
  if (Z.tool === 'text' && Z.text) { zPlaceText(w); return; }
  if (Z.tool === 'place' && Z.place) {           // click lays one piece; hold and drag to keep laying them along the stroke
    const ok = zPlace(w, e.shiftKey, false, true); Z.drag = { kind: 'lay', last: ok ? w : null, prev: w, n: ok ? 1 : 0, keep: e.shiftKey }; return; }
  const i = zHit(w);
  if (Z.tool === 'paint') { if (i == null) { Z.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: ZV.ox, oy: ZV.oy }; return; }
    if (e.altKey) { Z.brush = m.col[i]; zPanel(); return; }
    Z.drag = { kind: 'paint' }; zPaint(i); return; }
  if (e.shiftKey || e.ctrlKey || e.metaKey) {      // Shift-drag: a box (over pieces too); Shift-click: add or remove one piece
    Z.box = { x0: w.x, y0: w.y, x1: w.x, y1: w.y }; Z.drag = { kind: 'box', i, sx: e.clientX, sy: e.clientY }; zRender(); return; }
  if (i == null) { if (Z.sel.size) { Z.sel.clear(); zPanel(); } Z.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: ZV.ox, oy: ZV.oy }; zRender(); return; }
  if (!Z.sel.has(i)) { Z.sel.clear(); Z.sel.add(i); zPanel(); }
  Z.drag = { kind: 'move', w0: w, orig: [...Z.sel].map(k => [k, m.cells[k].slice()]), moved: false }; zRender();
});
zb.addEventListener('pointermove', e => {
  if (!Z.m) return; const w = zEv(e), m = Z.m;
  if (!Z.drag) { if (Z.tool === 'text' && Z.text) { Z.text.at = w; zRender(); return; }
    if (Z.tool === 'place' && Z.place) { Z.place.at = w; zRender(); return; }
    const h = zHit(w); if (h !== Z.hover) { Z.hover = h; zRender(); } zb.style.cursor = Z.tool === 'paint' ? 'crosshair' : h != null ? 'move' : 'default'; return; }
  const d = Z.drag;
  if (d.kind === 'pan') { ZV.ox = d.ox + e.clientX - d.sx; ZV.oy = d.oy + e.clientY - d.sy; zRender(); return; }
  if (d.kind === 'box') { Z.box.x1 = w.x; Z.box.y1 = w.y; zRender(); return; }
  if (d.kind === 'paint') { const i = zHit(w); if (i != null) zPaint(i); return; }
  if (d.kind === 'lay') {        // walk the pointer's path in small steps, so a fast stroke leaves no gaps
    const step = 0.6 * Math.sqrt(Math.abs(pArea(BASK[Z.place.b][Z.place.s]))), p0 = d.prev || w, len = Math.hypot(w.x - p0.x, w.y - p0.y), k = Math.min(200, Math.ceil(len / 1.5));
    for (let t = 1; t <= k; t++) { const q = { x: p0.x + (w.x - p0.x) * t / k, y: p0.y + (w.y - p0.y) * t / k };
      if ((!d.last || Math.hypot(q.x - d.last.x, q.y - d.last.y) >= step) && zPlace(q, d.keep, true, true)) { d.last = q; d.n++; } }
    d.prev = w; Z.place.at = w; zRender(); return; }
  if (d.kind === 'move') { let dx = w.x - d.w0.x, dy = w.y - d.w0.y; d.moved = true;
    if (zFreeMode()) {       // slide as far as the pieces stay clear of the others
      if (!d.skip) d.skip = zOverlapping(new Set(d.orig.map(o => o[0])));
      const skip = d.skip, ok = (ox, oy) => { ox = +ox.toFixed(1); oy = +oy.toFixed(1); return d.orig.length > Z_CHECK_MAX || d.orig.every(([, f]) => !zHits(mPoly(f).map(([x, y]) => [+(x + ox).toFixed(1), +(y + oy).toFixed(1)]), skip)); };
      const l = d.last || [0, 0];
      if (!d.step) d.step = Math.max(0.5, 0.4 * Math.min(...d.orig.map(([, f]) => Math.sqrt(Math.abs(pArea(mPoly(f)))))));
      const ns = Math.min(400, Math.ceil(Math.hypot(dx - l[0], dy - l[1]) / d.step));   // walk the path in steps under half a piece, so nothing is jumped over
      let t0 = 0, hit = false;
      for (let k = 1; k <= ns; k++) { const t = k / ns; if (ok(l[0] + (dx - l[0]) * t, l[1] + (dy - l[1]) * t)) t0 = t; else { hit = true; break; } }
      if (hit) { let lo = t0, hi = Math.min(1, t0 + 1 / ns); for (let it = 0; it < 10; it++) { const t = (lo + hi) / 2; if (ok(l[0] + (dx - l[0]) * t, l[1] + (dy - l[1]) * t)) lo = t; else hi = t; }
        dx = l[0] + (dx - l[0]) * lo; dy = l[1] + (dy - l[1]) * lo; }
      if (hit || ns) { dx = +dx.toFixed(1); dy = +dy.toFixed(1); }
      d.last = [dx, dy]; }
    for (const [k, f] of d.orig) m.cells[k] = f.map((v, j) => +(v + (j % 2 ? dy : dx)).toFixed(1)); zInval(m); zRender(); }
});
function zEnd() {
  const d = Z.drag; Z.drag = null; if (!d || !Z.m) return; const m = Z.m;
  if (d.kind === 'box' && Math.hypot(Z.box.x1 - Z.box.x0, Z.box.y1 - Z.box.y0) * ZV.z < 4) { Z.box = null;
    if (d.i != null) { Z.sel.has(d.i) ? Z.sel.delete(d.i) : Z.sel.add(d.i); } zPanel(); zRender(); return; }
  if (d.kind === 'box') { const b = Z.box, x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    m.cells.forEach((f, i) => { const [cx, cy] = zCent(f); if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) Z.sel.add(i); }); Z.box = null; zPanel(); zRender(); return; }
  if (d.kind === 'lay') { if (d.n) { zCommit(); if (d.n > 1) zMsg(`Laid ${d.n} pieces along the stroke (Undo takes the whole stroke back).`); } zRender(); return; }
  if (d.kind === 'paint' || (d.kind === 'move' && d.moved)) { zCommit(); zRender(); }
}
zb.addEventListener('pointerup', zEnd); zb.addEventListener('pointercancel', zEnd);
zb.addEventListener('contextmenu', e => e.preventDefault());
function zPaint(i) { const m = Z.m; if (m.col[i] !== Z.brush) { m.col[i] = Z.brush; zRender(); } }
window.addEventListener('keydown', e => {
  if ($('mosaicView').hidden || !$('infoOv').hidden || !$('helpOv').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('zRedo') : $('zUndo')).click(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); $('zRedo').click(); return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); $('zAll').click(); return; }
  if (e.key === 'Escape') { if (Z.tool !== 'select') zTool('select'); else { Z.sel.clear(); zPanel(); zRender(); } return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('zDel').click(); return; }
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); const a = e.shiftKey ? -15 : 15; if (Z.tool === 'place') zSetRot(Z.rot + a); else zRotate(a); return; }
  if (e.key.toLowerCase() === 't') { e.preventDefault(); $('zTossSel').click(); }
});

/* ---------- tools, palette, edits ---------- */
function zTool(t) { Z.tool = t; if (t !== 'place') { Z.place = null; zBaskets(); } if (t !== 'text') Z.text = null;
  document.querySelectorAll('#zTools button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); zb.style.cursor = t === 'paint' ? 'crosshair' : 'default';
  if (t !== 'text') zMsg(t === 'paint' ? 'Paint: click or drag over pieces to give them the chosen colour; Alt-click picks up a colour.' : t === 'place' ? 'Place: click in the space to lay the piece (R turns it; Shift-click keeps the same shape). Esc stops.' : 'Select: click a piece, Shift-click or Shift-drag for more; drag to move; R turns; T tosses new shapes; Del deletes.'); zRender(); }
document.querySelectorAll('#zTools button').forEach(b => b.onclick = () => {
  if (b.dataset.t === 'place' && !Z.place) {        // the baskets live under Free form: open it, so there is a piece to choose
    const ff = document.querySelector('#zStartTabs button[data-s=free]'); if (ff && !ff.classList.contains('on')) ff.click();
    zMsg('Choose a piece in one of the baskets (left, under Free form), then click in the space to lay it.'); return; }
  zTool(b.dataset.t); });
function zPanel() {
  const m = Z.m, has = !!m;
  ['zEdit', 'zOut'].forEach(id => $(id).hidden = !has);
  if (!has) return;
  Z.brush = Math.min(Z.brush, m.pal.length - 1);
  const sw = $('zSwatches'); sw.innerHTML = ''; const counts = m.pal.map(() => 0); m.col.forEach(c => counts[c] = (counts[c] || 0) + 1);
  m.pal.forEach((h, i) => { const b = document.createElement('button'); b.className = 'sw' + (i === Z.brush ? ' on' : ''); b.style.background = h;
    b.title = `${h} · ${counts[i] || 0} piece${counts[i] === 1 ? '' : 's'}. Click: choose it${Z.sel.size ? ' and give it to the selected pieces' : ''}. Double-click: select all pieces of this colour.`;
    b.onclick = () => { Z.brush = i; if (Z.sel.size && Z.tool === 'select') { for (const k of Z.sel) m.col[k] = i; zCommit(); zRender(); } zPanel(); };
    b.ondblclick = () => { Z.sel.clear(); m.col.forEach((c, k) => { if (c === i) Z.sel.add(k); }); zTool('select'); zPanel(); zRender(); };
    sw.appendChild(b); });
  $('zPick').value = m.pal[Z.brush] || '#888888';
  $('zSelInfo').textContent = Z.sel.size ? `${Z.sel.size} piece${Z.sel.size > 1 ? 's' : ''} selected` : `${m.cells.length} pieces · ${m.pal.length} colours`;
  $('zMortar').value = m.mortar; $('zJoint').value = m.gapPx != null ? m.gapPx : +(m.gap * m.W / m.n).toFixed(1); $('zJointV').textContent = (+$('zJoint').value).toFixed(1) + ' px';
  $('zSaveBack').hidden = !(Z.linked && dById(Z.linked)); if (Z.linked && dById(Z.linked)) $('zSaveBack').textContent = `Save back to “${dById(Z.linked).name.slice(0, 28)}”`;
  $('zSpaceInfo').textContent = `${{ rect: 'Rectangle', square: 'Square', hex: 'Hexagon', tri: 'Triangle' }[m.shape]} · ${Math.round(m.W)} × ${Math.round(m.H)} px`;
  if (m.shape === 'rect' || m.shape === 'square') { $('zW').value = Math.round(m.W); $('zH').value = Math.round(m.H); } else $('zE').value = Math.round(m.shape === 'hex' ? m.W / 2 : m.W);
  zSpaceRows();
  const hs = zHostSize(); $('zTHost').hidden = !hs; if (hs) $('zTHostV').textContent = hs.toFixed(1) + ' px';
}
function zHostSize() {      // typical size of the pieces of the open mosaic (median of √area)
  const m = Z.m; if (!m || !m.cells.length) return 0; const a = [], st = Math.max(1, Math.floor(m.cells.length / 300));
  for (let i = 0; i < m.cells.length; i += st) a.push(Math.sqrt(Math.abs(pArea(mPoly(m.cells[i]))))); a.sort((p, q) => p - q); return a[a.length >> 1]; }
$('zTMatch').onclick = () => { const hs = zHostSize(); if (!hs) return; const v = Math.max(3, Math.min(40, Math.round(hs * 2) / 2)); $('zTPiece').value = v; $('zTPieceV').textContent = v + ' px'; };
$('zPick').addEventListener('input', e => { if (!Z.m) return; Z.m.pal[Z.brush] = e.target.value; const b = $('zSwatches').children[Z.brush]; if (b) b.style.background = e.target.value; zRender(); });
$('zPick').addEventListener('change', () => { if (Z.m) zCommit(); });
$('zAddCol').onclick = () => { if (!Z.m) return; Z.m.pal.push($('zPick').value); Z.brush = Z.m.pal.length - 1; zCommit(); zMsg('Colour added: change it with the colour box.'); };
$('zMortar').addEventListener('input', e => { if (!Z.m) return; Z.m.mortar = e.target.value; zRender(); });
$('zMortar').addEventListener('change', () => zCommit());
$('zJoint').addEventListener('input', e => { if (!Z.m) return; Z.m.gapPx = +e.target.value; $('zJointV').textContent = Z.m.gapPx.toFixed(1) + ' px'; zInval(Z.m); zRender(); });
$('zJoint').addEventListener('change', () => zCommit());
$('zAll').onclick = () => { if (!Z.m) return; Z.m.cells.forEach((_, i) => Z.sel.add(i)); zTool('select'); zPanel(); zRender(); };
$('zDel').onclick = () => { const m = Z.m; if (!m || !Z.sel.size) return; const keep = m.cells.map((_, i) => !Z.sel.has(i));
  m.cells = m.cells.filter((_, i) => keep[i]); m.col = m.col.filter((_, i) => keep[i]); m.sh = m.sh.filter((_, i) => keep[i]); const n = Z.sel.size; Z.sel.clear(); Z.hover = null; zInval(m); zCommit(); zRender(); zMsg(`Deleted ${n} piece${n > 1 ? 's' : ''}.`); };
function zRotate(a) { const m = Z.m; if (!m || !Z.sel.size) return; let cx = 0, cy = 0; for (const i of Z.sel) { const [x, y] = zCent(m.cells[i]); cx += x; cy += y; } cx /= Z.sel.size; cy /= Z.sel.size;
  const c = Math.cos(rad(a)), s = Math.sin(rad(a)), old = new Map([...Z.sel].map(i => [i, m.cells[i]])), skip = zOverlapping(Z.sel);
  for (const i of Z.sel) m.cells[i] = m.cells[i].map((v, j, f) => j % 2 ? +(cy + (f[j - 1] - cx) * s + (v - cy) * c).toFixed(1) : +(cx + (v - cx) * c - (f[j + 1] - cy) * s).toFixed(1));
  zInval(m);
  if (zFreeMode() && Z.sel.size <= Z_CHECK_MAX && [...Z.sel].some(i => zHits(mPoly(m.cells[i]), skip))) { for (const [i, f] of old) m.cells[i] = f; zInval(m); zMsg('No room to turn: the piece would overlap its neighbours. Move it a little first.', true); zRender(); return; }
  zCommit(); zRender(); }
$('zRotL').onclick = () => zRotate(-15); $('zRotR').onclick = () => zRotate(15);
$('zTossSel').onclick = () => { const m = Z.m; if (!m || !Z.sel.size) { zMsg('Select pieces first: Toss gives them new random shapes of the same size.', true); return; }
  const R = rng(Date.now() & 0xffff), kind = $('zKind').value; let kept = 0;
  for (const i of Z.sel) { const P = mPoly(m.cells[i]), [cx, cy] = zCent(m.cells[i]), sz = Math.sqrt(Math.abs(pArea(P)));
    const old = m.cells[i], skip = zOverlapping(new Set([i])); let done = false;
    for (let tr = 0; tr < 24 && !done; tr++) {
      const S = randShape(sz * 1.08 * (tr < 12 ? 1 : 0.85), kind === 'mixed' ? (P.length === 4 ? 'tess' : 'shard') : kind, R), a = R() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      m.cells[i] = S.flatMap(([x, y]) => [+(cx + x * c - y * s).toFixed(1), +(cy + x * s + y * c).toFixed(1)]); zInval(m);
      done = !zFreeMode() || !zHits(mPoly(m.cells[i]), skip); }
    if (!done) { m.cells[i] = old; zInval(m); kept++; } }
  zInval(m); zCommit(); zRender(); zMsg(kept ? `New shapes tossed; ${kept} piece${kept > 1 ? 's' : ''} kept ${kept > 1 ? 'their' : 'its'} shape (no room for a new one).` : 'New shapes tossed. Toss again (T), or Undo to go back.'); };

/* ---------- start: from an image ---------- */
const ZO = { style: 'roman', shape: 'rect', n: 48, k: 8, irr: 0.35, gap: 0.12, mortar: '#cfc6b4', back: '#f3ede0', seed: 1 };
const ZSTYLE = { roman: { mortar: '#cfc6b4', gap: 0.12, irr: 0.35 }, verm: { mortar: '#cfc6b4', gap: 0.1, irr: 0.3 }, trenc: { mortar: '#f2efe8', gap: 0.2, irr: 0.6 } };
let ZSRC = null;
function zSyncOpts() { const set = (id, v, txt) => { $(id).value = v; $(id + 'V').textContent = txt ?? v; };
  $('zStyle').value = ZO.style; $('zShape').value = ZO.shape; set('zN', ZO.n); set('zK', ZO.k); set('zIrr', ZO.irr, Math.round(ZO.irr * 100) + '%'); set('zGap', ZO.gap, Math.round(ZO.gap * 100) + '%');
  $('zMort0').value = ZO.mortar; $('zBack').value = ZO.back; $('zCut').disabled = !ZSRC; }
function zSource(img, name) { ZSRC = { img, name }; $('zSrc').hidden = false; $('zSrcName').textContent = name;
  const t = $('zSrcThumb'), k = Math.min(1, 64 / Math.max(img.width, img.height)); t.width = Math.max(1, Math.round(img.width * k)); t.height = Math.max(1, Math.round(img.height * k));
  const x = t.getContext('2d'); x.fillStyle = ZO.back; x.fillRect(0, 0, t.width, t.height); x.drawImage(img, 0, 0, t.width, t.height); zSyncOpts();
  zMsg(`Source: ${name}. Choose a style and press “Cut the mosaic”.`); }
$('zLib').onclick = () => {
  PICK_TARGET = (img, x, y, w, h, label) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height); zSource(c, label); };
  targetSlot = -1; showLib(); $('dlgTitle').textContent = 'Choose an image for the mosaic (library, a crop of a plate, or My images)';
  dlg.addEventListener('close', () => { setTimeout(() => { PICK_TARGET = null; }, 0); }, { once: true }); dlg.showModal(); };
$('zFile').onclick = () => { $('zFileIn').value = ''; $('zFileIn').click(); };
$('zFileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image();
  im.onload = () => zSource(im, f.name.replace(/\.[^.]+$/, '')); im.onerror = () => zMsg('That file could not be read as an image.', true); im.src = URL.createObjectURL(f); };
$('zStyle').onchange = e => { ZO.style = e.target.value; Object.assign(ZO, ZSTYLE[ZO.style]); zSyncOpts(); };
$('zShape').onchange = e => { ZO.shape = e.target.value; };
for (const [id, k, f] of [['zN', 'n', v => v], ['zK', 'k', v => v], ['zIrr', 'irr', v => Math.round(v * 100) + '%'], ['zGap', 'gap', v => Math.round(v * 100) + '%']])
  $(id).addEventListener('input', e => { ZO[k] = +e.target.value; $(id + 'V').textContent = f(ZO[k]); });
$('zMort0').addEventListener('input', e => { ZO.mortar = e.target.value; });
$('zBack').addEventListener('input', e => { ZO.back = e.target.value; });
$('zSeed').onclick = () => { ZO.seed = 1 + Math.floor(Math.random() * 1e6); if (ZSRC) $('zCut').click(); };
function zArm(btn, label, fn) {   // a second click confirms replacing the current mosaic
  if (Z.m && Z.m.cells.length && btn.dataset.armed !== '1') { const t0 = btn.textContent; btn.dataset.armed = '1'; btn.classList.add('armed'); btn.textContent = label;
    setTimeout(() => { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = t0; }, 4000); return; }
  if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = btn.dataset.label; }
  fn();
}
$('zCut').dataset.label = $('zCut').textContent;
$('zCut').onclick = () => zArm($('zCut'), 'Replace the current mosaic?', async () => {
  if (!ZSRC) return; zMsg('Cutting the mosaic…'); await new Promise(r => setTimeout(r, 30));
  try { const m = await makeMosaicData(ZSRC.img, ZSRC.name, ZO); zLoad(m, null, `Cut: ${m.cells.length} pieces in ${m.pal.length} colours. Select pieces and click a colour to change them; Undo goes back.`); }
  catch (e) { zMsg('The mosaic could not be cut (' + e.message + '). Try fewer pieces across.', true); }
});

/* ---------- start: free form ---------- */
const GAUDI = ['#f4f1ea', '#1d3f8a', '#3c7fbf', '#5aa6a0', '#2f6b3a', '#9bbf4a', '#e6c13b', '#d9822b', '#b23a2e', '#7a2e4a', '#2b2b2b', '#c9b79c'];
function zSpaceRows() { const s = $('zSpShape').value, r = s === 'rect'; $('zWHrow').hidden = !r; $('zErow').hidden = r; }
$('zSpShape').onchange = zSpaceRows;
function zSpaceSize() { const s = $('zSpShape').value;
  if (s === 'rect') return { shape: 'rect', W: Math.max(40, Math.min(4000, +$('zW').value || 600)), H: Math.max(40, Math.min(4000, +$('zH').value || 400)) };
  const e = Math.max(20, Math.min(2000, +$('zE').value || 300));
  return s === 'hex' ? { shape: 'hex', W: 2 * e, H: Math.round(Math.sqrt(3) * e * 10) / 10 } : s === 'square' ? { shape: 'square', W: e, H: e } : { shape: 'tri', W: e, H: Math.round(Math.sqrt(3) / 2 * e * 10) / 10 }; }
$('zNewSpace').dataset.label = $('zNewSpace').textContent;
$('zNewSpace').onclick = () => zArm($('zNewSpace'), 'Replace the current mosaic?', () => {
  const sp = zSpaceSize();
  zLoad({ style: 'free', shape: sp.shape, W: sp.W, H: sp.H, n: 1, k: GAUDI.length, irr: 0, gap: 0, gapPx: 2, mortar: '#e9e4d8', back: '#ffffff', seed: 1,
    srcName: 'free form', src: '', pal: GAUDI.slice(), col: [], sh: [], cells: [] }, null, 'Empty space ready. Choose a piece in a basket and click in the space to lay it.');
  Z.brush = 1; zPanel(); zBaskets();
});
$('zResize').onclick = () => {          // extend (or shrink) the space; pieces keep their size, the space grows around them
  const m = Z.m; if (!m) return; const sp = zSpaceSize();
  if (sp.shape !== m.shape && !(['rect', 'square'].includes(sp.shape) && ['rect', 'square'].includes(m.shape))) { zMsg('The shape of an existing space cannot change; start a new space for another shape.', true); return; }
  const dx = (sp.W - m.W) / 2, dy = (sp.H - m.H) / 2;
  m.cells = m.cells.map(f => f.map((v, j) => +(v + (j % 2 ? dy : dx)).toFixed(1))); m.W = sp.W; m.H = sp.H; if (sp.shape === 'rect' || sp.shape === 'square') m.shape = Math.abs(sp.W - sp.H) < 0.5 ? 'square' : 'rect';
  zInval(m); zCommit(); zFit(); zMsg(`Space is now ${Math.round(m.W)} × ${Math.round(m.H)} px; the pieces kept their size.`); };

/* baskets: three sizes, each with a handful of random pieces to choose from */
const BASKETS = [{ name: 'Small', size: 14 }, { name: 'Medium', size: 26 }, { name: 'Large', size: 46 }], BSLOTS = 6;
let BR = rng(Date.now() & 0xffffff);
function randShape(size, kind, R = BR) {
  if (kind === 'tess') { const s = size * (0.85 + 0.25 * R()), j = () => (R() * 2 - 1) * 0.06 * s, a = s / 2, b = s * (0.8 + 0.25 * R()) / 2;
    return [[-a + j(), -b + j()], [a + j(), -b + j()], [a + j(), b + j()], [-a + j(), b + j()]]; }
  if (kind === 'round') { const n = 9 + Math.floor(R() * 4), r = size * (0.42 + 0.12 * R()); return Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI, q = r * (0.9 + 0.1 * R()); return [q * Math.cos(a), q * Math.sin(a)]; }); }
  // a shard: the convex hull of a few points around a circle (a broken tile breaks along straight lines)
  let P = [];
  for (let tries = 0; tries < 8; tries++) {
    const n = 4 + Math.floor(R() * 4), pts = Array.from({ length: n }, () => { const a = R() * 2 * Math.PI, q = size * (0.35 + 0.25 * R()); return [q * Math.cos(a), q * Math.sin(a)]; });
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    P = lo.slice(0, -1).concat(hi.slice(0, -1));
    if (P.length >= 3 && Math.abs(pArea(P)) > 0.22 * size * size) break;
  }
  if (P.length < 3) P = [[-size / 2, -size / 2], [size / 2, -size / 2], [0, size / 2]];
  const cx = P.reduce((s, q) => s + q[0], 0) / P.length, cy = P.reduce((s, q) => s + q[1], 0) / P.length; return P.map(([x, y]) => [x - cx, y - cy]);
}
const BASK = BASKETS.map(() => []);
function zToss(bi) { const kind = $('zKind').value; for (const b of bi == null ? BASKETS.map((_, i) => i) : [bi])
  BASK[b] = Array.from({ length: BSLOTS }, () => randShape(BASKETS[b].size, kind === 'mixed' ? (BR() < 0.4 ? 'tess' : 'shard') : kind)); zBaskets(); }
function zBaskets() {
  const box = $('zBaskets'); box.innerHTML = '';
  BASKETS.forEach((B, bi) => {
    const row = document.createElement('div'); row.className = 'bask';
    row.innerHTML = `<div class="bh"><span>${B.name} <span class="small">(~${B.size} px)</span></span><button title="New random pieces in this basket">Toss</button></div><div class="bs"></div>`;
    row.querySelector('button').onclick = () => zToss(bi);
    const bs = row.querySelector('.bs');
    BASK[bi].forEach((S, si) => { const c = document.createElement('canvas'), px = 44; c.width = c.height = px * 2; c.style.width = c.style.height = px + 'px';
      const on = Z.place && Z.place.b === bi && Z.place.s === si; c.className = on ? 'on' : ''; c.title = 'Click to choose, then click in the space to lay it';
      const x = c.getContext('2d'), k = (px * 2 - 14) / (B.size * 1.25); x.translate(px, px); x.scale(k, k);
      x.fillStyle = Z.m ? (Z.m.pal[Z.brush] || '#888') : '#1d3f8a'; zPath(x, S); x.fill();
      c.onclick = () => { if (!Z.m) { zMsg('First make an empty space (Free form) or cut a mosaic from an image.', true); return; }
        Z.place = { b: bi, s: si, at: null }; zTool('place'); zBaskets(); };
      bs.appendChild(c); });
    box.appendChild(row);
  });
}
$('zTossAll').onclick = () => zToss(null);
$('zKind').onchange = () => zToss(null);
/* in every mosaic pieces may touch but never overlap (separating-axis test; the pieces are convex) */
const zFreeMode = () => !!Z.m;      // every mosaic, cut from an image, set in letters or laid by hand: pieces may touch but never overlap
const Z_CHECK_MAX = 400;              // moving or turning more pieces than this at once skips the check (a whole mosaic moved as one)
function zOverlapping(ids) {          // pieces that already overlap the given ones (a cut can leave hairline overlaps): these are not held against a move
  const m = Z.m, out = new Set(ids); if (ids.size > Z_CHECK_MAX) return out;
  for (const i of ids) { const P = mPoly(m.cells[i]), b0 = zBB(i);
    for (let j = 0; j < m.cells.length; j++) { if (out.has(j)) continue; const b = zBB(j); if (b[2] <= b0[0] || b[0] >= b0[2] || b[3] <= b0[1] || b[1] >= b0[3]) continue;
      if (zSAT(P, mPoly(m.cells[j]))) out.add(j); } }
  return out; }
function zSAT(A, B) {          // true when the convex polygons A and B overlap by more than a hair
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], nx = q[1] - p[1], ny = p[0] - q[0], L = Math.hypot(nx, ny) || 1;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of A) { const d = (v[0] * nx + v[1] * ny) / L; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of B) { const d = (v[0] * nx + v[1] * ny) / L; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + 0.12 || b1 <= a0 + 0.12) return false;
  }
  return true;
}
function zHits(P, skip) {      // does polygon P overlap any piece (other than those in skip)?
  const m = Z.m; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  for (let i = 0; i < m.cells.length; i++) { if (skip && skip.has(i)) continue; const b = zBB(i); if (b[2] <= x0 || b[0] >= x1 || b[3] <= y0 || b[1] >= y1) continue;
    if (zSAT(P, mPoly(m.cells[i]))) return true; }
  return false;
}
function zFreeSpot(P0) {       // P0 if it is free, else the nearest free shift of it (searched in rings), else null
  if (!zHits(P0)) return P0; let r = 0; const n0 = P0.reduce((s, q) => Math.max(s, Math.hypot(q[0] - P0[0][0], q[1] - P0[0][1])), 0);
  for (let k = 1; k <= 40; k++) { r = k * Math.max(1, n0 / 12); const steps = 12 + 2 * k;
    for (let j = 0; j < steps; j++) { const a = j / steps * 2 * Math.PI, P = P0.map(([x, y]) => [x + r * Math.cos(a), y + r * Math.sin(a)]); if (!zHits(P)) return P; }
    if (r > Math.max(n0 * 2.5, 30)) break; }
  return null;
}
function zPlaced(at) { const S = BASK[Z.place.b][Z.place.s], c = Math.cos(rad(Z.rot)), s = Math.sin(rad(Z.rot)); return S.map(([x, y]) => [at.x + x * c - y * s, at.y + x * s + y * c]); }
function zPlace(w, keep, quiet, noCommit) {   // quiet: no warning (while laying along a stroke); noCommit: the stroke commits once at the end
  const m = Z.m, R1 = Q => Q && Q.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]); let P = R1(zPlaced(w));   // checked as stored, to 0.1
  if (zFreeMode()) { P = quiet ? P : R1(zFreeSpot(P)); if (P && zHits(P)) P = null;
    if (!P) { if (!quiet) zMsg('No room there: pieces may touch but not overlap. Click a little further away, or turn the piece (R).', true); return false; } }
  const gh = ZG.col && ZG.img ? zGuideSample(P) : null, np = m.pal.length;   // a guide colour joins the palette (up to 48 colours, then the nearest is used)
  m.cells.push(P.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)])); m.col.push(gh ? zPalIndex(m, gh, m.pal.length >= 48 ? Infinity : 9) : Z.brush); m.sh.push(+((BR() * 2 - 1) * 0.04).toFixed(3));
  if (m.pal.length !== np) zPanel();
  if ($('zRotRand').checked) zSetRot(BR() * 360 - 180);
  if (!keep) { const kind = $('zKind').value; BASK[Z.place.b][Z.place.s] = randShape(BASKETS[Z.place.b].size, kind === 'mixed' ? (BR() < 0.4 ? 'tess' : 'shard') : kind); zBaskets(); }
  zInval(m); if (!noCommit) zCommit(); zRender(); return true;
}

/* ---------- out: to Compose, back to a tile, files ---------- */
function zClean() {        // the mosaic as kept in a tile: pieces cut to the space, the ones outside dropped
  const m = JSON.parse(JSON.stringify(Z.m)), out = shapeOutline(m.shape, m.W, m.H), keep = [];
  m.cells.forEach((f, i) => { const P = clipConvex(mPoly(f), out); if (P.length >= 3 && Math.abs(pArea(P)) > 1) keep.push([P.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]), m.col[i], m.sh[i]]); });
  m.cells = keep.map(k => k[0]); m.col = keep.map(k => k[1]); m.sh = keep.map(k => k[2]); return m;
}
const zName = m => `${{ roman: 'Roman', verm: 'Roman (vermiculatum)', trenc: 'Trencadís', free: 'Free mosaic' }[m.style] || 'Mosaic'} · ${m.srcName}`.slice(0, 80);
$('zToTile').onclick = () => { if (!Z.m || !Z.m.cells.length) { zMsg('The mosaic is empty.', true); return; }
  const m = zClean(); if (m.shape === 'square') m.shape = 'square'; const d = addDesign(mosaicDesign(m, zName(m)));
  zMsg(`Added “${d.name}” to the saved tiles in Compose (shape: ${d.shape}). Drag it from there onto the board.`); };
$('zToPanel').onclick = () => { if (!Z.m || !Z.m.cells.length) { zMsg('The mosaic is empty.', true); return; }
  const m = zClean(); m.panel = true; const d = addDesign(mosaicDesign({ ...m, shapeIn: m.shape, shape: 'rect' }, zName(m) + ' (panel)'));
  showView('compose'); const r = board.getBoundingClientRect(), w = toWorld(r.width / 2, r.height / 2), p = newPiece(d, w.x, w.y); p.s = 1;
  PIECES.push(p); SEL.clear(); SEL.add(p.id); commit(); fitBoard(); cMsg(`Placed “${d.name}” at its own size, as a rectangular panel.`); };
$('zSaveBack').onclick = () => { const d = dById(Z.linked); if (!d || !Z.m) return; const m = zClean(); if (d.mosaic && d.mosaic.shapeIn) { m.shapeIn = m.shape; m.shape = 'rect'; }
  d.mosaic = m; renderMosaic(d, true); commit(); zMsg(`Saved back to “${d.name}”: every piece using it on the Compose board shows the change.`); };
$('zPng').onclick = () => { if (!Z.m) return; const m = zClean(), q = Math.min(4, 6000 / Math.max(m.W, m.H)), c = document.createElement('canvas');
  c.width = Math.ceil(m.W * q); c.height = Math.ceil(m.H * q); const x = c.getContext('2d'); x.scale(q, q); drawMosaic(x, m);
  c.toBlob(b => download(b, safe(zName(m)) + '.png'), 'image/png'); zMsg(`PNG: ${c.width} × ${c.height} px.`); };
$('zSvg').onclick = () => { if (!Z.m) return; const m = zClean(), P = mosaicPolys(m), out = shapeOutline(m.shape, m.W, m.H).map(q => q.join(',')).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.W} ${m.H}" width="${Math.round(m.W)}" height="${Math.round(m.H)}">\n<title>${zName(m).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>\n<polygon points="${out}" fill="${m.mortar}"/>\n`
    + P.map((q, i) => `<polygon points="${q.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(' ')}" fill="${mColour(m, i)}"/>`).join('\n') + '\n</svg>';
  download(new Blob([svg], { type: 'image/svg+xml' }), safe(zName(m)) + '.svg'); zMsg('SVG: every piece as a vector shape (useful for cutting).'); };
$('zSaveFile').onclick = () => { if (!Z.m) return; download(new Blob([JSON.stringify({ format: 'combinaisons-mosaic', version: 1, app: 'Tessera ' + TESSERA_VERSION, saved: new Date().toISOString(), mosaic: Z.m })], { type: 'application/json' }), safe(zName(Z.m)) + '.json'); };
$('zOpenFile').onclick = () => { $('zJson').value = ''; $('zJson').click(); };
$('zJson').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { let data; try { data = JSON.parse(rd.result); } catch (err) { zMsg('That file is not valid JSON.', true); return; }
    const raw = data && data.format === 'combinaisons-mosaic' ? data.mosaic : data && data.format === 'combinaisons-mirror-tool' ? ((data.designs || []).find(d => d && d.mosaic) || {}).mosaic : null;
    const m = cleanMosaic(raw, true); if (!m) { zMsg('No mosaic found in that file.', true); return; }
    zLoad(m, null, `Opened “${f.name}”: ${m.cells.length} pieces.`); };
  rd.readAsText(f); };
if (inFrame) { ['zPng', 'zSvg', 'zSaveFile'].forEach(id => $(id).disabled = true); $('zFrameNote').hidden = false; }

/* ---------- lettering: text turned into mosaic, as a new mosaic or laid into the current one ---------- */
const ZFONTS = {
  roman: { css: '700 {S}px "Cinzel", "Trajan Pro", Georgia, serif', name: 'Roman capitals', caps: true },
  boecklin: { css: '400 {S}px "Boecklins Universe", Georgia, serif', name: 'Art Nouveau · Böcklin' },
  gloria: { css: '400 {S}px "Gloria", Georgia, serif', name: 'Art Nouveau · Gloria' },
  nouveau: { css: '400 {S}px "Federant", "Arial Rounded MT Bold", Georgia, serif', name: 'Art Nouveau · Feder Antiqua' },
  serif: { css: '700 {S}px Georgia, "Times New Roman", serif', name: 'Serif' },
  sans: { css: '900 {S}px "Arial Black", "Helvetica Neue", Arial, sans-serif', name: 'Bold sans' },
};
async function zTextCanvas(text, fontKey, size, halo) {
  const F = ZFONTS[fontKey] || ZFONTS.serif, font = F.css.replace('{S}', Math.round(size));
  try { await document.fonts.load(font, text); } catch (e) {}
  const lines = (F.caps ? text.toUpperCase() : text).split('\n').map(l => l.replace(/\s+$/, '')).filter((l, i, a) => l || i < a.length - 1);
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const lh = size * 1.18, pad = Math.round(size * 0.35), w = Math.ceil(Math.max(...lines.map(l => m.measureText(l).width), size)) + 2 * pad, h = Math.ceil(lines.length * lh) + 2 * pad;
  if (w > 4000 || h > 4000) throw new Error('the text is too large: make the letters smaller or the text shorter');
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineJoin = 'round';
  lines.forEach((l, i) => { const y = pad + lh * (i + 0.5); x.fillText(l, w / 2, y); if (halo) { x.lineWidth = halo; x.strokeText(l, w / 2, y); } });
  return c;
}
function zCoverage(P, A, W, H) {        // share of a piece covered by the letters (alpha of the text canvas)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const st = Math.max(0.7, (x1 - x0) / 6), poly = P.map(([x, y]) => ({ x, y })); let s = 0, n = 0;
  for (let yy = y0 + st / 2; yy < y1; yy += st) for (let xx = x0 + st / 2; xx < x1; xx += st) { if (!inPoly({ x: xx, y: yy }, poly)) continue;
    const X = Math.floor(xx), Y = Math.floor(yy); s += X < 0 || Y < 0 || X >= W || Y >= H ? 0 : A[4 * (Y * W + X) + 3] / 255; n++; }
  return n ? s / n : 0;
}
async function zTextPieces() {         // cut the lettering; returns the canvas size and each piece with its coverage
  const text = $('zText').value.trim(); if (!text) throw new Error('type some text first');
  const size = +$('zTSize').value, t = +$('zTPiece').value, style = $('zTStyle').value;
  const c = await zTextCanvas(text, $('zTFont').value, size, 0), W = c.width, H = c.height;
  const o = { style, shape: 'rect', n: W / t, k: 2, irr: +$('zTIrr').value, gap: 0.12, back: '#ffffff', seed: 1 + Math.floor(Math.random() * 1e6) };
  let cells;
  if (style === 'verm') { const b = document.createElement('canvas'); b.width = W; b.height = H; const bx = b.getContext('2d'); bx.fillStyle = '#fff'; bx.fillRect(0, 0, W, H); bx.drawImage(c, 0, 0); cells = cutPieces(b, W, H, o); }
  else cells = cutPieces(null, W, H, o);
  const A = c.getContext('2d').getImageData(0, 0, W, H).data;
  return { W, H, t, canvas: c, pieces: cells.map(P => ({ P, cov: zCoverage(P, A, W, H) })) };
}
const zHex = id => $(id).value.toLowerCase();
$('zTMake').dataset.label = $('zTMake').textContent;
$('zTMake').onclick = () => zArm($('zTMake'), 'Replace the current mosaic?', async () => {
  zMsg('Setting the letters…'); await new Promise(r => setTimeout(r, 30));
  let T; try { T = await zTextPieces(); } catch (e) { zMsg('The text could not be set: ' + e.message + '.', true); return; }
  const bgOn = $('zTBg').checked, R = rng(T.W * 7 + T.H), keep = T.pieces.filter(p => bgOn || p.cov >= 0.5);
  const pal = bgOn ? [zHex('zTBack'), zHex('zTInk')] : [zHex('zTInk')];
  const m = { style: $('zTStyle').value === 'verm' ? 'verm' : $('zTStyle').value, shape: 'rect', W: T.W, H: T.H, n: T.W / T.t, k: pal.length, irr: +$('zTIrr').value, gap: 0.12,
    mortar: zHex('zTMortar'), back: '#ffffff', seed: 1, srcName: `“${$('zText').value.trim().replace(/\s+/g, ' ').slice(0, 40)}”`, src: '', pal,
    col: keep.map(p => bgOn ? (p.cov >= 0.5 ? 1 : 0) : 0), sh: keep.map(() => +((R() * 2 - 1) * 0.06).toFixed(3)),
    cells: keep.map(p => p.P.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)])) };
  zLoad(m, null, `Lettering set: ${keep.length} pieces. Edit them like any mosaic, or extend the space around it (Free form → Extend to this size).`);
});
$('zTAdd').onclick = async () => {
  if (!Z.m) { zMsg('There is no mosaic to add the text to: use “Make a text mosaic”, or start one first.', true); return; }
  zMsg('Setting the letters…'); await new Promise(r => setTimeout(r, 30));
  let T; try { T = await zTextPieces(); } catch (e) { zMsg('The text could not be set: ' + e.message + '.', true); return; }
  const letters = T.pieces.filter(p => p.cov >= 0.5);
  // the area the letters claim: the letters widened by about half a piece, so the pieces underneath can be lifted out
  const halo = await zTextCanvas($('zText').value.trim(), $('zTFont').value, +$('zTSize').value, T.t * 0.9), HA = halo.getContext('2d').getImageData(0, 0, T.W, T.H).data;
  // the ground around the letters is re-laid with the text's own small pieces, in the colours of the pieces they replace
  const ground = T.pieces.filter(p => p.cov < 0.5);
  const rel = P => P.map(([x, y]) => [x - T.W / 2, y - T.H / 2]);
  Z.text = { W: T.W, H: T.H, P: letters.map(p => rel(p.P)), G: ground.map(p => rel(p.P)), HA, at: null, ink: zHex('zTInk'), what: 'Text' };
  zTool('text'); zMsg(`Click in the mosaic where the text should go: the ${letters.length} letter pieces replace the pieces underneath. Esc cancels.`);
};
function zPalIndex(m, hex, tol) {       // the palette colour within tol (CIELAB ΔE) of hex, or a new palette colour
  const L = rgb2lab(...hex2rgb(hex)); let b = -1, bd = Infinity;
  m.pal.forEach((h, i) => { const q = rgb2lab(...hex2rgb(h)), d = Math.hypot(L[0] - q[0], L[1] - q[1], L[2] - q[2]); if (d < bd) { bd = d; b = i; } });
  if (b >= 0 && bd <= tol) return b; m.pal.push(hex); return m.pal.length - 1;
}
function zPlaceText(w) {
  const m = Z.m, T = Z.text, ci = zPalIndex(m, T.ink || zHex('zTInk'), 0), pci = T.hex ? T.hex.map(h => zPalIndex(m, h, 7)) : null, R = rng(Date.now() & 0xffff);
  const inHaloAt = (cx, cy) => { const X = Math.floor(cx - w.x + T.W / 2), Y = Math.floor(cy - w.y + T.H / 2); return X >= 0 && Y >= 0 && X < T.W && Y < T.H && T.HA[4 * (Y * T.W + X) + 3] > 60; };
  const L = T.P.map(P => P.flatMap(([x, y]) => [+(x + w.x).toFixed(1), +(y + w.y).toFixed(1)]));
  // the pieces to lift: those centred under the new work, and any other that a new piece would overlap (pieces never overlap, however they were made)
  const LP = L.map(f => ({ P: mPoly(f), b: zBBf(f) }));
  const keep = m.cells.map((f, i) => { const [cx, cy] = zCent(f); if (inHaloAt(cx, cy)) return false;
    const b = zBB(i), P = mPoly(f); return !LP.some(q => !(q.b[2] <= b[0] || q.b[0] >= b[2] || q.b[3] <= b[1] || q.b[1] >= b[3]) && zSAT(q.P, P)); });
  const m0cells = m.cells, lifted = keep.filter(k => !k).length, gone = m.cells.map((f, i) => keep[i] ? null : [...zCent(f), m.col[i]]).filter(Boolean);
  const near = (x, y) => { let b = null, bd = Infinity; for (const g of gone) { const d = (g[0] - x) ** 2 + (g[1] - y) ** 2; if (d < bd) { bd = d; b = g; } } return b ? b[2] : Z.brush; };
  m.cells = m.cells.filter((_, i) => keep[i]); m.col = m.col.filter((_, i) => keep[i]); m.sh = m.sh.filter((_, i) => keep[i]);
  L.forEach((f, k) => { m.cells.push(f); m.col.push(pci ? pci[k] : ci); m.sh.push(+((R() * 2 - 1) * 0.06).toFixed(3)); });
  zInval(m);
  // re-lay the ground wherever a stone was lifted (and in the band around the new work), only where a ground piece fits without overlapping
  const goneP = m0cells.map((f, i) => keep[i] ? null : { P: mPoly(f).map(([x, y]) => ({ x, y })), b: zBBf(f) }).filter(Boolean);
  for (const P of T.G) { const f = P.flatMap(([x, y]) => [+(x + w.x).toFixed(1), +(y + w.y).toFixed(1)]), [cx, cy] = zCent(f);
    const under = inHaloAt(cx, cy) || goneP.some(g => cx >= g.b[0] && cx <= g.b[2] && cy >= g.b[1] && cy <= g.b[3] && inPoly({ x: cx, y: cy }, g.P));
    if (under && gone.length && !zHits(mPoly(f))) { m.cells.push(f); m.col.push(near(cx, cy)); m.sh.push(+((R() * 2 - 1) * 0.06).toFixed(3)); } }
  Z.text = null; Z.sel.clear(); Z.hover = null; zInval(m); zTool('select'); zCommit(); zRender();
  zMsg(`${T.what || 'Text'} laid: ${T.P.length} pieces, the ground around them re-laid, in place of ${lifted} pieces. Undo takes it out again.`);
  return T.P.length;
}

$('zAW').addEventListener('input', e => { $('zAWV').textContent = e.target.value + ' px'; });
/* an image (an ornament) laid into the open mosaic: cut with the mosaic's own piece size, only where the image is not
   transparent, its colours matched to the mosaic's palette (or added to it), the ground around it re-laid */
async function zImagePieces(img, aw, o) {
  const k = aw / img.width, W = Math.max(8, Math.round(img.width * k)), H = Math.max(8, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H);
  const A = c.getContext('2d').getImageData(0, 0, W, H).data;
  const g = document.createElement('canvas'); g.width = W; g.height = H; const gx = g.getContext('2d'); gx.fillStyle = o.back; gx.fillRect(0, 0, W, H); gx.drawImage(c, 0, 0);
  const cells = cutPieces(g, W, H, o);
  const pieces = cells.map(P => ({ P, cov: zCoverage(P, A, W, H) })), solid = pieces.filter(p => p.cov >= 0.5);
  const { pal, col } = colourTesserae(solid.map(p => p.P), g, W, H, { ...o, back: o.back });
  // the area the image claims: its opaque part widened by about half a piece
  const h = document.createElement('canvas'); h.width = W; h.height = H; const hx = h.getContext('2d'), r = W / o.n * 0.45;
  for (let a = 0; a < 16; a++) hx.drawImage(c, Math.cos(a / 8 * Math.PI) * r, Math.sin(a / 8 * Math.PI) * r);
  hx.drawImage(c, 0, 0);
  return { W, H, solid, ground: pieces.filter(p => p.cov < 0.5), hex: col.map(i => pal[i]), HA: hx.getImageData(0, 0, W, H).data };
}
$('zAddImg').onclick = async () => {
  if (!ZSRC) { zMsg('Choose an image first (From the library… or From a file…).', true); return; }
  if (!Z.m) { zMsg('There is no mosaic open to add the image to: cut one, make a text mosaic, or start a free-form space first.', true); return; }
  zMsg('Cutting the image into pieces…'); await new Promise(r => setTimeout(r, 30));
  const t = zHostSize() || 12, aw = +$('zAW').value, o = { ...ZO, n: aw / t, seed: 1 + Math.floor(Math.random() * 1e6) };
  let I; try { I = await zImagePieces(ZSRC.img, aw, o); } catch (e) { zMsg('The image could not be cut: ' + e.message, true); return; }
  const rel = P => P.map(([x, y]) => [x - I.W / 2, y - I.H / 2]);
  Z.text = { W: I.W, H: I.H, P: I.solid.map(p => rel(p.P)), G: I.ground.map(p => rel(p.P)), HA: I.HA, hex: I.hex, at: null, what: ZSRC.name };
  zTool('text'); zMsg(`Click in the mosaic where “${ZSRC.name}” should go (${I.solid.length} pieces); the pieces underneath are lifted out. Esc cancels.`);
};
/* ---------- from Compose: edit a mosaic tile here ---------- */
/* every tile opens again where it was made: a mosaic in the Mosaic maker, a mirror tile (with its recorded set-up) in the Tile maker */
let TLINK = null;                    // the saved tile being edited in the Tile maker
async function editTile(d) {
  if (!d) return;
  if (d.mosaic) { const m = JSON.parse(JSON.stringify(d.mosaic)); if (m.shapeIn) { m.shape = m.shapeIn; delete m.shapeIn; }
    showView('mosaic'); zLoad(m, d.id, `Editing “${d.name}”. When done, press “Save back” (under Use the mosaic).`); return; }
  if (!d.setup) { cMsg(`“${d.name}” was saved before Tessera 1.0, without its mirror set-up, so it cannot be opened in the Tile maker. Remake it there and use Save back… or save it as a new tile.`, true); return; }
  showView('mirror'); const all = await applySetup(d.setup); TLINK = d.id; tLinkUI();
  $('saveTileMsg').textContent = `Editing “${d.name}”.${all ? '' : ' Some ornaments could not be loaded.'} Change it, then press Save back; Save tile keeps a new copy instead.`;
}
function tLinkUI() { const d = TLINK && dById(TLINK); $('tSaveBack').hidden = !d; if (d) $('tSaveBack').textContent = `Save back to “${d.name.slice(0, 28)}”`; }
$('tSaveBack').onclick = () => { const d = dById(TLINK); if (!d) { TLINK = null; tLinkUI(); return; }
  const nd = captureTile(true);
  if (!nd) { $('saveTileMsg').textContent = 'This tile cannot be saved (see the note above the tiled surface).'; return; }
  if (nd.shape !== d.shape) { const a = addDesign(nd); $('saveTileMsg').textContent = `The tile is now ${SHAPES[nd.shape].label.replace(/s$/, '')}-shaped, not like “${d.name}”, so it was saved as a new tile, “${a.name}”.`; return; }
  const k = d.edge / nd.edge; for (const p of PIECES) if (p.did === d.id) p.s *= k;        // pieces on the board keep their size
  Object.assign(d, { src: nd.src, w: nd.w, h: nd.h, edge: nd.edge, method: nd.method, bg: nd.bg, setup: nd.setup });
  d.img = new Image(); d.img.onload = () => { cRender(); renderPalette(); }; d.img.src = d.src;
  saveDesigns(); renderPalette(); commit();
  $('saveTileMsg').textContent = `Saved back to “${d.name}”: every piece using it on the Compose board shows the change.`; };
$('cEditMos').onclick = () => editTile(mosaicSelected());
function mosaicSelected() { const L = selList(), ds = new Set(L.map(p => p.did)); if (ds.size !== 1) return null; return dById([...ds][0]) || null; }   // the one tile all selected pieces share
function renderMosaicPanel() { const d = mosaicSelected(); $('cMosBox').hidden = !d; if (!d) return;
  const b = $('cEditMos'), where = d.mosaic ? 'Mosaic maker' : 'Tile maker';
  b.textContent = `Edit in the ${where} tab`; b.disabled = !d.mosaic && !d.setup;
  b.title = d.mosaic ? 'Open this mosaic in the Mosaic maker tab to change single pieces, colours or shapes' : d.setup ? 'Open the mirrors and ornaments that made this tile in the Tile maker tab' : 'Saved before Tessera 1.0, without its set-up: it cannot be reopened';
  $('cMosInfo').textContent = (d.method && d.method.detail || '') + (!d.mosaic && !d.setup ? ' (Set-up not recorded: saved before version 1.0.)' : ''); }
document.querySelectorAll('#zStartTabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#zStartTabs button').forEach(x => x.classList.toggle('on', x === b)); $('zImg').hidden = b.dataset.s !== 'img'; $('zFree').hidden = b.dataset.s !== 'free'; $('zTxt').hidden = b.dataset.s !== 'text'; zBaskets(); });
$('zTSize').addEventListener('input', e => { $('zTSizeV').textContent = e.target.value + ' px'; });
$('zTPiece').addEventListener('input', e => { $('zTPieceV').textContent = e.target.value + ' px'; });
$('zTIrr').addEventListener('input', e => { $('zTIrrV').textContent = Math.round(e.target.value * 100) + '%'; });
async function zInit() { zSyncOpts(); zToss(null); zSpaceRows();
  await TDB.ready; const st = TDB.db ? await tdbGet('mosaicDoc') : null; const m = st && cleanMosaic(st.m, true);
  if (m) { if (zUntangle(m)) zSave(); Z.m = m; Z.linked = st.linked || null; Z.last = zSnapStr(); }
  const g = TDB.db ? await tdbGet('mosaicGuide') : null; if (g && typeof g.src === 'string' && /^data:image\//.test(g.src)) zGuideSet(g.src, { a: +g.a || 0.35, fit: ['contain', 'cover', 'stretch'].includes(g.fit) ? g.fit : 'contain', show: g.show !== false, col: !!g.col });
  zPanel(); }

const HEX6 = /^#[0-9a-f]{6}$/i;
function cleanMosaic(m, allowEmpty) {
  try {
    if (!m || typeof m !== 'object' || !['roman', 'trenc', 'verm', 'free'].includes(m.style) || !(m.shape in SHAPE_BOX)) return undefined;
    const W = +m.W, H = +m.H, n = +m.n || 1; if (!(W > 0 && H > 0 && W <= 4000 && H <= 4000 && n > 0)) return undefined;
    const pal = (Array.isArray(m.pal) ? m.pal : []).filter(h => typeof h === 'string' && HEX6.test(h)).slice(0, 64); if (!pal.length) return undefined;
    const cells = Array.isArray(m.cells) ? m.cells : []; if ((!cells.length && !allowEmpty) || cells.length > 40000) return undefined;
    if (!cells.every(f => Array.isArray(f) && f.length >= 6 && f.length % 2 === 0 && f.every(v => typeof v === 'number' && isFinite(v)))) return undefined;
    const col = cells.map((_, i) => { const c = Array.isArray(m.col) ? m.col[i] | 0 : 0; return c >= 0 && c < pal.length ? c : 0; });
    const sh = cells.map((_, i) => { const v = Array.isArray(m.sh) ? +m.sh[i] : 0; return isFinite(v) ? Math.max(-0.3, Math.min(0.3, v)) : 0; });
    const src = typeof m.src === 'string' && /^data:image\/(png|webp|jpeg);base64,/.test(m.src) ? m.src : '';
    return { style: m.style, shape: m.shape, n, k: +m.k || pal.length, irr: +m.irr || 0, gap: Math.max(0, Math.min(0.5, +m.gap || 0)),
      mortar: HEX6.test(m.mortar) ? m.mortar : '#cfc6b4', back: HEX6.test(m.back) ? m.back : '#f3ede0', seed: +m.seed || 1,
      W, H, srcName: String(m.srcName || 'image').slice(0, 80), src, pal, col, sh, cells,
      ...(isFinite(+m.gapPx) && m.gapPx !== null && m.gapPx !== undefined ? { gapPx: Math.max(0, Math.min(40, +m.gapPx)) } : {}),
      ...(m.shapeIn in SHAPE_BOX ? { shapeIn: m.shapeIn } : {}), ...(m.panel ? { panel: true } : {}) };
  } catch (e) { return undefined; }
}
const snapState = () => JSON.stringify({ p: PIECES, m: DESIGNS.filter(d => d.mosaic).map(d => [d.id, d.mosaic.pal, d.mosaic.col]) });
function restoreMosaics(list) {
  for (const [id, pal, col] of list || []) { const d = dById(id); if (!d || !d.mosaic) continue;
    if (d.mosaic.pal.join() !== pal.join() || d.mosaic.col.join() !== col.join()) { d.mosaic.pal = pal.slice(); d.mosaic.col = col.slice(); renderMosaic(d, true); } }
}
