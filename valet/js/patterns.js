/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — cloth patterns. Each pattern is { type, scale (cm, one repeat), hex2 (accent) };
   the garment's own colour is the ground. Tiles are drawn on a canvas so the same drawing is
   used for the previews and swatches.
   Loads without a DOM (for tests); drawing needs a canvas. */
// @ts-check
(function () {
  'use strict';
  const VC = window.VC;

  /* cover: share of the tile in the accent colour, in linear light, measured from the drawings
     below (measureCover repeats the measurement in a browser). use: where the pattern is usual.
     Scales follow common cloth. */
  const TYPES = [
    { id: 'solid', name: 'Plain', family: 'Plain', scale: 0, cover: 0, use: 'anything' },
    { id: 'nailhead', name: 'Nailhead', family: 'Semi-solid', scale: 0.25, min: 0.15, max: 0.5, cover: 0.1916, use: 'suits, jackets' },
    { id: 'birdseye', name: 'Birdseye', family: 'Semi-solid', scale: 0.35, min: 0.2, max: 0.6, cover: 0.1035, use: 'suits, jackets' },
    { id: 'herringbone', name: 'Herringbone', family: 'Weave', scale: 1.2, min: 0.4, max: 4, cover: 0.627, use: 'jackets, coats, trousers' },
    { id: 'pinstripe', name: 'Pinstripe', family: 'Stripe', scale: 1.2, min: 0.6, max: 2, cover: 0.0575, use: 'suits, shirts' },
    { id: 'chalkstripe', name: 'Chalk stripe', family: 'Stripe', scale: 1.8, min: 1, max: 3, cover: 0.0441, use: 'suits' },
    { id: 'bengal', name: 'Bengal stripe', family: 'Stripe', scale: 1.1, min: 0.8, max: 1.5, cover: 0.5, use: 'shirts' },
    { id: 'candy', name: 'Candy stripe', family: 'Stripe', scale: 0.6, min: 0.3, max: 1, cover: 0.2974, use: 'shirts' },
    { id: 'gingham', name: 'Gingham', family: 'Check', scale: 0.6, min: 0.2, max: 2.5, cover: 0.3579, use: 'shirts' },
    { id: 'tattersall', name: 'Tattersall', family: 'Check', scale: 1.5, min: 0.8, max: 3, cover: 0.0799, use: 'shirts, waistcoats' },
    { id: 'houndstooth', name: 'Houndstooth', family: 'Check', scale: 0.8, min: 0.3, max: 6, cover: 0.6289, use: 'jackets, coats, ties' },
    { id: 'glen', name: 'Glen check', family: 'Check', scale: 6, min: 3, max: 12, cover: 0.463, use: 'suits, jackets' },
    { id: 'windowpane', name: 'Windowpane', family: 'Check', scale: 7, min: 3, max: 14, cover: 0.033, use: 'jackets, suits, coats' },
    { id: 'pindot', name: 'Pin dot', family: 'Dot', scale: 0.7, min: 0.3, max: 1.5, cover: 0.033, use: 'ties' },
    { id: 'repp', name: 'Repp stripe', family: 'Stripe', scale: 2.2, min: 0.8, max: 4, cover: 0.3455, use: 'ties' },
    { id: 'breton', name: 'Breton stripe', family: 'Stripe', scale: 2.4, min: 1, max: 4, cover: 0.3485, use: 'knits, tees' },
    { id: 'paisley', name: 'Paisley', family: 'Figure', scale: 2.5, min: 1, max: 10, cover: 0.126, use: 'ties, scarves, squares' },
    { id: 'foulard', name: 'Foulard', family: 'Figure', scale: 1.2, min: 0.6, max: 2.5, cover: 0.1122, use: 'ties, bow ties, squares' }
  ];

  /* The drawings' Fourier spectra, measured once in a browser from a 128-pixel tile of each
     drawing in black and white (linear light): [cycles per repeat, amplitude], the 24 strongest
     components, each ± pair counted once. Amplitude is per unit of light-dark difference between
     the two colours, so for real colours a component's modulation is amp × |Y2 − Y1| / mean Y. */
  const SPECTRA = {
    nailhead: [[2,0.2734],[2.828,0.1951],[4,0.0532],[4.472,0.038],[6,0.0776],[6.325,0.0554],[8,0.0494],[8.246,0.0353],[8.485,0.0157],[10,0.0314],[10.198,0.0224],[12,0.0434],[12.166,0.031],[16,0.0357],[16.125,0.0255],[20,0.0268],[20.1,0.0191],[22,0.0146],[24,0.0174],[26,0.0189],[30,0.0198],[34,0.018],[38,0.0141],[48,0.0146]],
    birdseye: [[1.414,0.1653],[2,0.1291],[2.828,0.0695],[3.162,0.0461],[4.243,0.0179],[4.472,0.0277],[5.099,0.0458],[5.657,0.0518],[5.831,0.0521],[6,0.0512],[6.325,0.0485],[7.071,0.0351],[7.211,0.0321],[7.616,0.023],[8,0.0136],[9.899,0.0102],[10,0.0101],[16.553,0.0107],[16.971,0.0106],[17.029,0.0106],[17.088,0.0108],[17.205,0.0106],[17.263,0.01],[17.493,0.0101]],
    herringbone: [[2,0.0277],[4,0.0273],[6,0.0265],[8,0.0731],[8.246,0.077],[8.944,0.094],[9.434,0.0233],[10,0.1815],[10.63,0.2783],[11.314,0.182],[12.042,0.0334],[12.806,0.0307],[20.616,0.0402],[21.26,0.103],[21.932,0.1063],[22.627,0.0355],[23.345,0.0273],[42.521,0.0564],[43.186,0.0636],[43.863,0.0308],[53.814,0.0302],[54.489,0.0229],[75.073,0.0297],[75.743,0.0238]],
    pinstripe: [[1,0.1143],[2,0.1124],[3,0.1093],[4,0.105],[5,0.0996],[6,0.0932],[7,0.086],[8,0.0781],[9,0.0697],[10,0.0609],[11,0.0519],[12,0.0428],[13,0.0338],[14,0.0252],[15,0.0169],[21,0.0174],[22,0.02],[23,0.0217],[24,0.0226],[25,0.0226],[26,0.0218],[27,0.0204],[28,0.0184],[29,0.016]],
    chalkstripe: [[1,0.0872],[2,0.0839],[3,0.0787],[4,0.0722],[5,0.0649],[6,0.0573],[7,0.0499],[8,0.043],[9,0.0368],[10,0.0315],[11,0.027],[12,0.0232],[13,0.0201],[14,0.0175],[15,0.0154],[16,0.0136],[17,0.0121],[18,0.0108],[19,0.0097],[20,0.0088],[21,0.008],[22,0.0073],[23,0.0066],[24,0.006]],
    bengal: [[1,0.6367],[3,0.2124],[5,0.1276],[7,0.0914],[9,0.0713],[11,0.0586],[13,0.0498],[15,0.0434],[17,0.0386],[19,0.0348],[21,0.0317],[23,0.0292],[25,0.0271],[27,0.0254],[29,0.0239],[31,0.0227],[33,0.0216],[35,0.0206],[37,0.0198],[39,0.0191],[41,0.0185],[43,0.018],[45,0.0175],[47,0.0171]],
    candy: [[1,0.512],[2,0.3044],[3,0.0706],[4,0.0894],[5,0.1274],[6,0.0667],[7,0.0232],[8,0.0742],[9,0.0605],[11,0.0439],[12,0.0523],[13,0.0203],[14,0.0226],[15,0.0427],[16,0.0279],[18,0.0323],[19,0.0306],[21,0.0216],[22,0.0296],[25,0.026],[26,0.0193],[28,0.0204],[29,0.0216],[32,0.0214]],
    gingham: [[1,0.3183],[1.414,0.1152],[3,0.1062],[3.162,0.0384],[4.243,0.0128],[5,0.0638],[5.099,0.0231],[7,0.0457],[7.071,0.0165],[9,0.0357],[9.055,0.0129],[11,0.0293],[11.045,0.0106],[13,0.0249],[15,0.0217],[17,0.0193],[19,0.0174],[21,0.0159],[23,0.0146],[25,0.0136],[27,0.0127],[29,0.012],[31,0.0113],[33,0.0108]],
    tattersall: [[1,0.0458],[2,0.0779],[3,0.0451],[4,0.0764],[5,0.0438],[6,0.0739],[7,0.0419],[8,0.0705],[9,0.0395],[10,0.0662],[11,0.0365],[12,0.0613],[13,0.0332],[14,0.0557],[15,0.0295],[16,0.0496],[17,0.0255],[18,0.0433],[19,0.0214],[20,0.0367],[21,0.0173],[22,0.0301],[24,0.0236],[26,0.0173]],
    houndstooth: [[1.414,0.403],[2.828,0.2054],[3.162,0.1367],[4.243,0.11],[5.099,0.082],[5.657,0.1014],[5.831,0.0648],[6.325,0.0666],[7.071,0.059],[8.485,0.0217],[9.055,0.0438],[10.198,0.0422],[11.045,0.0382],[11.402,0.0305],[12.649,0.0338],[13.038,0.0324],[13.342,0.0244],[14.142,0.0278],[15.033,0.0283],[17.029,0.0229],[18.111,0.024],[19.026,0.0227],[20.396,0.0204],[21.024,0.0206]],
    glen: [[1.414,0.1175],[3.162,0.0628],[4.243,0.07],[5,0.0733],[5.657,0.0986],[6.403,0.0529],[7.071,0.04],[9.434,0.0407],[9.899,0.0493],[10.63,0.1055],[11.314,0.0986],[11.402,0.0384],[12.042,0.0903],[15,0.0801],[15.033,0.0603],[16,0.1409],[16.031,0.0879],[17,0.085],[17.029,0.0488],[31,0.0433],[32,0.0695],[32.016,0.0416],[33,0.0399],[64,0.0466]],
    windowpane: [[1,0.0327],[2,0.0327],[3,0.0326],[4,0.0325],[5,0.0324],[6,0.0322],[7,0.032],[8,0.0318],[9,0.0316],[10,0.0313],[11,0.031],[12,0.0307],[13,0.0303],[14,0.03],[15,0.0296],[16,0.0292],[17,0.0287],[18,0.0283],[19,0.0278],[20,0.0273],[21,0.0268],[22,0.0263],[23,0.0257],[24,0.0252]],
    pindot: [[1.414,0.0626],[2,0.0593],[2.828,0.0532],[3.162,0.0503],[4,0.0422],[4.243,0.0396],[4.472,0.0372],[5.099,0.0305],[5.657,0.0245],[5.831,0.0227],[6,0.0209],[6.325,0.0176],[7.071,0.0105],[7.211,0.0093],[10.198,0.0077],[10.296,0.0077],[10.77,0.0084],[11.045,0.0089],[11.314,0.0084],[11.402,0.0088],[11.662,0.0084],[12,0.0086],[12.083,0.0081],[12.166,0.0083]],
    repp: [[1.414,0.5631],[2.828,0.2626],[4.243,0.0243],[5.657,0.1482],[7.071,0.0959],[8.485,0.0241],[9.899,0.0877],[11.314,0.0535],[12.728,0.0237],[14.142,0.0626],[15.556,0.0336],[16.971,0.0232],[18.385,0.0483],[19.799,0.022],[21.213,0.0226],[22.627,0.0389],[25.456,0.0218],[26.87,0.032],[29.698,0.021],[31.113,0.0266],[33.941,0.02],[35.355,0.0223],[38.184,0.0191],[39.598,0.0187]],
    breton: [[1,0.5659],[2,0.2592],[3,0.0303],[4,0.1503],[5,0.092],[6,0.0299],[7,0.0891],[8,0.049],[9,0.0294],[10,0.0633],[11,0.0287],[12,0.0286],[13,0.0484],[15,0.0277],[16,0.0382],[18,0.0265],[19,0.0306],[21,0.0252],[22,0.0244],[24,0.0237],[25,0.0194],[27,0.022],[30,0.0203],[33,0.0184]],
    paisley: [[1,0.1282],[1.414,0.1693],[2,0.0511],[2.236,0.0995],[2.828,0.0785],[3,0.0409],[3.162,0.048],[3.606,0.067],[4,0.0311],[4.123,0.0396],[4.243,0.044],[4.472,0.0478],[5,0.047],[5.099,0.0513],[5.831,0.0263],[6,0.0311],[6.083,0.0399],[7.81,0.0257],[8.544,0.0413],[9.22,0.033],[9.849,0.0253],[10,0.0284],[10.296,0.0285],[11.18,0.0283]],
    foulard: [[1,0.1291],[1.414,0.1489],[2,0.0986],[2.236,0.0187],[3,0.0206],[3.606,0.0744],[4.123,0.0508],[4.243,0.0501],[4.472,0.0335],[5,0.0649],[5.385,0.0403],[6.083,0.0152],[7.071,0.029],[7.211,0.0196],[7.28,0.0127],[7.81,0.0169],[8.485,0.0119],[9.899,0.0178],[10,0.0116],[10.63,0.0111],[12.728,0.0133],[13.454,0.0207],[13.601,0.0115],[16.279,0.0121]]
  };
  const byId = {};
  TYPES.forEach(function (t) { byId[t.id] = t; });

  /* Scale classes from the Outfit Check card (B): measured as the repeat, checked by hand. */
  function scaleClass(cm) {
    if (!cm || cm < 1) return { id: 'semi', label: 'semi-solid', hand: 'smaller than a fingernail: reads as solid from a step away' };
    if (cm < 3) return { id: 'small', label: 'small', hand: 'one to two finger widths: shirts and ties' };
    if (cm < 9) return { id: 'medium', label: 'medium', hand: 'up to a palm width: jackets, and the only medium in an outfit' };
    if (cm <= 15) return { id: 'large', label: 'large', hand: 'wider than a palm: coats only' };
    return { id: 'huge', label: 'oversized', hand: 'wider than a hand span: too large to wear' };
  }

  function norm(pat) {
    if (!pat || !byId[pat.type] || pat.type === 'solid') return { type: 'solid' };
    const t = byId[pat.type];
    // each pattern keeps to the repeat it is made in (a 15 cm pinstripe or a 3 mm windowpane does not exist)
    const lo = t.min || 0.1, hi = t.max || 25;
    const out = { type: pat.type, scale: Math.max(lo, Math.min(hi, +pat.scale || t.scale)), hex2: pat.hex2 || '#f7f6f2' };
    // share of the cloth in the second colour, when it differs from the drawn default (a dense foulard,
    // a grid that is half rust and half cream): set by the user, or measured from a photo
    const cv = +pat.cover;
    if (pat.cover != null && isFinite(cv) && cv >= COVER_MIN && cv <= COVER_MAX) out.cover = Math.round(cv * 100) / 100;
    return out;
  }
  const COVER_MIN = 0.02, COVER_MAX = 0.9;
  /* The share of the second colour: the piece's own when it has one, otherwise the pattern's default. */
  function coverOf(pat) { pat = norm(pat); return pat.type === 'solid' ? 0 : (pat.cover != null ? pat.cover : byId[pat.type].cover); }

  /* The colour a pattern adds up to from a distance: the two colours mixed by area, in linear
     light (A: the eye integrates fine detail it cannot resolve). */
  function mean(ground, pat) {
    pat = norm(pat);
    if (pat.type === 'solid') return ground;
    const f = coverOf(pat), a = VC.hexToRgb(ground).map(VC.srgbToLinear), b = VC.hexToRgb(pat.hex2).map(VC.srgbToLinear);
    return VC.rgbToHex(a.map(function (v, i) { return VC.linearToSrgb(v * (1 - f) + b[i] * f); }));
  }


  /* ---------- How the cloth reads from a distance (vision.js) ----------
     Each Fourier component of the cloth is a grating. Its size on the retina follows from the
     repeat and the distance; it is visible when its modulation exceeds the eye's threshold at
     that size (Barten 1999), and colour-only differences need coarser detail (Mullen 1985).
     Above threshold, apparent contrast is roughly the physical contrast less the threshold
     (contrast constancy, Georgeson and Sullivan 1975). The words on top are conventions (B):
       plain:   nothing is visible.
       texture: something is visible, but only finer than 10 c/deg (each light or dark element
                under about 3 arcmin: grain, not shapes), or only faintly (under 5% contrast
                and under 5 ΔE of colour).
       pattern: the rest.
     How strongly it shows is the visible components added in phase: a thin line or a small dot
     is made of many weak harmonics that all peak at the line, so judging each harmonic alone
     would call a sharp windowpane line faint. The sum is an upper bound for patterns whose
     harmonics do not all peak together, such as checks. */
  const FINE_CPD = 10, FAINT = 0.05, CHROMA_JND = 2.3, CHROMA_FAINT = 5;
  function relY(hex) { const l = VC.hexToRgb(hex).map(VC.srgbToLinear); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
  function reads(ground, pat, m) {
    pat = norm(pat);
    if (pat.type === 'solid') return { state: 'plain', why: 'solid', m: m };
    const V = window.VVIS, t = byId[pat.type], spec = SPECTRA[pat.type] || [];
    const Yg = relY(ground), Ya = relY(pat.hex2), Ym = Yg + (Ya - Yg) * coverOf(pat), dY = Math.abs(Ya - Yg);
    const lg = VC.hexToLab(ground), la = VC.hexToLab(pat.hex2), dab = Math.hypot(lg[1] - la[1], lg[2] - la[2]);
    let maxC = 0, sumE = 0, sumS = 0, coarsest = Infinity, anyCoarse = false, lumSeen = false;
    spec.forEach(function (sc) {
      const f = V.cpd(sc[0], pat.scale, m), c = Math.min(1, sc[1] * dY / Math.max(Ym, 1e-4));
      const e = c - V.threshold(f, Ym, m), s = sc[1] * dab * V.chromaPass(f);
      maxC = Math.max(maxC, c);
      const seen = e > 0 || s >= CHROMA_JND;
      if (e > 0) lumSeen = true;
      if (!seen) return;
      sumE += Math.max(0, e); if (s >= CHROMA_JND) sumS += s;
      coarsest = Math.min(coarsest, f);
      if (f < FINE_CPD) anyCoarse = true;
    });
    const peak = Math.min(1, sumE);
    const out = { m: m, repeatDeg: V.degrees(pat.scale, m), coarsest: coarsest, contrast: peak, colour: sumS, colourOnly: !lumSeen && sumS >= CHROMA_JND };
    if (coarsest === Infinity) { out.state = 'plain'; out.why = maxC >= FAINT ? 'fine' : 'faint'; return out; }
    if (!anyCoarse) { out.state = 'texture'; out.why = 'fine'; return out; }
    if (peak < FAINT && sumS < CHROMA_FAINT) { out.state = 'texture'; out.why = 'faint'; return out; }
    out.state = 'pattern'; out.why = 'clear'; return out;
  }

  /* Video calls (A: sampling). A webcam framing head and shoulders spreads about 84 cm of the
     scene over 1280 pixels at 720p, 0.66 mm a pixel. Detail with a period under about four
     pixels (2.6 mm) cannot be rendered cleanly and tends to shimmer or show false stripes
     (moiré) when it is strong. Strength here is in the camera's own terms, the encoded value,
     close to L*: the component's amplitude × ΔL* / 100. Working values, badge B. */
  const CAM_MM_PER_PX = 0.66, CAM_MIN_PX = 4, CAM_STRENGTH = 0.06;
  function camera(ground, pat) {
    pat = norm(pat);
    if (pat.type === 'solid') return null;
    const spec = SPECTRA[pat.type] || [];
    const dL = Math.abs(VC.hexToLab(ground)[0] - VC.hexToLab(pat.hex2)[0]) / 100;
    let worst = null;
    spec.forEach(function (sc) {
      const periodMm = pat.scale * 10 / sc[0], st = sc[1] * dL;
      if (periodMm / CAM_MM_PER_PX < CAM_MIN_PX && st >= CAM_STRENGTH && (!worst || st > worst.strength)) worst = { periodMm: periodMm, strength: st };
    });
    return worst;
  }

  /* ---------- Drawing: one repeat fills an S×S tile ---------- */
  const HT = ['11110001', '11110010', '11110100', '11111000', '00011111', '00101111', '01001111', '10001111']; // houndstooth 8×8

  function draw(c, S, type, g, a) {
    c.fillStyle = g; c.fillRect(0, 0, S, S); c.fillStyle = a; c.strokeStyle = a;
    const rect = function (x, y, w, h) { c.fillRect(x, y, w, h); };
    switch (type) {
      case 'nailhead':
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) rect(i * S / 2 + S * 0.14, j * S / 2 + S * 0.14, S * 0.22, S * 0.22);
        break;
      case 'birdseye':
        [[0.25, 0.25], [0.75, 0.75]].forEach(function (p) { c.beginPath(); c.arc(p[0] * S, p[1] * S, S * 0.14, 0, Math.PI * 2); c.fill(); });
        c.fillStyle = g;
        [[0.25, 0.25], [0.75, 0.75]].forEach(function (p) { c.beginPath(); c.arc(p[0] * S, p[1] * S, S * 0.05, 0, Math.PI * 2); c.fill(); });
        break;
      case 'herringbone': {
        // two columns of twill running in opposite directions
        const n = 8, w = S / 2;
        c.lineWidth = S / n * 0.5;
        for (let k = -n; k <= 2 * n; k++) {
          const y = k * S / n;
          c.beginPath(); c.moveTo(0, y); c.lineTo(w, y - w * 0.9); c.stroke();
          c.beginPath(); c.moveTo(w, y - w * 0.9); c.lineTo(S, y); c.stroke();
        }
        break;
      }
      case 'pinstripe': rect(S / 2 - S * 0.03, 0, S * 0.06, S); break;
      case 'chalkstripe': {
        const gr = c.createLinearGradient(S * 0.38, 0, S * 0.62, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, a); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; rect(S * 0.38, 0, S * 0.24, S); break;
      }
      case 'bengal': rect(0, 0, S / 2, S); break;
      case 'candy': rect(S * 0.35, 0, S * 0.3, S); break;
      case 'gingham':
        c.globalAlpha = 0.5; rect(0, 0, S / 2, S); rect(0, 0, S, S / 2); c.globalAlpha = 1; rect(0, 0, S / 2, S / 2);
        break;
      case 'tattersall':
        rect(S * 0.2, 0, S * 0.035, S); rect(0, S * 0.2, S, S * 0.035);
        c.globalAlpha = 0.6; rect(S * 0.7, 0, S * 0.03, S); rect(0, S * 0.7, S, S * 0.03); c.globalAlpha = 1;
        break;
      case 'houndstooth': {
        const u = S / 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (HT[y][x] === '1') rect(x * u, y * u, u + 0.5, u + 0.5);
        break;
      }
      case 'glen': {
        // Prince of Wales: a block of small houndstooth, a block of fine check, hairline blocks, an overcheck
        const h = S / 2, u = h / 16;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (HT[y % 8][x % 8] === '1') rect(x * u, y * u, u + 0.4, u + 0.4);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x >> 1) + (y >> 1)) % 2 === 0) rect(h + x * u, h + y * u, u + 0.4, u + 0.4);
        for (let k = 0; k < 8; k++) { rect(h, k * 2 * u, h, u * 0.7); rect(k * 2 * u, h, u * 0.7, h); }
        c.globalAlpha = 0.55; rect(h - u * 0.5, 0, u, S); rect(0, h - u * 0.5, S, u); c.globalAlpha = 1;
        break;
      }
      case 'windowpane': rect(S * 0.49, 0, S * 0.02, S); rect(0, S * 0.49, S, S * 0.02); break;
      case 'paisley': {
        // the teardrop (boteh) with a curled tail, an eye in the ground colour, and a small second
        // drop and dots between, all inside one repeat so it tiles
        const path = function (r) {
          c.beginPath(); c.moveTo(0, r);
          c.bezierCurveTo(-r * 1.3, r, -r * 1.25, -r * 0.9, 0, -r);
          c.bezierCurveTo(r * 0.8, -r * 1.1, r * 1.5, -r * 1.8, r * 1.15, -r * 2.15);
          c.bezierCurveTo(r * 1.9, -r * 1.25, r * 1.45, r, 0, r);
          c.closePath();
        };
        const tear = function (cx, cy, r, rot, inner) {
          c.save(); c.translate(cx, cy); c.rotate(rot); path(r); c.fill();
          if (inner) { c.strokeStyle = g; c.lineWidth = r * 0.12; c.translate(r * 0.05, -r * 0.08); path(r * 0.68); c.stroke(); }
          c.restore();
        };
        const dot = function (x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        tear(S * 0.36, S * 0.6, S * 0.17, 0.3, true);
        tear(S * 0.8, S * 0.24, S * 0.08, 2.4);
        dot(S * 0.13, S * 0.14, S * 0.035); dot(S * 0.86, S * 0.82, S * 0.035); dot(S * 0.62, S * 0.9, S * 0.025);
        c.fillStyle = g; dot(S * 0.34, S * 0.6, S * 0.07); c.fillStyle = a; dot(S * 0.34, S * 0.6, S * 0.03);
        break;
      }
      case 'foulard': {
        // a small diamond medallion with an open centre, and a dot at the corners of the repeat
        c.beginPath(); c.moveTo(S * 0.5, S * 0.26); c.lineTo(S * 0.74, S * 0.5); c.lineTo(S * 0.5, S * 0.74); c.lineTo(S * 0.26, S * 0.5); c.closePath(); c.fill();
        c.fillStyle = g; c.beginPath(); c.arc(S * 0.5, S * 0.5, S * 0.07, 0, Math.PI * 2); c.fill(); c.fillStyle = a;
        [[0, 0], [S, 0], [0, S], [S, S]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], S * 0.07, 0, Math.PI * 2); c.fill(); });
        break;
      }
      case 'repp': {
        // diagonal bars rising to the right, about a third of each repeat, as on a regimental tie
        const bw = S * 0.35;
        for (let k = -2; k <= 1; k++) { c.beginPath(); c.moveTo(0, S - k * S); c.lineTo(S, -k * S); c.lineTo(S, -k * S + bw); c.lineTo(0, S - k * S + bw); c.closePath(); c.fill(); }
        break;
      }
      case 'breton': rect(0, S * 0.65, S, S * 0.35); break;
      case 'pindot':
        [[0.25, 0.25], [0.75, 0.75]].forEach(function (p) { c.beginPath(); c.arc(p[0] * S, p[1] * S, S * 0.075, 0, Math.PI * 2); c.fill(); });
        break;
    }
  }

  function tile(ground, pat, S) {
    pat = norm(pat); S = S || 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    draw(cv.getContext('2d'), S, pat.type, ground, pat.hex2);
    return cv;
  }


  /* ---------- What survives a distance, as a picture ----------
     The tile is split into a light-dark channel and two colour-difference channels (linear RGB)
     and each is blurred in the frequency domain. A blur, not a cut: cutting every component at
     its own threshold leaves rings around dots and lines that the eye never sees, because the
     eye's own blur has no negative lobes. So the light-dark channel gets a Gaussian blur that
     halves detail where this cloth's strongest modulation meets the eye's threshold (limitFor),
     and the colour channels get chromaPass. The verdict words come from reads(), not from this
     picture. The result is that cloth at that distance, enlarged so the detail can be seen. */
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < h; j++) {
          const p = i + j, q = p + h, vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr;
          re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  function fft2(re, im, R, inv) {
    const rr = new Float64Array(R), ii = new Float64Array(R);
    for (let y = 0; y < R; y++) { for (let x = 0; x < R; x++) { rr[x] = re[y * R + x]; ii[x] = im[y * R + x]; } fft(rr, ii, inv); for (let x = 0; x < R; x++) { re[y * R + x] = rr[x]; im[y * R + x] = ii[x]; } }
    for (let x = 0; x < R; x++) { for (let y = 0; y < R; y++) { rr[y] = re[y * R + x]; ii[y] = im[y * R + x]; } fft(rr, ii, inv); for (let y = 0; y < R; y++) { re[y * R + x] = rr[y]; im[y * R + x] = ii[y]; } }
  }
  function seenTile(ground, pat, m, R) {
    pat = norm(pat); R = R || 64;
    const src = tile(ground, pat, R);
    if (!m || pat.type === 'solid') return src;
    const V = window.VVIS, ctx = src.getContext('2d'), img = ctx.getImageData(0, 0, R, R), d = img.data, N = R * R;
    const ch = [0, 1, 2].map(function () { return { re: new Float64Array(N), im: new Float64Array(N) }; });
    for (let i = 0; i < N; i++) {
      const r = VC.srgbToLinear(d[i * 4]), g = VC.srgbToLinear(d[i * 4 + 1]), b = VC.srgbToLinear(d[i * 4 + 2]);
      ch[0].re[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; ch[1].re[i] = r - g; ch[2].re[i] = b - (r + g) / 2;
    }
    ch.forEach(function (c) { fft2(c.re, c.im, R, false); });
    const Ym = Math.max(ch[0].re[0] / N, 1e-4);
    let cMax = 0;
    for (let i = 1; i < N; i++) cMax = Math.max(cMax, 2 * Math.hypot(ch[0].re[i], ch[0].im[i]) / N / Ym);
    const fHalf = V.limitFor(Math.min(1, cMax), Ym, m);
    for (let ky = 0; ky < R; ky++) for (let kx = 0; kx < R; kx++) {
      if (!kx && !ky) continue;
      const sx = kx > R / 2 ? kx - R : kx, sy = ky > R / 2 ? ky - R : ky, i = ky * R + kx;
      const f = V.cpd(Math.hypot(sx, sy), pat.scale, m);
      const kL = fHalf > 0 ? Math.exp(-Math.LN2 * Math.pow(f / fHalf, 2)) : 0, kC = V.chromaPass(f);
      ch[0].re[i] *= kL; ch[0].im[i] *= kL;
      for (let j = 1; j < 3; j++) { ch[j].re[i] *= kC; ch[j].im[i] *= kC; }
    }
    ch.forEach(function (c) { fft2(c.re, c.im, R, true); });
    for (let i = 0; i < N; i++) {
      const Y = ch[0].re[i], C1 = ch[1].re[i], C2 = ch[2].re[i];
      const g = Y - 0.2487 * C1 - 0.0722 * C2, r = g + C1, b = C2 + (r + g) / 2;
      d[i * 4] = VC.linearToSrgb(r); d[i * 4 + 1] = VC.linearToSrgb(g); d[i * 4 + 2] = VC.linearToSrgb(b);
    }
    ctx.putImageData(img, 0, 0);
    return src;
  }

  /* Measure coverage from the drawings themselves, so the mixed colour matches what is drawn. */
  function measureCover() {
    if (typeof document === 'undefined') return;
    try {
      TYPES.forEach(function (t) {
        if (t.id === 'solid') return;
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        const c = cv.getContext('2d'); draw(c, 128, t.id, '#000000', '#ffffff');
        const d = c.getImageData(0, 0, 128, 128).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += VC.srgbToLinear(d[i]);
        t.cover = s / (128 * 128);
      });
    } catch (e) { /* keep the fallbacks */ }
  }
  measureCover();

  /* A small preview as a data URL, for chips and lists. sizePx is one repeat in pixels. */
  const cache = {};
  function thumb(ground, pat, px, reps) {
    pat = norm(pat);
    const key = [ground, pat.type, pat.hex2, px, reps].join();
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'), n = px * (reps || 1);
    cv.width = cv.height = n;
    const c = cv.getContext('2d'), t = tile(ground, pat, Math.max(8, px));
    c.fillStyle = c.createPattern(t, 'repeat'); c.fillRect(0, 0, n, n);
    return (cache[key] = cv.toDataURL());
  }

  window.VPAT = { TYPES: TYPES, byId: byId, scaleClass: scaleClass, norm: norm, mean: mean, coverOf: coverOf, COVER_MIN: COVER_MIN, COVER_MAX: COVER_MAX, tile: tile, thumb: thumb, draw: draw,
    SPECTRA: SPECTRA, reads: reads, camera: camera, seenTile: seenTile, FINE_CPD: FINE_CPD, FAINT: FAINT };
})();
