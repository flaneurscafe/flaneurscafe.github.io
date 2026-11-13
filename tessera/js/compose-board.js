/* Tessera · Compose: undo, selection panel, board interaction, export, projects, the demo, switching tabs */
'use strict';

/* ---------- undo ---------- */
const UNDO = [], REDO = [];
let lastSnap = '{"p":[],"m":[]}';
function commit() {
  const s = snapState();
  if (s !== lastSnap) { UNDO.push(lastSnap); if (UNDO.length > 80) UNDO.shift(); REDO.length = 0; lastSnap = s; saveBoard(); }
  syncSel(); cRender(); renderLegend();
}
function restore(s) { const o = JSON.parse(s); if (Array.isArray(o)) PIECES = o; else { PIECES = o.p; restoreMosaics(o.m); } lastSnap = s;
  for (const p of PIECES) if (!dById(p.did) && TRASH.has(p.did)) { const d = TRASH.get(p.did); TRASH.delete(p.did); DESIGNS.push(d); saveDesigns(); renderPalette(); } for (const id of [...SEL]) if (!PIECES.some(p => p.id === id)) SEL.delete(id); saveBoard(); syncSel(); cRender(); renderLegend(); }
$('cUndo').onclick = () => { if (UNDO.length) { REDO.push(lastSnap); restore(UNDO.pop()); } };
$('cRedo').onclick = () => { if (REDO.length) { UNDO.push(lastSnap); restore(REDO.pop()); } };

/* ---------- selection panel ---------- */
const selList = () => PIECES.filter(p => SEL.has(p.id));
const pEdge = p => { const d = dById(p.did); return d ? d.edge * p.s : 0; };
function syncSel() {
  const L = selList(), ctl = $('cSelCtl');
  ctl.classList.toggle('off', !L.length);
  $('cSelInfo').textContent = !L.length ? 'Nothing selected. Click a piece; Shift-click or Shift-drag to select several.'
    : L.length === 1 ? (dById(L[0].did)?.name || '') : `${L.length} pieces selected (they move, turn and scale together).`;
  const shapes = new Set(L.map(p => dById(p.did)?.shape)), cut = $('cCut');
  cut.innerHTML = ''; cut.disabled = shapes.size !== 1;
  if (shapes.size === 1) { const sh = [...shapes][0]; for (const [k, lab] of Object.entries(CUTS[sh])) cut.add(new Option(lab, k));
    const cs = new Set(L.map(p => p.cut)); cut.value = cs.size === 1 ? [...cs][0] : 'full'; }
  else cut.add(new Option(L.length ? 'mixed shapes' : '—', ''));
  if (L.length) {
    const e = pEdge(L[0]); $('cSize').value = Math.round(e); $('cSizeV').textContent = Math.round(e) + ' px';
    if (L.length === 1) { $('cRot').value = Math.round(L[0].rot); $('cRotV').textContent = Math.round(L[0].rot) + '°'; }
    else { $('cRot').value = 0; $('cRotV').textContent = 'group'; }
  } else { $('cSizeV').textContent = '–'; $('cRotV').textContent = '–'; }
  $('cUnitV').textContent = CB.unit + ' px'; renderMosaicPanel(); if ($('cWorkTxt')) workBar();
  $('cGroutWV').textContent = CB.groutW;
}
const centroid = L => ({ x: L.reduce((s, p) => s + p.x, 0) / L.length, y: L.reduce((s, p) => s + p.y, 0) / L.length });
function rotateSel(dl) {
  const L = selList(); if (!L.length) return;
  // a single piece turns about the centre of its own shape (a triangle or half-hexagon is not centred in its image)
  const c = L.length === 1 ? (q => ({ x: q.reduce((t, v) => t + v.x, 0) / q.length, y: q.reduce((t, v) => t + v.y, 0) / q.length }))(worldPoly(L[0])) : centroid(L);
  const cs = Math.cos(rad(dl)), sn = Math.sin(rad(dl));
  for (const p of L) { const dx = p.x - c.x, dy = p.y - c.y; p.x = c.x + dx * cs - dy * sn; p.y = c.y + dx * sn + dy * cs; p.rot = wrap180(p.rot + dl); }
}
$('cCut').onchange = e => { for (const p of selList()) p.cut = e.target.value; commit(); };
$('cSize').addEventListener('input', e => {
  const L = selList(); if (!L.length) return; const k = +e.target.value / pEdge(L[0]); const c = centroid(L);
  for (const p of L) { p.s *= k; if (L.length > 1) { p.x = c.x + (p.x - c.x) * k; p.y = c.y + (p.y - c.y) * k; } }
  $('cSizeV').textContent = e.target.value + ' px'; cRender(); });
