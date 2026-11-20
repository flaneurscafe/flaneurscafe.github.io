/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the body model shared by Proportion (and later Fit & size). Measurements in cm, the
   ratios worked out from them, how sure each is, and where each sits among men in a large survey.
   No DOM; loads in Node for the tests.

   The survey is ANSUR II, the 2012 US Army anthropometric survey (4,082 men, public data). Its
   waist and waist height are taken at the navel, as Valet's are. Its shoulder breadth is measured
   straight between the shoulder bones, while Valet's shoulder follows the curve of the back, so
   shoulders are not compared. One population: the comparison says where a measurement sits among
   those men, nothing more. */
(function () {
  'use strict';
  const PCT = [1, 5, 10, 25, 50, 75, 90, 95, 99];
  const REF = {"height":[160.2,164.8,166.9,171.0,175.5,180.2,184.4,187.0,192.7],"chest":[87.3,92.2,94.8,99.6,105.6,111.7,117.2,120.7,127.6],"waist":[72.5,76.8,79.7,85.7,93.7,101.6,108.6,113.1,121.4],"seat":[86.2,89.9,92.2,96.7,101.7,106.8,111.8,114.9,121.8],"neck":[34.6,36.0,36.7,37.9,39.5,41.4,43.2,44.3,46.7],"arm":[52.3,54.5,55.4,57.2,59.2,61.2,63.4,64.5,67.0],"inseam":[74.7,77.1,78.8,81.4,84.5,87.6,90.6,92.5,96.0],"backNeckFloor":[137.3,141.6,143.7,147.5,151.7,155.8,159.7,162.3,167.7],"waistHeight":[94.3,97.2,99.0,102.0,105.5,109.0,112.3,114.5,118.6],"wrist":[15.6,16.2,16.5,17.0,17.6,18.2,18.7,19.1,19.8],"head":[53.8,54.8,55.4,56.3,57.4,58.5,59.5,60.1,61.4],"foot":[24.2,25.0,25.4,26.3,27.1,28.0,28.8,29.3,30.2],"faceWidth":[12.9,13.3,13.5,13.8,14.3,14.7,15.0,15.3,15.8],"faceLength":[10.7,11.2,11.4,11.8,12.3,12.7,13.1,13.4,13.8],"legRatio":[0.4502,0.4591,0.4637,0.472,0.4811,0.4905,0.4995,0.5055,0.5188],"torsoRatio":[0.3495,0.3605,0.3655,0.3739,0.3825,0.391,0.3987,0.4037,0.4128],"waistHeightRatio":[0.5701,0.5801,0.5849,0.593,0.6016,0.61,0.6177,0.6222,0.6304],"frame":[0.0902,0.0927,0.0943,0.097,0.1001,0.1032,0.1061,0.108,0.112],"drop":[-1.6,2.8,5.1,8.3,11.9,15.5,18.4,20.1,23.3],"faceShape":[1.0056,1.0519,1.0758,1.1155,1.1626,1.2131,1.2605,1.2917,1.3492]};

  /* How sure a measurement taken at home is (cm, one way). Lengths down the body are hard to take
     alone; a second person roughly halves the error. */
  const UNC = { height: 0.7, chest: 1.5, waist: 1.5, seat: 1.5, neck: 0.7, shoulder: 1.5, arm: 1.5, inseam: 2, backNeckFloor: 2,
    waistHeight: 1.5, wrist: 0.4, hand: 0.4, head: 0.7, foot: 0.4, faceWidth: 0.4, faceLength: 0.4 };

  /* Where a value sits among the survey's men: a percentile from 1 to 99, interpolated between the
     tabled points; null when the measure is not tabled or the value is missing. */
  function percentile(key, v) {
    const t = REF[key]; if (!t || v == null || !isFinite(v)) return null;
    if (v <= t[0]) return 1;
    if (v >= t[t.length - 1]) return 99;
    for (let i = 1; i < t.length; i++) {
      if (v <= t[i]) return Math.round(PCT[i - 1] + (PCT[i] - PCT[i - 1]) * (v - t[i - 1]) / ((t[i] - t[i - 1]) || 1));
    }
    return 99;
  }
  const median = function (key) { return REF[key] ? REF[key][4] : null; };

  /* Everything the proportion rules read, with estimates where a measurement is missing (each
     estimate marked, so the page can say so). m: measurements; shape: the body choices. */
  function derive(m, shape) {
    m = m || {}; shape = shape || {};
    const has = function (k) { return m[k] > 0; };
    const est = {}, v = {};
    const H = has('height') ? m.height : null;
    v.height = H;
    // back-neck (C7) to floor: about 86 % of height in the survey
    v.backNeckFloor = has('backNeckFloor') ? m.backNeckFloor : H ? (est.backNeckFloor = true, H * median('backNeckFloor') / median('height')) : null;
    v.inseam = has('inseam') ? m.inseam : H ? (est.inseam = true, H * median('legRatio')) : null;
    v.waistHeight = has('waistHeight') ? m.waistHeight : H ? (est.waistHeight = true, H * median('waistHeightRatio')) : null;
    ['chest', 'waist', 'seat', 'neck', 'shoulder', 'arm', 'wrist', 'head', 'foot', 'faceWidth', 'faceLength'].forEach(function (k) { v[k] = has(k) ? m[k] : null; });
    const r = {};
    if (H && v.inseam) r.legRatio = v.inseam / H;
    if (H && v.backNeckFloor && v.inseam) r.torsoRatio = (v.backNeckFloor - v.inseam) / H;
    if (H && v.waistHeight) r.waistHeightRatio = v.waistHeight / H;
    if (H && v.wrist) r.frame = v.wrist / H;
    if (v.chest && v.waist) r.drop = v.chest - v.waist;
    if (v.faceWidth && v.faceLength) r.faceShape = v.faceWidth / v.faceLength;
    const pct = {};
    Object.keys(v).forEach(function (k) { if (v[k] != null && !est[k] && REF[k]) pct[k] = percentile(k, v[k]); });
    Object.keys(r).forEach(function (k) {
      // a ratio built on an estimate says nothing about the person
      const uses = { legRatio: ['inseam'], torsoRatio: ['inseam', 'backNeckFloor'], waistHeightRatio: ['waistHeight'], frame: [], drop: [], faceShape: [] }[k] || [];
      if (!uses.some(function (u) { return est[u]; })) pct[k] = percentile(k, r[k]);
    });
    /* Broad or long for its size, only beyond what the tape's error could cause: a 4 mm error on
       width and on length moves the ratio by about ±0.05, as far as from the middle of the survey to
       its 70th percentile. So a face is called broad (or long) only when the ratio minus (plus) that
       error is still beyond the 70th (30th) percentile; otherwise it is the middle, within the error. */
    let faceClass = null;
    if (r.faceShape != null) {
      const u = r.faceShape * Math.hypot(UNC.faceWidth / v.faceWidth, UNC.faceLength / v.faceLength);
      const at = function (q) { const t = REF.faceShape, i = PCT.findIndex(function (p) { return p >= q; }); return t[i - 1] + (t[i] - t[i - 1]) * (q - PCT[i - 1]) / (PCT[i] - PCT[i - 1]); };
      faceClass = r.faceShape - u > at(70) ? 'broad' : r.faceShape + u < at(30) ? 'long' : 'middle';
    }
    return { v: v, r: r, pct: pct, est: est, shape: shape, unc: UNC, faceClass: faceClass };
  }

  /* A percentile in words, neutral: where it sits, not whether that is good. */
  function words(p) {
    if (p == null) return '';
    if (p <= 10) return 'among the lowest tenth';
    if (p < 30) return 'below the middle';
    if (p <= 70) return 'near the middle';
    if (p < 90) return 'above the middle';
    return 'among the highest tenth';
  }

  window.VBODY = { REF: REF, PCT: PCT, UNC: UNC, percentile: percentile, median: median, derive: derive, words: words };
})();
