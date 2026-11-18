/* Tessera · Compose: the tile library, the board, snapping, Fit to an edge, tile set-ups and editing */
'use strict';

/* =====================================================================================
   COMPOSER: saved tiles + a board where pieces of mixed shapes are dragged, snapped and cut
   ===================================================================================== */
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
             set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
const inFrame = (() => { try { return window.top !== window; } catch (e) { return true; } })();
// design = a saved tile: image (transparent outside the shape), its shape and its unit edge in image px
const DESIGNS = [];            // {id, name, shape, w, h, src, img, edge}
let PIECES = [];               // {id, did, cut, x, y, rot, s, flip}
const CB = { unit: 80, snap: true, fit: true, joints: true, groutW: 1, grout: '#8a7a66', bg: '#ffffff', grid: 'none' };
const VIEW = { ox: 0, oy: 0, z: 1, init: false };
const SEL = new Set();
let uid = 1;
const CUTS = {
  square: { full: 'Full square', half: 'Half (rectangle)', diag: 'Half (diagonal)' },
  rect:   { full: 'Full strip', half: 'Half strip' },
  hex:    { full: 'Full hexagon', half: 'Half, cut through corners', halfe: 'Half, cut through edges' },
  tri:    { full: 'Full triangle', half: 'Half (right triangle)' },
};
function cutPoly(d, cut) {
  const w = d.w, h = d.h;
  switch (d.shape) {
    case 'square': return cut === 'half' ? [[0, 0], [w, 0], [w, h / 2], [0, h / 2]] : cut === 'diag' ? [[0, 0], [w, 0], [0, h]] : [[0, 0], [w, 0], [w, h], [0, h]];
    case 'rect':   return cut === 'half' ? [[0, 0], [w / 2, 0], [w / 2, h], [0, h]] : [[0, 0], [w, 0], [w, h], [0, h]];
    case 'hex':    return cut === 'half' ? [[w / 4, 0], [3 * w / 4, 0], [w, h / 2], [0, h / 2]]
                        : cut === 'halfe' ? [[w / 4, 0], [w / 2, 0], [w / 2, h], [w / 4, h], [0, h / 2]]
                        : [[w / 4, 0], [3 * w / 4, 0], [w, h / 2], [3 * w / 4, h], [w / 4, h], [0, h / 2]];
    case 'tri':    return cut === 'half' ? [[w / 2, 0], [w / 2, h], [0, h]] : [[w / 2, 0], [w, h], [0, h]];
  }
  return [[0, 0], [w, 0], [w, h], [0, h]];
}
const dById = id => DESIGNS.find(d => d.id === id);
const TRASH = new Map();       // removed tiles, kept for this session so Undo can bring back their pieces
function removeDesign(d) { removeDesigns([d]); }
function removeDesigns(L) {               // several tiles at once (a frieze set): one message, one undo step
  const ids = new Set(L.map(d => d.id)), n = PIECES.filter(p => ids.has(p.did)).length;
  if (n) { PIECES = PIECES.filter(p => !ids.has(p.did)); for (const id of [...SEL]) if (!PIECES.some(p => p.id === id)) SEL.delete(id); }
  for (const d of L) { TRASH.set(d.id, d); const i = DESIGNS.indexOf(d); if (i >= 0) DESIGNS.splice(i, 1); }
  saveDesigns(); renderPalette();
  if (n) commit(); else cRender();
  const what = L.length === 1 ? `“${L[0].name}”` : `the ${L.length} tiles of “${fzSetName(L[0])}”`;
  cMsg(`Removed ${what}${n ? ` and ${n} piece${n > 1 ? 's' : ''}` : ''}.${n ? ' Undo brings them back.' : ''}`);
}
/* the tiles of one frieze set (saved together from the Frieze maker) are shown and handled as a group */
const fzSetName = d => String(d.name).split(' · ')[0];
const fzSetKey = d => !d.frieze ? null : d.fset ? 'set:' + d.fset : fzSetName(d) + '|' + JSON.stringify(d.frieze);   // fset: the set's id (older tiles: name and settings)
/* ✕ with a second click when pieces on the board would go too */
function armedRemove(btn, L, label) {
  const ids = new Set(L.map(d => d.id)), n = PIECES.filter(p => ids.has(p.did)).length;
  if (n && btn.dataset.armed !== '1') {
    btn.dataset.armed = '1'; btn.classList.add('armed'); const t0 = btn.title; btn.title = 'Click again to remove ' + (L.length > 1 ? 'the tiles' : 'the tile') + ' and the pieces';
    cMsg(`${label} is used by ${n} piece${n > 1 ? 's' : ''} on the board. Click ✕ again to remove ${L.length > 1 ? 'them' : 'the tile'} and ${n > 1 ? 'those pieces' : 'that piece'} (Undo brings them back).`, true);
    setTimeout(() => { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.title = t0; }, 4000); return; }
  removeDesigns(L);
}
function worldPoly(p) {
  const d = dById(p.did); if (!d) return [];
  const c = Math.cos(rad(p.rot)), s = Math.sin(rad(p.rot)), f = p.flip ? -1 : 1;
  return cutPoly(d, p.cut).map(([u, v]) => { const qx = (u - d.w / 2) * f * p.s, qy = (v - d.h / 2) * p.s;
    return { x: p.x + qx * c - qy * s, y: p.y + qx * s + qy * c }; });
}
/* ---------- contacts between pieces: after a tile changes size, which neighbours now overlap or have come apart ---------- */
const polyArea = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j].x + P[i].x) * (P[j].y - P[i].y); return Math.abs(a / 2); };
function clipPieces(A, B) {                      // the part of polygon A inside convex polygon B (Sutherland–Hodgman)
  let sa = 0; for (let i = 0; i < B.length; i++) { const p = B[i], q = B[(i + 1) % B.length]; sa += p.x * q.y - q.x * p.y; }
  const s = Math.sign(sa) || 1; let out = A;          // inside = on the same side of every edge as B's own winding
  for (let i = 0; i < B.length && out.length; i++) {
    const a = B[i], b = B[(i + 1) % B.length], side = q => s * ((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) >= -1e-9;
    const inp = out; out = [];
    for (let k = 0; k < inp.length; k++) { const c = inp[k], d = inp[(k + 1) % inp.length], ci = side(c), di = side(d);
      if (ci) out.push(c);
      if (ci !== di) { const ex = b.x - a.x, ey = b.y - a.y, den = ex * (d.y - c.y) - ey * (d.x - c.x); if (Math.abs(den) > 1e-12) { const t = (ey * (c.x - a.x) - ex * (c.y - a.y)) / den; out.push({ x: c.x + t * (d.x - c.x), y: c.y + t * (d.y - c.y) }); } } }
  }
  return out;
}
function segDist(p, a, b) { const ex = b.x - a.x, ey = b.y - a.y, L = ex * ex + ey * ey, t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / L)) : 0;
  return Math.hypot(p.x - a.x - t * ex, p.y - a.y - t * ey); }