$('cSize').addEventListener('change', commit);
$('cRot').addEventListener('input', e => {
  const L = selList(); if (L.length !== 1) return; L[0].rot = +e.target.value; $('cRotV').textContent = e.target.value + '°'; cRender(); });
$('cRot').addEventListener('change', commit);
$('cRotL').onclick = () => { rotateSel(-+$('cStep').value); commit(); };
$('cRotR').onclick = () => { rotateSel(+$('cStep').value); commit(); };
$('cFlip').onclick = () => { const L = selList(), c = L.length ? centroid(L) : null;
  for (const p of L) { p.flip = !p.flip; p.rot = wrap180(-p.rot); if (L.length > 1) p.x = 2 * c.x - p.x; } commit(); };
$('cFront').onclick = () => { const L = selList(); PIECES = PIECES.filter(p => !SEL.has(p.id)).concat(L); commit(); };
$('cBack').onclick = () => { const L = selList(); PIECES = L.concat(PIECES.filter(p => !SEL.has(p.id))); commit(); };
$('cDel').onclick = () => { PIECES = PIECES.filter(p => !SEL.has(p.id)); SEL.clear(); commit(); };
let lastDup = null;           // {src:[ids], ids:[ids], dx, dy}: repeat the step the user gave the previous copy
function duplicate() {
  const L = selList(); if (!L.length) return;
  const key = L.map(p => p.id).sort().join(), repeat = !!(lastDup && lastDup.ids === key && lastDup.dx !== null);
  const dx = repeat ? lastDup.dx : 24 / VIEW.z, dy = repeat ? lastDup.dy : 24 / VIEW.z;
  const copies = L.map(p => ({ ...p, id: 'p' + (uid++), x: p.x + dx, y: p.y + dy }));
  PIECES.push(...copies); SEL.clear(); copies.forEach(p => SEL.add(p.id));
  lastDup = { src: L.map(p => ({ x: p.x, y: p.y })), ids: copies.map(p => p.id).sort().join(), dx: repeat ? dx : null, dy: repeat ? dy : null };
  commit(); cMsg(repeat ? 'Repeated the same step.' : 'Copy made. Drag it into place; pressing Duplicate again then repeats that step.');
}
$('cDup').onclick = duplicate;
$('cAll').onclick = () => { PIECES.forEach(p => SEL.add(p.id)); syncSel(); cRender(); };
$('cClear').onclick = () => { PIECES = []; SEL.clear(); commit(); };

/* ---------- board options ---------- */
$('cUnit').addEventListener('input', e => { CB.unit = +e.target.value; syncSel(); saveBoard(); cRender(); });
$('cSnap').onchange = e => { CB.snap = e.target.checked; saveBoard(); };
$('cFitAuto').onchange = e => { CB.fit = e.target.checked; saveBoard(); };
$('cJoints').onchange = e => { CB.joints = e.target.checked; saveBoard(); cRender(); };
$('cGroutW').addEventListener('input', e => { CB.groutW = +e.target.value; syncSel(); saveBoard(); cRender(); });
$('cGrout').addEventListener('input', e => { CB.grout = e.target.value; saveBoard(); cRender(); });
$('cBg').addEventListener('input', e => { CB.bg = e.target.value; saveBoard(); cRender(); });
$('cGrid').onchange = e => { CB.grid = e.target.value; saveBoard(); cRender(); };
function syncBoardCtl() {
  $('cUnit').value = CB.unit; $('cSnap').checked = CB.snap; $('cFitAuto').checked = CB.fit; $('cJoints').checked = CB.joints; $('cGroutW').value = CB.groutW;
  $('cGrout').value = CB.grout; $('cBg').value = CB.bg; $('cGrid').value = CB.grid; syncSel();
}
function cMsg(t, warn) { const s = $('cStatus'); s.textContent = t; s.style.color = warn ? 'var(--rose)' : 'var(--muted)'; }

