/* Tessera · Frieze maker: bands that repeat in one direction (the seven frieze groups), printed borders of the two
   books, corners by the group's rule, frames around a rectangle, and the tile set of a frieze */
'use strict';

/* ---------- the seven frieze groups. Names: J. H. Conway (The Symmetries of Things, 2008), orbifold symbol, IUC.
   A frieze is built from one motif placed in a slot of width s (motif + spacing), in band coordinates
   (x along the band, y across it, 0 at the outer edge, h at the inner edge). ops: the copies of the motif in one
   period P; 'mir' = mirrors across the band at multiples of P/2 (then a 45° mitre closes a corner seamlessly) ---------- */
const I0 = [1, 0, 0, 1, 0, 0];
const FZG = {
  p1:   { name: 'hop',            orb: '∞∞',  half: false, mir: false, P: 1, ops: (s, h) => [I0],
          desc: 'translations only: the motif repeats, all facing the same way' },
  p11g: { name: 'step',           orb: '∞×',  half: true,  mir: false, P: 2, ops: (s, h) => [I0, [1, 0, 0, -1, s, h]],
          desc: 'a glide reflection: the motif and its mirror image across the centre line, in turn, half a period apart' },
  p1m1: { name: 'sidle',          orb: '∗∞∞', half: false, mir: true,  P: 2, ops: (s, h) => [I0, [-1, 0, 0, 1, 2 * s, 0]],
          desc: 'mirrors across the band: the motif and its mirror image side by side' },
  p11m: { name: 'jump',           orb: '∞∗',  half: true,  mir: false, P: 1, ops: (s, h) => [I0, [1, 0, 0, -1, 0, h]],
          desc: 'a mirror along the centre line: the motif above, its reflection below' },
  p2:   { name: 'spinning hop',   orb: '22∞', half: true,  mir: false, P: 2, ops: (s, h) => [I0, [-1, 0, 0, -1, 2 * s, h]],
          desc: 'half-turns about points on the centre line' },
  p2mg: { name: 'spinning sidle', orb: '2∗∞', half: true,  mir: true,  P: 2, ops: (s, h) => [I0, [1, 0, 0, -1, s, h], [-1, 0, 0, 1, 2 * s, 0], [-1, 0, 0, -1, s, h]],
          desc: 'mirrors across the band and half-turns between them, with a glide along the centre line' },
  p2mm: { name: 'spinning jump',  orb: '∗22∞', half: true, mir: true,  P: 2, ops: (s, h) => [I0, [1, 0, 0, -1, 0, h], [-1, 0, 0, 1, 2 * s, 0], [-1, 0, 0, -1, 2 * s, h]],
          desc: 'mirrors across and along the band, half-turns where they cross: the most symmetric frieze' },
};
/* each op is an isometry of the band as a canvas transform [a, b, c, d, e, f] (x' = a·x + c·y + e, y' = b·x + d·y + f),
   applied to the motif drawn in the first slot: glide (x + s, mirrored in the centre line y = h/2), mirror across the
   band at x = s, mirror in the centre line, half-turn about a point of the centre line */
const FZ_ORDER = ['p1', 'p11g', 'p1m1', 'p11m', 'p2', 'p2mg', 'p2mm'];
const FZ = { src: 'motif', group: 'p1m1', motif: null, label: '', lib: null, printed: null, scale: 0.86, gap: 0.12, dy: 0,
  rot: 0, bg: '#f3ead6', rules: true, ruleCol: '#6b5a44', view: 'strip', nW: 10, nH: 7, corner: 'alike', block: 'mirror',
  blockImg: null, blockLabel: '', grasset: null, filter: 'all', BH: 200, geo: 'zigzag', geoR: 1, geoW: 0.06, ink: '#2f5d5a', mirrorPos: 0 };
const FZImg = {};
function fzLoad(url) { if (!FZImg[url]) FZImg[url] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = e => { delete FZImg[url]; rej(e); }; im.src = url; }); return FZImg[url]; }
const fzMsg = (t, warn) => { const e = $('fzStatus'); e.textContent = t; e.style.color = warn ? 'var(--rose)' : 'var(--muted)'; };
const fzGroup = () => FZ.src === 'printed' ? (FZ.printed ? FZ.printed.group : 'p1') : FZ.src === 'geo' ? GEO[FZ.geo].g : FZ.group;
const fzMirror = () => FZG[fzGroup()].mir;
const fzMitre = () => FZ.corner !== 'block';             // 'alike' and 'mitre': mirrors at the corners             // mirrors at the corners unless square blocks are chosen
/* auto = the default until the corners are chosen by hand: mirrors where the band has mirrors across it, blocks where it runs one way */

/* ---------- geometric friezes: the classic bands, at least one for each of the seven groups. Each draws one period
   (width P) of a band of height h in ink on the ground; mirror groups put a mirror at x = 0 and x = P/2, so the
   frame's mitres fall on mirrors. r: the default period / height ratio ---------- */