function polyGap(A, B) {                          // 0 when they touch or overlap, else the distance between them
  if (A.some(q => inPoly(q, B)) || B.some(q => inPoly(q, A))) return 0;
  let m = Infinity; for (const [P, Q] of [[A, B], [B, A]]) for (const q of P) for (let i = 0; i < Q.length; i++) m = Math.min(m, segDist(q, Q[i], Q[(i + 1) % Q.length]));
  return m;
}
/* contacts of the pieces in `ids` with every other piece: overlap (share of the smaller piece) and gap (in board units) */
function pieceContacts(ids) {
  const P = PIECES.map(p => ({ p, poly: worldPoly(p) })).filter(e => e.poly.length > 2), out = new Map();
  for (const e of P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const v of e.poly) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); } e.bb = [x0, y0, x1, y1]; e.area = polyArea(e.poly); }
  const near = Math.max(...P.map(e => Math.min(e.bb[2] - e.bb[0], e.bb[3] - e.bb[1]))) * 0.5 || 1;
  for (const a of P) { if (!ids.has(a.p.did)) continue;
    for (const b of P) { if (a === b) continue; const k = a.p.id < b.p.id ? a.p.id + '|' + b.p.id : b.p.id + '|' + a.p.id; if (out.has(k)) continue;
      if (a.bb[0] > b.bb[2] + near || b.bb[0] > a.bb[2] + near || a.bb[1] > b.bb[3] + near || b.bb[1] > a.bb[3] + near) continue;
      const g = polyGap(a.poly, b.poly), inter = g ? 0 : polyArea(clipPieces(a.poly, b.poly)) / Math.max(1e-9, Math.min(a.area, b.area));
      const size = Math.min(a.bb[2] - a.bb[0], a.bb[3] - a.bb[1], b.bb[2] - b.bb[0], b.bb[3] - b.bb[1]);
      out.set(k, { a: a.p.id, b: b.p.id, gap: g / Math.max(1e-9, size), over: inter }); } }
  return out;
}
/* compare contacts before and after: pairs that now overlap, and pairs that touched and now stand apart */
function contactChanges(before, after) {
  const over = new Set(), gap = new Set(); let nO = 0, nG = 0;
  for (const [k, n] of after) { const o = before.get(k);
    if (n.over > 0.01 && (!o || n.over > o.over + 0.01)) { over.add(n.a); over.add(n.b); nO++; }
    else if (o && o.gap < 0.005 && n.gap > 0.01) { gap.add(n.a); gap.add(n.b); nG++; } }
  return { over, gap, nO, nG };
}
function inPoly(pt, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}