/* ---------- board interaction ---------- */
let BD = null;
board.addEventListener('pointerdown', e => {
  if (FITPICK) { const w = evWorld(e), ed = edgeAt(w);
    if (!ed) { cMsg('Click closer to an edge of another piece (or press Esc to cancel).', true); return; }
    const k = FITPICK.edges.findIndex(x => x.pid === ed.pid && x.i === ed.i);
    if (k >= 0) FITPICK.edges.splice(k, 1); else FITPICK.edges.push(ed);
    if (e.shiftKey) { cMsg(`${FITPICK.edges.length} edge${FITPICK.edges.length > 1 ? 's' : ''} picked. Shift-click more edges in the same line, or click the last one without Shift to fit.`); cRender(); return; }
    applyFitEdge(); return; }
  board.setPointerCapture(e.pointerId); const w = evWorld(e);
  let hit = null; for (let i = PIECES.length - 1; i >= 0; i--) if (inPoly(w, worldPoly(PIECES[i]))) { hit = PIECES[i]; break; }
  if (hit) {
    if (e.shiftKey) { SEL.has(hit.id) ? SEL.delete(hit.id) : SEL.add(hit.id); syncSel(); cRender(); BD = null; return; }
    if (!SEL.has(hit.id)) { SEL.clear(); SEL.add(hit.id); }
    if (e.altKey) { const copies = selList().map(p => ({ ...p, id: 'p' + (uid++) })); PIECES.push(...copies); SEL.clear(); copies.forEach(p => SEL.add(p.id)); }
    const L = selList();
    BD = { kind: 'move', start: w, orig: L.map(p => ({ p, x: p.x, y: p.y, rot: p.rot, s: p.s })), moved: false };
    syncSel(); cRender();
  } else if (e.shiftKey) { BD = { kind: 'box' }; BOX = { a: w, b: w }; }
  else BD = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: VIEW.ox, oy: VIEW.oy, moved: false };
});
board.addEventListener('pointermove', e => {
  if (FITPICK) { const ed = edgeAt(evWorld(e)); FITPICK.hover = ed; board.style.cursor = ed ? 'pointer' : 'crosshair'; cRender(); return; }
  if (!BD) { const w = evWorld(e); let over = false; for (let i = PIECES.length - 1; i >= 0; i--) if (inPoly(w, worldPoly(PIECES[i]))) { over = true; break; }
    board.style.cursor = over ? 'move' : 'grab'; return; }
  if (BD.kind === 'pan') { VIEW.ox = BD.ox + e.clientX - BD.sx; VIEW.oy = BD.oy + e.clientY - BD.sy; BD.moved = true; cRender(); return; }
  const w = evWorld(e);
  if (BD.kind === 'box') { BOX.b = w; cRender(); return; }
  BD.moved = true;
  for (const o of BD.orig) { o.p.x = o.x + w.x - BD.start.x; o.p.y = o.y + w.y - BD.start.y; o.p.rot = o.rot; o.p.s = o.s; }
  snapPieces(BD.orig.map(o => o.p), BD.orig.length === 1); if (FITNOTE) cMsg(FITNOTE); syncSel(); cRender();
});
function endBoardDrag() {
  if (!BD) return;
  if (BD.kind === 'pan' && !BD.moved) { SEL.clear(); syncSel(); }
  if (BD.kind === 'box' && BOX) {
    const x0 = Math.min(BOX.a.x, BOX.b.x), x1 = Math.max(BOX.a.x, BOX.b.x), y0 = Math.min(BOX.a.y, BOX.b.y), y1 = Math.max(BOX.a.y, BOX.b.y);
    for (const p of PIECES) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) SEL.add(p.id);
    BOX = null; syncSel();
  }
  if (BD.kind === 'move') {
    if (lastDup && lastDup.ids === BD.orig.map(o => o.p.id).sort().join() && lastDup.src.length) {
      const p = BD.orig[0].p, s0 = lastDup.src[0]; lastDup.dx = p.x - s0.x; lastDup.dy = p.y - s0.y;
    }
    commit();
  }
  BD = null; SNAPMARK = null; saveBoard(); cRender();
}
board.addEventListener('pointerup', endBoardDrag); board.addEventListener('pointercancel', endBoardDrag);
board.addEventListener('wheel', e => {
  e.preventDefault(); const r = board.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, w = toWorld(sx, sy);
  VIEW.z = Math.min(8, Math.max(0.1, VIEW.z * Math.exp(-e.deltaY * 0.0015))); VIEW.ox = sx - w.x * VIEW.z; VIEW.oy = sy - w.y * VIEW.z; cRender();
}, { passive: false });
document.addEventListener('keydown', e => {
  if ($('composeView').hidden || !$('helpOv').hidden || !$('prefOv').hidden || !$('infoOv').hidden) return;
  if (FITPICK && e.key === 'Escape') { e.preventDefault(); endFitPick('Fit cancelled.'); return; }
  const mod = e.ctrlKey || e.metaKey, L = selList();
  const t = e.target, typing = t.matches && t.matches('input[type=text],input[type=number],input[type=search],textarea,[contenteditable]');
  const inControl = t.closest && t.closest('input,select,textarea');
  if (typing || (inControl && !mod)) return;          // arrows on a slider move the slider; shortcuts still work
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('cRedo') : $('cUndo')).click(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); $('cRedo').click(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); $('cAll').click(); return; }
  if (!L.length || mod || e.altKey) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('cDel').click(); }
  else if (e.key === 'r' || e.key === 'R') { rotateSel((e.shiftKey ? -1 : 1) * +$('cStep').value); commit(); }
  else if (e.key === 'f' || e.key === 'F') $('cFlip').click();
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const st = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
    for (const p of L) { p.x += dx; p.y += dy; } commit(); }
});

