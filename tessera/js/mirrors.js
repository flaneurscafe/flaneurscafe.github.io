/* Tessera · Tile maker: angles, the source sheet, handles and the mirror view (planar unfolding) */
'use strict';

/* ---------- angle bookkeeping ---------- */
const N_ANG = [2, 3, 4, 5, 6, 8, 10, 12].map(n => ({ v: 180 / n, n }));
const K_ANG = [3, 4, 5, 6, 7, 8].map(k => ({ v: 360 / k, k }));
function near(a, b, tol) { return Math.abs(a - b) < tol; }
function analyse(a) {
  const n = Math.round(180 / a);
  if (n >= 1 && near(a, 180 / n, 0.05)) return { closed: true, n };
  const k = Math.round(360 / a);
  if (k >= 2 && near(a, 360 / k, 0.05)) return { closed: false, k };
  return { closed: false };
}
function snapAlpha(a) {
  if (!S.snap) return a;
  const n = Math.round(180 / a);
  for (let m = Math.max(1, n - 1); m <= n + 1; m++) if (near(a, 180 / m, 1.2)) return 180 / m;
  const k = Math.round(360 / a);
  if (k >= 3 && k <= 8 && near(a, 360 / k, 1.2)) return 360 / k;
  return a;
}

/* ---------- source sheet ---------- */
function cleanFilter() {
  const c = S.clean;
  return c ? `contrast(${1 + 0.5 * c}) saturate(${1 + 0.3 * c})` : 'none';
}
function renderSource() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.clearRect(0, 0, SW, SH);                       // transparent sheet: the paper colour is chosen where it is shown
  for (const o of S.orn) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.filter = cleanFilter();
    g.translate(o.x, o.y); g.rotate(rad(o.rot)); g.scale(o.s * (o.flip ? -1 : 1), o.s);
    g.drawImage(o.img, o.cx, o.cy, o.cw, o.ch, -o.cw / 2, -o.ch / 2, o.cw, o.ch);
    g.restore();
  }
}

/* ---------- handles ---------- */
function handles() {
  const O = S.O, h = [{ id: 'O', x: O.x, y: O.y, c: '#2f5d5a', shape: 'dot' }];
  if (S.mode === 'lattice') { const a = dir(S.lt); h.push({ id: 'cell', x: O.x + S.cell * a.x, y: O.y + S.cell * a.y, c: '#a3434f', shape: 'tri' }); return h; }
  if (S.mode === 'hinge') {
    const r = dir(S.beta), a = dir(S.beta + S.alpha / 2);
    h.push({ id: 'rot', x: O.x + 130 * r.x, y: O.y + 130 * r.y, c: '#b07a2a', shape: 'dia' });
    h.push({ id: 'open', x: O.x + 220 * a.x, y: O.y + 220 * a.y, c: '#a3434f', shape: 'tri' });
  } else {
    const t = dir(S.theta);
    h.push({ id: 'rot', x: O.x + 170 * t.x, y: O.y + 170 * t.y, c: '#b07a2a', shape: 'dia' });
    if (S.mode === 'parallel') {
      const n = dir(S.theta + 90);
      h.push({ id: 'dist', x: O.x + S.d * n.x - 90 * t.x, y: O.y + S.d * n.y - 90 * t.y, c: '#a3434f', shape: 'tri' });
    }
  }
  return h;
}
function drawHandle(ctx, h) {
  ctx.save(); ctx.translate(h.x, h.y);
  ctx.fillStyle = h.c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (h.shape === 'dot') ctx.arc(0, 0, 10, 0, 7);
  else if (h.shape === 'dia') { ctx.moveTo(0, -12); ctx.lineTo(12, 0); ctx.lineTo(0, 12); ctx.lineTo(-12, 0); ctx.closePath(); }
  else { ctx.moveTo(0, -12); ctx.lineTo(11, 9); ctx.lineTo(-11, 9); ctx.closePath(); }
  ctx.stroke(); ctx.fill(); ctx.restore();
}