/* ---------- capture the current tile from the mirror view ---------- */
function captureTile(noAdd) {
  const g0 = tileGeom(), shape = g0.lat ? g0.latShape : T.shape;
  if (shape === 'para' || ['zoom', 'latzoom'].includes(tilesCompatible().why)) return null;
  const rho = rad((g0.rect || shape === 'rect' ? 0 : SHAPES[shape].show) - g0.m);
  const cs = Math.cos(rho), sn = Math.sin(rho);
  const dv = g0.verts.map(v => ({ x: (v.x - g0.C.x) * cs - (v.y - g0.C.y) * sn, y: (v.x - g0.C.x) * sn + (v.y - g0.C.y) * cs }));
  const minx = Math.min(...dv.map(p => p.x)), maxx = Math.max(...dv.map(p => p.x)), miny = Math.min(...dv.map(p => p.y)), maxy = Math.max(...dv.map(p => p.y));
  const f = Math.min(1, 640 / Math.max(maxx - minx, maxy - miny));
  const W = Math.max(8, Math.round((maxx - minx) * f)), H = Math.max(8, Math.round((maxy - miny) * f));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.setTransform(W / (maxx - minx), 0, 0, H / (maxy - miny), -minx * W / (maxx - minx), -miny * H / (maxy - miny));
  x.rotate(rho); x.translate(-g0.C.x, -g0.C.y);
  x.beginPath(); g0.verts.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.clip();
  x.fillStyle = T.bg; x.fill(); x.drawImage(clean, 0, 0);
  let src = c.toDataURL('image/webp', 0.92); if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/png');
  const edge = shape === 'square' ? W : shape === 'tri' ? W : W / 2;      // hexagon: width = 2 edges; strip: long side = 2 units
  const mi = methodInfo();
  const count = DESIGNS.filter(d => d.shape === shape).length + 1;
  const d = { id: 'd' + Date.now().toString(36) + (uid++), name: `${SHAPES[shape].label.replace(/s$/, '')} ${count} · ${mi.sym}`, shape, w: W, h: H, src, edge, method: mi, bg: T.bg, setup: tileSetup() };
  return noAdd ? d : addDesign(d);
}
/* the Tile maker set-up behind a tile (mirrors, method, tile options, ornaments), kept with the tile so it can be opened again for editing.
   Library ornaments are kept by their id; any other picture (a plate crop, your own image) as a small image of the part used */
