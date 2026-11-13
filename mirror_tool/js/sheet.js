/* Tessera · Tile maker: ornament slots, symmetry, the ornament library, plates, My images, the sheet, the dial demo */
'use strict';

/* ---------- slots ---------- */
const MAX_ORN = 60;
function ornLabel(o) { return o.label ? o.label : o.lib ? o.lib.replace(/^p0?(\d+)_0?(\d+)$/, 'pl. $1 · #$2').replace(/^p0?(\d+)_frame$/, 'pl. $1 · frame').replace(/^p0?(\d+)_panel$/, 'pl. $1 · whole') : plateLabel(o.n).replace('Plate ', 'pl. '); }
function renderSlots() {
  const wrap = $('slots'); wrap.innerHTML = '';
  S.orn.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (S.sel === i ? ' sel' : '');
    d.innerHTML = `<div class="t"><span>#${i + 1}</span><span class="small">${ornLabel(o)}</span></div>`;
    const c = document.createElement('canvas'); c.width = 220; c.height = 128; d.appendChild(c);
    const x = c.getContext('2d'), k = Math.min(c.width / o.cw, c.height / o.ch);
    x.drawImage(o.img, o.cx, o.cy, o.cw, o.ch, (c.width - o.cw * k) / 2, (c.height - o.ch * k) / 2, o.cw * k, o.ch * k);
    const bb = document.createElement('div'); bb.className = 'b';
    const rp = document.createElement('button'); rp.textContent = 'Replace';
    rp.onclick = e => { e.stopPropagation(); openPicker(i); };
    const du = document.createElement('button'); du.textContent = 'Copy'; du.title = 'Duplicate this ornament';
    du.onclick = e => { e.stopPropagation(); if (S.orn.length >= MAX_ORN) return; S.orn.push({ ...o, x: o.x + 30, y: o.y + 30 }); S.sel = S.orn.length - 1; renderSlots(); redraw(true); };
    const rm = document.createElement('button'); rm.textContent = '✕'; rm.title = 'Remove';
    rm.onclick = e => { e.stopPropagation(); S.orn.splice(i, 1); if (S.sel > i) S.sel--; else if (S.sel === i) S.sel = Math.min(i, S.orn.length - 1); renderSlots(); redraw(true); };
    bb.append(rp, du, rm); d.appendChild(bb);
    d.onclick = () => { S.sel = i; renderSlots(); redraw(); };
    wrap.appendChild(d);
  });
  $('addOrn').disabled = S.orn.length >= MAX_ORN;
  if (!S.orn.length) wrap.innerHTML = '<p class="small" style="grid-column:1/-1;margin:4px 0">No ornaments yet. Use “+ Add ornament” to pick from the library (plates 3–60).</p>';
  $('ornCount').textContent = S.orn.length ? `${S.orn.length} on the sheet` : '';
}

/* ---------- an ornament's own symmetry (point group), measured on its pixels ----------
   The picture is reduced to ink (colour × opacity on white), centred on its centre of mass, and compared with
   its own copies turned by 360°/n (n = 2…8) and reflected in lines through that centre (every 1°).
   overlap(T) = Σ min(ink, ink∘T) / Σ ink, corrected for chance (dense all-over patterns overlap themselves at any
   angle): s = (overlap − b)/(1 − b), b = median overlap under turns by 'meaningless' angles. Above SYM_T it counts.
   Result: Cn (n-fold turns, no mirror) or Dn (n mirrors), C1 = no symmetry. Printed ornaments are never exact:
   registration, hand drawing and the crop all lower the score, so the label is a measurement, not a proof. */
const SYM_T = 0.38, SYM_CLEAR = 0.5;   // chance-corrected scale: 0 = what any turn gives, 1 = exact; between the two: approximate
function symmetryOf(img) {
  const M = 120, k = Math.min(1, M / Math.max(img.width, img.height)), w = Math.max(4, Math.round(img.width * k)), h = Math.max(4, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, n = w * h;
  const A = new Float32Array(n * 3); let tot = 0, mx = 0, my = 0;
  for (let i = 0; i < n; i++) { const a = d[4 * i + 3] / 255;
    for (let q = 0; q < 3; q++) { const v = (255 - d[4 * i + q]) * a; A[3 * i + q] = v; tot += v; mx += v * (i % w); my += v * Math.floor(i / w); } }
  if (tot < 1) return { label: 'C1', n: 1, m: 0, score: 0, axes: [] };
  const cx = mx / tot, cy = my / tot;
  const over = (a, b, c2, d2) => {          // overlap under p ↦ [a b; c d](p − centre) + centre
    let s2 = 0;
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = y * w + X, u = X - cx, v = y - cy, sx = Math.round(cx + a * u + b * v), sy = Math.round(cy + c2 * u + d2 * v);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const j = sy * w + sx; for (let q = 0; q < 3; q++) s2 += Math.min(A[3 * i + q], A[3 * j + q]);
    }
    return s2 / tot;
  };
  // chance level for this picture: turns by angles that no ornament symmetry uses
  const offs = [17, 33, 79, 139, 163, 199, 241, 283].map(t => { const f = t * Math.PI / 180; return over(Math.cos(f), -Math.sin(f), Math.sin(f), Math.cos(f)); }).sort((p2, q) => p2 - q);
  const base = offs[Math.floor(offs.length / 2)], norm = v => (v - base) / Math.max(1e-6, 1 - base);
  const rot = {}; let nmax = 1;
  for (const r of [2, 3, 4, 5, 6, 8]) { const t = 2 * Math.PI / r; rot[r] = norm(over(Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t))); }
  for (const r of [8, 6, 5, 4, 3, 2]) if (rot[r] >= SYM_T && (r % 2 || rot[2] >= SYM_T * 0.8)) { nmax = r; break; }
  const mir = [];
  for (let t = 0; t < 180; t++) { const f = 2 * t * Math.PI / 180; mir.push(norm(over(Math.cos(f), Math.sin(f), Math.sin(f), -Math.cos(f)))); }
  const axes = [];
  for (let t = 0; t < 180; t++) { const v = mir[t]; if (v >= SYM_T && v >= mir[(t + 179) % 180] && v >= mir[(t + 1) % 180] && !axes.some(a2 => Math.min(Math.abs(a2 - t), 180 - Math.abs(a2 - t)) < 12)) axes.push(t); }
  axes.sort((p2, q) => mir[q] - mir[p2]);
  let m = axes.length, label;
  if (m >= 2) { m = Math.max(m, nmax); label = 'D' + m; }
  else if (m === 1) label = nmax >= 2 ? 'D' + nmax : 'D1';
  else label = 'C' + nmax;
  const score = Math.max(nmax > 1 ? rot[nmax] : 0, axes.length ? mir[axes[0]] : 0);
  const bm = Math.max(...mir);
  const sp = [+(cx / w).toFixed(4), +(cy / h).toFixed(4), axes.length ? axes[0] : null];
  return { label, sp, approx: label !== 'C1' && score < SYM_CLEAR, n: nmax, m: axes.length, score: +score.toFixed(3), axes: axes.map(t => (180 - t) % 180), best: { mir: bm, mirAt: (180 - mir.indexOf(bm)) % 180, rot, base } };
}
const SYMTXT = l0 => { const ap = l0[0] === '≈', l = ap ? l0.slice(1) : l0 || 'C1';
  const t = l === 'C1' ? 'no symmetry' : l === 'D1' ? 'one mirror line' : l === 'C∞' ? 'a ring: turns by any angle, no mirror' : l[0] === 'D' ? `${l.slice(1)} mirror lines and ${l.slice(1)}-fold turns` : `${l.slice(1)}-fold turns, no mirror`;
  return (ap ? 'roughly: ' : '') + t + ' (' + l + ')'; };