/* ---------- drag from the palette ---------- */
function newPiece(d, x, y) { return { id: 'p' + (uid++), did: d.id, cut: 'full', x, y, rot: 0, s: CB.unit / d.edge, flip: false }; }
function startPaletteDrag(e, d) {
  e.preventDefault(); const gh = $('cGhost'); gh.src = d.src; gh.style.width = Math.min(160, CB.unit * 1.3) + 'px';
  let moved = false; const x0 = e.clientX, y0 = e.clientY;
  const move = ev => {
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4) moved = true; if (!moved) return;
    const r = board.getBoundingClientRect(), over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (over) { gh.hidden = true; const w = toWorld(ev.clientX - r.left, ev.clientY - r.top);
      GHOST = GHOST && GHOST.did === d.id ? Object.assign(GHOST, { x: w.x, y: w.y, rot: 0, s: CB.unit / d.edge }) : newPiece(d, w.x, w.y); snapPieces([GHOST], true); if (FITNOTE) cMsg(FITNOTE); }
    else { GHOST = null; SNAPMARK = null; gh.hidden = false; gh.style.left = (ev.clientX - gh.offsetWidth / 2) + 'px'; gh.style.top = (ev.clientY - gh.offsetHeight / 2) + 'px'; }
    cRender();
  };
  const up = ev => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); gh.hidden = true;
    if (!moved) { const r = board.getBoundingClientRect(), w = toWorld(r.width / 2, r.height / 2); const p = newPiece(d, w.x, w.y);
      PIECES.push(p); SEL.clear(); SEL.add(p.id); commit(); return; }
    if (GHOST) { PIECES.push(GHOST); SEL.clear(); SEL.add(GHOST.id); GHOST = null; SNAPMARK = null; commit(); }
    cRender();
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
}