function tileSetup() {
  const orn = S.orn.map(o => { const r = {}; for (const k of Object.keys(o)) if (k !== 'img' && k[0] !== '_') r[k] = o[k];
    if (!o.lib) { const k = Math.min(1, 900 / Math.max(o.cw, o.ch)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(o.cw * k)); c.height = Math.max(1, Math.round(o.ch * k));
      c.getContext('2d').drawImage(o.img, o.cx, o.cy, o.cw, o.ch, 0, 0, c.width, c.height);
      let u = c.toDataURL('image/webp', 0.9); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/png');
      r.src = u; r.cx = 0; r.cy = 0; r.s = o.s * o.cw / c.width; r.cw = c.width; r.ch = c.height; }
    return JSON.parse(JSON.stringify(r)); });
  const SS = { ...S }, TT = { ...T }; delete SS.orn; delete SS.sel; delete TT.before;
  return JSON.parse(JSON.stringify({ v: 1, S: SS, T: TT, orn, sel: S.sel }));
}
const validSetup = st => st && typeof st === 'object' && st.v === 1 && st.S && st.T && Array.isArray(st.orn) ? st : undefined;
async function applySetup(st) {     // open a tile's set-up in the Tile maker
  const orn = [];
  for (const r of st.orn.slice(0, MAX_ORN)) {
    let img = null;
    try { if (r.lib) img = await loadLib(r.lib);
      else if (typeof r.src === 'string' && /^data:image\//.test(r.src)) img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = r.src; }); } catch (e) { img = null; }
    if (!img) continue; const o = { ...r }; delete o.src; o.img = img; orn.push(o); }
  for (const k of Object.keys(st.S)) if (k in S) S[k] = st.S[k];
  for (const k of Object.keys(st.T)) if (k in T) T[k] = st.T[k];
  S.orn = orn; S.sel = Math.min(orn.length - 1, Math.max(0, st.sel | 0)); T.before = null;
  setTileShape(T.shape); syncSnap(); $('wpGroup').value = S.group;
  $('tileShift').value = T.shift; $('tileRatio').value = T.ratio; $('tileBorder').checked = T.border; $('tileCrop').value = T.crop; $('tileN').value = T.across; $('tileJoints').checked = T.joints;
  document.querySelectorAll('#stripBond button').forEach(x => x.classList.toggle('on', x.dataset.b === T.bond));
  document.querySelectorAll('#stripDir button').forEach(x => x.classList.toggle('on', (x.dataset.o === 'v') === !!T.vertical));
  setTileBg(T.bg); renderSlots(); redraw(true);
  return orn.length === st.orn.length;
}
/* what made the current tile: method keys (with their sources) and a precise description */
function methodInfo() {
  const keys = [S.method]; let detail, sym;
  if (S.mode === 'lattice') {
    const E = effGroup();
    if (S.method === 'brewster') { detail = `${E.bc.name} (Brewster, ch. XIII ${E.bc.sec}); group ${E.key}, ${E.g.orb}`; sym = E.key; }
    else { detail = `wallpaper group ${E.key} (${E.g.orb}), ${LATNAME[E.lat]} lattice${E.g.mirrors ? '; mirrors only' : ''}`; sym = E.key; }
  } else if (S.mode === 'hinge') { const r = analyse(S.alpha);
    detail = `hinged pair at ${fmt(S.alpha)}°` + (r.closed ? ` (D${r.n})` : r.k ? ` (dial mark ${r.k}, seam)` : ' (seam)'); sym = r.closed ? `D${r.n}` : `${fmt(S.alpha)}°`; }
  else if (S.mode === 'parallel') { detail = `parallel pair, spacing ${Math.round(S.d)}`; sym = 'border'; }
  else { detail = 'single mirror'; sym = 'mirror'; }
  if (T.shape === 'rect' && S.mode !== 'lattice') detail += `; strip tile, ${T.bond === 'brick' ? 'brick' : 'stacked'} bond in the preview`;
  return { keys, detail, sym };
}
function addDesign(d) {
  if (DESIGNS.some(x => x.id === d.id)) return dById(d.id);
  d.img = new Image(); d.img.onload = () => { cRender(); renderPalette(); }; d.img.src = d.src;
  DESIGNS.push(d); saveDesigns(); renderPalette(); return d;
}
/* the tile library lives in IndexedDB (room for mosaics); localStorage is only a fallback and the old location */
const TDB = { db: null, loaded: false };
TDB.ready = new Promise(res => {
  let r; try { r = indexedDB.open('mirror-tool-tiles', 1); } catch (e) { return res(); }
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { TDB.db = r.result; res(); }; r.onerror = r.onblocked = () => res();
});
const tdbGet = k => new Promise(res => { try { const q = TDB.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } });
const tdbPut = (k, v) => new Promise(res => { try { const t = TDB.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k);
  t.oncomplete = () => res(true); t.onerror = t.onabort = () => res(false); } catch (e) { res(false); } });
let saveDT = 0;
function saveDesigns() {
  if (!TDB.loaded) return;                      // never overwrite the stored library before it has been read
  clearTimeout(saveDT); saveDT = setTimeout(async () => {
    const data = DESIGNS.map(({ img, ...d }) => d);
    if (TDB.db) { if (await tdbPut('designs', data)) { try { localStorage.removeItem('mt.designs'); } catch (e) {} return; } }
    const ok = LS.set('mt.designs', JSON.stringify(data));
    if (!ok && DESIGNS.length) cMsg('Your browser would not store the tile library (storage full or blocked). Use “Save project” to keep it.', true);
  }, 200);
}
let saveT = 0;
$('cFilter').onchange = renderPalette;
/* methods actually present on the board, for the legend and the exports */
function methodSummary() {
  const m = new Map();
  for (const p of PIECES) {
    const d = dById(p.did), keys = dKeys(d);
    for (const k of new Set(keys)) { const e = m.get(k) || { n: 0, details: new Set() }; e.n++;
      if (d && d.method && d.method.detail && k !== 'unknown') e.details.add(d.method.detail);
      m.set(k, e); }
  }
  return m;
}
function renderLegend() {
  const m = methodSummary(), el = $('cLegend');
  if (!m.size) { el.innerHTML = ''; return; }
  el.innerHTML = '<span>Methods on the board:</span>' + [...m.entries()].map(([k, e]) =>
    `<span class="lg" title="${[...e.details].join('\n')}">${chip(k)} ${e.n} piece${e.n > 1 ? 's' : ''}</span>`).join('') +
    (m.size > 1 ? ' <span style="color:var(--rose)">· mixed methods</span>' : ' <span style="color:var(--teal)">· one method</span>');
}
function saveBoard() { clearTimeout(saveT); saveT = setTimeout(() => LS.set('mt.board', JSON.stringify({ pieces: PIECES, cb: CB })), 300); }

/* ---------- palette ---------- */
const dKeys = d => (d && d.method && Array.isArray(d.method.keys) && d.method.keys.length ? d.method.keys.filter(k => METHODS[k]) : ['unknown']);
function shownDesigns() { const flt = $('cFilter').value; return DESIGNS.filter(d => flt === 'all' || (flt === 'demo' ? d.demo : dKeys(d).includes(flt))); }
function renderPalette() {
  const pal = $('cPalette'); pal.innerHTML = '';
  if (!DESIGNS.length) { pal.innerHTML = '<div class="empty">No saved tiles yet. Press “+ Tile from the Tile maker”, or save one under the tiled surface in the Tile maker tab.</div>'; return; }
  const flt = $('cFilter').value, shown = shownDesigns();
  if (!shown.length) { pal.innerHTML = `<div class="empty">${flt === 'demo' ? 'No demo tiles in the library (Load the demo puts them back).' : 'No saved tiles made with this method.'}</div>`; return; }
  const groups = new Map();
  for (const d of shown) { const k = fzSetKey(d); if (k) { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); } }
  const done = new Set();
  for (const d of shown) {
    if (done.has(d.id)) continue;
    const k = fzSetKey(d), G = k ? groups.get(k) : null;
    if (G && G.length > 1) { pal.appendChild(paletteGroup(G)); G.forEach(g => done.add(g.id)); continue; }
    pal.appendChild(paletteItem(d)); done.add(d.id);
  }
}
function paletteItem(d, inSet) {
  const it = document.createElement('div'); it.className = 'it';
  it.title = `${d.name}\nMade with: ${dKeys(d).map(k => METHODS[k].label).join(' + ')}${d.method && d.method.detail ? ' — ' + d.method.detail : ''}\n${dKeys(d).map(k => plain(METHODS[k].cite)).filter(Boolean).join('\n')}\nDrag onto the board.`;
  const ed = inSet ? '' : `<button title="${d.mosaic ? 'Edit in the Mosaic maker tab' : d.setup ? 'Edit in the Tile maker tab' : d.frieze ? 'Open in the Frieze maker tab' : 'Saved before version 1.0 without its set-up: cannot be reopened'}" data-a="ed"${!d.mosaic && !d.setup && !d.frieze ? ' disabled' : ''}>✎</button>`;
  const nm = inSet ? String(d.name).split(' · ').slice(1).join(' · ') || d.name : d.name;
  it.innerHTML = `<img src="${d.src}" alt="">${inSet ? '' : `<div class="mm">${dKeys(d).map(k => chip(k)).join('')}</div>`}<div class="nm">${nm}</div><div class="ac">${ed}<button title="Download this tile (PNG)" data-a="dl">⤓</button><button title="Remove this tile from the library" data-a="rm">✕</button></div>`;
  it.querySelector('[data-a=dl]').onclick = e => { e.stopPropagation(); downloadTile(d); };
  if (!inSet) it.querySelector('[data-a=ed]').onclick = e => { e.stopPropagation(); editTile(d); };
  const rm = it.querySelector('[data-a=rm]'); rm.onclick = e => { e.stopPropagation(); armedRemove(rm, [d], `“${d.name}”`); };
  it.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; startPaletteDrag(e, d); });
  return it;
}
function paletteGroup(G) {
  const g = document.createElement('div'); g.className = 'fzgrp'; const nm = fzSetName(G[0]);
  g.innerHTML = `<div class="fzgh"><span class="t" title="${nm}: the ${G.length} tiles saved together from the Frieze maker">${dKeys(G[0]).map(k => chip(k)).join('')} <b>${nm}</b> · set of ${G.length}</span>`
    + `<span class="ac"><button data-a="ed" title="Open the set in the Frieze maker tab">✎</button><button data-a="rm" title="Remove the whole set from the library">✕</button></span></div><div class="fzgi"></div>`;
  const inner = g.querySelector('.fzgi'); for (const d of G) inner.appendChild(paletteItem(d, true));
  g.querySelector('[data-a=ed]').onclick = () => editTile(G[0]);
  const rm = g.querySelector('[data-a=rm]'); rm.onclick = () => armedRemove(rm, G, `The set “${nm}”`);
  return g;
}