/* Which ornaments sit whole on a site of a wallpaper group. At a point whose stabiliser is H (a rotation centre
   of order n, a point of a mirror, a crossing of mirrors) the group lays |H| copies of the ornament on top of each
   other; they coincide only if the ornament's own symmetry contains H. Anywhere else (a general position) any
   ornament works, the copies being apart. Sites: the point groups of the special positions in the International Tables. */
const SITES = { p1: [], p2: ['C2'], pm: ['D1'], pg: [], cm: ['D1'], pmm: ['D2', 'D1'], pmg: ['C2', 'D1'], pgg: ['C2'],
  cmm: ['D2', 'C2', 'D1'], p4: ['C4', 'C2'], p4m: ['D4', 'D2', 'D1'], p4g: ['C4', 'D2', 'D1'], p3: ['C3'],
  p3m1: ['D3', 'D1'], p31m: ['D3', 'C3', 'D1'], p6: ['C6', 'C3', 'C2'], p6m: ['D6', 'D3', 'D2', 'D1'] };
const SITE_MARK = { C2: '◆ half-turn centre', C3: '▲ third-turn centre', C4: '■ quarter-turn centre', C6: '⬢ sixth-turn centre',
  D1: 'mirror line', D2: 'crossing of two mirrors', D3: 'meeting of three mirrors', D4: 'meeting of four mirrors', D6: 'meeting of six mirrors' };
const symN = l => l.slice(1) === '∞' ? Infinity : +l.slice(1);
function symContains(g, h) {           // does point group g (Cn / Dn / C∞, a ring) contain h?
  const gn = symN(g), hn = symN(h);
  if (gn === Infinity) return h[0] === 'C' || g[0] === 'D';
  if (h[0] === 'C') return gn % hn === 0;
  return g[0] === 'D' && gn % hn === 0;
}
const fitSites = (l0, grp) => { const l = (l0 || '').replace('≈', '') || 'C1'; return l === 'C1' ? [] : (SITES[grp] || []).filter(h => symContains(l, h)); };