/* ---------- export ---------- */
function download(blobOrUrl, name) {
  const a = document.createElement('a'); a.download = name;
  a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const safe = s => s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
function downloadTile(d) {
  const c = document.createElement('canvas'); c.width = d.w; c.height = d.h; c.getContext('2d').drawImage(d.img, 0, 0, d.w, d.h);
  c.toBlob(b => download(b, safe(d.name) + '.png'), 'image/png');
}
function captionLines() {
  const m = methodSummary(), out = [];
  for (const [k, e] of m) out.push(`${METHODS[k].label} (${e.n} piece${e.n > 1 ? 's' : ''})${e.details.size ? ': ' + [...e.details].join('; ') : ''}. ${plain(METHODS[k].cite)}`);
  if (out.length) out.unshift(m.size > 1 ? 'Methods (mixed):' : 'Method:');
  return out;
}
function boardBounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of PIECES) for (const q of worldPoly(p)) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  const m = CB.joints ? CB.groutW : 0; return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
}
$('cExpPng').onclick = () => {
  if (!PIECES.length) { cMsg('The board is empty.', true); return; }
  const b = boardBounds(), bw = b.x1 - b.x0, bh = b.y1 - b.y0, q = Math.min(4, 5000 / Math.max(bw, bh));
  const lines = $('cCaption').checked ? captionLines() : [];
  const W = Math.ceil(bw * q), fs = Math.max(13, Math.round(W / 90)), lh = Math.round(fs * 1.4);
  const wrapped = []; { const t = document.createElement('canvas').getContext('2d'); t.font = `${fs}px Georgia, serif`;
    for (const ln of lines) { let cur = ''; for (const w of ln.split(' ')) { const tryS = cur ? cur + ' ' + w : w; if (t.measureText(tryS).width > W - 2 * fs && cur) { wrapped.push(cur); cur = w; } else cur = tryS; } wrapped.push(cur); } }
  const capH = wrapped.length ? wrapped.length * lh + 2 * fs : 0;
  const c = document.createElement('canvas'); c.width = W; c.height = Math.ceil(bh * q) + capH; const x = c.getContext('2d');
  x.fillStyle = CB.bg; x.fillRect(0, 0, c.width, c.height); x.setTransform(q, 0, 0, q, -b.x0 * q, -b.y0 * q);
  for (const p of PIECES) drawPiece(x, p, 1, true);
  if (CB.joints && CB.groutW > 0) for (const p of PIECES) strokePoly(x, worldPoly(p), CB.grout, CB.groutW);
  if (capH) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fbf8f1'; x.fillRect(0, c.height - capH, W, capH);
    x.fillStyle = '#4a3f33'; x.font = `${fs}px Georgia, serif`; wrapped.forEach((ln, i) => x.fillText(ln, fs, c.height - capH + fs + (i + 0.8) * lh)); }
  c.toBlob(bl => download(bl, 'tiling.png'), 'image/png'); cMsg(`Exported ${c.width} × ${c.height} px.`);
};
$('cExpSvg').onclick = () => {
  if (!PIECES.length) { cMsg('The board is empty.', true); return; }
  const b = boardBounds(), used = [...new Set(PIECES.map(p => p.did))].map(dById), clips = new Set();
  const pngOf = d => { const c = document.createElement('canvas'); c.width = d.w; c.height = d.h; c.getContext('2d').drawImage(d.img, 0, 0, d.w, d.h); return c.toDataURL('image/png'); };
  const mosSvg = d => { const m = d.mosaic, P = mosaicPolys(m);
    return `<g id="img_${d.id}"><rect width="${m.W}" height="${m.H}" fill="${m.mortar}"/>` + P.map((q, i) => `<polygon points="${q.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(' ')}" fill="${mColour(m, i)}"/>`).join('') + '</g>'; };
  let defs = used.map(d => { if (d.mosaic) return mosSvg(d); const u = pngOf(d); return `<image id="img_${d.id}" width="${d.w}" height="${d.h}" xlink:href="${u}" href="${u}"/>`; }).join('\n');
  let body = '';
  for (const p of PIECES) {
    const d = dById(p.did), key = `${d.id}_${p.cut}`, pts = cutPoly(d, p.cut).map(([u, v]) => `${+u.toFixed(2)},${+v.toFixed(2)}`).join(' ');
    if (!clips.has(key)) { clips.add(key); defs += `\n<clipPath id="clip_${key}"><polygon points="${pts}"/></clipPath>`; }
    const tr = `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)}) scale(${(p.flip ? -p.s : p.s).toFixed(5)} ${p.s.toFixed(5)}) translate(${-d.w / 2} ${-d.h / 2})`;
    body += `<g transform="${tr}"><use xlink:href="#img_${d.id}" href="#img_${d.id}" clip-path="url(#clip_${key})"/>` +
      (CB.joints && CB.groutW > 0 ? `<polygon points="${pts}" fill="none" stroke="${CB.grout}" stroke-width="${CB.groutW}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : '') + `</g>\n`;
  }
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const meta = `<title>Tiling composed with Tessera (after Combinaisons ornementales, 1901)</title>\n<desc>${esc(captionLines().join('\n'))}</desc>\n<metadata>${esc(JSON.stringify(provenance()))}</metadata>\n`;
  const svg0 = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${b.x0.toFixed(2)} ${b.y0.toFixed(2)} ${(b.x1 - b.x0).toFixed(2)} ${(b.y1 - b.y0).toFixed(2)}" width="${Math.round(b.x1 - b.x0)}" height="${Math.round(b.y1 - b.y0)}">\n<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="${CB.bg}"/>\n<defs>\n${defs}\n</defs>\n${body}</svg>`;
  const svg = svg0.replace('>\n<rect', '>\n' + meta + '<rect');
  download(new Blob([svg], { type: 'image/svg+xml' }), 'tiling.svg'); cMsg('SVG exported: tiles as images, mosaics as vector stones, joints as vector outlines (useful as cutting lines).');
};
$('cExpSheet').onclick = () => {
  if (!DESIGNS.length) { cMsg('No saved tiles yet.', true); return; }
  const cell = 300, pad = 16, cols = Math.min(4, DESIGNS.length), rows = Math.ceil(DESIGNS.length / cols);
  const c = document.createElement('canvas'); c.width = cols * (cell + pad) + pad; c.height = rows * (cell + pad + 22) + pad; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '14px Georgia, serif'; x.fillStyle = '#5c4f3f'; x.textAlign = 'center';
  DESIGNS.forEach((d, i) => { const k = Math.min(cell / d.w, cell / d.h), cx = pad + (i % cols) * (cell + pad), cy = pad + Math.floor(i / cols) * (cell + pad + 22);
    x.drawImage(d.img, cx + (cell - d.w * k) / 2, cy + (cell - d.h * k) / 2, d.w * k, d.h * k); x.fillText(d.name, cx + cell / 2, cy + cell + 16); });
  c.toBlob(b => download(b, 'tile_sheet.png'), 'image/png');
};
/* project files: JSON with the tile images embedded, so a file reopens exactly */
$('cSaveProj').onclick = () => {
  const data = { format: 'combinaisons-mirror-tool', version: 2, app: 'Tessera ' + TESSERA_VERSION, saved: new Date().toISOString(),
    provenance: provenance(), designs: DESIGNS.map(({ img, ...d }) => d), pieces: PIECES, board: CB };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'mirror_tiles_project.json');
};
function provenance() {
  const m = methodSummary(), out = {};
  for (const [k, e] of m) out[k] = { label: METHODS[k].label, pieces: e.n, details: [...e.details], source: plain(METHODS[k].cite) };
  return out;
}
let fileMode = 'open';
$('cOpenProj').onclick = () => { fileMode = 'open'; $('cFile').value = ''; $('cFile').click(); };
$('cAddTiles').onclick = () => { fileMode = 'tiles'; $('cFile').value = ''; $('cFile').click(); };
$('cFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => {
    let data; try { data = JSON.parse(rd.result); } catch (err) { cMsg('That file is not valid JSON.', true); return; }
    if (!data || data.format !== 'combinaisons-mirror-tool' || !Array.isArray(data.designs)) { cMsg('That is not a project saved by this tool.', true); return; }
    const r = loadProject(data, fileMode);
    cMsg(fileMode === 'open' ? `Opened “${f.name}”: ${r.tiles} tiles, ${PIECES.length} pieces.` : `Added ${r.tiles} tile${r.tiles === 1 ? '' : 's'} from “${f.name}”.`);
  };
  rd.readAsText(f);
};
/* load a project (from a file, or the demo): its tiles join the library; 'open' also replaces the board */
/* the demo: a Ver Sacrum mosaic panel among mirror tiles; its tiles stay in the library when the workshop is cleared */
function demoData() { try { return window.TESSERA_DEMO ? JSON.parse(JSON.stringify(window.TESSERA_DEMO)) : null; } catch (e) { return null; } }   // a fresh copy each time
/* demo tiles kept in the library from an earlier visit are brought up to the current demo (newer images, the recorded set-up) */
function refreshDemoTiles(data) {
  data = data || demoData(); if (!data) return 0; let n = 0;
  for (const nd of data.designs) { const d = dById(nd.id); if (!d || !d.demo) continue;
    const mos = nd.mosaic ? cleanMosaic(nd.mosaic) : undefined, set = validSetup(nd.setup);
    if (d.src === nd.src && !!d.setup === !!set && !!d.mosaic === !!mos) continue;
    const k = d.edge / nd.edge; if (isFinite(k) && k > 0 && d.shape === nd.shape) for (const p of PIECES) if (p.did === d.id) p.s *= k;
    Object.assign(d, { name: nd.name, shape: nd.shape, w: nd.w, h: nd.h, edge: nd.edge, src: nd.src, bg: nd.bg, method: nd.method, mosaic: mos, setup: set });
    d.img = new Image(); d.img.onload = () => { cRender(); renderPalette(); }; d.img.src = d.src; n++; }
  if (n) { saveDesigns(); renderPalette(); cRender(); }
  return n;
}
function loadDemo() {
  const data = demoData(); if (!data) return; refreshDemoTiles(data);
  loadProject(data, 'open');
  const pd = DESIGNS.find(d => d.demo && d.mosaic && d.mosaic.panel);
  if (pd) { const m = JSON.parse(JSON.stringify(pd.mosaic)); if (m.shapeIn) { m.shape = m.shapeIn; delete m.shapeIn; } zLoad(m, pd.id); }
  workBar(); cMsg('The demo: a mosaic panel (Ver Sacrum, cut following the outlines) framed by mirror tiles into a rectangle. Click any piece; open the Mosaic maker tab to edit the mosaic.');
}
function workBar() {
  const demoOn = PIECES.some(p => { const d = dById(p.did); return d && d.demo; });
  $('cWorkTxt').innerHTML = demoOn ? '<b>This is the demo workshop.</b> <b>Clear the workshop</b> to start afresh; you can keep the demo’s tiles in Saved tiles or remove them.'
    : PIECES.length || Z.m ? 'Your workshop. <b>Clear the workshop</b> empties the board and the Mosaic maker tab, and asks whether to keep the library.' : 'An empty workshop: drag tiles from Saved tiles, make some in the Tile maker, or cut a mosaic. <b>Load the demo</b> to see an example.';
}
function armTwice(btn, label, fn) {
  if (btn.dataset.armed !== '1') { btn.dataset.label = btn.dataset.label || btn.textContent; btn.dataset.armed = '1'; btn.classList.add('armed'); btn.textContent = label;
    setTimeout(() => { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = btn.dataset.label; } }, 4000); return; }
  btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = btn.dataset.label; fn();
}
$('cWipe').onclick = () => { if (!PIECES.length && !Z.m && !DESIGNS.length) { cMsg('The workshop and the library are already empty.'); return; }
  const ask = $('cWipeAsk'), nDemo = DESIGNS.filter(d => d.demo).length;
  $('cWipeDemo').hidden = !nDemo || nDemo === DESIGNS.length; $('cWipeDemo').textContent = `Also remove the demo’s ${nDemo} tile${nDemo > 1 ? 's' : ''}`;
  $('cWipeAll').hidden = !DESIGNS.length; $('cWipeAll').textContent = nDemo === DESIGNS.length ? `Also remove the demo’s ${nDemo} tile${nDemo > 1 ? 's' : ''}` : `Also empty the whole library (${DESIGNS.length} tile${DESIGNS.length > 1 ? 's' : ''})`;
  ask.hidden = !ask.hidden; if (!ask.hidden) $('cWipeKeep').focus(); };