const GEO = {
  sawtooth: { name: 'Sawtooth', g: 'p1', r: 0.8, draw(x, P, h, m) { x.beginPath(); x.moveTo(0, h - m); x.lineTo(P, h - m); x.lineTo(P, m); x.closePath(); x.fill(); } },
  wave:     { name: 'Running scroll (Vitruvian wave)', g: 'p1', r: 1.6, line: true, draw(x, P, h, m) { const c = h * .5, R = h * .26;
              x.beginPath(); x.moveTo(0, h - m); x.bezierCurveTo(P * .28, h - m, P * .22, c - R, P * .5, c - R); x.arc(P * .5, c, R, -Math.PI / 2, 0);
              x.bezierCurveTo(P * .5 + R, c + R * 1.3, P * .8, h - m, P, h - m); x.stroke();
              x.beginPath(); x.arc(P * .5, c, R, 0, Math.PI * .95); x.stroke(); x.beginPath(); x.arc(P * .5 - R * .25, c, R * .55, Math.PI, Math.PI * 2.3); x.stroke(); } },
  teeth:    { name: 'Offset teeth', g: 'p11g', r: 1.2, draw(x, P, h, m) { const g = h * .04;
              x.beginPath(); x.moveTo(0, m); x.lineTo(P / 2, m); x.lineTo(0, h / 2 - g); x.closePath(); x.fill();
              x.beginPath(); x.moveTo(P / 2, h - m); x.lineTo(P, h - m); x.lineTo(P / 2, h / 2 + g); x.closePath(); x.fill(); } },
  dentils:  { name: 'Dentils', g: 'p1m1', r: 0.75, draw(x, P, h, m) { x.fillRect(-P, m, 3 * P, h * .16); x.fillRect(P * .22, m + h * .22, P * .56, h * .5); } },
  scallops: { name: 'Scallops (arcades)', g: 'p1m1', r: 1.1, line: true, draw(x, P, h, m) { x.beginPath(); x.moveTo(-P, m); x.lineTo(2 * P, m); x.stroke();
              x.beginPath(); x.ellipse(P / 2, m, P / 2, h - 2 * m, 0, 0, Math.PI); x.stroke(); x.beginPath(); x.ellipse(P / 2, m, P * .28, (h - 2 * m) * .55, 0, 0, Math.PI); x.stroke(); } },
  chevrons: { name: 'Chevrons', g: 'p11m', r: 0.7, line: true, draw(x, P, h, m) { x.beginPath(); x.moveTo(P * .2, m); x.lineTo(P * .75, h / 2); x.lineTo(P * .2, h - m); x.stroke(); } },
  meander:  { name: 'Meander (Greek key)', g: 'p2', r: 1, line: true, sq: true, draw(x, P, h, m) { const u = P / 4, v = (h - 2 * m) / 4, Y = k => m + k * v;
              x.beginPath(); x.moveTo(0, Y(4)); x.lineTo(0, Y(0)); x.lineTo(3 * u, Y(0)); x.lineTo(3 * u, Y(2)); x.lineTo(u, Y(2)); x.lineTo(u, Y(4)); x.lineTo(4 * u, Y(4)); x.stroke(); } },
  cord:     { name: 'S-scrolls (cord)', g: 'p2', r: 0.6, line: true, draw(x, P, h, m) { x.beginPath(); x.moveTo(P * .1, h * .2); x.bezierCurveTo(P * 1.1, h * .15, -P * .1, h * .85, P * .9, h * .8); x.stroke(); } },
  zigzag:   { name: 'Zigzag', g: 'p2mg', r: 1, line: true, draw(x, P, h, m) { x.beginPath(); x.moveTo(-P / 2, h - m); x.lineTo(0, m); x.lineTo(P / 2, h - m); x.lineTo(P, m); x.lineTo(1.5 * P, h - m); x.stroke(); } },
  checker:  { name: 'Chequer, two rows', g: 'p2mg', r: 1, draw(x, P, h, m) { const H = (h - 2 * m) / 2; x.fillRect(-P / 4, m, P / 2, H); x.fillRect(P / 4, m + H, P / 2, H); x.fillRect(3 * P / 4, m, P / 2, H); } },
  beads:    { name: 'Bead and reel', g: 'p2mm', r: 0.9, draw(x, P, h, m) { const c = h / 2, R = (h - 2 * m) * .36;
              x.beginPath(); x.ellipse(P / 2, c, Math.min(R, P * .3), R, 0, 0, 2 * Math.PI); x.fill(); x.beginPath(); x.ellipse(0, c, P * .1, R * .45, 0, 0, 2 * Math.PI); x.fill(); } },
  guilloche:{ name: 'Guilloche', g: 'p2mm', r: 1.2, line: true, draw(x, P, h, m) { const c = h / 2, A = (h - 2 * m) / 2 * .92;
              for (const s of [1, -1]) { x.beginPath(); for (let i = -40; i <= 120; i++) { const X = i * P / 80; x.lineTo(X, c + s * A * Math.cos(Math.PI * X / P)); } x.stroke(); }
              x.beginPath(); x.arc(0, c, A * .45, 0, 2 * Math.PI); x.fill(); } },
};
const GEO_ORDER = ['sawtooth', 'wave', 'teeth', 'dentils', 'scallops', 'chevrons', 'meander', 'cord', 'zigzag', 'checker', 'beads', 'guilloche'];
function fzGeoUnit(h) {
  const G = GEO[FZ.geo], P = Math.max(8, Math.round(h * FZ.geoR)), c = document.createElement('canvas'); c.width = P; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = FZ.bg; x.fillRect(0, 0, P, h);
  const m = FZ.rules ? h * .12 : h * .06, lw = Math.max(1.5, h * FZ.geoW);
  x.fillStyle = x.strokeStyle = FZ.ink; x.lineWidth = lw; x.lineJoin = G.sq ? 'miter' : 'round'; x.lineCap = G.sq ? 'square' : 'round';
  for (const k of [-1, 0, 1]) { x.save(); x.translate(k * P, 0); G.draw(x, P, h, m + (G.line ? lw / 2 : 0)); x.restore(); }
  return c;
}
/* ---------- one period of the band, as a canvas of height BH ---------- */
function fzUnit() {
  const h = FZ.src === 'motif' && FZG[FZ.group].half ? 2 * FZ.BH : FZ.BH;   // two-row groups: twice as tall, so the motif keeps its resolution
  if (FZ.src === 'geo') { const c = fzGeoUnit(h); if (FZ.rules) { const x = c.getContext('2d'), t = Math.max(2, h * 0.025); x.fillStyle = FZ.ruleCol; x.fillRect(0, t, c.width, t); x.fillRect(0, h - 2 * t, c.width, t); } return c; }
  if (FZ.src === 'printed') {
    const im = FZ.printed && FZ.printed.img; if (!im) return null;
    const w = Math.max(4, Math.round(im.width * h / im.height)), c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = FZ.bg; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); return c;
  }
  const m = FZ.motif; if (!m) return null;
  const G = FZG[FZ.group], mh = FZ.scale * (G.half ? h / 2 : h) * 0.98;
  const rr = rad(FZ.rot), cs = Math.abs(Math.cos(rr)), sn = Math.abs(Math.sin(rr));
  const mw0 = mh * m.width / m.height, bw = mw0 * cs + mh * sn, bh = mw0 * sn + mh * cs, k = Math.min(1, mh / bh);  // rotated box fits the height
  const mw = mw0 * k, mhh = mh * k, boxW = bw * k;
  const s = Math.max(4, boxW * (1 + FZ.gap)), P = s * G.P, W = Math.max(4, Math.round(P));
  const c = document.createElement('canvas'); c.width = W; c.height = h; const x = c.getContext('2d');
  x.fillStyle = FZ.bg; x.fillRect(0, 0, W, h);
  const cy0 = G.half ? h / 4 + FZ.dy * h / 4 : h / 2 + FZ.dy * h / 2;     // motif centre (dy: −1 … 1 moves it up or down)
  const sx = W / P;                                                       // round the period to whole pixels
  for (const op of G.ops(s, h)) for (const rep of [-1, 0, 1]) {         // neighbours too, for motifs that cross the unit's edge
    x.save(); x.scale(sx, 1); x.translate(rep * P, 0); x.transform(...op);
    x.translate(s / 2, cy0); x.rotate(rr); x.drawImage(m, -mw / 2, -mhh / 2, mw, mhh); x.restore();
  }
  if (FZ.rules) { x.fillStyle = FZ.ruleCol; const t = Math.max(2, h * 0.025); x.fillRect(0, t, W, t); x.fillRect(0, h - 2 * t, W, t); }
  return c;
}
/* a band of length L (px, along the outer edge) drawn from phase phi (px of the unit), stretched by sx */
function fzBand(ctx, U, L, phi, sx) {
  const P = U.width * sx; let x0 = -((phi * sx) % P); if (x0 > 0) x0 -= P;
  for (let x = x0; x < L; x += P) ctx.drawImage(U, x, 0, P + 0.6, U.height);
}
/* ---------- corners ---------- */
function fzBlock(U) {           // a corner square, h × h, for the top-left corner
  const h = U.height, c = document.createElement('canvas'); c.width = c.height = h; const x = c.getContext('2d');
  x.fillStyle = FZ.bg; x.fillRect(0, 0, h, h);
  const b = FZ.block;
  if (b === 'grasset' && FZ.grasset && FZ.grasset.blk) { x.drawImage(FZ.grasset.blk, 0, 0, h, h); return c; }
  if (b === 'orn' && FZ.blockImg) { const im = FZ.blockImg, k = 0.86 * h / Math.max(im.width, im.height);
    x.drawImage(im, (h - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k); }
  else if (b === 'mirror') {      // Verneuil's corner mirror applied to a square of the band (the fullest one), mirrored on its diagonal
    const L = 3 * U.width + h, sq = document.createElement('canvas'); sq.width = L; sq.height = h; fzBand(sq.getContext('2d'), U, L, 0, 1);
    const px = sq.getContext('2d').getImageData(0, 0, L, h).data, bg = parseInt(FZ.bg.slice(1), 16), br = bg >> 16, bgg = (bg >> 8) & 255, bb = bg & 255;
    const col = new Float32Array(L); for (let X = 0; X < L; X++) { let n = 0; for (let Y = 0; Y < h; Y += 3) { const i = (Y * L + X) * 4; if (px[i + 3] > 40 && Math.abs(px[i] - br) + Math.abs(px[i + 1] - bgg) + Math.abs(px[i + 2] - bb) > 60) n++; } col[X] = n; }
    let best = 0, bx = 0, run = 0; for (let X = 0; X < L; X++) { run += col[X] - (X >= h ? col[X - h] : 0); if (X >= h - 1 && X - h + 1 <= U.width && run > best) { best = run; bx = X - h + 1; } }
    x.save(); x.beginPath(); x.moveTo(0, 0); x.lineTo(h, 0); x.lineTo(h, h); x.closePath(); x.clip(); x.drawImage(sq, bx, 0, h, h, 0, 0, h, h); x.restore();
    x.save(); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, h); x.lineTo(h, h); x.closePath(); x.clip(); x.transform(0, 1, 1, 0, 0, 0); x.drawImage(sq, bx, 0, h, h, 0, 0, h, h); x.restore();
  }
  if ((FZ.src === 'motif' && FZ.rules) || b === 'plain') { x.strokeStyle = FZ.ruleCol; x.lineWidth = Math.max(2, h * 0.025); const t = Math.max(2, h * 0.025) * 1.5; x.strokeRect(t, t, h - 2 * t, h - 2 * t); }
  return c;
}
/* ---------- a frame around a rectangle: outer size W × H band heights. Sides run clockwise, the band's top edge outwards.
   Mitre: every side holds a whole number of half-periods, the phase carried on from side to side, so each 45° join is a
   mirror line of the band (Verneuil's third mirror). Block: a square in each corner, every side a whole number of periods. ---------- */