/* ---------- ornament library (segmented from all plates by segment_ornaments_v2.py) ---------- */
// [id, plate, width, height, kind, symmetry]: kind 0 = ornament, 1 = the whole printed frame, 2 = the whole plate, uncut;
// symmetry = the ornament's point group measured by symmetryOf() and then checked by eye ('' = none, '≈' = approximate);
// labels were corrected by hand after review (wavy borders, scattered sprays, faint line drawings);
// symmetric entries end with [x, y, axis]: the symmetry centre as fractions of width and height, and the direction of one
// mirror line in degrees (image axes, y down; null for pure turns), each fitted by search for the best overlap
const LIB = [["p03_01",3,820,137,0,""],["p03_02",3,820,211,0,""],["p03_03",3,410,410,0,""],["p03_04",3,291,820,0,""],["p03_05",3,291,820,0,""],["p03_06",3,820,630,0,""],["p03_07",3,186,271,0,""],["p03_frame",3,820,696,1,""],["p03_panel",3,820,696,2,""],["p04_01",4,289,820,0,"≈D1",[0.4829,0.4273,89.0]],["p04_02",4,682,820,0,""],["p04_03",4,552,820,0,""],["p04_04",4,555,569,0,""],["p04_05",4,472,495,0,"D1",[0.4776,0.4836,95.0]],["p04_frame",4,820,691,1,""],["p04_panel",4,820,691,2,""],["p05_01",5,820,364,0,""],["p05_02",5,220,820,0,""],["p05_03",5,820,155,0,""],["p05_04",5,820,384,0,"D1",[0.4974,0.5357,89.0]],["p05_frame",5,820,695,1,""],["p05_panel",5,820,695,2,""],["p06_01",6,820,719,0,""],["p06_02",6,820,739,0,"D3",[0.5044,0.6222,92.5]],["p06_frame",6,820,704,1,""],["p06_panel",6,820,704,2,""],["p07_01",7,371,384,0,""],["p07_02",7,820,390,0,""],["p07_03",7,798,531,0,"≈D1",[0.4215,0.5617,89.5]],["p07_04",7,820,553,0,"≈D1",[0.5609,0.5688,89.5]],["p07_05",7,816,820,0,""],["p07_06",7,273,820,0,""],["p07_07",7,805,820,0,""],["p07_frame",7,820,698,1,""],["p07_panel",7,820,698,2,""],["p08_01",8,820,658,0,""],["p08_02",8,820,661,0,""],["p08_03",8,754,313,0,"D2",[0.4962,0.4926,90.0]],["p08_frame",8,820,698,1,""],["p08_panel",8,820,698,2,""],["p09_01",9,754,820,0,""],["p09_02",9,820,761,0,"D3",[0.4909,0.4009,90.5]],["p09_03",9,363,336,0,"D3",[0.4903,0.5378,30.5]],["p09_04",9,820,794,0,""],["p09_05",9,618,820,0,"D1",[0.4894,0.5408,90.0]],["p09_06",9,354,569,0,""],["p09_frame",9,820,697,1,""],["p09_panel",9,820,697,2,""],["p10_01",10,820,820,0,""],["p10_02",10,281,820,0,""],["p10_03",10,374,820,0,""],["p10_04",10,531,820,0,""],["p10_05",10,751,719,0,""],["p10_frame",10,820,698,1,""],["p10_panel",10,820,698,2,""],["p11_01",11,820,696,0,"D1",[0.4917,0.5656,90.5]],["p11_02",11,333,761,0,""],["p11_03",11,820,685,0,"D1",[0.4869,0.4825,90.5]],["p11_04",11,820,238,0,""],["p11_05",11,535,545,0,"C4",[0.4887,0.4909,null]],["p11_06",11,820,246,0,"D1",[0.4801,0.4472,90.5]],["p11_07",11,820,706,0,"D1",[0.4974,0.4326,90.5]],["p11_08",11,820,673,0,"D1",[0.4924,0.4731,89.5]],["p11_09",11,346,792,0,"D1",[0.4742,0.4857,90.0]],["p11_frame",11,820,700,1,""],["p11_panel",11,820,700,2,""],["p12_01",12,649,820,0,""],["p12_02",12,475,820,0,""],["p12_03",12,820,781,0,""],["p12_04",12,435,820,0,""],["p12_frame",12,820,756,1,""],["p12_panel",12,820,756,2,""],["p13_01",13,722,820,0,""],["p13_02",13,747,820,0,""],["p13_03",13,813,820,0,"≈C4",[0.4906,0.4951,null]],["p13_04",13,820,733,0,""],["p13_05",13,820,726,0,""],["p13_frame",13,820,695,1,""],["p13_panel",13,820,695,2,""],["p14_01",14,820,716,0,""],["p14_frame",14,820,697,1,""],["p14_panel",14,820,697,2,""],["p15_01",15,793,820,0,""],["p15_02",15,533,620,0,"D1",[0.4829,0.4985,91.0]],["p15_03",15,820,793,0,""],["p15_04",15,454,359,0,""],["p15_05",15,234,239,0,""],["p15_frame",15,820,694,1,""],["p15_panel",15,820,694,2,""],["p16_01",16,820,674,0,"≈D1",[0.4972,0.5491,89.5]],["p16_frame",16,820,696,1,""],["p16_panel",16,820,696,2,""],["p17_01",17,729,702,0,""],["p17_02",17,820,545,0,"D1",[0.4842,0.5489,90.0]],["p17_03",17,716,688,0,"≈D1",[0.4856,0.4901,89.5]],["p17_04",17,820,266,0,""],["p17_05",17,342,250,0,"D1",[0.4804,0.3197,89.0]],["p17_06",17,820,242,0,""],["p17_07",17,820,342,0,""],["p17_frame",17,820,669,1,""],["p17_panel",17,820,669,2,""],["p18_01",18,628,820,0,""],["p18_02",18,820,684,0,""],["p18_03",18,786,820,0,""],["p18_frame",18,820,700,1,""],["p18_panel",18,820,700,2,""],["p19_01",19,820,534,0,""],["p19_02",19,238,800,0,"D1",[0.4813,0.4138,90.0]],["p19_03",19,808,820,0,"≈C4",[0.4905,0.4962,null]],["p19_04",19,816,820,0,"≈C4",[0.4866,0.4954,null]],["p19_frame",19,820,700,1,""],["p19_panel",19,820,700,2,""],["p20_01",20,820,690,0,""],["p20_frame",20,820,698,1,""],["p20_panel",20,820,698,2,""],["p21_01",21,820,568,0,"D1",[0.4881,0.4669,89.5]],["p21_02",21,820,703,0,""],["p21_03",21,774,787,0,""],["p21_04",21,760,773,0,""],["p21_05",21,741,741,0,"≈D1",[0.4992,0.4861,87]],["p21_06",21,207,617,0,""],["p21_frame",21,820,691,1,""],["p21_panel",21,820,691,2,""],["p22_01",22,813,194,0,""],["p22_02",22,501,505,0,""],["p22_03",22,765,309,0,"≈D1",[0.453,0.4896,0.0]],["p22_04",22,814,213,0,""],["p22_05",22,506,501,0,""],["p22_frame",22,820,697,1,""],["p22_panel",22,820,697,2,""],["p23_01",23,820,820,0,""],["p23_02",23,313,820,0,"D1",[0.484,0.4921,0.0]],["p23_03",23,793,820,0,""],["p23_04",23,820,800,0,""],["p23_05",23,803,820,0,""],["p23_frame",23,820,698,1,""],["p23_panel",23,820,698,2,""],["p24_01",24,820,685,0,""],["p24_02",24,707,820,0,""],["p24_frame",24,820,701,1,""],["p24_panel",24,820,701,2,""],["p25_01",25,274,820,0,"D1",[0.6299,0.5592,90]],["p25_02",25,820,576,0,""],["p25_03",25,820,340,0,"≈D1",[0.4757,0.4902,90.0]],["p25_frame",25,820,695,1,""],["p25_panel",25,820,695,2,""],["p26_01",26,820,495,0,"≈D1",[0.4915,0.4377,90]],["p26_02",26,166,820,0,""],["p26_03",26,173,820,0,""],["p26_04",26,430,430,0,"≈D1",[0.3587,0.6181,135.5]],["p26_05",26,425,435,0,""],["p26_06",26,820,499,0,"≈D1",[0.49,0.557,90.0]],["p26_frame",26,820,701,1,""],["p26_panel",26,820,701,2,""],["p27_01",27,820,693,0,""],["p27_frame",27,820,692,1,""],["p27_panel",27,820,692,2,""],["p28_01",28,222,820,0,"D1",[0.4632,0.484,90.0]],["p28_02",28,820,369,0,"D1",[0.49,0.4886,90.0]],["p28_03",28,820,444,0,""],["p28_frame",28,820,697,1,""],["p28_panel",28,820,697,2,""],["p29_01",29,695,817,0,""],["p29_02",29,310,820,0,"≈D1",[0.5247,0.5279,90.5]],["p29_03",29,820,333,0,""],["p29_04",29,784,820,0,""],["p29_frame",29,820,698,1,""],["p29_panel",29,820,698,2,""],["p30_01",30,820,366,0,""],["p30_02",30,485,820,0,""],["p30_03",30,736,820,0,""],["p30_04",30,432,820,0,""],["p30_05",30,237,820,0,""],["p30_06",30,525,820,0,"D1",[0.4837,0.5718,89.5]],["p30_frame",30,820,706,1,""],["p30_panel",30,820,706,2,""],["p31_01",31,820,704,0,"≈D1",[0.4962,0.5246,89.5]],["p31_02",31,820,525,0,""],["p31_frame",31,820,701,1,""],["p31_panel",31,820,701,2,""],["p32_01",32,820,175,0,""],["p32_02",32,820,179,0,"D1",[0.4888,0.4251,179.5]],["p32_03",32,820,507,0,"≈D1",[0.4943,0.4327,90.0]],["p32_04",32,820,539,0,"D1",[0.4878,0.3415,90.0]],["p32_05",32,820,477,0,""],["p32_06",32,343,820,0,""],["p32_frame",32,820,695,1,""],["p32_panel",32,820,695,2,""],["p33_01",33,434,325,0,""],["p33_02",33,710,820,0,""],["p33_03",33,818,240,0,"D1",[0.4866,0.3448,89.5]],["p33_04",33,623,820,0,""],["p33_05",33,208,388,0,"D1",[0.4774,0.4495,90.0]],["p33_06",33,161,820,0,"D1",[0.4476,0.4684,90.5]],["p33_07",33,746,710,0,""],["p33_08",33,614,820,0,"D1",[0.4893,0.3756,90.0]],["p33_frame",33,820,695,1,""],["p33_panel",33,820,695,2,""],["p34_01",34,406,820,0,"D1",[0.4836,0.5364,90.0]],["p34_02",34,574,596,0,""],["p34_03",34,601,623,0,""],["p34_04",34,339,820,0,"D1",[0.4798,0.543,90.0]],["p34_05",34,398,820,0,""],["p34_frame",34,820,696,1,""],["p34_panel",34,820,696,2,""],["p35_01",35,329,820,0,"D1",[0.4809,0.5031,90.5]],["p35_02",35,560,820,0,"D1",[0.4881,0.4677,90.5]],["p35_03",35,344,820,0,""],["p35_04",35,568,752,0,"D1",[0.5323,0.505,179.5]],["p35_05",35,733,760,0,"≈C∞",[0.4954,0.4955,null]],["p35_frame",35,820,705,1,""],["p35_panel",35,820,705,2,""],["p36_01",36,820,693,0,""],["p36_02",36,356,820,0,""],["p36_03",36,432,820,0,"≈D1",[0.4762,0.4311,90.5]],["p36_04",36,650,820,0,""],["p36_frame",36,820,709,1,""],["p36_panel",36,820,709,2,""],["p37_01",37,415,820,0,""],["p37_02",37,413,820,0,""],["p37_03",37,820,650,0,""],["p37_04",37,283,724,0,""],["p37_05",37,292,180,0,""],["p37_06",37,820,356,0,""],["p37_07",37,162,193,0,"≈D1",[0.4867,0.4063,91.5]],["p37_08",37,167,184,0,"≈D1",[0.4946,0.4227,90.5]],["p37_09",37,166,202,0,"≈D1",[0.4863,0.4054,90.0]],["p37_10",37,166,203,0,"≈D1",[0.484,0.4086,88.5]],["p37_11",37,252,193,0,""],["p37_frame",37,820,706,1,""],["p37_panel",37,820,706,2,""],["p38_01",38,820,568,0,"D1",[0.4938,0.3313,90.0]],["p38_02",38,536,820,0,""],["p38_03",38,247,820,0,""],["p38_04",38,820,425,0,"D1",[0.492,0.4831,89.5]],["p38_frame",38,820,694,1,""],["p38_panel",38,820,694,2,""],["p39_01",39,820,803,0,"D5",[0.4914,0.4954,161.5]],["p39_02",39,818,732,0,""],["p39_03",39,820,486,0,""],["p39_04",39,820,619,0,""],["p39_05",39,820,545,0,""],["p39_frame",39,820,704,1,""],["p39_panel",39,820,704,2,""],["p40_01",40,771,820,0,"D1",[0.4913,0.5584,90.5]],["p40_02",40,801,224,0,""],["p40_03",40,808,820,0,""],["p40_04",40,706,243,0,""],["p40_05",40,644,820,0,""],["p40_06",40,820,282,0,""],["p40_07",40,820,296,0,""],["p40_08",40,820,365,0,"D1",[0.4695,0.4946,89.5]],["p40_09",40,820,294,0,"D2",[0.4882,0.48,90.5]],["p40_10",40,706,298,0,"D2",[0.4945,0.4846,90.0]],["p40_11",40,820,323,0,"D1",[0.4638,0.4993,89.5]],["p40_12",40,820,369,0,"D1",[0.4932,0.4817,90.0]],["p40_13",40,706,278,0,"D1",[0.4911,0.496,90.5]],["p40_frame",40,820,699,1,""],["p40_panel",40,820,699,2,""],["p41_01",41,820,79,0,"D1",[0.4997,0.4699,0.0]],["p41_02",41,690,562,0,"D1",[0.4866,0.419,89.5]],["p41_03",41,690,576,0,"D1",[0.4891,0.4229,89.0]],["p41_04",41,820,627,0,""],["p41_05",41,308,820,0,""],["p41_06",41,820,194,0,"D2",[0.492,0.438,90]],["p41_07",41,283,274,0,""],["p41_frame",41,820,695,1,""],["p41_panel",41,820,695,2,""],["p42_01",42,541,820,0,""],["p42_02",42,820,820,0,""],["p42_03",42,585,820,0,""],["p42_04",42,820,650,0,""],["p42_frame",42,820,713,1,""],["p42_panel",42,820,713,2,""],["p43_01",43,820,329,0,""],["p43_02",43,820,796,0,"D1",[0.4923,0.5463,89.5]],["p43_03",43,486,820,0,""],["p43_frame",43,820,697,1,""],["p43_panel",43,820,697,2,""],["p44_01",44,820,614,0,""],["p44_02",44,820,799,0,"D1",[0.4921,0.528,90]],["p44_03",44,615,820,0,""],["p44_frame",44,820,698,1,""],["p44_panel",44,820,698,2,""],["p45_01",45,555,820,0,""],["p45_02",45,626,521,0,""],["p45_03",45,704,649,0,""],["p45_04",45,461,315,0,"≈D1",[0.4851,0.4863,88.5]],["p45_05",45,711,521,0,"D1",[0.4979,0.3839,89.5]],["p45_06",45,754,758,0,"D1",[0.4868,0.4948,90.5]],["p45_frame",45,820,691,1,""],["p45_panel",45,820,691,2,""],["p46_01",46,288,820,0,""],["p46_02",46,820,167,0,""],["p46_03",46,735,820,0,"≈D1",[0.4893,0.4894,90.0]],["p46_04",46,223,820,0,""],["p46_frame",46,820,698,1,""],["p46_panel",46,820,698,2,""],["p47_01",47,706,820,0,""],["p47_02",47,803,758,0,""],["p47_03",47,240,820,0,""],["p47_frame",47,820,700,1,""],["p47_panel",47,820,700,2,""],["p48_01",48,383,820,0,""],["p48_02",48,820,782,0,""],["p48_03",48,506,629,0,""],["p48_04",48,820,449,0,""],["p48_frame",48,820,699,1,""],["p48_panel",48,820,699,2,""],["p49_01",49,436,820,0,"D1",[0.492,0.3623,90.5]],["p49_02",49,414,820,0,"D1",[0.4877,0.3543,90.0]],["p49_03",49,817,820,0,""],["p49_frame",49,820,696,1,""],["p49_panel",49,820,696,2,""],["p50_01",50,820,591,0,"D1",[0.4923,0.3989,89.5]],["p50_02",50,526,820,0,""],["p50_03",50,583,820,0,""],["p50_04",50,820,368,0,"≈D1",[0.492,0.5681,90.5]],["p50_frame",50,820,698,1,""],["p50_panel",50,820,698,2,""],["p51_01",51,820,552,0,""],["p51_02",51,820,534,0,"D1",[0.4952,0.3836,90]],["p51_03",51,599,820,0,"≈D1",[0.4928,0.445,90.5]],["p51_04",51,547,820,0,""],["p51_05",51,745,817,0,"D1",[0.4887,0.388,88.5]],["p51_frame",51,820,693,1,""],["p51_panel",51,820,693,2,""],["p52_01",52,764,820,0,"≈D1",[0.491,0.3645,90]],["p52_02",52,417,806,0,""],["p52_03",52,773,820,0,""],["p52_04",52,619,503,0,"≈D1",[0.4902,0.4722,88.5]],["p52_05",52,820,737,0,""],["p52_06",52,820,761,0,""],["p52_frame",52,820,697,1,""],["p52_panel",52,820,697,2,""],["p53_01",53,787,820,0,""],["p53_02",53,820,612,0,"≈D1",[0.4806,0.3563,92.0]],["p53_03",53,163,163,0,""],["p53_04",53,524,365,0,""],["p53_05",53,370,740,0,"D1",[0.4877,0.5041,91.0]],["p53_06",53,443,649,0,""],["p53_07",53,631,771,0,"D1",[0.4901,0.5175,91.0]],["p53_08",53,442,447,0,"D1",[0.4833,0.5011,90.0]],["p53_frame",53,820,699,1,""],["p53_panel",53,820,699,2,""],["p54_01",54,802,584,0,""],["p54_02",54,260,820,0,""],["p54_03",54,820,171,0,""],["p54_frame",54,820,731,1,""],["p54_panel",54,820,731,2,""],["p55_01",55,249,820,0,""],["p55_02",55,310,820,0,""],["p55_03",55,820,670,0,"D1",[0.4919,0.4136,90.0]],["p55_04",55,820,257,0,""],["p55_05",55,514,524,0,""],["p55_frame",55,820,699,1,""],["p55_panel",55,820,699,2,""],["p56_01",56,820,382,0,"≈D1",[0.5002,0.5538,90]],["p56_02",56,621,322,0,""],["p56_03",56,540,290,0,""],["p56_04",56,820,267,0,"≈D1",[0.4447,0.5524,90.0]],["p56_05",56,608,458,0,""],["p56_06",56,820,174,0,"D1",[0.4906,0.4871,179.0]],["p56_frame",56,820,694,1,""],["p56_panel",56,820,694,2,""],["p57_01",57,119,92,0,""],["p57_02",57,622,636,0,"D5",[0.527,0.4853,33.5]],["p57_03",57,763,820,0,"D1",[0.4894,0.4674,89.5]],["p57_04",57,435,820,0,""],["p57_05",57,818,820,0,"≈D1",[0.4863,0.4596,89.0]],["p57_06",57,610,820,0,""],["p57_07",57,466,416,0,"≈D1",[0.4873,0.4453,90.0]],["p57_frame",57,820,697,1,""],["p57_panel",57,820,697,2,""],["p58_01",58,820,536,0,"≈D1",[0.5175,0.4985,90.5]],["p58_02",58,820,635,0,"D1",[0.4921,0.7482,90.0]],["p58_03",58,820,535,0,"≈D1",[0.5333,0.49,90.5]],["p58_04",58,728,732,0,""],["p58_05",58,724,732,0,""],["p58_frame",58,820,695,1,""],["p58_panel",58,820,695,2,""],["p59_01",59,820,481,0,""],["p59_02",59,820,217,0,"D1",[0.4904,0.4564,90.5]],["p59_03",59,820,664,0,""],["p59_04",59,820,669,0,""],["p59_frame",59,820,699,1,""],["p59_panel",59,820,699,2,""],["p60_01",60,820,655,0,""],["p60_frame",60,820,686,1,""],["p60_panel",60,820,686,2,""]];
const libImg = {}, ATLAS_C = 120, ATLAS_COLS = 18;
function loadLib(id) {
  if (!libImg[id]) libImg[id] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = e => { delete libImg[id]; rej(e); }; im.src = 'ornaments/' + id + '.webp?v=2'; });
  return libImg[id];
}
async function placeLib(e) {
  const [id, n] = e; let img;
  try { img = await loadLib(id); } catch (err) { delete libImg[id]; const st = $('status'); st.classList.add('warn'); st.textContent = 'Could not load ornament ' + id + '. Check your connection and try again.'; return; }
  place(n, img, 0, 0, img.width, img.height, { lib: id, sym: e[5] || '', sp: e[6] || null });
}
(() => {
  const sel = $('libPlate');
  for (let n = FIRST_PLATE; n <= NPLATES; n++) if (LIB.some(e => e[1] === n)) { const o = document.createElement('option'); o.value = n; o.textContent = plateLabel(n); sel.appendChild(o); }
  sel.onchange = renderLib; $('libKind').onchange = renderLib; $('libSym').onchange = renderLib;
})();
const symBadge = l => l ? `<b class="sym${l[0] === '≈' ? ' ap' : ''}">${l}</b>` : '';
function renderLib() {
  const pf = +$('libPlate').value, kv = $('libKind').value, list = $('libList'); list.innerHTML = '';
  const sv = $('libSym').value, grp = effGroup().key;
  const symOk = l0 => { const l = (l0 || '').replace('≈', '');
    return !sv || (sv === 'sym' ? !!l : sv === 'D' ? l[0] === 'D' : sv === 'rot' ? !!l && symN(l) >= 2 : fitSites(l, grp).length > 0); };
  const items = LIB.filter(e => e[1] >= FIRST_PLATE && (!pf || e[1] === pf) && (kv === 'all' || e[4] === +kv) && symOk(e[5]));
  const KN = ['ornament', 'whole frame', 'whole plate'];
  $('libCount').textContent = (kv === 'all' ? items.length + ' items' : items.length + ' ' + KN[+kv] + (items.length === 1 ? '' : 's'))
    + (sv === 'fit' ? ` that sit whole on a site of ${grp}` : '');
  if (!items.length) list.innerHTML = `<p class="small">${sv === 'fit' && !(SITES[grp] || []).length ? `Group ${grp} has no rotation centres or mirrors, so every ornament fits it equally (choose “any”).` : 'Nothing matches these filters.'}</p>`;
  let cur = 0, grid = null;
  for (const e of items) {
    if (e[1] !== cur) { cur = e[1]; const h = document.createElement('h4'); h.textContent = plateLabel(cur); list.appendChild(h);
      grid = document.createElement('div'); grid.className = 'og'; list.appendChild(grid); }
    const d = document.createElement('div'); d.title = e[0] + (e[4] ? ` (${KN[e[4]]})` : '') + (e[5] ? ' · symmetry ' + SYMTXT(e[5]) : '');
    const k = LIB.indexOf(e);
    d.innerHTML = `<i style="display:block;width:${ATLAS_C}px;height:${ATLAS_C}px;background:url(othumbs_atlas.webp?v=2) -${(k % ATLAS_COLS) * ATLAS_C}px -${Math.floor(k / ATLAS_COLS) * ATLAS_C}px"></i><span>${e[4] ? KN[e[4]] : ''}</span>${symBadge(e[5])}`;
    d.onclick = () => placeLib(e); grid.appendChild(d);
  }
}
$('shuffle').onclick = () => { const pool = LIB.filter(e => !e[4] && e[1] >= FIRST_PLATE); targetSlot = -1; placeLib(pool[Math.floor(Math.random() * pool.length)]); };
$('addOrn').onclick = () => openPicker(-1);
$('clearAll').onclick = () => { S.orn = []; S.sel = -1; renderSlots(); redraw(true); };