function wipeWorkshop(which) {           // which: 'none' | 'demo' | 'all' — tiles to take out of the library as well
  $('cWipeAsk').hidden = true;
  const gone = which === 'all' ? [...DESIGNS] : which === 'demo' ? DESIGNS.filter(d => d.demo) : [];
  PIECES = []; SEL.clear();
  for (const d of gone) { TRASH.set(d.id, d); DESIGNS.splice(DESIGNS.indexOf(d), 1); }
  if (gone.length) { saveDesigns(); renderPalette(); }
  commit(); cRender();
  if (Z.m) { if (Z.last) Z.undo.push(Z.last); Z.m = null; Z.last = ''; Z.linked = null; Z.sel.clear(); zSave(); zPanel(); zRender(); }
  workBar();
  cMsg(gone.length ? `Workshop cleared and ${gone.length} tile${gone.length > 1 ? 's' : ''} removed from the library. Undo (Ctrl+Z) brings the board and its tiles back; Load the demo restores the demo.`
    : 'Workshop cleared. Your tiles and mosaics are still in Saved tiles (Undo brings the board back).');
}
$('cWipeKeep').onclick = () => wipeWorkshop('none');
$('cWipeDemo').onclick = () => wipeWorkshop('demo');
$('cWipeAll').onclick = () => wipeWorkshop(DESIGNS.every(d => d.demo) ? 'demo' : 'all');
$('cDelShown').onclick = () => {
  const L = shownDesigns(), flt = $('cFilter'), what = flt.value === 'all' ? 'all saved tiles' : `the ${flt.options[flt.selectedIndex].text.replace(/ only$/, '').toLowerCase()}`;
  if (!L.length) { cMsg('There are no tiles shown to remove.'); return; }
  armTwice($('cDelShown'), `Click again: remove ${L.length} tile${L.length > 1 ? 's' : ''}`, () => {
    const ids = new Set(L.map(d => d.id)), n = PIECES.filter(p => ids.has(p.did)).length;
    if (n) { PIECES = PIECES.filter(p => !ids.has(p.did)); for (const id of [...SEL]) if (!PIECES.some(p => p.id === id)) SEL.delete(id); }
    for (const d of L) { TRASH.set(d.id, d); DESIGNS.splice(DESIGNS.indexOf(d), 1); }
    saveDesigns(); renderPalette(); if (n) commit(); else cRender(); workBar();
    cMsg(`Removed ${what} (${L.length} tile${L.length > 1 ? 's' : ''}${n ? `, and ${n} piece${n > 1 ? 's' : ''} from the board; Undo brings those back` : ''}).${L.some(d => d.demo) ? ' Load the demo restores the demo tiles.' : ''}`); }); };