/* the band drawn from x0 to x1 (px), with band position phi (px) at x = 0 */
function fzBandSpan(ctx, U, x0, x1, phi, sx) {
  const P = U.width * sx; let x = -phi * sx; x -= Math.ceil((x - x0) / P) * P;
  for (; x < x1; x += P) ctx.drawImage(U, x, 0, P + 0.6, U.height);
}
/* the fewest repeats a side can have: with mirrors the side must be longer than its two corner triangles */
const fzMinRepeats = (U, mirror) => mirror ? Math.max(0.5, Math.ceil(2.2 * U.height / (U.width / 2)) / 2) : 1;
function fzFrame(U, scale = 1) {
  const h = U.height, P = U.width, mitre = fzMitre();
  const c = document.createElement('canvas'), x = c.getContext('2d'), info = [];
  if (mitre) {
    /* Verneuil's corners: a mirror on the diagonal of every corner. The top band is the only one drawn; each other
       side is its image in the mirrors (right = top reflected at the top-right corner, bottom = right reflected at the
       bottom-right corner, left = bottom reflected at the bottom-left corner). Every corner is then a mirror line,
       seamless for any band. The four reflections together slide the band by 2(H − W), so the frame closes at the top
       left only when W − H is a whole number of half repeats. The size is set in repeats (halves allowed), so it always
       closes: nothing is rounded or stretched. A side shorter than the corners need is shown at its shortest. */
    const nMin = fzMinRepeats(U, true), nW = Math.max(nMin, FZ.nW), nH = Math.max(nMin, FZ.nH);
    const W = Math.round(nW * P), H = Math.round(nH * P);
    const phi = (FZ.mirrorPos || 0) * P;
    c.width = Math.round(W * scale); c.height = Math.round(H * scale); x.scale(scale, scale); x.fillStyle = FZ.bg; x.fillRect(0, 0, W, H);
    const clip = pts => { x.beginPath(); pts.forEach(([a, b], n) => n ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.clip(); };
    const span = [-(W + H) * 2, (W + H) * 2];
    const e = 1.5, sides = [
      // each side overlaps the corner diagonals by e px: the two sides are mirror images there, so the overlap is invisible
      // and no anti-aliased hairline shows along the mitre
      { pts: [[-e, 0], [W + e, 0], [W - h + e, h], [h - e, h]], m: [1, 0, 0, 1, 0, 0] },                       // top
      { pts: [[W, -e], [W, H + e], [W - h, H - h + e], [W - h, h - e]], m: [0, -1, -1, 0, W, W] },             // right: mirror x + y = W
      { pts: [[W + e, H], [-e, H], [h - e, H - h], [W - h + e, H - h]], m: [-1, 0, 0, -1, 2 * W - H, H] },      // bottom
      { pts: [[0, H + e], [0, -e], [h, h - e], [h, H - h + e]], m: [0, 1, 1, 0, 0, 2 * H - 2 * W] },            // left
    ];
    if (FZ.corner === 'alike') {
      /* four corners alike: every side is mirrored at its middle as well, so each corner shows the band running out from
         the same point on both arms. Any size closes (the middle mirror takes up the difference). */
      for (const [L, ox, oy, a] of [[W, 0, 0, 0], [H, W, 0, 90], [W, W, H, 180], [H, 0, H, 270]]) for (const half of [0, 1]) {
        x.save(); x.translate(ox, oy); x.rotate(rad(a));
        if (half) { x.translate(L, 0); x.scale(-1, 1); }
        clip([[-e, 0], [L / 2 + 0.5, 0], [L / 2 + 0.5, h], [h - e, h]]); fzBandSpan(x, U, -h, L / 2 + h, phi, 1); x.restore();
      }
    } else for (const sd of sides) { x.save(); clip(sd.pts); x.transform(...sd.m); fzBandSpan(x, U, span[0], span[1], phi, 1); x.restore(); }
    info.push({ n: nW, st: 1 }, { n: nH, st: 1 });
    return { c, info, W, H, h, mitre: true, short: nW > FZ.nW || nH > FZ.nH, nMin };
  }
  /* corner blocks: every side is the same band turned clockwise (a one-way band keeps its direction all round),
     whole repeats between the blocks, as many as you set: nothing is stretched */
  const st = 1, nW = Math.max(1, Math.round(FZ.nW)), nH = Math.max(1, Math.round(FZ.nH));
  const W = Math.round(nW * P + 2 * h), H = Math.round(nH * P + 2 * h);
  c.width = Math.round(W * scale); c.height = Math.round(H * scale); x.scale(scale, scale); x.fillStyle = FZ.bg; x.fillRect(0, 0, W, H);
  const blk = fzBlock(U);
  for (const [L, n, ox, oy, a] of [[W, nW, 0, 0, 0], [H, nH, W, 0, 90], [W, nW, W, H, 180], [H, nH, 0, H, 270]]) {
    x.save(); x.translate(ox, oy); x.rotate(rad(a));
    const Ls = L - 2 * h;
    x.save(); x.translate(h, 0); x.beginPath(); x.rect(0, 0, Ls, h); x.clip(); fzBand(x, U, Ls, 0, st); x.restore();
    x.drawImage(blk, 0, 0); info.push({ n, st }); x.restore();
  }
  return { c, info, W, H, h, mitre: false, short: false };
}
/* ---------- the tile set: one period, half a period (mirror groups: cut on a mirror), the corner ---------- */
function fzSet(U) {
  const h = U.height, P = U.width, out = [{ name: 'repeat unit', c: U }];
  if (fzMirror()) { const c = document.createElement('canvas'); c.width = Math.round(P / 2); c.height = h; c.getContext('2d').drawImage(U, 0, 0); out.push({ name: 'half unit', c }); }
  if (!fzMitre()) { const k = document.createElement('canvas'); k.width = k.height = h; k.getContext('2d').drawImage(fzBlock(U), 0, 0); out.push({ name: 'corner block', c: k }); return out; }
  /* mirror corners: the corners as they stand in the frame, each turned to the top-left position; identical ones once */
  const F = fzFrame(U), W = F.W, H = F.H, sq = (sx, sy, turn) => { const k = document.createElement('canvas'); k.width = k.height = h; const x = k.getContext('2d');
    x.translate(h / 2, h / 2); x.rotate(-turn * Math.PI / 2); x.drawImage(F.c, sx, sy, h, h, -h / 2, -h / 2, h, h); return k; };
  const cs = [['top left', sq(0, 0, 0)], ['top right', sq(W - h, 0, 1)], ['bottom right', sq(W - h, H - h, 2)], ['bottom left', sq(0, H - h, 3)]];
  const px = k => k.getContext('2d').getImageData(0, 0, h, h).data, kept = [];
  for (const [n, k] of cs) { const d = px(k); if (kept.some(([, , e]) => { let s2 = 0; for (let i = 0; i < d.length; i += 16) s2 += Math.abs(d[i] - e[i]) + Math.abs(d[i + 1] - e[i + 1]); return s2 / (d.length / 16) < 6; })) continue; kept.push([n, k, d]); }
  kept.forEach(([n, k]) => out.push({ name: kept.length > 1 ? 'corner, ' + n : 'mirror corner', c: k }));
  if (!fzMirror()) {            // a one-way band runs reversed along some sides: its mirror image as a tile too
    const r = document.createElement('canvas'); r.width = P; r.height = h; const x = r.getContext('2d'); x.translate(P, 0); x.scale(-1, 1); x.drawImage(U, 0, 0); out.splice(1, 0, { name: 'repeat, mirrored', c: r });
    if (FZ.corner === 'alike') { const m = document.createElement('canvas'); m.width = P; m.height = h; const y = m.getContext('2d'), ph = (FZ.mirrorPos || 0) * P;
      y.save(); y.beginPath(); y.rect(0, 0, P / 2, h); y.clip(); fzBandSpan(y, U, 0, P / 2, ph + P / 2, 1); y.restore();
      y.save(); y.translate(P, 0); y.scale(-1, 1); y.beginPath(); y.rect(0, 0, P / 2, h); y.clip(); fzBandSpan(y, U, 0, P / 2, ph + P / 2, 1); y.restore();
      out.push({ name: 'middle of a side', c: m }); }
  }
  return out;
}
/* ---------- drawing ---------- */
const fzc = $('fzCanvas'), fzx = fzc.getContext('2d');
let fzPend = false;
function fzRender() { if ($('friezeView').hidden || fzPend) return; fzPend = true; requestAnimationFrame(() => { fzPend = false; fzDraw(); }); }
function fzMarks(x, U, k, n) {   // symmetry elements of the group over n periods (strip view)
  const G = FZG[fzGroup()], h = U.height * k, P = U.width * k;
  x.save(); x.lineWidth = 1.5; x.setLineDash([6, 5]);
  for (let i = 0; i <= n * 2; i++) {
    const X = i * P / 2;
    if (G.mir) { x.strokeStyle = '#b43c3c'; x.beginPath(); x.moveTo(X, -8); x.lineTo(X, h + 8); x.stroke(); }
  }
  if (['p11m', 'p2mm'].includes(fzGroup())) { x.strokeStyle = '#b43c3c'; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(n * P, h / 2); x.stroke(); }
  if (['p11g', 'p2mg'].includes(fzGroup())) { x.setLineDash([3, 6]); x.lineWidth = 4; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(n * P, h / 2); x.stroke(); x.lineWidth = 2; x.strokeStyle = '#d9a33a'; x.stroke(); }
  x.setLineDash([]);
  if (['p2', 'p2mg', 'p2mm'].includes(fzGroup())) {
    const off = fzGroup() === 'p2mg' ? P / 4 : 0;
    for (let i = 0; i <= n * 2; i++) { const X = i * P / 2 + off; if (X > n * P) break; x.fillStyle = '#d9a33a'; x.strokeStyle = '#fff'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(X, h / 2 - 7); x.lineTo(X + 7, h / 2); x.lineTo(X, h / 2 + 7); x.lineTo(X - 7, h / 2); x.closePath(); x.stroke(); x.fill(); }
  }
  x.restore();
}
function fzDraw() {
  const dpr = window.devicePixelRatio || 1; let Wc, Hc;
  if (FIT_MQ.matches) {      // wide window: the canvas fills the space the layout gives it
    fzc.style.width = fzc.style.height = ''; const rc = fzc.getBoundingClientRect();
    Wc = Math.max(200, Math.floor(rc.width)); Hc = Math.max(160, Math.floor(rc.height));
  } else {
    const r = fzc.parentElement.getBoundingClientRect();
    Wc = Math.max(200, r.width - 4); Hc = Math.max(240, window.innerHeight - fzc.getBoundingClientRect().top - 60);
    fzc.style.width = Wc + 'px'; fzc.style.height = Hc + 'px';
  }
  fzc.width = Math.round(Wc * dpr); fzc.height = Math.round(Hc * dpr);
  fzx.setTransform(dpr, 0, 0, dpr, 0, 0); fzx.clearRect(0, 0, Wc, Hc);
  const U = fzUnit();
  if (!U) { fzx.fillStyle = '#8a7f70'; fzx.font = '15px Georgia'; fzx.fillText(FZ.src === 'printed' ? 'Choose a printed border on the left.' : 'Choose a motif on the left.', 20, 40); return; }
  if (FZ.view === 'strip') {
    const n = Math.max(2, Math.min(8, Math.ceil(Wc * 0.9 / Math.max(1, U.width * Math.min(1, 150 / U.height))))), k = Math.min(Wc * 0.92 / (n * U.width), 160 / U.height);
    fzx.save(); fzx.translate(20, 40); fzx.scale(k, k); fzBand(fzx, U, n * U.width, 0, 1); fzx.restore();
    fzx.save(); fzx.translate(20, 40); fzMarks(fzx, U, k, n);
    if (fzMitre()) { fzx.strokeStyle = '#d9a33a'; fzx.lineWidth = 3; for (let i = 0; i < n; i++) { const X = ((FZ.mirrorPos || 0) + i) * U.width * k; fzx.beginPath(); fzx.moveTo(X, -14); fzx.lineTo(X, U.height * k + 14); fzx.stroke(); } }
    fzx.restore();
    const G = FZG[fzGroup()]; fzx.fillStyle = '#4a3f33'; fzx.font = '14px Georgia';
    fzx.fillText(`${G.name}  ·  ${G.orb}  ·  ${fzGroup()}: ${G.desc}`, 20, 40 + U.height * k + 34);
    fzx.font = '12.5px Georgia'; fzx.fillStyle = '#8a7f70';
    fzx.fillText(G.mir ? 'Red dashed lines: mirrors across the band. A 45° mitre at a corner falls on a mirror, so the corner closes without a seam.'
                      : 'No mirror across the band: in corner mirrors this band reverses at every corner; corner blocks keep its direction.', 20, 40 + U.height * k + 56);
    if (fzMitre()) fzx.fillText('Gold line: where the corner mirrors stand on the band (Mirror position).', 20, 40 + U.height * k + 76);
  } else if (FZ.view === 'frame') {
    const F0 = fzFrame(U, 0.05), k = Math.min((Wc - 40) / (F0.W), (Hc - 90) / F0.H), F = fzFrame(U, Math.min(1, k * dpr));
    fzx.drawImage(F.c, 20, 20, F.W * k, F.H * k);
    fzx.fillStyle = '#4a3f33'; fzx.font = '13px Georgia';
    fzx.fillText(`${F.mitre ? 'Mirrors at the corners' : 'A block in each corner'} · ${fmtN(F.info[0].n)} × ${fmtN(F.info[1].n)} repeats · outer size ${fzSizeText(F)}`, 20, 20 + F.H * k + 22);
    if (F.short) fzMsg(`A side needs at least ${fmtN(F.nMin)} repeats with this band and mirror corners: the frame is shown at that size.`, true);
  } else {
    const S = fzSet(U); let X = 20; const k = Math.min(1, 220 / U.height);
    fzx.font = '13px Georgia';
    for (const t of S) { fzx.drawImage(t.c, X, 30, t.c.width * k, t.c.height * k); fzx.strokeStyle = '#c9bca6'; fzx.strokeRect(X - .5, 29.5, t.c.width * k + 1, t.c.height * k + 1);
      fzx.fillStyle = '#4a3f33'; fzx.fillText(t.name, X, 30 + t.c.height * k + 20); fzx.fillStyle = '#8a7f70'; fzx.fillText(`${t.c.width} × ${t.c.height} px`, X, 30 + t.c.height * k + 38); X += t.c.width * k + 30; }
  }
}
const fmtN = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
function fzSizeText(F) { const r = F.W / F.H, q = [[1, 1], [5, 4], [4, 3], [3, 2], [8, 5], [5, 3], [16, 9], [2, 1]].find(([a, b]) => Math.abs(r - a / b) < 0.02 || Math.abs(1 / r - a / b) < 0.02);
  return `${(F.W / F.h).toFixed(1)} × ${(F.H / F.h).toFixed(1)} band heights${q ? ` (≈ ${r >= 1 ? q[0] + ':' + q[1] : q[1] + ':' + q[0]})` : ''}`; }
/* ---------- the printed borders of the two books (data in frieze-data.js) ---------- */
function fzPrintedList() {
  const box = $('fzPrinted'); box.innerHTML = '';
  for (const P of PUBS) {
    const L = FZ_BORDERS.filter(b => (P.key === 'lp') === b[0].startsWith('lp') && (FZ.filter === 'all' || b[4] === FZ.filter));
    if (!L.length) continue;
    const hd = document.createElement('h3'); hd.className = 'pubh'; hd.textContent = P.short; box.appendChild(hd);
    for (const b of L) {
      const d = document.createElement('button'); d.className = 'fzb' + (FZ.printed && FZ.printed.id === b[0] ? ' on' : '');
      const n = b[0].startsWith('lp') ? 1000 + +b[0].slice(2, 4) : +b[0].slice(1, 3);
      d.title = `${b[0].startsWith('lp') ? lpLabel(b[0]) : b[0]} · ${FZG[b[3]].name} (${b[3]}) · ${b[4] === 'verified' ? 'seamless join' : 'approximate: the join between repeats can show'}${b[5] ? ' · with its printed corner' : ''}\n${ornSource({ lib: b[0], n })}`;
      d.innerHTML = `<i style="background:${FZ.bg} url(friezes/${b[0]}.webp?v=3) repeat-x left center / auto 100%"></i><span>${b[3] === 'p1m1' ? 'sidle' : 'hop'}${b[4] === 'verified' ? '' : ' ≈'}${b[5] ? ' · corner' : ''}</span>`;
      d.onclick = () => fzPick(b); box.appendChild(d);
    }
  }
}
async function fzPick(b) {
  try {
    const img = await fzLoad(`friezes/${b[0]}.webp?v=3`); const blk = b[5] ? await fzLoad(`friezes/c_${b[0]}.webp?v=3`) : null;
    FZ.src = 'printed'; FZ.printed = { id: b[0], img, group: b[3], verdict: b[4] }; FZ.grasset = blk ? { id: b[0], blk } : FZ.grasset;
    fzSync(); fzPrintedList(); fzRender();
    const n = b[0].startsWith('lp') ? 1000 + +b[0].slice(2, 4) : +b[0].slice(1, 3);
    fzMsg(`${ornSource({ lib: b[0], n })}${blk ? ' Grasset printed this border with its own corner: Corners → A block in each corner → Grasset’s printed corner.' : ''} ${b[4] === 'verified' ? 'The join between repeats is seamless.' : 'Approximate: drawn by hand, the joins between repeats can show.'}`);
  } catch (e) { fzMsg('Could not load that border. Check your connection and try again.', true); }
}
/* ---------- controls ---------- */
function fzSync() {
  document.querySelectorAll('#fzSrcTabs button').forEach(b => b.classList.toggle('on', b.dataset.s === FZ.src));
  $('fzMotifBox').hidden = FZ.src !== 'motif'; $('fzPrintedBox').hidden = FZ.src !== 'printed'; $('fzGeoBox').hidden = FZ.src !== 'geo';
  $('fzGeo').value = FZ.geo; $('fzGeoR').value = FZ.geoR; $('fzGeoRV').textContent = FZ.geoR.toFixed(2); $('fzGeoW').value = FZ.geoW; $('fzGeoWV').textContent = Math.round(FZ.geoW * 100) + ' %'; $('fzInk').value = FZ.ink;
  document.querySelectorAll('#fzGroups button').forEach(b => b.classList.toggle('on', b.dataset.g === fzGroup()));
  $('fzGroupsH').hidden = $('fzGroups').hidden = FZ.src !== 'motif';          // only a motif lets you choose the group
  const G0 = FZG[fzGroup()], gl = FZ.src === 'printed' && !FZ.printed ? '' : `Frieze group: <b>${G0.name}</b> (${G0.orb} · ${fzGroup()}), ${G0.desc}.`;
  document.querySelectorAll('.fzgline').forEach(e => e.innerHTML = gl);
  document.querySelectorAll('#fzViewTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === FZ.view));
  const set = (id, v, t) => { $(id).value = v; $(id + 'V').textContent = t; };
  set('fzScale', FZ.scale, Math.round(FZ.scale * 100) + ' %'); set('fzGap', FZ.gap, Math.round(FZ.gap * 100) + ' %');
  set('fzDy', FZ.dy, FZ.dy.toFixed(2)); set('fzRot', FZ.rot, FZ.rot + '°');
  $('fzW').value = FZ.nW; $('fzH').value = FZ.nH; $('fzW').step = $('fzH').step = fzMitre() ? 0.5 : 1; $('fzCorner').value = FZ.corner;
  $('fzRules').parentElement.hidden = FZ.src === 'printed';
  $('fzMirrorRow').hidden = !fzMitre(); $('fzMirror').value = FZ.mirrorPos; $('fzMirrorV').textContent = Math.round(FZ.mirrorPos * 100) + ' %'; $('fzBlockRow').hidden = fzMitre(); $('fzBlock').value = FZ.block;
  $('fzRules').checked = FZ.rules; $('fzBg').value = FZ.bg; $('fzRuleCol').value = FZ.ruleCol;
  $('fzGrassetOpt').disabled = !FZ.grasset; $('fzGrassetOpt').textContent = 'Grasset’s printed corner' + (FZ.grasset ? ` (pl. ${+FZ.grasset.id.slice(2, 4)})` : ': choose a border marked “corner”'); $('fzBlockOrn').hidden = FZ.block !== 'orn';
  $('fzMotifName').textContent = FZ.motif ? FZ.label : 'none yet';
  $('fzRuleNote').textContent = FZ.corner === 'alike' ? 'A mirror on every corner diagonal and one in the middle of each side: all four corners are the same, for any band and any size. Mirror position chooses which part of the band meets in the corners.'
    : FZ.corner === 'mitre' ? (fzMirror() && (FZ.mirrorPos % 0.5 < 0.01 || FZ.mirrorPos % 0.5 > 0.49) ? 'Mirrors on the corner diagonals only, as in Verneuil’s mirror box: the band runs unbroken along each side. At this mirror position all four corners are alike.'
      : 'Mirrors on the corner diagonals only, as in Verneuil’s mirror box: the band runs unbroken along each side, but neighbouring corners differ (one shows the band before the mirror, the other after it). Choose “4 corners alike” for identical corners.')
    : 'A block in each corner: the band runs clockwise all round and keeps its direction. For mirror corners (and Mirror position) choose one of the Mirrors options above.';
}
function fzSetMotif(img, x, y, w, h, label, lib) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  FZ.motif = c; FZ.label = label; FZ.lib = lib || null; FZ.src = 'motif'; fzSync(); fzRender();
}
function fzPickImage(cb, title) {
  PICK_TARGET = cb; targetSlot = -1; showLib(); $('dlgTitle').textContent = title;
  dlg.addEventListener('close', () => { setTimeout(() => { PICK_TARGET = null; }, 0); }, { once: true }); dlg.showModal();
}
$('fzChoose').onclick = () => fzPickImage((img, x, y, w, h, label) => fzSetMotif(img, x, y, w, h, label), 'Choose a motif for the frieze (library, a crop of a plate, or My images)');
$('fzBlockChoose').onclick = () => fzPickImage((img, x, y, w, h, label) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height); FZ.blockImg = c; FZ.blockLabel = label; FZ.block = 'orn'; fzSync(); fzRender(); }, 'Choose an ornament for the corner blocks');
$('fzAsMotif').onclick = () => { if (!FZ.printed) { fzMsg('Choose a printed border first.', true); return; }
  const im = FZ.printed.img; FZ.gap = 0; FZ.scale = 1; fzSetMotif(im, 0, 0, im.width, im.height, 'border ' + FZ.printed.id, FZ.printed.id);
  fzMsg('The printed repeat is now the motif: try the other groups, for example jump (∞∗) to mirror it into a double band.'); };