/* ---------- plate picker & crop ---------- */
const dlg = $('dlg'); let targetSlot = 0, cropImg = null, cropN = 0, cropK = 1, sel = null;
const grid = $('plateGrid');
for (let n = FIRST_PLATE; n <= NPLATES; n++) {
  const f = document.createElement('figure');
  f.innerHTML = `<img loading="lazy" src="thumbs/plate_${pad(n)}.jpg" alt="${plateLabel(n)}"><figcaption>${plateLabel(n)}</figcaption>`;
  f.onclick = () => openCrop(n);
  grid.appendChild(f);
}
function openPicker(slot) {
  targetSlot = slot; showLib(); dlg.showModal();
}
function showTab(t) {
  $('libWrap').hidden = t !== 'lib'; grid.hidden = t !== 'plates'; $('mineWrap').hidden = t !== 'mine'; $('cropWrap').hidden = true; $('cropFoot').hidden = true;
  $('tabLib').classList.toggle('on', t === 'lib'); $('tabPlates').classList.toggle('on', t === 'plates'); $('tabMine').classList.toggle('on', t === 'mine');
  $('dlgTitle').textContent = targetSlot < 0 ? 'Add an ornament' : `Replace ornament #${targetSlot + 1}`;
}
function showLib() {
  showTab('lib'); const fit = $('libSymFit'); fit.textContent = S.mode === 'lattice' ? `fits ${effGroup().key} (sits whole on a centre or mirror)` : 'fits the group (Brewster or wallpaper mode)';
  fit.disabled = S.mode !== 'lattice'; if (fit.disabled && $('libSym').value === 'fit') $('libSym').value = 'sym';
  renderLib();
}
function showGrid() { showTab('plates'); }
function showMine() { showTab('mine'); renderMine(); }
$('tabLib').onclick = showLib; $('tabPlates').onclick = showGrid; $('tabMine').onclick = showMine;