/* ---------- board view ---------- */
const board = $('board'), bctx = board.getContext('2d');
function bSize() {
  const r = board.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.max(50, Math.round(r.width * dpr)), H = Math.max(50, Math.round(r.height * dpr));
  if (board.width !== W || board.height !== H) { board.width = W; board.height = H; }
  if (!VIEW.init && r.width > 0) { VIEW.ox = r.width / 2; VIEW.oy = r.height / 2; VIEW.init = true; }
  return { w: r.width, h: r.height, dpr };
}
const toWorld = (sx, sy) => ({ x: (sx - VIEW.ox) / VIEW.z, y: (sy - VIEW.oy) / VIEW.z });
function evWorld(e) { const r = board.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); }
let cPending = false, GHOST = null, BOX = null;
function cRender() {
  if ($('composeView').hidden || cPending) return; cPending = true;
  requestAnimationFrame(() => { cPending = false; drawBoard(); });
}
function drawPiece(ctx, p, alpha = 1, hi = false) {
  const d = dById(p.did); if (!d || !d.img || (d.img instanceof HTMLImageElement && (!d.img.complete || !d.img.naturalWidth))) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y); ctx.rotate(rad(p.rot)); ctx.scale(p.flip ? -p.s : p.s, p.s); ctx.translate(-d.w / 2, -d.h / 2);
  const poly = cutPoly(d, p.cut); ctx.beginPath(); poly.forEach(([u, v], i) => i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)); ctx.closePath(); ctx.clip();
  if (hi && d.mosaic) drawMosaic(ctx, d.mosaic); else ctx.drawImage(d.img, 0, 0, d.w, d.h); ctx.restore();
}
function strokePoly(ctx, poly, style, width, dash) {
  if (poly.length < 2) return;
  ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); poly.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); ctx.restore();
}
function drawGrid(ctx, w, h) {
  if (CB.grid === 'none') return;
  const a = toWorld(0, 0), b = toWorld(w, h), U = CB.unit;
  ctx.save(); ctx.strokeStyle = 'rgba(122,106,85,.18)'; ctx.lineWidth = 1 / VIEW.z; ctx.beginPath();
  if (CB.grid === 'square') {
    for (let x = Math.floor(a.x / U) * U; x <= b.x; x += U) { ctx.moveTo(x, a.y); ctx.lineTo(x, b.y); }
    for (let y = Math.floor(a.y / U) * U; y <= b.y; y += U) { ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); }
  } else {
    // equilateral triangles of edge U; all three families pass through the lattice points (kU + mU/2, m·U√3/2)
    const hh = U * Math.sqrt(3) / 2, r3 = Math.sqrt(3);
    for (let y = Math.floor(a.y / hh) * hh; y <= b.y; y += hh) { ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); }
    const ext = Math.max(Math.abs(a.y), Math.abs(b.y)) / r3;
    for (let k = Math.floor((a.x - ext) / U) - 1; k <= Math.ceil((b.x + ext) / U) + 1; k++) {
      const x = k * U;                        // lines x = kU ± y/√3
      ctx.moveTo(x + a.y / r3, a.y); ctx.lineTo(x + b.y / r3, b.y);
      ctx.moveTo(x - a.y / r3, a.y); ctx.lineTo(x - b.y / r3, b.y);
    }
  }
  ctx.stroke(); ctx.restore();
}
function drawBoard() {
  const { w, h, dpr } = bSize(), ctx = bctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = CB.bg; ctx.fillRect(0, 0, board.width, board.height);
  ctx.setTransform(dpr * VIEW.z, 0, 0, dpr * VIEW.z, dpr * VIEW.ox, dpr * VIEW.oy);
  drawGrid(ctx, w, h);
  for (const p of PIECES) drawPiece(ctx, p);
  if (CB.joints && CB.groutW > 0) for (const p of PIECES) strokePoly(ctx, worldPoly(p), CB.grout, Math.max(CB.groutW, 0.6 / VIEW.z));
  for (const p of PIECES) if (SEL.has(p.id)) strokePoly(ctx, worldPoly(p), '#2f5d5a', 2.2 / VIEW.z, [6 / VIEW.z, 4 / VIEW.z]);
  if (GHOST) { drawPiece(ctx, GHOST, 0.75); strokePoly(ctx, worldPoly(GHOST), '#2f5d5a', 1.5 / VIEW.z, [4 / VIEW.z, 3 / VIEW.z]); }
  if (FITPICK) for (const e of FITPICK.edges.concat(FITPICK.hover ? [FITPICK.hover] : [])) {
    ctx.save(); ctx.strokeStyle = e === FITPICK.hover ? 'rgba(163,67,79,.6)' : '#a3434f'; ctx.lineWidth = 5 / VIEW.z; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke(); ctx.restore(); }
  if (SNAPMARK) { ctx.fillStyle = '#a3434f'; ctx.beginPath(); ctx.arc(SNAPMARK.x, SNAPMARK.y, 4 / VIEW.z, 0, 7); ctx.fill(); }
  if (BOX) { ctx.save(); ctx.strokeStyle = '#2f5d5a'; ctx.lineWidth = 1 / VIEW.z; ctx.setLineDash([4 / VIEW.z, 3 / VIEW.z]);
    ctx.strokeRect(BOX.a.x, BOX.a.y, BOX.b.x - BOX.a.x, BOX.b.y - BOX.a.y); ctx.restore(); }
  if (!PIECES.length && !GHOST) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#b3a58c'; ctx.font = '16px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(DESIGNS.length ? 'Drag saved tiles from the left onto the board' : 'Save a tile first (left: “+ Tile from the Tile maker”)', w / 2, h / 2);
  }
}