document.querySelectorAll('#fzSrcTabs button').forEach(b => b.onclick = () => { FZ.src = b.dataset.s; fzSync(); fzRender(); });
document.querySelectorAll('#fzViewTabs button').forEach(b => b.onclick = () => { FZ.view = b.dataset.v; fzSync(); fzRender(); });
(() => { const g = $('fzGroups');
  for (const k of FZ_ORDER) { const G = FZG[k], b = document.createElement('button'); b.dataset.g = k; b.title = `${k} (${G.orb}): ${G.desc}`;
    b.innerHTML = `${G.name}<small>${G.orb} · ${k}</small>`; b.onclick = () => { FZ.group = k; fzSync(); fzRender(); }; g.appendChild(b); } })();
const fzRange = (id, key) => $(id).addEventListener('input', e => { FZ[key] = +e.target.value; fzSync(); fzRender(); });
fzRange('fzScale', 'scale'); fzRange('fzGap', 'gap'); fzRange('fzDy', 'dy'); fzRange('fzRot', 'rot');
const fzShowFrame = () => { if (FZ.view === 'strip') FZ.view = 'frame'; };     // frame controls show their effect
$('fzW').onchange = e => { FZ.nW = Math.max(0.5, Math.min(60, +e.target.value || 10)); fzShowFrame(); fzSync(); fzRender(); };
$('fzH').onchange = e => { FZ.nH = Math.max(0.5, Math.min(60, +e.target.value || 7)); fzShowFrame(); fzSync(); fzRender(); };
$('fzCorner').onchange = e => { FZ.corner = e.target.value; if (FZ.corner === 'block') { FZ.nW = Math.max(1, Math.round(FZ.nW)); FZ.nH = Math.max(1, Math.round(FZ.nH)); } fzShowFrame(); fzSync(); fzRender(); };
$('fzMirror').addEventListener('input', e => { FZ.mirrorPos = +e.target.value; fzShowFrame(); fzSync(); fzRender(); });
$('fzBlock').onchange = e => { FZ.block = e.target.value; fzShowFrame(); fzSync(); fzRender(); };
$('fzRules').onchange = e => { FZ.rules = e.target.checked; fzRender(); };
$('fzBg').oninput = e => { FZ.bg = e.target.value; fzRender(); fzPrintedList(); };
$('fzRuleCol').oninput = e => { FZ.ruleCol = e.target.value; fzRender(); };
$('fzFilter').onchange = e => { FZ.filter = e.target.value; fzPrintedList(); };
/* ---------- output: as everywhere in Tessera: PNG files, tiles in the Compose library, a source for the Mosaic maker ---------- */
const fzName = () => FZ.src === 'geo' ? `frieze_${FZ.geo}_${fzGroup()}` : FZ.src === 'printed' && FZ.printed ? `border_${FZ.printed.id}` : `frieze_${fzGroup()}_${safe(FZ.label || 'motif')}`;
function fzMethod() {
  const G = FZG[fzGroup()], keys = ['frieze']; if (fzMitre()) keys.push('verneuil');
  return { keys, sym: `${G.name} ${G.orb}`, detail: `frieze group ${fzGroup()} (${G.name}, ${G.orb})${FZ.src === 'geo' ? `, ${GEO[FZ.geo].name.toLowerCase()}` : FZ.src === 'printed' && FZ.printed ? `, printed border ${FZ.printed.id}` : FZ.label ? `, motif ${FZ.label}` : ''}; ${fzMitre() ? 'mirrors at the corners' : 'corner blocks'}` };
}
$('fzPng').onclick = () => { const U = fzUnit(); if (!U) return;
  if (FZ.view === 'frame') fzFrame(U).c.toBlob(b => download(b, fzName() + '_frame.png'));
  else if (FZ.view === 'set') fzSet(U).forEach((t, i) => setTimeout(() => t.c.toBlob(b => download(b, `${fzName()}_${t.name.replace(/ /g, '_')}.png`)), i * 300));
  else { const n = Math.max(3, Math.ceil(1600 / U.width)), c = document.createElement('canvas'); c.width = n * U.width; c.height = U.height; fzBand(c.getContext('2d'), U, c.width, 0, 1); c.toBlob(b => download(b, fzName() + '_strip.png')); } };