$('cWipeNo').onclick = () => { $('cWipeAsk').hidden = true; };
$('cDemo').onclick = () => { if (PIECES.length) armTwice($('cDemo'), 'Replace the board?', loadDemo); else loadDemo(); };
function loadProject(data, mode) {
  const okD = data.designs.filter(d => d && typeof d.id === 'string' && CUTS[d.shape] && typeof d.src === 'string' && /^data:image\/(png|webp|jpeg);base64,/.test(d.src) && d.w > 0 && d.h > 0 && d.edge > 0);
  for (const d of okD) if (!dById(d.id)) addDesign({ id: d.id, name: String(d.name || 'tile').slice(0, 80), shape: d.shape, w: +d.w, h: +d.h, src: d.src, edge: +d.edge, mosaic: cleanMosaic(d.mosaic), bg: typeof d.bg === 'string' ? d.bg : undefined, demo: !!d.demo, setup: validSetup(d.setup),
      method: d.method && Array.isArray(d.method.keys) ? { keys: d.method.keys.filter(k => METHODS[k] && k !== 'unknown').slice(0, 4), detail: String(d.method.detail || '').slice(0, 300), sym: String(d.method.sym || '').slice(0, 40) } : undefined });
  if (mode === 'open') {
    const ids = new Set(DESIGNS.map(d => d.id));
    PIECES = (Array.isArray(data.pieces) ? data.pieces : []).filter(p => p && ids.has(p.did) && isFinite(p.x) && isFinite(p.y) && isFinite(p.s) && p.s > 0)
      .map(p => ({ id: 'p' + (uid++), did: p.did, cut: CUTS[dById(p.did).shape][p.cut] ? p.cut : 'full', x: +p.x, y: +p.y, rot: +p.rot || 0, s: +p.s, flip: !!p.flip }));
    if (data.board) for (const k of Object.keys(CB)) if (k in data.board && typeof data.board[k] === typeof CB[k]) CB[k] = data.board[k];
    SEL.clear(); syncBoardCtl(); commit(); fitBoard();
  }
  return { tiles: okD.length };
}
function fitBoard() {
  if (!PIECES.length) return; const { w, h } = bSize(), b = boardBounds();
  VIEW.z = Math.min(4, 0.9 * Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0))); VIEW.ox = w / 2 - VIEW.z * (b.x0 + b.x1) / 2; VIEW.oy = h / 2 - VIEW.z * (b.y0 + b.y1) / 2; cRender();
}
$('cFit').onclick = fitBoard;
if (inFrame) { ['cExpPng', 'cExpSvg', 'cExpSheet', 'cSaveProj'].forEach(id => $(id).disabled = true); $('cFrameNote').hidden = false; }