/* mirror line with a hatched silvered back, drawn from p along direction a, length L; back side toward normal sgn */
function mirrorLine(ctx, p, a, L, backSign, from = 0) {
  const d = dir(a), n = dir(a + 90 * backSign);
  ctx.save();
  ctx.strokeStyle = 'rgba(176,122,42,.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let s = from + 6; s < L; s += 11) {
    const x = p.x + d.x * s, y = p.y + d.y * s;
    ctx.moveTo(x, y); ctx.lineTo(x + n.x * 7 + d.x * 4, y + n.y * 7 + d.y * 4);
  }
  ctx.stroke();
  ctx.strokeStyle = '#8a5a17'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x + d.x * from, p.y + d.y * from); ctx.lineTo(p.x + d.x * L, p.y + d.y * L); ctx.stroke();
  ctx.restore();
}

function renderSheet() {
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, SW, SH);
  sctx.drawImage(src, 0, 0);
  const O = S.O, L = 3000;
  if (S.mode === 'lattice') {
    const G = latGeom(), poly = G.asym;
    sctx.save(); sctx.beginPath(); sctx.rect(-L, -L, 2 * L, 2 * L);
    poly.forEach((q, i) => i ? sctx.lineTo(q.x, q.y) : sctx.moveTo(q.x, q.y)); sctx.closePath();
    sctx.fillStyle = 'rgba(60,45,25,.22)'; sctx.fill('evenodd'); sctx.restore();
    sctx.save(); sctx.beginPath(); poly.forEach((q, i) => i ? sctx.lineTo(q.x, q.y) : sctx.moveTo(q.x, q.y)); sctx.closePath();
    if (S.method === 'brewster') { sctx.strokeStyle = '#8a5a17'; sctx.lineWidth = 3; }
    else { sctx.strokeStyle = '#7a4a8c'; sctx.lineWidth = 1.6; sctx.setLineDash([6, 4]); }
    sctx.stroke(); sctx.restore();
    const o = S.orn[S.sel];
    if (o) { sctx.save(); sctx.translate(o.x, o.y); sctx.rotate(rad(o.rot)); sctx.setLineDash([5, 5]); sctx.strokeStyle = 'rgba(47,93,90,.7)'; sctx.lineWidth = 1.2;
      sctx.strokeRect(-o.cw * o.s / 2, -o.ch * o.s / 2, o.cw * o.s, o.ch * o.s); sctx.restore();
      const os = ornSym(o);
      if (os) { sctx.save(); sctx.strokeStyle = '#5d3a6c'; sctx.fillStyle = '#5d3a6c'; sctx.lineWidth = 1.4; sctx.setLineDash([3, 4]);
        for (const a of os.ax) { const u = dir(a); sctx.beginPath(); sctx.moveTo(os.P.x - u.x * 60, os.P.y - u.y * 60); sctx.lineTo(os.P.x + u.x * 60, os.P.y + u.y * 60); sctx.stroke(); }
        sctx.setLineDash([]); sctx.beginPath(); sctx.arc(os.P.x, os.P.y, 5, 0, 7); sctx.stroke(); sctx.beginPath(); sctx.arc(os.P.x, os.P.y, 1.8, 0, 7); sctx.fill(); sctx.restore(); } }
    if (snapNote) { sctx.save(); sctx.strokeStyle = '#a8691c'; sctx.lineWidth = 2.5; sctx.beginPath(); sctx.arc(snapNote.p.x, snapNote.p.y, 11, 0, 7); sctx.stroke();
      sctx.font = '15px Georgia, serif'; sctx.lineWidth = 4; sctx.strokeStyle = 'rgba(255,255,255,.9)'; sctx.fillStyle = '#5c3f12';
      sctx.strokeText(snapNote.text, snapNote.p.x + 16, snapNote.p.y - 12); sctx.fillText(snapNote.text, snapNote.p.x + 16, snapNote.p.y - 12); sctx.restore(); }
    for (const h of handles()) drawHandle(sctx, h);
    return;
  }
  // shade what is behind the mirrors
  sctx.save();
  sctx.beginPath(); sctx.rect(-L, -L, 2 * L, 2 * L);
  sctx.translate(O.x, O.y);
  if (S.mode === 'hinge') {
    sctx.rotate(rad(S.beta));
    sctx.moveTo(0, 0); sctx.arc(0, 0, L, rad(-S.alpha / 2), rad(S.alpha / 2)); sctx.closePath();
  } else {
    sctx.rotate(rad(S.theta));
    sctx.rect(-L, 0, 2 * L, S.mode === 'parallel' ? S.d : L);
  }
  sctx.fillStyle = 'rgba(60,45,25,.22)'; sctx.fill('evenodd');
  sctx.restore();
  // mirror lines
  if (S.mode === 'hinge') {
    mirrorLine(sctx, O, S.beta - S.alpha / 2, L, -1);
    mirrorLine(sctx, O, S.beta + S.alpha / 2, L, +1);
    // bisector
    const b = dir(S.beta);
    sctx.save(); sctx.setLineDash([4, 6]); sctx.strokeStyle = 'rgba(47,93,90,.6)'; sctx.lineWidth = 1.2;
    sctx.beginPath(); sctx.moveTo(O.x, O.y); sctx.lineTo(O.x + b.x * 130, O.y + b.y * 130); sctx.stroke(); sctx.restore();
  } else {
    const t = dir(S.theta), p0 = { x: O.x - t.x * L, y: O.y - t.y * L };
    mirrorLine(sctx, p0, S.theta, 2 * L, -1);
    if (S.mode === 'parallel') {
      const n = dir(S.theta + 90);
      mirrorLine(sctx, { x: p0.x + n.x * S.d, y: p0.y + n.y * S.d }, S.theta, 2 * L, +1);
    }
  }
  // selected ornament outline
  const o = S.orn[S.sel];
  if (o) {
    sctx.save(); sctx.translate(o.x, o.y); sctx.rotate(rad(o.rot));
    sctx.setLineDash([5, 5]); sctx.strokeStyle = 'rgba(47,93,90,.7)'; sctx.lineWidth = 1.2;
    sctx.strokeRect(-o.cw * o.s / 2, -o.ch * o.s / 2, o.cw * o.s, o.ch * o.s);
    sctx.restore();
  }
  for (const h of handles()) drawHandle(sctx, h);
}