/* the frieze set-up kept with a saved tile, so ✎ reopens it here. Library and printed items by id; any other motif
   (a plate crop, your own image) as a small image */
const FZ_KEYS = ['mirrorPos', 'src', 'group', 'scale', 'gap', 'dy', 'rot', 'bg', 'rules', 'ruleCol', 'nW', 'nH', 'corner', 'block', 'geo', 'geoR', 'geoW', 'ink'];
function fzState() {
  const st = { v: 1 }; for (const k of FZ_KEYS) st[k] = FZ[k];
  st.label = FZ.label; st.lib = FZ.lib; st.printed = FZ.printed ? FZ.printed.id : null; st.grasset = FZ.grasset ? FZ.grasset.id : null;
  if (FZ.src === 'motif' && FZ.motif && !FZ.lib) { const m = FZ.motif, k = Math.min(1, 600 / Math.max(m.width, m.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(m.width * k)); c.height = Math.max(1, Math.round(m.height * k)); c.getContext('2d').drawImage(m, 0, 0, c.width, c.height);
    st.motifSrc = c.toDataURL('image/png'); }
  return st;
}
const validFrieze = st => st && typeof st === 'object' && st.v === 1 && ['motif', 'geo', 'printed'].includes(st.src) ? st : undefined;
async function fzApply(st) {
  for (const k of FZ_KEYS) if (k in st && typeof st[k] === typeof FZ[k]) FZ[k] = st[k];
  if (!['block', 'alike', 'mitre'].includes(FZ.corner)) FZ.corner = 'alike';
  if (!FZG[FZ.group]) FZ.group = 'p1'; if (!GEO[FZ.geo]) FZ.geo = 'zigzag';
  FZ.nW = Math.max(0.5, Math.min(60, +FZ.nW || 10)); FZ.nH = Math.max(0.5, Math.min(60, +FZ.nH || 7));
  try {
    if (st.grasset) { const b = FZ_BORDERS.find(x => x[0] === st.grasset); if (b) FZ.grasset = { id: b[0], blk: await fzLoad(`friezes/c_${b[0]}.webp?v=3`) }; }
    if (st.src === 'printed' && st.printed) { const b = FZ_BORDERS.find(x => x[0] === st.printed); if (b) FZ.printed = { id: b[0], img: await fzLoad(`friezes/${b[0]}.webp?v=3`), group: b[3], verdict: b[4] }; }
    if (st.src === 'motif') {
      const isBorder = st.lib && FZ_BORDERS.some(b => b[0] === st.lib) && String(st.label || '').startsWith('border ');
      const im = isBorder ? await fzLoad(`friezes/${st.lib}.webp?v=3`) : st.lib ? await loadLib(st.lib)
        : typeof st.motifSrc === 'string' && /^data:image\//.test(st.motifSrc) ? await fzLoad(st.motifSrc) : null;
      if (im) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); FZ.motif = c; FZ.label = st.label || ''; FZ.lib = st.lib || null; }
    }
  } catch (e) { fzMsg('Part of this frieze could not be loaded (check your connection).', true); }
  fzSync(); fzPrintedList(); fzRender();
}
/* ---------- saving: a new set, or back into the set being edited ---------- */
let FZLINK = null;                    // ids of the saved tiles (one frieze set) being edited, or null
const fzEnc = c => { let u = c.toDataURL('image/webp', 0.92); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/png'); return u; };
const fzBase = () => FZ.src === 'geo' ? GEO[FZ.geo].name : FZ.src === 'printed' && FZ.printed ? `Border ${FZ.printed.id}` : `Frieze ${FZG[fzGroup()].name}`;
const fzLinked = () => FZLINK ? FZLINK.map(dById).filter(Boolean) : [];
function fzLinkUI() {
  const L = fzLinked(); if (FZLINK && !L.length) FZLINK = null;
  $('fzLinkBar').hidden = !FZLINK;
  $('fzSave').textContent = FZLINK ? 'Save as a new set' : 'Save tiles to Compose';
  if (FZLINK) $('fzLinkTxt').innerHTML = `<b>Editing the set “${fzSetName(L[0])}”</b> (${L.length} tile${L.length > 1 ? 's' : ''} in Saved tiles). Change it, then <b>Update the set</b>, or keep the original and <b>Save as a new set</b>.`;
}
async function fzEditSet(d) {
  const k = fzSetKey(d), G = DESIGNS.filter(x => x === d || (k && fzSetKey(x) === k));
  showView('frieze'); FZLINK = G.map(x => x.id); await fzApply(d.frieze);
  FZ.view = 'set'; fzSync(); fzRender(); fzLinkUI();
  const on = document.querySelector('#fzPrinted .fzb.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  document.querySelector('#friezeView .caside').scrollTop = 0;
  fzMsg(`Opened “${fzSetName(d)}” (${G.length} tile${G.length > 1 ? 's' : ''}). The view shows the set as it is now.`);
}
function fzSaveNew() { const U = fzUnit(); if (!U) return; const mi = fzMethod(), S = fzSet(U), base = fzBase(), st = fzState(), ids = [], fset = 's' + Date.now().toString(36) + (uid++);
  // one band height = one board unit for every tile of the set, so the pieces fit together on the board
  for (const t of S) { const d = addDesign({ id: 'd' + Date.now().toString(36) + (uid++), name: `${base} · ${t.name}`, shape: t.c.width === t.c.height ? 'square' : 'rect',
    w: t.c.width, h: t.c.height, src: fzEnc(t.c), edge: t.c.height, method: mi, bg: FZ.bg, frieze: st, fset }); if (d) ids.push(d.id); }
  const was = !!FZLINK; FZLINK = ids.length ? ids : null; fzLinkUI();
  fzMsg(`Saved ${S.length} tiles to the Compose tab${was ? ' as a new set; the original set is unchanged' : ''}: ${S.map(t => t.name).join(', ')} (one band height = one board unit).`); }
$('fzSave').onclick = fzSaveNew; $('fzSaveNew').onclick = fzSaveNew;
$('fzUnlink').onclick = () => { FZLINK = null; fzLinkUI(); fzMsg('Stopped editing the set; saving now makes a new set.'); };
$('fzUpdate').onclick = () => { const U = fzUnit(), old = fzLinked(); if (!U) return; if (!old.length) { FZLINK = null; fzLinkUI(); return; }
  const mi = fzMethod(), S = fzSet(U), base = fzBase(), st = fzState(), byPart = new Map(old.map(d => [String(d.name).split(' · ').slice(1).join(' · '), d]));
  const ids = [], added = [], gone = [], kept = [], resized = [], fset = (old.find(d => d.fset) || {}).fset || 's' + Date.now().toString(36) + (uid++);
  const setIds = new Set(old.map(d => d.id)), before = pieceContacts(setIds);     // how the set's pieces sit against their neighbours now
  // pair the new tiles with the old ones: by name, then the rest in order within their role (corner or band)
  const NT = S.map(t => ({ t, shape: t.c.width === t.c.height ? 'square' : 'rect', d: null }));
  for (const n of NT) { const d = byPart.get(n.t.name); if (d) { n.d = d; byPart.delete(n.t.name); } }
  const role = nm => /corner/.test(nm) ? 'corner' : 'band';      // a corner tile never stands in for a band tile, nor the reverse
  for (const n of NT) if (!n.d) { const e = [...byPart.entries()].find(([k]) => role(k) === role(n.t.name)); if (e) { n.d = e[1]; byPart.delete(e[0]); } }
  for (const { t, shape, d } of NT) { const nd = { name: `${base} · ${t.name}`, shape, w: t.c.width, h: t.c.height, src: fzEnc(t.c), edge: t.c.height, method: mi, bg: FZ.bg, frieze: st, fset };
    if (d) { const k = d.edge / nd.edge; for (const p of PIECES) if (p.did === d.id) p.s *= k;     // pieces keep their band thickness
      if (Math.abs(nd.w / nd.h - d.w / d.h) > 0.01 * (d.w / d.h) && PIECES.some(p => p.did === d.id)) resized.push(t.name);
      Object.assign(d, nd); delete d.demo; d.img = new Image(); d.img.onload = () => { cRender(); renderPalette(); }; d.img.src = d.src; ids.push(d.id); }
    else { const a = addDesign({ id: 'd' + Date.now().toString(36) + (uid++), ...nd }); if (a) { ids.push(a.id); added.push(t.name); } } }
  for (const d of byPart.values()) { if (PIECES.some(p => p.did === d.id)) { kept.push(d); d.fset = 'x' + d.id; } else gone.push(d); }
  for (const d of gone) { TRASH.set(d.id, d); DESIGNS.splice(DESIGNS.indexOf(d), 1); }
  const C = contactChanges(before, pieceContacts(setIds)), mine = new Set(ids);
  const bad = new Set([...C.over, ...C.gap].filter(id => { const p = PIECES.find(q => q.id === id); return p && mine.has(p.did); }));   // only the set's own pieces: neighbours stay unselected
  if (bad.size) { SEL.clear(); for (const id of bad) SEL.add(id); syncSel(); }
  const fit = !bad.size ? '' : ` Check the board: ${C.nO ? `${C.nO} pair${C.nO > 1 ? 's' : ''} of pieces now overlap` : ''}${C.nO && C.nG ? ' and ' : ''}${C.nG ? `${C.nG} pair${C.nG > 1 ? 's' : ''} that touched now leave a gap` : ''}, because ${resized.length ? `the ${resized.join(', ')} changed length` : 'tiles changed size'} while the pieces kept their places. The ${bad.size} pieces of this set involved are selected in the Compose tab: move them, or lay the frame again.`;
  if (bad.size) cMsg(`After updating “${base}”: the ${bad.size} selected piece${bad.size > 1 ? 's' : ''} now ${C.nO && C.nG ? 'overlap or leave gaps against' : C.nO ? 'overlap' : 'leave gaps against'} their neighbours, because the tiles changed length. Move them, or lay the frame again.`, true);
  saveDesigns(); renderPalette(); commit(); FZLINK = ids; fzLinkUI();
  fzMsg(`Updated the set “${base}”: pieces on the Compose board show the change.` + fit + (added.length ? ` Added: ${added.join(', ')}.` : '')
    + (gone.length ? ` Removed tiles the set no longer has: ${gone.map(d => d.name.split(' · ').slice(1).join(' · ')).join(', ')}.` : '')
    + (kept.length ? ` Kept, because pieces use them: ${kept.map(d => d.name).join(', ')}.` : '')
    + (resized.length && !bad.size ? ` The ${resized.join(', ')} changed length; no pieces on the board were affected.` : ''), bad.size > 0); };
$('fzMosaic').onclick = () => { const U = fzUnit(); if (!U) return; const F = fzFrame(U);
  const c = document.createElement('canvas'); c.width = F.c.width; c.height = F.c.height; const x = c.getContext('2d'); x.drawImage(F.c, 0, 0);
  x.clearRect(F.h, F.h, c.width - 2 * F.h, c.height - 2 * F.h);      // the middle stays open: only the band is cut, ready to be filled later
  zSource(c, (FZ.src === 'geo' ? GEO[FZ.geo].name : FZ.src === 'printed' && FZ.printed ? 'Border ' + FZ.printed.id : 'Frieze ' + FZG[fzGroup()].name) + ' frame', { mask: true }); showView('mosaic'); };
(() => { const sel = $('fzGeo');
  for (const g of FZ_ORDER) { const L = GEO_ORDER.filter(k => GEO[k].g === g); if (!L.length) continue;
    const og = document.createElement('optgroup'); og.label = `${FZG[g].name} · ${FZG[g].orb} · ${g}`; sel.appendChild(og);
    for (const k of L) { const o = document.createElement('option'); o.value = k; o.textContent = GEO[k].name; og.appendChild(o); } }
  sel.onchange = e => { FZ.geo = e.target.value; FZ.geoR = GEO[FZ.geo].r; fzSync(); fzRender(); };
  $('fzGeoR').addEventListener('input', e => { FZ.geoR = +e.target.value; fzSync(); fzRender(); });
  $('fzGeoW').addEventListener('input', e => { FZ.geoW = +e.target.value; fzSync(); fzRender(); });
  $('fzInk').oninput = e => { FZ.ink = e.target.value; fzRender(); }; })();
function fzHelpFigures() {          // the example column of the frieze-groups table in How it works
  const keep = { geo: FZ.geo, geoR: FZ.geoR, geoW: FZ.geoW, rules: FZ.rules, bg: FZ.bg, ink: FZ.ink };
  Object.assign(FZ, { rules: false, geoW: 0.07, bg: '#f3ead6', ink: '#2f5d5a' });
  document.querySelectorAll('canvas[data-geo]').forEach(cv => { const k = cv.dataset.geo; if (!GEO[k]) return; FZ.geo = k; FZ.geoR = GEO[k].r;
    const U = fzGeoUnit(72), W = 300; cv.width = W; cv.height = 72; fzBand(cv.getContext('2d'), U, W, 0, 1); });
  Object.assign(FZ, keep);
}
async function fzInit() {
  fzHelpFigures();
  fzPrintedList(); fzSync();
  try { const im = await loadLib('lp22_02'); fzSetMotif(im, 0, 0, im.width, im.height, lpLabel('lp22_02'), 'lp22_02'); } catch (e) {}
}
fzInit();
new ResizeObserver(() => fzRender()).observe($('friezeView'));