/* ---------- my images: the user's own pictures, kept in this browser (IndexedDB), exported/imported as JSON ---------- */
const MINE_MAX = 1600, MINE_FMT = 'mirror-tool-images';
const MINE = { db: null, list: [], ready: null, mem: false };   // list: {id, name, w, h, sym, src, added}
MINE.ready = new Promise(res => {
  let r; try { r = indexedDB.open('mirror-tool', 1); } catch (e) { MINE.mem = true; return res(); }
  r.onupgradeneeded = () => r.result.createObjectStore('images', { keyPath: 'id' });
  r.onsuccess = () => { MINE.db = r.result; const q = MINE.db.transaction('images').objectStore('images').getAll();
    q.onsuccess = () => { MINE.list = q.result.sort((a, b) => a.added - b.added); res(); }; q.onerror = () => res(); };
  r.onerror = r.onblocked = () => { MINE.mem = true; res(); };
});
function mineTx(fn) {
  if (!MINE.db) return Promise.resolve(false);
  return new Promise(res => { try { const t = MINE.db.transaction('images', 'readwrite'); fn(t.objectStore('images'));
    t.oncomplete = () => res(true); t.onerror = t.onabort = () => res(false); } catch (e) { res(false); } });
}
const mineImg = {};
function loadMine(r) {
  if (!mineImg[r.id]) mineImg[r.id] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = r.src; });
  return mineImg[r.id];
}
function mineMsg(t, warn) { const m = $('mineCount'); m.textContent = t; m.style.color = warn ? '#a33' : ''; }
async function mineAdd(recs) {          // recs: {name, src}; each is decoded, reduced to MINE_MAX px and measured
  let ok = 0, bad = 0, dup = 0, full = false;
  for (const r of recs) {
    if (typeof r.src !== 'string' || !/^data:image\//.test(r.src)) { bad++; continue; }
    let im; try { im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.src; }); } catch (e) { bad++; continue; }
    if (!im.naturalWidth) { bad++; continue; }
    const k = Math.min(1, MINE_MAX / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    let src = r.src;
    if (k < 1 || !/^data:image\/(webp|png|jpeg)/.test(src)) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
      src = c.toDataURL('image/webp', 0.92); if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/png');
    }
    if (MINE.list.some(q => q.src === src)) { dup++; continue; }
    const sy = symmetryOf(im), sym = sy.label === 'C1' ? '' : (sy.approx ? '≈' : '') + sy.label;
    const rec = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: String(r.name || 'image').slice(0, 80), w, h, sym, sp: sy.sp, src, added: Date.now() + ok };
    if (MINE.db && !(await mineTx(st => st.put(rec)))) { full = true; break; }
    MINE.list.push(rec); ok++;
  }
  await renderMine();
  const bits = [ok ? `Added ${ok} image${ok === 1 ? '' : 's'}.` : '', dup ? `${dup} already here.` : '', bad ? `${bad} could not be read as images.` : '',
    full ? 'The browser refused to store more (storage full or private mode).' : '', ok && !MINE.db ? 'This browser does not allow local storage here, so they last only until the page is closed: use Save library.' : ''];
  mineMsg(bits.filter(Boolean).join(' '), bad || full || (ok && !MINE.db));
}
async function mineDel(r) {
  if (!confirmDel(r.name)) return;
  await mineTx(st => st.delete(r.id)); MINE.list = MINE.list.filter(q => q.id !== r.id); delete mineImg[r.id]; renderMine();
}
function confirmDel(name) { try { return window.confirm(`Remove “${name}” from your images? (Save the library first if you want to keep a copy.)`); } catch (e) { return true; } }
async function renderMine() {
  await MINE.ready;
  const list = $('mineList'); list.innerHTML = '';
  const n = MINE.list.length; mineMsg(n ? `${n} image${n === 1 ? '' : 's'} in this browser` : '');
  $('mineExp').disabled = !n;
  if (!n) { list.innerHTML = '<p class="small">No images yet.</p>'; return; }
  const g = document.createElement('div'); g.className = 'og'; list.appendChild(g);
  for (const r of MINE.list) {
    const d = document.createElement('div'); d.title = `${r.name} · ${r.w}×${r.h}` + (r.sym ? ' · symmetry ' + SYMTXT(r.sym) : '');
    d.innerHTML = `<img alt="">${symBadge(r.sym)}<span class="nm"></span><button class="del" title="Remove from your images">×</button>`;
    d.querySelector('.nm').textContent = r.name; d.querySelector('img').src = r.src;
    d.onclick = async ev => { if (ev.target.classList.contains('del')) return;
      let im; try { im = await loadMine(r); } catch (e) { mineMsg('Could not open this image.', true); return; }
      if (r.sym && !r.sp) r.sp = symmetryOf(im).sp;
      place(0, im, 0, 0, im.width, im.height, { label: r.name, sym: r.sym, sp: r.sym ? r.sp : null }); };
    d.querySelector('.del').onclick = ev => { ev.stopPropagation(); mineDel(r); };
    g.appendChild(d);
  }
}
const readAs = (f, how) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr[how](f); });
async function mineFiles(files) {
  const imgs = [], jsons = [];
  for (const f of files) (/json$/i.test(f.type) || /\.json$/i.test(f.name) ? jsons : /^image\//.test(f.type) ? imgs : jsons).push(f);
  const recs = [];
  for (const f of imgs) try { recs.push({ name: f.name.replace(/\.[^.]+$/, ''), src: await readAs(f, 'readAsDataURL') }); } catch (e) {}
  for (const f of jsons) {
    let j; try { j = JSON.parse(await readAs(f, 'readAsText')); } catch (e) { mineMsg(`${f.name} is not a saved image library.`, true); continue; }
    const arr = Array.isArray(j) ? j : j && Array.isArray(j.images) ? j.images : null;
    if (!arr) { mineMsg(`${f.name} is not a saved image library.`, true); continue; }
    for (const r of arr) if (r && typeof r === 'object') recs.push({ name: r.name, src: r.src });
  }
  mineMsg('Adding…'); await MINE.ready; await mineAdd(recs);
}
$('mineAdd').onclick = () => $('mineFile').click();
$('mineImp').onclick = () => $('mineJson').click();
$('mineFile').onchange = e => { mineFiles([...e.target.files]); e.target.value = ''; };
$('mineJson').onchange = e => { mineFiles([...e.target.files]); e.target.value = ''; };
$('mineExp').onclick = async () => {
  await MINE.ready; if (!MINE.list.length) return;
  const out = { format: MINE_FMT, version: 1, saved: new Date().toISOString(), images: MINE.list.map(({ name, w, h, sym, src }) => ({ name, w, h, sym, src })) };
  download(new Blob([JSON.stringify(out)], { type: 'application/json' }), 'my_images_' + new Date().toISOString().slice(0, 10) + '.json');
  if (inFrame) mineMsg('If no file appears, this preview blocks downloads: open the tool on its own page.', true);
};
(() => { const z = $('mineDrop');
  z.ondragover = e => { e.preventDefault(); z.classList.add('over'); };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('over'); if (e.dataTransfer.files.length) mineFiles([...e.dataTransfer.files]); };
})();
$('dlgClose').onclick = () => dlg.close();
$('cropBack').onclick = showGrid;
const cc = $('cropCanvas'), cx = cc.getContext('2d');
async function openCrop(n) {
  cropN = n; try { cropImg = await loadPlate(n); } catch (err) { delete imgCache[n]; return; } sel = null; $('cropUse').disabled = true;
  grid.hidden = true; $('libWrap').hidden = true; $('mineWrap').hidden = true; $('cropWrap').hidden = false; $('cropFoot').hidden = false;
  $('dlgTitle').textContent = `${plateLabel(n)} — select an ornament`;
  const maxW = Math.min(1060, window.innerWidth * 0.9), maxH = window.innerHeight * 0.92 - 140;
  cropK = Math.min(maxW / cropImg.width, maxH / cropImg.height);
  cc.width = Math.round(cropImg.width * cropK); cc.height = Math.round(cropImg.height * cropK);
  drawCrop();
}
function drawCrop() {
  cx.drawImage(cropImg, 0, 0, cc.width, cc.height);
  if (!sel) return;
  const r = normRect(sel);
  cx.save(); cx.fillStyle = 'rgba(40,30,15,.45)';
  cx.beginPath(); cx.rect(0, 0, cc.width, cc.height); cx.rect(r.x, r.y, r.w, r.h); cx.fill('evenodd');
  cx.strokeStyle = '#2f5d5a'; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.strokeRect(r.x, r.y, r.w, r.h); cx.restore();
}
const normRect = s => ({ x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), w: Math.abs(s.x1 - s.x0), h: Math.abs(s.y1 - s.y0) });
function canvasPt(c, e) { const b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * c.width / b.width, y: (e.clientY - b.top) * c.height / b.height }; }
cc.addEventListener('pointerdown', e => { cc.setPointerCapture(e.pointerId); const p = canvasPt(cc, e); sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; drawCrop(); });
cc.addEventListener('pointermove', e => { if (!sel || !cc.hasPointerCapture(e.pointerId)) return; const p = canvasPt(cc, e); sel.x1 = p.x; sel.y1 = p.y; drawCrop();
  const r = normRect(sel); $('cropUse').disabled = r.w < 8 || r.h < 8; });