/* ---------- saving from the mirror view, switching views, restoring ---------- */
$('cSaveCur').onclick = () => { if (!S.orn || !S.orn.length) { cMsg('The Tile maker sheet is empty: open the Tile maker tab, add an ornament, then come back.', true); return; } const d = captureTile(); cMsg(d ? `Saved “${d.name}”.` : 'Parallelogram cells (oblique lattice) cannot be used in Compose.', !d); };
$('saveTile').onclick = () => { const d = captureTile(); $('saveTileMsg').textContent = d ? `Saved “${d.name}”: see the Compose tab.` : (latTileGeom && S.mode === 'lattice' && latTileGeom().latShape === 'para' && !latTileGeom().out ? 'Not saved: parallelogram cells (groups p1 and p2) cannot be saved as tiles in the Compose tab.' : 'Not saved: the tile is larger than the mirror view. Lower the Zoom (or the Cell size, or the mirror spacing).'); };
function showView(v) {
  document.querySelectorAll('#viewTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('mirrorView').hidden = v !== 'mirror'; $('composeView').hidden = v !== 'compose'; $('mosaicView').hidden = v !== 'mosaic';
  if (v === 'mosaic') { zPanel(); requestAnimationFrame(() => zFit()); return; }
  if (v === 'compose') { syncBoardCtl(); renderPalette(); cRender(); }
  else redraw(true);
}
document.querySelectorAll('#viewTabs button').forEach(b => b.onclick = () => showView(b.dataset.v));