/* ---------- mirror view (planar unfolding) ---------- */
function onWhite(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, RES, RES); c.drawImage(clean, 0, 0); }
function setView(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(RES / 2, RES / 2); ctx.scale(S.zoom, S.zoom); ctx.translate(-S.O.x, -S.O.y);
}
function renderResult() {
  let ctx = cctx; const O = S.O, L = 4000 / S.zoom + 2000;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, RES, RES);
  if (S.mode === 'lattice') {
    const G = renderLattice(ctx);
    onWhite(rctx); PIX = null;
    if (S.showLines) drawSymOverlay(rctx, G);
    rctx.save(); setView(rctx); rctx.strokeStyle = S.method === 'brewster' ? '#8a5a17' : '#7a4a8c'; rctx.lineWidth = 2 / S.zoom;
    rctx.setLineDash(S.method === 'brewster' ? [] : [6 / S.zoom, 4 / S.zoom]);
    rctx.beginPath(); G.asym.forEach((q, i) => i ? rctx.lineTo(q.x, q.y) : rctx.moveTo(q.x, q.y)); rctx.closePath(); if (S.showLines) rctx.stroke(); rctx.restore();
    return;
  }
  const lines = []; let seam = null;
  if (S.mode === 'hinge') {
    const a = S.alpha, N = Math.ceil(180 / a) + 1;
    for (let j = -N; j <= N; j++) {
      const lo = Math.max(j * a - a / 2, -180), hi = Math.min(j * a + a / 2, 180);
      if (hi - lo < 1e-9) continue;
      ctx.save(); setView(ctx);
      ctx.translate(O.x, O.y); ctx.rotate(rad(S.beta));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, rad(lo), rad(hi)); ctx.closePath(); ctx.clip();
      if (j % 2 === 0) ctx.rotate(rad(j * a));
      else { const g2 = rad(j * a); ctx.transform(Math.cos(g2), Math.sin(g2), Math.sin(g2), -Math.cos(g2), 0, 0); }
      ctx.rotate(-rad(S.beta)); ctx.translate(-O.x, -O.y);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
      const b = j * a + a / 2;
      if (b > -180 + 1e-6 && b < 180 - 1e-6) lines.push({ ang: S.beta + b, real: j === 0 || j === -1 });
    }
    if (!analyse(a).closed) seam = S.beta + 180;
  } else {
    const d = S.mode === 'parallel' ? S.d : 1e9;
    const reach = (RES / 2) / S.zoom * 1.5;
    const N = S.mode === 'parallel' ? Math.ceil(reach / d) + 1 : 1;
    for (let j = -N; j <= N; j++) {
      if (S.mode === 'single' && j > 0) break;
      ctx.save(); setView(ctx);
      ctx.translate(O.x, O.y); ctx.rotate(rad(S.theta));
      ctx.beginPath();
      if (S.mode === 'single') ctx.rect(-L, j === 0 ? 0 : -L, 2 * L, L);
      else ctx.rect(-L, j * d, 2 * L, d);
      ctx.clip();
      if (S.mode === 'single') { if (j === -1) ctx.transform(1, 0, 0, -1, 0, 0); }
      else if (j % 2 === 0) ctx.translate(0, j * d);
      else ctx.transform(1, 0, 0, -1, 0, (j + 1) * d);
      ctx.rotate(-rad(S.theta)); ctx.translate(-O.x, -O.y);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
      if (S.mode === 'parallel') lines.push({ off: j * d, real: j === 0 || j === 1 });
    }
    if (S.mode === 'single') lines.push({ off: 0, real: true });
  }
  // copy the clean unfolding to the visible canvas, then draw overlays on top
  onWhite(rctx); ctx = rctx; PIX = null;
  if (S.showLines) {
    ctx.save(); setView(ctx); ctx.lineWidth = 1.4 / S.zoom;
    for (const l of lines) {
      ctx.strokeStyle = l.real ? 'rgba(138,90,23,.75)' : 'rgba(138,90,23,.28)';
      ctx.setLineDash(l.real ? [] : [6 / S.zoom, 6 / S.zoom]);
      ctx.beginPath();
      if (l.ang !== undefined) { const v = dir(l.ang); ctx.moveTo(O.x, O.y); ctx.lineTo(O.x + v.x * L, O.y + v.y * L); }
      else { const t = dir(S.theta), n = dir(S.theta + 90);
        const px = O.x + n.x * l.off, py = O.y + n.y * l.off;
        ctx.moveTo(px - t.x * L, py - t.y * L); ctx.lineTo(px + t.x * L, py + t.y * L); }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (seam !== null && S.showSeam) {
    ctx.save(); setView(ctx); const v = dir(seam);
    ctx.strokeStyle = 'rgba(200,30,40,.85)'; ctx.lineWidth = 2.2 / S.zoom; ctx.setLineDash([9 / S.zoom, 6 / S.zoom]);
    ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(O.x + v.x * L, O.y + v.y * L); ctx.stroke();
    ctx.restore();
  }
  if (S.mode === 'hinge') { ctx.save(); setView(ctx); ctx.fillStyle = '#2f5d5a';
    ctx.beginPath(); ctx.arc(O.x, O.y, 4 / S.zoom, 0, 7); ctx.fill(); ctx.restore(); }
}