$('cropUse').onclick = () => { const r = normRect(sel); place(cropN, cropImg, r.x / cropK, r.y / cropK, r.w / cropK, r.h / cropK); };
$('cropWhole').onclick = () => place(cropN, cropImg, 0, 0, cropImg.width, cropImg.height);
function place(n, img, x, y, w, h, opts = {}) {
  if (PICK_TARGET) { const cb = PICK_TARGET; PICK_TARGET = null; if (dlg.open) dlg.close(); cb(img, x, y, w, h, opts.label || opts.lib || plateLabel(n)); return; }
  const replacing = targetSlot >= 0 && targetSlot < S.orn.length;
  const prev = replacing ? S.orn[targetSlot] : null;
  const s = opts.s ?? Math.min(1.2, 440 / w, 440 / h);
  const k = S.orn.length;
  const o = { n, img, cx: x, cy: y, cw: w, ch: h,
    x: opts.x ?? (prev ? prev.x : SW / 2 + ((k * 67) % 300) - 150),
    y: opts.y ?? (prev ? prev.y : SH / 2 + ((k * 41) % 200) - 100),
    s: prev && !opts.s ? prev.s : s, rot: opts.rot ?? (prev ? prev.rot : 0), flip: false, lib: opts.lib || null, label: opts.label || null, sym: opts.sym || '', sp: opts.sp || null };
  if (S.mode === 'lattice' && o.sp && T.snapSym) { snapOrn(o, Infinity); snapNote = null; }
  if (replacing) { S.orn[targetSlot] = o; S.sel = targetSlot; }
  else { if (S.orn.length >= MAX_ORN) return; S.orn.push(o); S.sel = S.orn.length - 1; }
  if (dlg.open) dlg.close(); renderSlots(); redraw(true);
}