/* ---------- snapping: bring a corner onto a nearby corner and line up the edges ---------- */
let SNAPMARK = null;
function snapPieces(list, allowRot) {
  SNAPMARK = null; FITNOTE = ''; if (!CB.snap) return;
  const ids = new Set(list.map(p => p.id)), tol = 14 / VIEW.z, rotTol = 8;
  const mov = list.map(worldPoly), others = PIECES.filter(p => !ids.has(p.id));
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const poly of mov) for (const q of poly) { bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y); bx1 = Math.max(bx1, q.x); by1 = Math.max(by1, q.y); }
  const fixed = [];
  for (const o of others) {
    const poly = worldPoly(o);
    if (poly.some(q => q.x > bx0 - tol && q.x < bx1 + tol && q.y > by0 - tol && q.y < by1 + tol)) fixed.push(poly);
  }
  const gridPts = [];
  if (CB.grid !== 'none') {
    const U = CB.unit, hh = U * Math.sqrt(3) / 2;
    for (const poly of mov) for (const q of poly) {
      if (CB.grid === 'square') gridPts.push({ x: Math.round(q.x / U) * U, y: Math.round(q.y / U) * U, dirs: [0, 90], mid: false });
      else { const m0 = Math.round(q.y / hh);
        for (let m = m0 - 1; m <= m0 + 1; m++) { const off = m * U / 2;
          gridPts.push({ x: Math.round((q.x - off) / U) * U + off, y: m * hh, dirs: [0, 60, 120], mid: false }); } }
    }
  }
  if (!fixed.length && !gridPts.length) return;
  let best = null;
  // snap points: corners (with the directions of both edges) and edge midpoints (with the edge direction)
  const pts = poly => { const n = poly.length, out = [];
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], c = poly[(i - 1 + n) % n];
      const eb = deg(Math.atan2(b.y - a.y, b.x - a.x)), ec = deg(Math.atan2(c.y - a.y, c.x - a.x));
      out.push({ x: a.x, y: a.y, dirs: [eb, ec], nb: [b, c], mid: false }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dirs: [eb], mid: true }); }
    return out; };
  const fixedPts = fixed.flatMap(pts).concat(gridPts);
  for (const mp of mov) for (const v of pts(mp)) {
    for (const w of fixedPts) {
      const dist = Math.hypot(w.x - v.x, w.y - v.y); if (dist > tol) continue;
      let dl = 0;
      if (allowRot) {
        let bd = Infinity;
        for (const am of v.dirs) for (const af of w.dirs) {
          let dd = ((af - am) % 180 + 540) % 180; if (dd > 90) dd -= 180;      // make the edges parallel (same line)
          if (Math.abs(dd) < Math.abs(bd)) bd = dd;
        }
        dl = Math.abs(bd) <= rotTol ? bd : 0;
      }
      const score = dist + Math.abs(dl) * 0.3 + (v.mid || w.mid ? 0.35 * tol : 0);   // prefer corner-to-corner
      if (!best || score < best.score) best = { score, v, w, dl };
    }
  }
  if (!best) return;
  if (best.dl && list.length === 1) {
    const p = list[0], c = Math.cos(rad(best.dl)), s = Math.sin(rad(best.dl)), dx = p.x - best.v.x, dy = p.y - best.v.y;
    p.x = best.v.x + dx * c - dy * s; p.y = best.v.y + dx * s + dy * c; p.rot = wrap180(p.rot + best.dl);
  }
  for (const p of list) { p.x += best.w.x - best.v.x; p.y += best.w.y - best.v.y; }
  SNAPMARK = best.w; FITNOTE = '';
  if (CB.fit && best.w.nb && !best.v.mid) fitToEdge(list, best.w);
}
/* After a corner has snapped onto a corner w of a fixed piece: if an edge of the moved piece leaving that corner
   runs along an edge of the fixed piece leaving w, scale the moved piece(s) about w so the two edges have the same
   length or a simple ratio (½, ⅓, ¼, 2×, 3×, 4×). Uniform scaling: the pattern is never stretched. */
