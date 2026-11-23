/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — checks: proportion: the outfit's lines on the body, and cuts that belong together.
   One of the classic scripts in js/checks/, loaded after engine.js. engine.js runs them in the order of
   its ORDER list, giving each the outfit being checked (ctx; see checkOutfit in engine.js), and they
   add their findings to ctx.out. Shared helpers come from engine.js (window.VENGINE.kit). The rules'
   sources and reasons are in How it works; their names, weights and kinds in rules.js. */
// @ts-check
(function () {
  'use strict';
  const E = window.VENGINE, X = E.kit;
  const PARAMS = X.PARAMS, VC = X.VC, G = X.G;

  /* Proportion. Two kinds of check.
     Lines: where the outfit changes from light to dark falls on the body, and the eye reads the
     figure in those pieces. The waistband is where the legs appear to start; a strong step at the
     hips (a jacket hem over contrasting trousers) starts them lower, a strong step at the ankle
     ends them sooner. On legs that are long for the height none of this matters much; on legs
     shorter than most it does (B). A tonal column, every main piece close in lightness, is the
     one clothing change found to raise height estimates in photos (Lee 2018, A). These are notes,
     scored 0.75 at the lowest, so they never mark a colour as a clash.
     Cuts: pieces of one period were cut to meet. A short knit (to a high 1930s waistband) over
     mid- or low-rise trousers leaves a band of shirt showing; a long knit hides a high waist; a
     standard tie hangs past a high waistband (B).
     o.body holds the percentiles from body.js (legRatio, height...), or nothing without measurements. */
  function proportionChecks(o, L, K, add, nm) {
    const pc = o.body || {}, leg = pc.legRatio, shortLegs = leg != null && leg < PARAMS.shortLegsPct, legWord = shortLegs ? ' Your legs are shorter than most for your height, so this line matters for you.' : '';
    const lum = function (k) { return L[k] ? VC.hexToLab(L[k].mean)[0] : null; };
    const ad = function (c) { c.group = 'proportion'; c.level = c.level || 'B'; c.slots = c.slots || []; return add(c); };
    const top = L.jacket ? 'jacket' : L.mid ? 'mid' : 'shirt', rise = (o.trousers && o.trousers.rise) || 'mid';
    // A tall frame with legs short for its height gets two pieces of advice about one contrast (1.18):
    // the height takes a break between top and trousers (phalves, below), the legs want that break at
    // the waist, not lower (pline). They are said together, once: the contrast is fine, its place is not.
    const hgt = +((o.m || {}).height) || 0, tallFrame = hgt >= PARAMS.frameTall;
    const lowBreak = function (d) { return d >= PARAMS.halvesStrong && (top === 'jacket' || rise === 'low'); };
    const tallWord = shortLegs && tallFrame ? ' Your height takes a contrast between top and trousers (Flusser); it is where the break falls that costs you leg length.' : '';
    if (L[top] && L.trousers) {
      const d = Math.abs(lum(top) - lum('trousers')), jacketHem = top === 'jacket';
      if (d >= PARAMS.halvesStrong && jacketHem) ad({ id: 'pline', score: shortLegs ? 0.75 : 0.9, slots: [],
        text: 'A strong light-dark step at the ' + nm('jacket') + '\'s hem, over the hips: the eye starts the legs there, lower than the waist.' + legWord + tallWord + (shortLegs ? ' Closer lightness between jacket and trousers moves the line up.' : '') });
      else if (d >= PARAMS.halvesStrong && rise === 'low') ad({ id: 'pline', score: shortLegs ? 0.75 : 0.9, slots: [],
        text: 'The light-dark change sits at a low waistband, below your waist: the legs read shorter than they are.' + legWord + tallWord + (shortLegs ? ' Higher-rise trousers move the line to your waist.' : '') });
      else if (d >= PARAMS.halvesStrong) ad({ id: 'pline', score: 1, slots: [], text: 'The light-dark change between top and trousers falls at the waistband, where the legs appear to start.' });
    }
    // Top against trousers by build (Flusser, Dressing the Man, pp. 52-54, 271): the less contrast between the
    // halves, the longer and dressier the figure, which a short man wants; a tall man wants horizontal breaks,
    // such as a contrasting trouser. Matched (a suit, ΔE under nearFrom) is one block and not judged here.
    if (L[top] && L.trousers && VC.deltaE2000(VC.hexToLab(L[top].mean), VC.hexToLab(L.trousers.mean)) >= PARAMS.nearFrom) {
      const d = Math.abs(lum(top) - lum('trousers')), h = hgt;
      const tall = tallFrame, short = (h && h < PARAMS.frameShort) || shortLegs;
      if (h && d < PARAMS.halvesL && tall) ad({ id: 'phalves', score: 0.8, slots: ['trousers'],
        text: nm(top) + ' and ' + nm('trousers') + ' are close in lightness (step ' + Math.round(d) + '): one long column on a tall frame. A contrasting trouser, or a patterned jacket, breaks the line (Flusser).' });
      else if (h && d < PARAMS.halvesL) ad({ id: 'phalves', score: 1, slots: [],
        text: nm(top) + ' and ' + nm('trousers') + ' close in lightness: ' + (short ? 'the less contrast between the halves, the longer the figure, which suits your build (Flusser).' : 'a long, dressy line (Flusser).') });
      else if (h && d >= PARAMS.halvesStrong && short && !(shortLegs && (top === 'jacket' || rise === 'low'))) ad({ id: 'phalves', score: 0.8, slots: ['trousers'],
        text: 'A strong light-dark step between ' + nm(top) + ' and ' + nm('trousers') + ' (' + Math.round(d) + ') cuts a shorter figure in two; closer tones lengthen it (Flusser).' });
      else if (h && d >= PARAMS.halvesL && tall && !(shortLegs && lowBreak(d))) ad({ id: 'phalves', score: 1, slots: [],
        text: 'A contrasting top and trousers break a tall frame\'s long line, as Flusser advises.' });
    }
    if (L.trousers && L.shoes) {
      const ds = Math.abs(lum('trousers') - lum('shoes')), bridge = L.socks && Math.abs(lum('socks') - lum('trousers')) < PARAMS.ankleBridgeL;
      if (ds >= 35 && !bridge && shortLegs) ad({ id: 'pankle', score: 0.75, slots: [],
        text: 'A strong step at the ankle, from the trousers to the shoes, ends the leg line early.' + legWord + ' Shoes, or at least socks, closer to the trousers carry it on.' });
    }
    const main = ['jacket', 'mid', 'shirt', 'trousers', 'shoes'].filter(function (k) { return L[k]; }).map(lum);
    if (main.length >= 3 && Math.max.apply(null, main) - Math.min.apply(null, main) <= PARAMS.columnL) ad({ id: 'pcolumn', level: 'A/B', score: 1, slots: [],
      text: 'A tonal column: every main piece is close in lightness. Of the tricks said to add height, this is the one found to work in photos.' });
    // cuts that belong to different periods
    const vest = L.mid && K.mid.vest, len = o.mid && !vest && o.mid.length;
    if (vest && rise === 'low') ad({ id: 'pperiod', score: 0.45, slots: [],
      text: 'A waistcoat over low-rise trousers: its points end above the waistband, and a band of shirt shows between them.',
      fixes: [{ label: 'High-rise trousers', slot: 'trousers', set: { rise: 'high' } }, { label: 'Mid-rise trousers', slot: 'trousers', set: { rise: 'mid' } }] });
    else if (vest && rise === 'high') ad({ id: 'pperiod', score: 1, slots: [], text: 'Waistcoat and high-rise trousers meet at the waist: the 1930s line, worn with braces.' });
    else if (vest) ad({ id: 'pperiod', score: 0.9, slots: [], text: 'A waistcoat over mid-rise trousers: check its points cover the waistband; higher trousers make that easy.' });
    else if (L.mid && len === 'short' && rise !== 'high') ad({ id: 'pperiod', score: 0.45, slots: [],
      text: 'A short knit, cut to end at a high 1930s waistband, over ' + rise + '-rise trousers: a band of shirt shows at the waist.',
      fixes: [{ label: 'High-rise trousers', slot: 'trousers', set: { rise: 'high' } }, { label: 'A regular-length knit', slot: 'mid', set: { length: 'regular' } }] });
    else if (L.mid && len === 'long' && rise === 'high') ad({ id: 'pperiod', score: 0.85, slots: [],
      text: 'A long knit over high-rise trousers covers the high waist, so the period line is lost; a knit ending at the waistband keeps it.',
      fixes: [{ label: 'A short knit', slot: 'mid', set: { length: 'short' } }] });
    else if (L.mid && len && L.trousers) ad({ id: 'pperiod', score: 1, slots: [], text: 'Knit and trousers meet at the waist: their cuts belong together.' });
    if (L.tie && rise === 'high' && !L.mid) ad({ id: 'ptie', score: 0.85, slots: [],
      text: 'With high-rise trousers a standard-length tie hangs past the waistband; tie a larger knot, or wear a knit or waistcoat over it, as the 1930s did.' });
    // The collar against the face (Flusser, Dressing the Man, pp. 124–126: counterbalance, not repeat).
    // A woven shirt records its collar (1.17), so it is judged: long points set close together narrow
    // a face, a wide spread broadens it. A polo's or knit's collar is part of its type, so for those
    // this stays advice for the shirt you choose. Broad or long only beyond the tape's error (body.js);
    // the percentile alone is not trusted.
    const fs = pc.faceClass === 'broad' ? 70 : pc.faceClass === 'long' ? 30 : null, bald = o.hairStyle === 'none';
    // judged only when the collar has been chosen: a shirt saved without one gets the advice, as before 1.17
    const cs = L.shirt && K.shirt && K.shirt.collars && o.shirt.collar && G.collarBy[o.shirt.collar] ? G.collarOf(o.shirt) : null, cn = cs ? cs.name.toLowerCase() : '';
    if (cs && fs != null) {
      if (fs >= 70 && cs.spread === 'wide') ad({ id: 'collarface', score: 0.65, slots: ['shirt'],
        text: 'Your face is broad for its length, and a ' + cn + ' collar spreads its points wide, which broadens it further. Longer points with a moderate spread balance it: a point or semi-spread collar (Flusser).',
        fixes: [{ label: 'A point collar', slot: 'shirt', set: { collar: 'point' } }, { label: 'A semi-spread collar', slot: 'shirt', set: { collar: 'semispread' } }] });
      else if (fs >= 70) ad({ id: 'collarface', score: 1, slots: ['shirt'],
        text: cs.spread === 'narrow' ? 'A ' + cn + ' collar: its long points, set close together, balance your broad face (Flusser).' : 'A ' + cn + ' collar: its moderate spread suits your broad face; longer points set closer would balance it more (Flusser).' });
      else if (cs.spread === 'narrow') ad({ id: 'collarface', score: 0.65, slots: ['shirt'],
        text: 'Your face is long for its width, and a ' + cn + ' collar\'s long points, set close together, lengthen it further. A wider spread balances it (Flusser).',
        fixes: [{ label: 'A spread collar', slot: 'shirt', set: { collar: 'spread' } }, { label: 'A semi-spread collar', slot: 'shirt', set: { collar: 'semispread' } }] });
      else ad({ id: 'collarface', score: 1, slots: ['shirt'],
        text: cs.spread === 'wide' ? 'A ' + cn + ' collar: its wide spread balances your long face (Flusser).' : 'A ' + cn + ' collar: its moderate spread suits your long face; a wider spread would balance it more (Flusser).' });
    }
    // a chosen collar that the face rule cannot judge: say why (information, never counted)
    if (cs && fs == null) ad({ id: 'collarhint', score: 1, slots: ['shirt'], text: pc.faceClass === 'middle'
      ? 'A ' + cn + ' collar: your face is neither clearly broad nor clearly long, so no collar has to counterbalance it; Gentleman\'s Gazette finds a spread collar suits most faces.'
      : 'Not judged against your face: Valet needs your face width and length (You tab) to say whether a ' + cn + ' collar balances it.' });
    if (cs && o.shirt.collarBand === 'tall' && !bald) ad({ id: 'collarhint', score: 1, slots: ['shirt'],
      text: 'A tall band: not judged. Flusser gives a long neck a taller band and a short neck a lower one, and Valet does not measure the neck.' });
    // advice, never counted: the collar to choose where none is recorded, and the band for a head with no hair
    const tall = cs && o.shirt && o.shirt.collarBand === 'tall';
    if (L.shirt && K.shirt && K.shirt.collar && ((!cs && fs != null) || bald)) ad({ id: 'pcollar', score: 1, slots: ['shirt'],
      text: (!cs && fs >= 70 ? 'Your face is broad for its length: a collar with longer points and a moderate spread balances it; a wide cutaway would widen it further.'
        : !cs && fs != null && fs <= 30 ? 'Your face is long for its width: a wider spread balances it; long narrow points would lengthen it further.' : '') +
        (bald ? (!cs && fs != null ? ' ' : '') + (tall ? 'With no hair the collar is the frame, and its tall band stands up to do that job.' : 'With no hair the collar is the frame: a taller band stands up and does that job.') : '') });
    // a prominent seat or hollow lower back and a low waistband (tailoring advice): the back of the
    // waistband stands away and the cloth pulls under the seat. Only the low rise is marked; a flat
    // seat is a matter of the trousers' cut, which the outfit does not record, so Proportion and Fit say it.
    if (L.trousers && o.shape && o.shape.seat === 'prominent' && rise === 'low') ad({ id: 'pseat', score: 0.85, slots: [],
      text: 'With a prominent seat or a hollow lower back, low-rise trousers gap at the back of the waistband and pull under the seat. A higher rise, with side adjusters or braces, follows the back.',
      fixes: [{ label: 'Mid-rise trousers', slot: 'trousers', set: { rise: 'mid' } }, { label: 'High-rise trousers', slot: 'trousers', set: { rise: 'high' } }] });
    // a full stomach and the waistband (tailoring advice: trousers held above the stomach do not roll)
    if (L.trousers && o.shape && o.shape.stomach === 'full') {
      if (rise === 'high') ad({ id: 'pstomach', score: 1, slots: [], text: 'High-rise trousers sit above a full stomach rather than under it; braces or side adjusters keep them there without a tight waistband.' });
      else ad({ id: 'pstomach', score: rise === 'low' ? 0.75 : 0.85, slots: [],
        text: 'With a full stomach a ' + rise + '-rise waistband sits under it and rolls forward and down, and the front of the trousers creases. High-rise trousers on braces or side adjusters sit above it.',
        fixes: [{ label: 'High-rise trousers', slot: 'trousers', set: { rise: 'high' } }] });
    }
  }

  E.part('lines', /** @param {ValetCtx} ctx */ function (ctx) {
    const o = ctx.o, L = ctx.L, K = ctx.K, add = ctx.add, nm = ctx.nm;
    if (o.propOn && !o.study) proportionChecks(o, L, K, add, nm);
  });
})();