/* ---------- sheet interaction ---------- */
let drag = null;
function hitOrn(p) {
  for (let i = S.orn.length - 1; i >= 0; i--) {
    const o = S.orn[i];
    const dx = p.x - o.x, dy = p.y - o.y, c = Math.cos(-rad(o.rot)), s = Math.sin(-rad(o.rot));
    const qx = (dx * c - dy * s) / o.s, qy = (dx * s + dy * c) / o.s;
    if (Math.abs(qx) <= o.cw / 2 && Math.abs(qy) <= o.ch / 2) return i;
  }
  return -1;
}
function hitHandle(p) {
  const tol = 20 * sheet.width / sheet.getBoundingClientRect().width;
  let best = null, bd = Math.max(tol, 16);
  for (const h of handles()) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < bd) { bd = d; best = h; } }
  return best;
}
sheet.addEventListener('pointerdown', e => {
  const p = canvasPt(sheet, e), h = hitHandle(p);
  if (h) drag = { kind: h.id };
  else { const i = hitOrn(p); if (i < 0) return;
    S.sel = i; renderSlots(); const o = S.orn[i]; drag = { kind: 'orn', i, ox: o.x - p.x, oy: o.y - p.y }; }
  sheet.setPointerCapture(e.pointerId); redraw();
});
sheet.addEventListener('pointermove', e => {
  const p = canvasPt(sheet, e);
  if (!drag) { sheet.style.cursor = hitHandle(p) ? 'grab' : hitOrn(p) >= 0 ? 'move' : 'default'; return; }
  const O = S.O, ang = deg(Math.atan2(p.y - O.y, p.x - O.x));
  switch (drag.kind) {
    case 'O': S.O = { x: p.x, y: p.y }; break;
    case 'rot': if (S.mode === 'hinge') S.beta = ang; else S.theta = ang; break;
    case 'open': S.alpha = snapAlpha(Math.min(180, Math.max(3, 2 * Math.abs(wrap180(ang - S.beta))))); break;
    case 'cell': S.lt = ang; S.cell = Math.min(600, Math.max(40, Math.hypot(p.x - O.x, p.y - O.y))); break;
    case 'dist': { const n = dir(S.theta + 90); S.d = Math.min(600, Math.max(10, (p.x - O.x) * n.x + (p.y - O.y) * n.y)); break; }
    case 'orn': { const o = S.orn[drag.i]; o.x = p.x + drag.ox; o.y = p.y + drag.oy;
      const r0 = o.rot;
      if (S.mode === 'lattice' && T.snapSym && o.sp && !e.altKey) snapOrn(o, 22 * sheet.width / sheet.getBoundingClientRect().width); else snapNote = null;
      if (o.rot !== r0) renderSlots(); redraw(true); return; }
  }
  redraw();
});
const endDrag = () => { drag = null; if (snapNote) { snapNote = null; redraw(); } };
sheet.addEventListener('pointerup', endDrag); sheet.addEventListener('pointercancel', endDrag);
sheet.addEventListener('wheel', e => {
  const i = hitOrn(canvasPt(sheet, e)); if (i < 0) return;
  e.preventDefault(); const o = S.orn[i]; S.sel = i;
  if (e.shiftKey) o.rot = wrap180(o.rot + (e.deltaY || e.deltaX) * 0.1);
  else o.s = Math.min(3, Math.max(0.1, o.s * Math.exp(-e.deltaY * 0.0012)));
  renderSlots(); redraw(true);
}, { passive: false });
result.addEventListener('wheel', e => { e.preventDefault(); S.zoom = Math.min(3, Math.max(0.25, S.zoom * Math.exp(-e.deltaY * 0.0012))); redraw(); }, { passive: false });