let FITNOTE = '';
const FRAC = ['', '', '½', '⅓', '¼', '⅕', '⅙', '1/7', '⅛'];
const FIT_Q = [[1, 'same length as']];
for (let n = 2; n <= 8; n++) FIT_Q.push([1 / n, `${FRAC[n]} of`], [n, `${n}× of`]);
function fitToEdge(list, w) {
  const eps = 1e-6; let best = null;
  for (const p of list) {
    const poly = worldPoly(p), n = poly.length;
    for (let i = 0; i < n; i++) {
      if (Math.hypot(poly[i].x - w.x, poly[i].y - w.y) > 0.5) continue;
      for (const m of [poly[(i + 1) % n], poly[(i - 1 + n) % n]]) {
        const lm = Math.hypot(m.x - w.x, m.y - w.y); if (lm < eps) continue;
        for (const f of w.nb) {
          const lf = Math.hypot(f.x - w.x, f.y - w.y); if (lf < eps) continue;
          const cosA = ((m.x - w.x) * (f.x - w.x) + (m.y - w.y) * (f.y - w.y)) / (lm * lf);
          if (cosA < Math.cos(rad(4))) continue;                       // the two edges must lie on the same ray
          for (const [q, lab] of FIT_Q) {
            const err = Math.abs(Math.log(lm / (lf * q)));             // how far from an exact fit, in log scale
            if (err < Math.log(1.18) && (!best || err < best.err - 1e-9)) best = { err, k: lf * q / lm, lab, q };
          }
        }
      }
    }
  }
  if (!best || Math.abs(best.k - 1) < 1e-9) { if (best) FITNOTE = `Edge fits: ${best.lab} the neighbour’s edge.`; return; }
  for (const p of list) { p.s *= best.k; p.x = w.x + (p.x - w.x) * best.k; p.y = w.y + (p.y - w.y) * best.k; }
  FITNOTE = `Resized to fit: edge = ${best.lab} the neighbour’s edge.`;
}
/* ---------- Fit to an edge: the user picks the target edge(s); the selected pieces are turned (to the nearest
   parallel position), scaled and moved so that their common side facing that edge covers it exactly ---------- */
let FITPICK = null;            // {edges:[{pid,i,a,b}], hover}
function edgeAt(w) {
  const tol = 10 / VIEW.z; let best = null;
  for (let j = PIECES.length - 1; j >= 0; j--) { const p = PIECES[j]; if (SEL.has(p.id)) continue;
    const poly = worldPoly(p), n = poly.length;
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; if (L2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((w.x - a.x) * dx + (w.y - a.y) * dy) / L2)), d = Math.hypot(w.x - a.x - t * dx, w.y - a.y - t * dy);
      if (d <= tol && (!best || d < best.d)) best = { d, pid: p.id, i, a, b }; } }
  return best;
}
function endFitPick(msg) { FITPICK = null; $('cFitEdge').classList.remove('on'); board.style.cursor = 'default'; if (msg) cMsg(msg); cRender(); }
$('cFitEdge').onclick = () => {
  if (FITPICK) { endFitPick('Fit cancelled.'); return; }
  if (!selList().length) { cMsg('First select the pieces to fit (click, Shift-click or Shift-drag), then press “Fit to an edge…”.', true); return; }
  FITPICK = { edges: [], hover: null }; $('cFitEdge').classList.add('on');
  cMsg('Now click the edge of another piece to fit the selection to. Shift-click to pick several edges in a line; Esc cancels.');
};
function applyFitEdge() {
  const L = selList(), E = FITPICK.edges;
  if (!L.length || !E.length) { endFitPick(); return; }
  // target segment: the first edge's line, spanning every picked edge
  const A0 = E[0].a, B0 = E[0].b, len0 = Math.hypot(B0.x - A0.x, B0.y - A0.y);
  let u = { x: (B0.x - A0.x) / len0, y: (B0.y - A0.y) / len0 }, n = { x: -u.y, y: u.x };
  let t0 = Infinity, t1 = -Infinity;
  for (const e of E) for (const q of [e.a, e.b]) { const t = (q.x - A0.x) * u.x + (q.y - A0.y) * u.y; t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
  const A = { x: A0.x + u.x * t0, y: A0.y + u.y * t0 }, tgtLen = t1 - t0;
  // the selection goes on the side away from the target piece(s)
  const tp = E.map(e => PIECES.find(p => p.id === e.pid)).filter(Boolean);
  const tc = centroid(tp.map(p => { const q = worldPoly(p); return { x: q.reduce((s, v) => s + v.x, 0) / q.length, y: q.reduce((s, v) => s + v.y, 0) / q.length }; }));
  const side = ((tc.x - A.x) * n.x + (tc.y - A.y) * n.y) > 0 ? -1 : 1;
  // turn the selection so that its edge closest in direction to the target becomes parallel to it
  const au = deg(Math.atan2(u.y, u.x)); let dl = null;
  for (const p of L) { const q = worldPoly(p);
    for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length];
      let dd = ((au - deg(Math.atan2(b.y - a.y, b.x - a.x))) % 180 + 540) % 180; if (dd > 90) dd -= 180;
      if (dl === null || Math.abs(dd) < Math.abs(dl)) dl = dd; } }
  if (dl && Math.abs(dl) > 1e-6) rotateSel(dl);
  // Pieces whose spans along the edge overlap form a column (a stack) and move together; columns are laid side by side
  // along the edge in their current order, each pressed against the edge line, gaps closed, all scaled by one factor so
  // the sides that face the edge cover it exactly from end to end.
  const info = L.map(p => { const V = worldPoly(p), S = V.map(q => (q.x - A.x) * n.x + (q.y - A.y) * n.y), T = V.map(q => (q.x - A.x) * u.x + (q.y - A.y) * u.y);
    return { p, S, T, t0: Math.min(...T), t1: Math.max(...T) }; });
  const span = Math.max(...info.map(o => o.t1)) - Math.min(...info.map(o => o.t0)), tol = Math.max(0.5, span * 0.004);
  const par = info.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++)
    if (Math.min(info[i].t1, info[j].t1) - Math.max(info[i].t0, info[j].t0) > tol) par[find(i)] = find(j);
  const cols = new Map(); info.forEach((o, i) => { const r = find(i); (cols.get(r) || cols.set(r, []).get(r)).push(o); });
  const C = [];
  for (const g of cols.values()) {
    const S = g.flatMap(o => o.S), T = g.flatMap(o => o.T), ext = side > 0 ? Math.min(...S) : Math.max(...S);
    const face = S.map((v, i) => i).filter(i => Math.abs(S[i] - ext) <= tol), f0 = Math.min(...face.map(i => T[i])), f1 = Math.max(...face.map(i => T[i]));
    C.push({ g, ext, f0, f1 });
  }
  if (C.some(c => c.f1 - c.f0 < 1e-6)) { commit(); endFitPick(); cMsg('A selected piece has only a corner facing that edge, no straight side to lay along it.', true); return; }
  C.sort((a, b) => (a.f0 + a.f1) - (b.f0 + b.f1));
  const total = C.reduce((s, c) => s + c.f1 - c.f0, 0), k = tgtLen / total; let cur = 0;
  for (const c of C) {
    const F = { x: A.x + u.x * c.f0 + n.x * c.ext, y: A.y + u.y * c.f0 + n.y * c.ext }, O = { x: A.x + u.x * cur, y: A.y + u.y * cur };
    for (const { p } of c.g) { p.s *= k; p.x = O.x + (p.x - F.x) * k; p.y = O.y + (p.y - F.y) * k; }
    cur += (c.f1 - c.f0) * k;
  }
  commit(); endFitPick();
  cMsg(`Fitted ${L.length} piece${L.length > 1 ? 's' : ''} to ${E.length > 1 ? E.length + ' edges' : 'the edge'} (scale ×${k.toFixed(3)}${dl && Math.abs(dl) > 0.05 ? `, turned ${dl.toFixed(1)}°` : ''}). Undo reverses it.`);
}