/* ---------- export ---------- */
$('export').onclick = () => {
  try {
    result.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b);
      a.download = `mirror_${S.mode}_${fmt(S.mode === 'hinge' ? S.alpha : S.d)}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  } catch (err) {
    const st = $('status'); st.classList.add('warn');
    st.textContent = 'Your browser blocks saving canvases built from local files (file://). Serve the folder instead: run "python3 -m http.server" in it and open http://localhost:8000.';
  }
};

/* ---------- Verneuil's own dial (preface figure, plate 2) ---------- */
async function demo() {
  let img; try { img = await loadPlate(2); } catch (e) { const st = $('status'); st.classList.add('warn'); st.textContent = 'Could not load plate 2 for the dial demo. Check your connection and try again.'; return; }
  // hinge O of the dial measured at (2889,1189) on the 3698 px scan → scale to this image
  const k = img.width / 3698, Ox = 2889 * k, Oy = 1189 * k;
  const half = 225 * img.width / 1600;
  S.orn = []; targetSlot = -1;
  place(2, img, Ox - half, Oy - half, 2 * half, 2 * half, { x: SW / 2, y: SH / 2, s: 1.4 });
  S.method = 'verneuil'; S.mode = 'hinge'; S.vmode = 'hinge'; S.O = { x: SW / 2, y: SH / 2 }; S.beta = -90; S.alpha = 120; S.zoom = 1;
  renderSlots(); redraw(true);
}
$('demo').onclick = demo;
