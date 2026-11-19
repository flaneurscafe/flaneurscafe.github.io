/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — Fit & size. Checks before buying whether a garment will fit:
   one or several sizes from a shop's chart, against a garment of yours that fits, the Proportion
   targets, or the body plus ease; or from the size label alone. Also turns body measurements (cm,
   from the You tab) into sizes, and lists what to look for at a try-on.

   Badges as elsewhere: A where a number follows from geometry or a defined standard (German sizes
   are half the chest in cm), B where it is tailoring convention (ease, the half inch on a collar).
   Every size here is a starting point: brands cut differently, so the shop check (garment
   measurements against your body) is the reliable test. Loads without a DOM; render() needs one. */
(function () {
  'use strict';
  const IN = 2.54;
  const r1 = function (v) { return Math.round(v * 10) / 10; };
  const inch = function (cm) { return cm / IN; };

  /* Shirt collar: the neck plus about half an inch (1.25 cm), so one finger fits (B). Standard
     collar sizes, centimetres with their inch labels as in UK shirtmakers' charts. */
  const COLLARS = [[37, 14.5], [38, 15], [39, 15.5], [40, 15.75], [41, 16], [42, 16.5], [43, 17], [44, 17.5], [45, 17.75], [46, 18], [47, 18.5], [48, 19]];
  function collar(neck) {
    const want = neck + 1.25;
    const c = COLLARS.find(function (x) { return x[0] >= want - 0.4; }) || COLLARS[COLLARS.length - 1];
    return { cm: c[0], in: c[1], want: want };
  }

  /* Jacket length letter by height (typical US and UK ready-to-wear; brands differ). */
  function lengthLetter(h) {
    if (!h) return null;
    return h < 173 ? { id: 'S', name: 'Short' } : h <= 183 ? { id: 'R', name: 'Regular' } : h <= 191 ? { id: 'L', name: 'Long' } : { id: 'XL', name: 'Extra long' };
  }

  /* Watch case range from the wrist, shared with the accessory check. */
  function watchRange(wrist) {
    return !wrist ? [36, 40] : wrist < 15.5 ? [34, 38] : wrist < 17 ? [36, 40] : wrist < 18.5 ? [38, 42] : [40, 44];
  }

  /* All sizes that the entered measurements allow. Each item: { group, label, value, how, level, needs }.
     needs lists the measurements still missing for an item that cannot be worked out yet. */
  function sizes(m) {
    const out = [], has = function (k) { return m[k] > 0; };
    const add = function (o) { out.push(o); };
    const need = function (group, label, keys) { add({ group: group, label: label, needs: keys.filter(function (k) { return !has(k); }) }); };

    // Shirts
    if (has('neck')) {
      const c = collar(m.neck);
      add({ group: 'Shirts', label: 'Collar', value: c.cm + ' cm (' + c.in + ' in)', level: 'B',
        how: 'Your neck, ' + m.neck + ' cm, plus about 1.25 cm (half an inch) so one finger slips in when it is buttoned: ' + r1(c.want) + ' cm, rounded to the nearest collar size.' });
    } else need('Shirts', 'Collar', ['neck']);
    if (has('shoulder') && has('arm')) {
      const cb = m.shoulder / 2 + m.arm + 2.5;
      add({ group: 'Shirts', label: 'Sleeve, centre back to cuff', value: Math.round(cb) + ' cm (' + Math.round(inch(cb)) + ' in)', level: 'B',
        how: 'Half your shoulder width, your arm to the wrist bone, and about 2.5 cm so the cuff covers the wrist bone and shows below a jacket sleeve. Shirtmakers who give a sleeve in centimetres from the shoulder seam mean ' + Math.round(m.arm + 2.5) + ' cm.' });
    } else need('Shirts', 'Sleeve', ['shoulder', 'arm']);

    // Jackets and suits
    if (has('chest')) {
      const half = m.chest / 2, de = Math.round(half / 2) * 2, ci = inch(m.chest);
      const usEven = Math.round(ci / 2) * 2, len = lengthLetter(m.height);
      add({ group: 'Jackets and suits', label: 'European size (German, Italian, French)', value: String(de) + (Math.abs(half - de) > 0.6 ? ' (between ' + (de - 2) + ' and ' + (de + 2) + ' on the ' + (half < de ? 'small' : 'large') + ' side)' : ''), level: 'A',
        how: 'Half your chest in centimetres (' + m.chest + ' / 2 = ' + r1(half) + '), to the nearest even size. German brands also make long sizes for tall, slim men, numbered 2 × size − 2 (here ' + (2 * de - 2) + '), and short sizes, numbered half the size (here ' + (de / 2) + ').' });
      add({ group: 'Jackets and suits', label: 'UK and US size', value: usEven + (len ? len.id : '') + (Math.abs(ci - usEven) >= 0.5 ? ' or ' + Math.round(ci) + (len ? len.id : '') : ''), level: 'B',
        how: 'Your chest in inches (' + r1(ci) + '), to the nearest size; ' + (len ? 'the letter is the length for your height (' + len.name + ').' : 'add your height for the length letter.') + ' For a slimmer fit some brands advise a size about an inch smaller.' });
    } else need('Jackets and suits', 'Jacket size', ['chest']);
    if (has('chest') && has('waist')) {
      const drop = inch(m.chest - m.waist), d = Math.round(drop);
      add({ group: 'Jackets and suits', label: 'Drop (chest minus waist)', value: Math.round(m.chest - m.waist) + ' cm (drop ' + d + ')', level: 'B',
        how: 'Suits sold as a set pair the jacket with trousers a fixed amount smaller. Shops give this drop in inches, even in Europe: drop 6, about 15 cm, is the standard. ' +
          (d >= 7 ? 'Yours is larger: a standard suit will fit the chest and gape at the trouser waist. Look for drop 7 or 8 (about 18 or 20 cm), or buy jacket and trousers separately.'
            : d <= 5 ? 'Yours is smaller: the trousers of a standard suit will be tight. Look for drop 4 or 5 (about 10 or 13 cm), or buy separately.'
              : 'Yours matches, so a standard suit fits both halves.') });
    } else need('Jackets and suits', 'Drop', ['chest', 'waist']);
    if (has('arm')) add({ group: 'Jackets and suits', label: 'Jacket sleeve, from the shoulder seam', value: Math.round(m.arm - 1) + ' cm', level: 'B',
      how: 'Just short of the wrist bone, so 1 to 1.5 cm of shirt cuff shows below it.' });
    else need('Jackets and suits', 'Jacket sleeve', ['arm']);
    if (has('backNeckFloor')) add({ group: 'Jackets and suits', label: 'Jacket length, back of the collar to the hem', value: Math.round(m.backNeckFloor / 2) + ' cm', level: 'B',
      how: 'About half your back-neck-to-floor height: the classic rule, which covers the seat and leaves the legs their length.' });
    else need('Jackets and suits', 'Jacket length', ['backNeckFloor']);

    // Trousers
    if (has('waist')) add({ group: 'Trousers', label: 'Waist', value: Math.round(m.waist) + ' cm (' + Math.round(inch(m.waist)) + ' in)', level: 'A',
      how: 'Trousers are sized by the waist where they sit. Measure there if your trousers sit lower than your natural waist.' });
    else need('Trousers', 'Waist', ['waist']);
    if (has('waist')) add({ group: 'Trousers', label: 'European size (German, Italian)', value: String(2 * Math.round((m.waist / 2 + 6) / 2)), level: 'B',
      how: 'German and Italian trouser sizes step 4 cm of waist a size: half your waist plus 6 (' + Math.round(m.waist) + ' / 2 + 6), to the nearest even size. Size charts differ by a centimetre or two; French sizes run on their own scale.' });
    if (has('inseam')) {
      const t = m.inseam - 3;
      add({ group: 'Trousers', label: 'Inside leg of the trousers', value: Math.round(t) + ' cm (' + Math.round(inch(t)) + ' in)', level: 'B',
        how: 'Your inseam to the floor is ' + m.inseam + ' cm; with shoes on, trousers about 3 cm shorter rest on the shoe in a slight break. Less for no break, more for a full one; a tailor shortens trousers easily.' });
    } else need('Trousers', 'Inside leg', ['inseam']);

    // Accessories and the rest
    if (has('wrist')) { const w = watchRange(m.wrist); add({ group: 'Accessories', label: 'Watch case', value: w[0] + '–' + w[1] + ' mm', level: 'B', how: 'Inside the width of the wrist, and thin enough to slip under a shirt cuff.' }); }
    else need('Accessories', 'Watch case', ['wrist']);
    if (has('head')) {
      const us = Math.round(inch(m.head) / Math.PI * 8) / 8;
      const F = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
      const eighths = function (x) { const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 8); return f ? w + ' ' + F[f] : String(w); };
      add({ group: 'Accessories', label: 'Hat', value: Math.round(m.head) + ' cm (US ' + eighths(us) + ', UK ' + eighths(us - 0.125) + ')', level: 'A',
        how: 'A hat is sized by the head circumference in centimetres. American sizes are that circumference in inches divided by π, in eighths; British sizes run an eighth smaller.' });
    } else need('Accessories', 'Hat', ['head']);
    if (has('foot')) {
      const eu = Math.round((m.foot + 1.5) * 1.5 * 2) / 2;
      // A/B: the Paris point is a definition; the 1.5 cm a last adds to the foot is makers' convention
      add({ group: 'Accessories', label: 'Shoes', value: 'EU about ' + eu + ' (Mondopoint ' + Math.round(m.foot * 10) + ')', level: 'A/B',
        how: 'European sizes count the last in Paris points of two thirds of a centimetre; the last is about 1.5 cm longer than the foot. Lasts differ between makers by a size or more, so try shoes on, late in the day.' });
    } else need('Accessories', 'Shoes', ['foot']);
    return out;
  }

  /* ---------- Before you buy: a size's garment measurements against you ----------
     Three ways to judge a measurement, best first:
       1. against a garment of yours that fits (same kind, measured the same way): the most reliable,
          since it already carries your build and the ease you like (A);
       2. for lengths and the rise, against the Proportion targets for your build and the chosen
          period, when proportion.js can work them out (B);
       3. against the body plus the ease of the cut you want, or a tailoring rule (B).
     A field has either cuts (ease bands for slim, modern, classic) or bands (a single target), and
     may name a Proportion target (prop) or give its own range (rng). low and high are what to say
     outside a range: [state, text, alter]. alter says how a tailor can mend it: 'easy', 'some', 'no'. */
  const CHECKS = {
    jacket: { name: 'Jacket', cut: true, fields: [
      { key: 'chest', label: 'Chest, around', body: 'chest', flat: true, step: 4, around: true,
        cuts: { slim: [6, 10], modern: [10, 14], classic: [14, 19] },
        tight: [6, 'Too tight for any cut: the lapels bow and the front pulls into an X when buttoned.', 'some'],
        loose: [19, 'Larger than even a classic cut: the front hangs away from the chest. A tailor can take in the sides a little; better a size down.', 'some'] },
      { key: 'shoulder', label: 'Shoulders, seam to seam', body: 'shoulder', prop: 'shoulder',
        low: ['tight', 'Narrower than your shoulders: the sleeve head will dent and pull. Shoulders cannot be let out; choose another size.', 'no'],
        high: ['loose', 'Wider than your shoulders: the seam hangs off the shoulder and the sleeve head collapses. Hard and costly to alter.', 'no'],
        ok: 'The seam sits at the shoulder bone.',
        bands: [[-99, -1, 'tight', 'Narrower than your shoulders: the sleeve head will dent and pull. Shoulders cannot be let out; choose another size.', 'no'], [-1, 3.5, 'right', 'Right: the seam sits at the shoulder bone (a jacket is usually 1 to 2 cm wider than the body measurement).', null], [3.5, 99, 'loose', 'Wider than your shoulders: the seam hangs off the shoulder and the sleeve head collapses. Hard and costly to alter.', 'no']] },
      { key: 'sleeve', label: 'Sleeve, from the shoulder seam', target: function (m) { return m.arm ? m.arm - 1 : null; }, needs: ['arm'], prop: 'sleeve',
        low: ['short', 'Short: the shirt cuff will show too much. A tailor can let it out only by what is folded inside, often 2 to 3 cm.', 'some'],
        high: ['long', 'Long: covers the shirt cuff. Shortening a sleeve is the most common and easiest alteration.', 'easy'],
        ok: 'It ends just before the wrist bone, with a little shirt cuff showing.',
        bands: [[-99, -2.5, 'short', 'Short: the shirt cuff will show too much. A tailor can let it out only by what is folded inside, often 2 to 3 cm.', 'some'], [-2.5, 2, 'right', 'Right: ending just before the wrist bone, with a little shirt cuff showing.', null], [2, 99, 'long', 'Long: covers the shirt cuff. Shortening a sleeve is the most common and easiest alteration.', 'easy']] },
      { key: 'length', label: 'Length, back of the collar to the hem', target: function (m) { return m.backNeckFloor ? m.backNeckFloor / 2 : null; }, needs: ['backNeckFloor'], prop: 'jacketLength',
        low: ['short', 'Short for you: the seat shows and the legs look long. Length cannot be added.', 'no'],
        high: ['long', 'Long for you: it cuts the leg. Only slightly shortenable, as the pockets set the limit.', 'some'],
        ok: 'Right for your build.',
        bands: [[-99, -3, 'short', 'Short for you: the seat shows and the legs look long. Length cannot be added.', 'no'], [-3, 3, 'right', 'Right: about half your back-neck-to-floor height.', null], [3, 99, 'long', 'Long for you: it cuts the leg. Only slightly shortenable, as the pockets set the limit.', 'some']] },
      // a matter of style, not of fit: a lapel cannot be altered, but its width belongs to a period
      // rather than to a size, so a miss is never a reason to try another size
      { key: 'lapel', label: 'Lapel width, at its widest', prop: 'lapel', style: true,
        styleText: function (d, lo, hi) { return (d < 0 ? 'Narrower' : 'Wider') + ' than the lapels of the period chosen on Proportion (' + lo + ' to ' + hi + ' cm). A matter of period, not of fit: another size will not change it. The periods it suits are listed below.'; },
        ok: 'In proportion to your shoulders for the period chosen on Proportion.' }
    ] },
    coat: { name: 'Overcoat', cut: true, fields: [
      // worn over a jacket: the ease is the jacket's plus about 8 cm of room for it (B), so each cut assumes a
      // jacket of the same cut beneath (a slim overcoat will not go over a classic jacket)
      { key: 'chest', label: 'Chest, around', body: 'chest', flat: true, step: 4, around: true,
        cuts: { slim: [14, 19], modern: [19, 25], classic: [25, 34] },
        tight: [14, 'Too tight to go over a jacket: it pulls at the buttons and the jacket sleeves bunch inside.', 'no'],
        loose: [34, 'Fuller than even a classic overcoat: it hangs like a tent. A tailor can take in the sides a little.', 'some'] },
      { key: 'shoulder', label: 'Shoulders, seam to seam', rng: function (m) { return m.shoulder ? [m.shoulder + 1.5, m.shoulder + 5] : null; }, needs: ['shoulder'],
        low: ['tight', 'Narrow: over a jacket the sleeve head will pinch. Shoulders cannot be let out.', 'no'],
        high: ['loose', 'Wide even for a coat: the seam drops down the arm. Cannot be altered.', 'no'],
        ok: 'Just beyond your shoulders, so the jacket shoulder fits under it.' },
      { key: 'sleeve', label: 'Sleeve, from the shoulder seam', rng: function (m) { return m.arm ? [m.arm + 0.5, m.arm + 2.5] : null; }, needs: ['arm'],
        low: ['short', 'Short: the jacket sleeve will show below it. Can be let out only by the turn-in.', 'some'],
        high: ['long', 'Long: it covers the hand. A coat sleeve shortens easily.', 'easy'],
        ok: 'It covers the jacket sleeve and the shirt cuff.' },
      { key: 'length', label: 'Length, back of the collar to the hem', prop: 'coat',
        low: ['short', 'Short for the length you want: cannot be lengthened.', 'no'],
        high: ['long', 'Long for the length you want: a coat can be shortened, but the vents and pockets set the limit.', 'some'],
        ok: 'Right for your build and the period.' }
    ] },
    shirt: { name: 'Shirt', cut: true, fields: [
      { key: 'collar', label: 'Collar', body: 'neck',
        bands: [[-99, 0.5, 'tight', 'Tight: it will not close comfortably. Collars cannot be enlarged.', 'no'], [0.5, 2.5, 'right', 'Right: about 1.25 cm (half an inch) over the neck, so one finger fits.', null], [2.5, 99, 'loose', 'Loose: the collar gapes and a tie knot pulls it in. Collars cannot be made smaller.', 'no']] },
      { key: 'chest', label: 'Chest, around', body: 'chest', flat: true, step: 5, around: true,
        cuts: { slim: [6, 11], modern: [11, 15], classic: [15, 22] },
        tight: [6, 'Too tight for any cut: the buttons pull open across the chest.', 'no'],
        loose: [22, 'Fuller than a classic cut: it billows when tucked in. A tailor can take in the sides.', 'easy'] },
      { key: 'sleeve', label: 'Sleeve, centre back to cuff', target: function (m) { return m.shoulder && m.arm ? m.shoulder / 2 + m.arm + 2.5 : null; }, needs: ['shoulder', 'arm'],
        bands: [[-99, -2, 'short', 'Short: the cuff will not show below a jacket sleeve. Cannot be lengthened.', 'no'], [-2, 2, 'right', 'Right: the cuff covers the wrist bone.', null], [2, 99, 'long', 'Long: the cuff slides over the hand. Many shirtmakers shorten sleeves.', 'easy']] }
    ] },
    knit: { name: 'Knit', cut: true, fields: [
      { key: 'chest', label: 'Chest, around', body: 'chest', flat: true, step: 5, around: true,
        cuts: { slim: [2, 6], modern: [6, 11], classic: [11, 18] },
        tight: [2, 'Clings: the shirt buttons and seams show through, and it will not go under a jacket.', 'no'],
        loose: [18, 'Bulky: it gathers at the waist and fills a jacket. Knitwear cannot be taken in well.', 'no'] },
      { key: 'length', label: 'Length, back of the collar to the hem', prop: 'knit', periodSoft: true,
        low: ['short', 'Short for your rise and the period: the shirt shows between knit and waistband. Cannot be lengthened.', 'no'],
        high: ['long', 'Long even over lower trousers: it covers the hips and bunches under a jacket. Knitwear cannot be shortened well.', 'no'],
        // longer than the period's knit is a choice of trousers, not a misfit: right over a lower rise
        soft: [10, 'Longer than a knit for the period\'s trousers, which end higher: right over mid- or low-rise trousers, but over high-waisted ones it bunches.'],
        ok: 'The hem meets the waistband of the period\'s trousers.' },
      { key: 'sleeve', label: 'Sleeve, from the shoulder seam', rng: function (m) { return m.arm ? [m.arm - 1, m.arm + 2] : null; }, needs: ['arm'],
        low: ['short', 'Short: the wrist shows when you reach. Cannot be lengthened.', 'no'],
        high: ['long', 'Long: more than a rib cuff can gather; it bunches at the wrist.', 'no'],
        ok: 'The cuff sits at the wrist bone.' }
    ] },
    trousers: { name: 'Trousers', cut: true, fields: [
      { key: 'waist', label: 'Waist, around', body: 'waist', flat: true, around: true,
        bands: [[-99, -1, 'tight', 'Tight. A tailor can let out the back seam by what is folded inside, often 2 to 4 cm.', 'some'], [-1, 2.5, 'right', 'Right: on your waist, with a belt barely needed.', null], [2.5, 6, 'loose', 'Loose: the belt will gather the cloth. Easy to take in at the back seam.', 'easy'], [6, 99, 'loose', 'Much too large at the waist; the seat and thighs will be too large as well.', 'some']] },
      { key: 'seat', label: 'Seat, around', body: 'seat', flat: true, step: 4, around: true,
        cuts: { slim: [3, 6], modern: [6, 9], classic: [9, 14] },
        tight: [3, 'Too tight across the seat for any cut: the pockets flare and creases form under the seat.', 'some'],
        loose: [14, 'Fuller than a classic cut in the seat. A tailor can take in the seat seam a little.', 'some'] },
      { key: 'rise', label: 'Front rise, crotch seam to the top of the waistband', prop: 'rise', periodSoft: true,
        low: ['short', 'Lower than the rise for your build and the period: the waistband sits below where it should. Cannot be raised.', 'no'],
        high: ['long', 'Higher than the target: the waistband rides above it. Cannot be lowered.', 'no'],
        ok: 'The waistband sits where your build and the period want it.' },
      { key: 'inseam', label: 'Inside leg', target: function (m) { return m.inseam ? m.inseam - 3 : null; }, needs: ['inseam'],
        bands: [[-99, -3, 'short', 'Short. Can be let down only by the hem allowance, and turn-ups use more cloth.', 'some'], [-3, 2, 'right', 'Right: a slight break on the shoe.', null], [2, 99, 'long', 'Long. Hemming is the easiest alteration there is.', 'easy']] },
      { key: 'opening', label: 'Leg opening, the hem laid flat', prop: 'opening', periodSoft: true,
        low: ['tight', 'Narrower than your shoe and the period want: the hem catches on the shoe. Can be let out only by the seam allowance.', 'some'],
        high: ['loose', 'Wider than your shoe and the period want. A tailor can taper the leg.', 'easy'],
        ok: 'It covers the back of the shoe and rests on it.' }
    ] },
    shoes: { name: 'Shoes', fields: [
      // the inside of the shoe is longer than the foot: about a centimetre and a half for the toes to move (B)
      { key: 'insole', label: 'Inside length, heel to toe', rng: function (m) { return m.foot ? [m.foot + 1, m.foot + 1.8] : null; }, needs: ['foot'], tol: 0.4,
        low: ['tight', 'Short: the toes will touch the front. Leather gives a little in width, never in length.', 'no'],
        high: ['loose', 'Long: the heel slips and the front creases deeply. An insole helps only a little.', 'some'],
        ok: 'Room for the toes, and the heel stays put.' }
    ] },
    hat: { name: 'Hat', fields: [
      { key: 'inner', label: 'Inside, around the sweatband', rng: function (m) { return m.head ? [m.head, m.head + 1] : null; }, needs: ['head'], tol: 0.4, around: true,
        low: ['tight', 'Tight: it presses on the forehead. A hatter can stretch a felt hat by about half a size.', 'some'],
        high: ['loose', 'Loose: it slips down. A strip of foam behind the sweatband takes up half a size.', 'easy'],
        ok: 'Snug without pressing.' }
    ] }
  };
  /* The cut a garment has on you follows from its ease: the same jacket is slim on a broad man and
     classic on a narrow one. want is the cut you are after: 'slim', 'modern' or 'classic'. */
  const CUT_NAME = { slim: 'slim', modern: 'modern (tailored)', classic: 'classic' };
  const CUT_ORDER = ['slim', 'modern', 'classic'];
  /* How close to your own garment counts as the same: round measurements, lengths (cm). */
  const REF_TOL = { around: 2, length: 1.5 };

  /* vals: { field: number }; flat: { field: true } when measured flat across (doubled for
     measurements around). ctx: { prop: { id: target } from proportion.js, ref: { field: number }
     from a garment of yours that fits }. */
  function checkGarment(kind, vals, flat, m, want, ctx) {
    const def = CHECKS[kind]; if (!def) return [];
    want = CUT_NAME[want] ? want : 'modern'; ctx = ctx || {}; flat = flat || {};
    const prop = ctx.prop || {}, ref = ctx.ref || {};
    const dbl = function (f, x) { return f.flat && f.around && flat[f.key] ? x * 2 : x; };
    return def.fields.map(function (f) {
      const v0 = +vals[f.key]; if (!(v0 > 0)) return null;
      if (v0 > 250) return { key: f.key, label: f.label, garment: v0, implausible: true };
      const v = dbl(f, v0);
      if (f.around && f.flat && !flat[f.key] && m[f.body] > 0 && v < m[f.body] * 0.7)
        return { key: f.key, label: f.label, garment: v, halfHint: true };
      const r0 = +ref[f.key];
      // 1. your own garment
      if (r0 > 0 && r0 <= 250) {
        const rv = dbl(f, r0), d = v - rv, tol = f.tol || (f.around ? REF_TOL.around : REF_TOL.length);
        const base = { key: f.key, label: f.label, garment: r1(v), target: r1(rv), diff: r1(d), against: 'yours' };
        if (Math.abs(d) <= tol) return Object.assign(base, { state: 'right', text: 'Within ' + tol + ' cm of yours, so it should fit as yours does.' });
        if (f.style) return Object.assign(base, { state: 'close', style: true, text: Math.abs(r1(d)) + ' cm ' + (d < 0 ? 'narrower' : 'wider') + ' than yours: a different style, not a different fit.' });
        const lowS = f.low ? f.low[0] : f.cuts ? 'tight' : (f.bands[0][2]), highS = f.high ? f.high[0] : f.cuts ? 'loose' : f.bands[f.bands.length - 1][2];
        const alter = d < 0 ? (f.low ? f.low[2] : f.cuts ? f.tight[2] : f.bands[0][4]) : (f.high ? f.high[2] : f.cuts ? f.loose[2] : f.bands[f.bands.length - 1][4]);
        const near = Math.abs(d) <= tol * 2;
        return Object.assign(base, { state: near ? 'close' : d < 0 ? lowS : highS, alter: near ? null : alter,
          text: Math.abs(r1(d)) + ' cm ' + (d < 0 ? 'less' : 'more') + ' than yours. ' + (near ? 'Close enough to wear, a shade ' + (d < 0 ? (f.around ? 'closer' : 'shorter') : (f.around ? 'roomier' : 'longer')) + ' than yours.' : (d < 0 ? (f.low ? f.low[1] : f.cuts ? f.tight[1] : f.bands[0][3]) : (f.high ? f.high[1] : f.cuts ? f.loose[1] : f.bands[f.bands.length - 1][3]))) });
      }
      // 2. a range: the Proportion target, or the field's own rule
      const pt = f.prop && prop[f.prop] && prop[f.prop].lo != null && prop[f.prop].hi != null ? prop[f.prop] : null;
      const rg = pt ? [pt.lo, pt.hi] : f.rng ? f.rng(m) : null;
      if (rg || (f.low && !f.bands && !f.cuts)) {
        if (!rg) return { key: f.key, label: f.label, garment: v, missing: (f.prop && prop[f.prop] && prop[f.prop].needs) || f.needs || ['height'] };
        const lo = rg[0], hi = rg[1], tol = f.tol || 1;
        const d = v < lo ? v - lo : v > hi ? v - hi : 0;
        const base = { key: f.key, label: f.label, garment: r1(v), target: r1(lo) + '–' + r1(hi), diff: r1(d), against: pt ? 'proportion' : 'rule', range: true };
        if (!d) return Object.assign(base, { state: 'right', text: f.ok + (pt ? ' Inside the range Proportion works out for you.' : '') });
        if (Math.abs(d) <= tol) return Object.assign(base, { state: 'close', text: 'Just ' + (d < 0 ? 'under' : 'over') + ' the range, by ' + Math.abs(r1(d)) + ' cm: wearable.' });
        if (d > 0 && f.soft && d <= f.soft[0]) return Object.assign(base, { state: 'close', text: f.soft[1] });
        // a rise, leg opening or knit length that another period calls for is a matter of period: another
        // size would hardly change it. Only a value no period calls for is a misfit.
        if (f.periodSoft && pt && ctx.periods) {
          const other = Object.keys(ctx.periods).filter(function (id) { const t = ctx.periods[id][f.prop]; return t && t.lo != null && v >= t.lo - tol && v <= t.hi + tol; });
          if (other.length) return Object.assign(base, { state: 'close', style: true, text: (d < 0 ? 'Below' : 'Above') + ' the range for the period chosen on Proportion, but in the range for ' + other.map(function (id) { return window.VPROP ? window.VPROP.PERIODS[id].name : id; }).join(', ') + ': a matter of period, not of size, and another size would hardly change it.' });
        }
        if (f.style) return Object.assign(base, { state: 'close', style: true, text: f.styleText(d, r1(lo), r1(hi)) });
        const s = d < 0 ? f.low : f.high;
        return Object.assign(base, { state: s[0], text: s[1], alter: s[2] });
      }
      // 3. the body plus ease, or a single target
      const target = f.target ? f.target(m) : m[f.body] || null;
      if (!target) return { key: f.key, label: f.label, garment: v, missing: f.needs || [f.body] };
      const d = v - target, base = { key: f.key, label: f.label, garment: r1(v), target: r1(target), diff: r1(d), against: 'body' };
      if (f.cuts) {
        if (d < f.tight[0]) return Object.assign(base, { state: 'tight', text: f.tight[1], alter: f.tight[2] });
        if (d >= f.loose[0]) return Object.assign(base, { state: 'loose', text: f.loose[1], alter: f.loose[2] });
        const cut = CUT_ORDER.find(function (c) { return d >= f.cuts[c][0] && d < f.cuts[c][1]; });
        const w = f.cuts[want], mid = (w[0] + w[1]) / 2, gap = mid - d, sizes = Math.round(gap / f.step);
        const ease = 'Ease ' + r1(d) + ' cm, which makes it a ' + CUT_NAME[cut] + ' cut on you';
        if (cut === want) return Object.assign(base, { state: 'right', cut: cut, text: ease + ', as you want (' + w[0] + ' to ' + w[1] + ' cm for a ' + CUT_NAME[want] + ' cut).' });
        return Object.assign(base, { state: 'close', cut: cut, text: ease + '; a ' + CUT_NAME[want] + ' cut needs ' + w[0] + ' to ' + w[1] + ' cm. ' +
          (sizes ? 'About ' + Math.abs(sizes) + ' size' + (Math.abs(sizes) > 1 ? 's' : '') + ' ' + (sizes > 0 ? 'up' : 'down') + ' would give that, if the shoulders still fit.' : 'Within a size of it: wearable as it is.') });
      }
      // the outer bands are open-ended: anything beyond them belongs to the first or last
      const b = f.bands.find(function (x) { return d >= x[0] && d < x[1]; }) || (d < f.bands[0][1] ? f.bands[0] : f.bands[f.bands.length - 1]);
      return Object.assign(base, { state: b[2], text: b[3], alter: b[4] });
    }).filter(Boolean);
  }
  /* Which periods a garment suits on you. Run each measurement whose target changes with the period
     (lapel, rise, leg opening, knit length, shoulders, jacket length) against every period's target;
     a measurement within 1 cm of a period's range suits it. props: { periodId: { targetId: target } }.
     Returns null when no such measurement was entered, else { fields: [{ key, label, value, fits }],
     all: the periods every one of them suits }. */
  function periodFit(kind, res, props) {
    const def = CHECKS[kind], ids = Object.keys(props || {});
    if (!def || ids.length < 2) return null;
    const fields = [];
    def.fields.forEach(function (f) {
      if (!f.prop) return;
      const r = res.find(function (x) { return x.key === f.key && x.state && x.garment > 0; });
      if (!r) return;
      const rs = ids.map(function (id) { const t = props[id][f.prop]; return t && t.lo != null && t.hi != null ? [t.lo, t.hi] : null; });
      if (rs.some(function (x) { return !x; })) return;
      const sig = rs.map(function (x) { return x.join('-'); });
      if (sig.every(function (x) { return x === sig[0]; })) return;   // the same in every period
      const tol = f.tol || 1;
      fields.push({ key: f.key, label: f.label.split(',')[0], value: r.garment,
        fits: ids.filter(function (id, i) { return r.garment >= rs[i][0] - tol && r.garment <= rs[i][1] + tol; }) });
    });
    if (!fields.length) return null;
    return { fields: fields, all: ids.filter(function (id) { return fields.every(function (x) { return x.fits.indexOf(id) >= 0; }); }) };
  }
  const RANK = { good: 0, ok: 1, fix: 2, bad: 3 };
  function verdictOf(res) {
    const real = res.filter(function (r) { return r.state; });
    if (!real.length) return null;
    const bad = real.filter(function (r) { return r.state !== 'right' && r.state !== 'close'; });
    const other = real.filter(function (r) { return r.state === 'close' && !r.style; });
    const styled = real.filter(function (r) { return r.style; });
    const fixed = bad.filter(function (r) { return r.alter === 'easy'; }), hard = bad.filter(function (r) { return r.alter === 'no'; });
    const word = function (r) { return r.label.split(',')[0].toLowerCase(); };
    const cutOff = other.find(function (r) { return r.cut; });
    if (!bad.length && cutOff) return { level: 'ok', title: 'Fits, in a different cut', text: 'It fits, but as a ' + CUT_NAME[cutOff.cut] + ' cut rather than the one you want. See the notes for the size that would give your cut.' };
    if (!bad.length && !other.length && styled.length) return { level: 'ok', title: 'Fits; the cut is another period\'s', text: 'It fits, but its ' + styled.map(word).join(' and ') + ' belong' + (styled.length > 1 ? '' : 's') + ' to a different period from the one chosen on Proportion. The periods it suits are listed with the measurements.' };
    if (!bad.length && other.length) return { level: 'ok', title: 'Fits, near enough', text: 'The ' + other.map(word).join(' and ') + ' ' + (other.length > 1 ? 'are' : 'is') + ' just outside the ideal, by little enough to wear.' +
      (styled.length ? ' The ' + styled.map(word).join(' and ') + ' belong' + (styled.length > 1 ? '' : 's') + ' to another period than the one chosen on Proportion; see the periods it suits.' : '') };
    if (!bad.length) return { level: 'good', title: 'This size fits', text: 'Every measurement you entered is right for you' + (real.some(function (r) { return r.cut; }) ? ', in the cut you want.' : '.') };
    if (hard.length) return { level: 'bad', title: 'Try another size', text: 'The ' + hard.map(word).join(' and ') + ' cannot be altered to fit.' };
    if (fixed.length === bad.length) return { level: 'ok', title: 'Fits with an easy alteration', text: bad.map(function (r) { return r.label.split(',')[0]; }).join(' and ') + ': a routine job for a tailor.' };
    return { level: 'fix', title: 'Close, with alterations', text: 'Check the notes: some of this can be altered only within limits.' };
  }
  /* Several sizes from one chart: the best is the one with the mildest verdict, then the fewest
     and smallest misses. Returns the index, or -1 when none can be judged. */
  function bestSize(results) {
    let best = -1, key = null;
    results.forEach(function (res, i) {
      const v = verdictOf(res); if (!v) return;
      const miss = res.filter(function (r) { return r.state && r.state !== 'right'; });
      const k = [RANK[v.level], miss.length, res.reduce(function (s, r) { return s + (r.state && r.state !== 'right' ? Math.abs(r.diff || 0) : 0); }, 0)];
      if (!key || k[0] < key[0] || (k[0] === key[0] && (k[1] < key[1] || (k[1] === key[1] && k[2] < key[2])))) { key = k; best = i; }
    });
    return best;
  }

  /* ---------- At the try-on: what to look for, and why (B) ---------- */
  const TRYON = [
    { name: 'Jacket', items: [
      ['Shoulders first', 'The seam ends at the shoulder bone, and the sleeve hangs straight without a dent below the shoulder. Shoulders are the one part a tailor cannot really change, so a size that is wrong here is the wrong size.'],
      ['Collar against the shirt collar', 'The jacket collar sits on the shirt collar with no gap at the back of the neck, and about 1 to 1.5 cm of shirt collar shows above it.'],
      ['Buttoned', 'No X-shaped pull around the button, and the lapels lie flat on the chest. Room for a flat hand inside, not a fist.'],
      ['Sleeves', 'They end just before the wrist bone, with 1 to 1.5 cm of shirt cuff showing when the arms hang.'],
      ['Length', 'It covers the seat; with the arms hanging, the hem is about where the cupped fingers are.'],
      ['Raise your arms', 'The whole jacket should not ride up to the ears; some lift is normal, a lot means the armholes are too low.']
    ] },
    { name: 'Shirt', items: [
      ['Collar', 'Buttoned, one finger fits between collar and neck. The collar points reach the jacket lapel or tuck under it.'],
      ['Shoulder seam', 'At the shoulder bone, not down the arm.'],
      ['Chest and waist', 'No pulling at the buttons; tucked in, it does not balloon over the belt.'],
      ['Cuffs', 'They cover the wrist bone and stay there when you reach forward. A watch should fit under one.']
    ] },
    { name: 'Trousers', items: [
      ['Waist', 'They stay up without a belt, and a belt only tidies them.'],
      ['Seat', 'Smooth, no folds under the seat and no pull across it when you sit.'],
      ['Front', 'Pockets lie flat; pleats, if any, close when you stand.'],
      ['Length', 'At the front the hem rests on the shoe in a slight break, or just touches it; at the back it reaches the top of the heel.'],
      ['Leg', 'The leg narrows toward the hem without clinging to the calf.']
    ] },
    { name: 'Knitwear', items: [
      ['Length', 'The hem reaches the belt and covers it; longer bunches under a jacket.'],
      ['Shoulders and sleeves', 'Shoulder seam at the shoulder bone, cuffs at the wrist.'],
      ['Under a jacket', 'Thin enough that the jacket still buttons without strain.']
    ] },
    { name: 'Overcoat', items: [
      ['Over a jacket', 'Try it on over the jacket you will wear under it. It buttons without pulling, and the jacket sleeves do not bunch inside.'],
      ['Sleeves', 'They cover the jacket sleeve and the shirt cuff with the arms hanging.'],
      ['Collar', 'It hugs the jacket collar at the back of the neck, and turned up it closes around the throat.']
    ] },
    { name: 'Shoes', items: [
      ['Length', 'About a thumb width beyond the longest toe; try them late in the day, when feet are largest.'],
      ['Width', 'The widest part of the foot sits at the widest part of the shoe, with no bulge at the sides.'],
      ['Heel', 'The heel lifts very little when you walk; a leather sole will slip a little at first.']
    ]},
    { name: 'Hat', items: [
      ['Fit', 'Snug all round without a red line on the forehead afterwards; it should not move when you nod.'],
      ['Height on the head', 'The brim sits about two fingers above the eyebrows, level or a little tilted.']
    ] }
  ];

  /* ---------- From the label: what a size is cut for, against you ----------
     German and Italian jacket sizes are half the chest they are cut for (A); UK and US sizes are
     that chest in inches (B, by convention); collars and trouser waists are labelled with the body
     size in cm or inches. */
  const LABELS = {
    jacket: [{ id: 'eu', name: 'European: German, Italian, French (48, 50, 52…)', body: 'chest', toCm: function (n) { return n >= 88 ? n + 2 : n < 35 ? n * 4 : n * 2; } },   // long sizes are 2N − 2, short sizes N / 2
      { id: 'uk', name: 'UK or US (38, 40, 42…)', body: 'chest', toCm: function (n) { return n * IN; } }],
    shirt: [{ id: 'cm', name: 'Collar in cm (39, 41…)', body: 'neck', toCm: function (n) { return n; }, collar: true },
      { id: 'in', name: 'Collar in inches (15½, 16…)', body: 'neck', toCm: function (n) { return n * IN; }, collar: true }],
    trousers: [{ id: 'in', name: 'Waist in inches (32, 34…)', body: 'waist', toCm: function (n) { return n * IN; } },
      { id: 'eu', name: 'German or Italian size (48, 50…; long 98, 102…; short 24, 25…)', body: 'waist', toCm: function (n) {
        /* German size charts (Baur, Breuninger, outdoor-renner, 2026): normal sizes step 4 cm of waist
           a size, 48 is about 84 cm and 50 about 88; long sizes (90, 94, 98, 102…) run about 14 cm
           under their number (102 is 86–89 cm); short sizes (23, 24, 25…) about 4 × size − 8 (24 is
           86–92 cm). Charts differ by a centimetre or two (B). */
        return n >= 88 ? n - 14 : n < 35 ? n * 4 - 8 : (n - 6) * 2; } },
      // French trouser sizes are about half the waist in cm (38 is about 76 cm, 42 about 84); charts differ by a centimetre or two (B)
      { id: 'fr', name: 'French size (38, 40, 42…)', body: 'waist', toCm: function (n) { return n * 2; } }]
,
    /* Shoes: the size names the last, which is about 1.5 cm longer than the foot it fits. European
       sizes count the last in Paris points of 2/3 cm; British sizes in barleycorns of 1/3 inch,
       UK = 3 × last (in) − 25, US men's one more (B). */
    shoes: [{ id: 'eu', name: 'European (41, 42, 43…)', body: 'foot', shoe: true, toCm: function (n) { return n / 1.5 - 1.5; } },
      { id: 'uk', name: 'UK (7, 8, 9…)', body: 'foot', shoe: true, toCm: function (n) { return (n + 25) / 3 * IN - 1.5; } },
      { id: 'us', name: 'US men\'s (8, 9, 10…)', body: 'foot', shoe: true, toCm: function (n) { return (n + 24) / 3 * IN - 1.5; } },
      { id: 'mp', name: 'Mondopoint, the foot in mm (270, 275…)', body: 'foot', shoe: true, toCm: function (n) { return n / 10; } }],
    // hats are labelled with the head they fit: in cm, or in the US as that in inches over π (A)
    hat: [{ id: 'cm', name: 'Centimetres (57, 58, 59…)', body: 'head', hat: true, toCm: function (n) { return n; } },
      { id: 'us', name: 'US (7, 7⅛, 7¼… as 7.125, 7.25)', body: 'head', hat: true, toCm: function (n) { return n * Math.PI * IN; } }]
  };
  LABELS.coat = LABELS.jacket;   // overcoats are sold by the jacket size they go over
  function checkLabel(kind, sysId, n, m, want) {
    const sys = (LABELS[kind] || []).find(function (s) { return s.id === sysId; });
    if (!sys || !(n > 0)) return null;
    const body = m[sys.body]; if (!body) return { missing: [sys.body] };
    let made = sys.toCm(n);
    if (sys.collar) made -= 1.25;                     // a collar is labelled with the neck it fits, plus the finger's room
    const d = body - made, what = sys.body;
    const tol = { slim: [-2, 1], modern: [-2, 2.5], classic: [-1, 4] }[want] || [-2, 2.5];
    let state, text;
    if (sys.body === 'chest') {
      if (d > 4) { state = 'tight'; text = 'Cut for a ' + what + ' of about ' + Math.round(made) + ' cm; yours is ' + body + ', ' + Math.round(d) + ' cm more. It will be tight in any cut: go up a size.'; }
      else if (d > tol[1]) { state = 'close'; text = 'Cut for about ' + Math.round(made) + ' cm; you are ' + Math.round(d) + ' cm over. ' + (want === 'slim' ? 'It may close, but snug even for a slim cut; one size up is safer.' : 'It would wear as a slim cut at best; for a ' + CUT_NAME[want] + ' fit, one size up.'); }
      else if (d < -4) { state = 'loose'; text = 'Cut for about ' + Math.round(made) + ' cm, ' + Math.round(-d) + ' cm more than your chest: it will hang. Go down a size.'; }
      else if (d < tol[0]) { state = 'close'; text = 'Cut for about ' + Math.round(made) + ' cm, a little over your ' + body + ': it will wear as a roomier, classic cut.'; }
      else { state = 'right'; text = 'Cut for about ' + Math.round(made) + ' cm, close to your ' + body + ' cm: the right size. The cut the label promises (slim, regular) decides the rest.'; }
    } else if (sys.shoe) {
      state = d > 0.4 ? 'tight' : d < -0.8 ? 'loose' : 'right';
      text = 'Made for a foot of about ' + r1(made) + ' cm; yours is ' + body + '. ' + (state === 'tight' ? 'Your toes will reach the front: go up half a size.' : state === 'loose' ? 'Your heel will slip: go down half a size.' : 'The right length on paper.') + ' Lasts differ between makers by half a size or more, and width matters as much: try them on, late in the day.';
      return { state: state, text: text };
    } else if (sys.hat) {
      state = d > 0.5 ? 'tight' : d < -1 ? 'loose' : 'right';
      text = 'Made for a head of about ' + r1(made) + ' cm; yours is ' + body + '. ' + (state === 'tight' ? 'It will press on the forehead: go up a size.' : state === 'loose' ? 'It will slip down: go down a size, or pad the sweatband.' : 'The right size.');
      return { state: state, text: text };
    } else if (sys.collar) {
      state = d > 0.6 ? 'tight' : d < -1.5 ? 'loose' : 'right';
      text = 'Made for a neck of about ' + r1(made) + ' cm; yours is ' + body + '. ' + (state === 'tight' ? 'It will not close comfortably: go up a size.' : state === 'loose' ? 'The collar will gape: go down a size.' : 'The right collar.');
    } else {
      state = d > 2 ? 'tight' : d < -4 ? 'loose' : 'right';
      text = 'Made for a waist of about ' + Math.round(made) + ' cm; yours is ' + body + '. ' + (state === 'tight' ? 'Tight: a tailor can let out 2 to 4 cm at most, so go up a size.' : state === 'loose' ? 'Loose: a tailor can take in the back seam, but more than 4 cm upsets the seat; go down a size.' : 'The right waist.');
    }
    return { state: state, text: text + (kind !== 'shirt' ? ' Labels are a guide; brands cut differently, so the measurement check is the reliable test.' : '') };
  }

  /* ---------- The page ---------- */
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const CUT_HELP = { slim: 'close to the body; little room under it', modern: 'shaped at the waist, room to move: today\'s tailored default', classic: 'fuller through chest and seat, drapes rather than follows' };
  const STATE_WORD = { right: 'Right', close: 'Wearable', tight: 'Tight', loose: 'Loose', short: 'Short', long: 'Long' };
  const ALTER_WORD = { easy: 'easy to alter', some: 'alterable within limits', no: 'cannot be altered' };
  const AGAINST = { yours: 'against yours', proportion: 'Proportion target', rule: 'for you', body: 'your body' };
  const MAX_SIZES = 4, CLEAN = typeof Symbol === 'function' ? Symbol('clean') : '__clean';

  /* The saved state of the check, made safe whatever a file holds. */
  function clean(fc) {
    fc = fc && typeof fc === 'object' ? fc : {};
    const num = function (x) { const n = parseFloat(x); return n > 0 && n < 1000 ? String(n) : ''; };
    const vals = function (o, kind) { const r = {}; if (o && typeof o === 'object') CHECKS[kind].fields.forEach(function (f) { const n = num(o[f.key]); if (n) r[f.key] = n; }); return r; };
    const out = { kind: CHECKS[fc.kind] ? fc.kind : 'jacket', want: CUT_NAME[fc.want] ? fc.want : 'modern', mode: fc.mode === 'label' ? 'label' : 'measure',
      flat: {}, label: {}, sizes: {}, ref: {} };
    const fl = fc.flat && typeof fc.flat === 'object' ? fc.flat : { chest: true };
    ['chest', 'waist', 'seat'].forEach(function (k) { out.flat[k] = !!fl[k]; });
    Object.keys(CHECKS).forEach(function (k) {
      let list = fc.sizes && Array.isArray(fc.sizes[k]) ? fc.sizes[k] : fc.vals && fc.vals[k] ? [{ n: '', v: fc.vals[k] }] : [];   // older files kept one size in vals
      list = list.slice(0, MAX_SIZES).map(function (z) { return { n: z && typeof z.n === 'string' ? z.n.slice(0, 12) : '', v: vals(z && z.v, k) }; });
      out.sizes[k] = list.length ? list : [{ n: '', v: {} }];
      out.ref[k] = vals(fc.ref && fc.ref[k], k);
      const L = fc.label && fc.label[k];
      if (LABELS[k]) out.label[k] = { sys: L && LABELS[k].some(function (x) { return x.id === L.sys; }) ? L.sys : LABELS[k][0].id, n: L ? num(L.n) : '' };
    });
    Object.defineProperty(out, CLEAN, { value: true });   // not saved: a loaded file is cleaned again
    return out;
  }

  function render(root, api) {
    const st = api.state(), m = st.measurements || {};
    // cleaned once and then kept, so every handler works on the same object even when a render
    // happens inside another (removing an edited input can fire its change event)
    if (!st.fitCheck || !st.fitCheck[CLEAN]) st.fitCheck = clean(st.fitCheck);
    const fc = st.fitCheck;
    const labelOf = api.labelOf;
    const prop = {};
    if (window.VPROP && m.height > 0) {
      try { window.VPROP.targets(m, st.shape || {}, st.period || 'classic', { hairStyle: st.hairStyle }).list.forEach(function (t) { prop[t.id] = t; }); } catch (e) { /* the check works without it */ }
    }
    const perName = window.VPROP && window.VPROP.PERIODS[st.period] ? window.VPROP.PERIODS[st.period].name : null;
    // the targets of every period, for the line that says which periods a garment suits
    const allProps = {};
    if (window.VPROP && m.height > 0) Object.keys(window.VPROP.PERIODS).forEach(function (id) {
      try { const pp = {}; window.VPROP.targets(m, st.shape || {}, id, { hairStyle: st.hairStyle }).list.forEach(function (t) { pp[t.id] = t; }); allProps[id] = pp; } catch (e) { /* skipped */ }
    });
    const PN = function (id) { return window.VPROP.PERIODS[id].name + (id === (st.period || 'classic') ? ' (chosen)' : ''); };
    const periodsHtml = function (res) {
      const pf = periodFit(fc.kind, res, allProps);
      if (!pf) return '';
      const list = function (ids) { return ids.length ? ids.map(PN).join(', ') : 'none'; };
      return '<div class="fc-periods"><strong>Periods it suits on you</strong> <span class="badge B">B</span>' +
        '<p>' + (pf.fields.length > 1 ? (pf.all.length ? 'All of it: ' + esc(list(pf.all)) + '.' : 'No single period: its measurements belong to different ones.') : '') + '</p><ul>' +
        pf.fields.map(function (x) { return '<li>' + esc(x.label) + ' ' + x.value + ' cm: ' + esc(list(x.fits)) + '</li>'; }).join('') +
        '</ul><p class="small muted">From the measurements that change with the period; within a centimetre of a period\'s range counts. Period ranges are tendencies, so read this as "in the range for", not "authentic to".</p></div>';
    };
    const sz = sizes(m), groups = [];
    sz.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
    let h = '<h2>Fit &amp; size</h2><p class="lede">Whether a garment will fit you, before you buy it: from the measurements the shop gives, from its size label, or against one of yours that fits. Then your sizes, and what to look for when you try it on.</p>';

    // the check comes first: it is what the page is for
    const def = CHECKS[fc.kind], hasLabel = !!LABELS[fc.kind];
    const mode = hasLabel ? fc.mode : 'measure';
    h += '<h3>Will it fit?</h3>' +
      '<div class="fit-controls">' +
      '<div><span class="flabel">Garment</span><div class="seg" role="radiogroup" id="fcKind">' + Object.keys(CHECKS).map(function (k) { return '<button type="button" role="radio" data-v="' + k + '" aria-checked="' + (fc.kind === k) + '">' + CHECKS[k].name + '</button>'; }).join('') + '</div></div>' +
      (def.cut ? '<div><span class="flabel">The cut you want</span><div class="seg" role="radiogroup" id="fcWant">' + CUT_ORDER.map(function (c) { return '<button type="button" role="radio" data-v="' + c + '" aria-checked="' + (fc.want === c) + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</button>'; }).join('') + '</div>' +
        '<p class="small muted fc-cuthelp">' + CUT_NAME[fc.want].replace(/^./, function (c) { return c.toUpperCase(); }) + ': ' + CUT_HELP[fc.want] + '.</p></div>' : '') +
      (hasLabel ? '<div><span class="flabel">Check by</span><div class="seg" role="radiogroup" id="fcMode"><button type="button" role="radio" data-v="measure" aria-checked="' + (mode === 'measure') + '">Its measurements</button><button type="button" role="radio" data-v="label" aria-checked="' + (mode === 'label') + '">Its size label</button></div></div>' : '') +
      '</div>';
    if (mode === 'label') {
      const L = fc.label[fc.kind];
      const res = checkLabel(fc.kind, L.sys, +L.n, m, fc.want);
      h += '<div class="fc-form"><label>Size system <select id="fcSys">' + LABELS[fc.kind].map(function (s) { return '<option value="' + s.id + '"' + (L.sys === s.id ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select></label>' +
        '<label>Size on the label <input type="number" id="fcN" step="any" min="1" value="' + esc(L.n) + '"></label></div>' +
        (res ? (res.missing ? '<p class="small muted">Needs your ' + res.missing.map(labelOf).join(' and ').toLowerCase() + ' (You tab).</p>'
          : '<div class="fc-res"><p class="fc-line ' + res.state + '"><strong>' + STATE_WORD[res.state] + '.</strong> ' + esc(res.text) + '</p></div>') : '<p class="small muted">Enter the size on the label.</p>');
    } else {
      const list = fc.sizes[fc.kind], ref = fc.ref[fc.kind];
      const hasRef = Object.keys(ref).length > 0;
      h += '<p class="small fc-intro">Copy the garment\'s own measurements from the shop\'s size chart (not the body sizes it is meant for); leave out what the chart does not give. Add more sizes from the same chart to compare them. ' +
        'If you have one of the same kind that fits well, measure it the same way and fill in the first column: nothing judges a new garment better.</p>';
      h += '<div class="fc-scroll"><table class="fc-grid"><thead><tr><th scope="col">Measurement</th><th scope="col" class="fc-ref">One of yours that fits</th>' +
        list.map(function (z, i) { return '<th scope="col"><input type="text" class="fc-name" data-sname="' + i + '" maxlength="12" placeholder="Size ' + (i + 1) + '" value="' + esc(z.n) + '" aria-label="Name of size ' + (i + 1) + '">' + (list.length > 1 ? '<button type="button" class="fc-del" data-sdel="' + i + '" aria-label="Remove size ' + (i + 1) + '">×</button>' : '') + '</th>'; }).join('') +
        (list.length < MAX_SIZES ? '<th scope="col"><button type="button" class="btn ghost small" id="fcAdd">Add a size</button></th>' : '') + '</tr></thead><tbody>' +
        def.fields.map(function (f) {
          const cell = function (val, attr) { return '<td><input type="number" step="0.5" min="1" ' + attr + ' value="' + esc(val || '') + '" aria-label="' + esc(f.label) + '"></td>'; };
          return '<tr><th scope="row">' + f.label + (f.flat ? '<label class="check small fc-flat"><input type="checkbox" data-flat="' + f.key + '"' + (fc.flat[f.key] ? ' checked' : '') + '> measured flat, across</label>' : '') + '</th>' +
            cell(ref[f.key], 'data-ref="' + f.key + '"') + list.map(function (z, i) { return cell(z.v[f.key], 'data-s="' + i + '" data-f="' + f.key + '"'); }).join('') + (list.length < MAX_SIZES ? '<td></td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
      // the seat's shape changes what to look for in trousers (tailoring convention, B)
      const seatShape = (st.shape || {}).seat;
      if (fc.kind === 'trousers' && seatShape === 'prominent') h += '<p class="small fc-note"><span class="badge B">B</span> <strong>Your seat:</strong> with a prominent seat or a hollow lower back, choose seat ease at the upper end of the cut and a rise that is not low. If the chart gives a back rise, it should be clearly longer than the front. Side adjusters or braces follow the back better than a belt. A low, slim cut gaps at the back of the waistband.</p>';
      if (fc.kind === 'trousers' && seatShape === 'flat') h += '<p class="small fc-note"><span class="badge B">B</span> <strong>Your seat:</strong> with a flat seat, trousers cut for an average one sag under it. Seat ease at the lower end of the cut suits you, and a tailor can take in the seat seam.</p>';
      if (def.fields.some(function (f) { return f.key === 'length'; })) h += '<p class="small muted fc-note">Lengths here run from the base of the collar at the back. Charts that measure from the shoulder\'s highest point, beside the collar, give about 2 cm more: take that off.</p>';
      const ctx = { prop: prop, ref: ref, periods: allProps };
      const results = list.map(function (z) { return checkGarment(fc.kind, z.v, fc.flat, m, fc.want, ctx); });
      const judged = results.filter(function (r) { return verdictOf(r); }).length;
      const best = judged > 1 ? bestSize(results) : -1;
      const nameOf = function (i) { return list[i].n ? list[i].n : 'Size ' + (i + 1); };
      if (best >= 0) {
        const v = verdictOf(results[best]);
        h += '<div class="ov-verdict mini ' + v.level + '"><div><strong>' + (v.level === 'bad' ? 'None of these fits; the nearest is ' : 'Best of these: ') + esc(nameOf(best)) + '</strong><span>' + esc(v.title) + '. ' + esc(v.text) + '</span></div></div>';
      }
      const any = results.some(function (r) { return r.length; });
      h += any ? results.map(function (res, i) {
        if (!res.length) return '';
        const v = verdictOf(res);
        const body = '<ul class="fc-list">' + res.map(function (r) {
          if (r.implausible) return '<li><strong>' + r.label + ':</strong> ' + r.garment + ' cm is not a garment measurement; check the number and the units.</li>';
          if (r.halfHint) return '<li><strong>' + r.label + ':</strong> ' + r.garment + ' cm is far less than your body, so it is probably measured flat, across one side: tick <em>measured flat</em> to double it.</li>';
          if (r.missing) return '<li><strong>' + r.label + ':</strong> needs your ' + r.missing.map(labelOf).join(' and ').toLowerCase() + ' (You tab).</li>';
          return '<li class="fc-line ' + r.state + '"><strong>' + r.label + '</strong> <span class="fc-num">' + r.garment + ' cm; ' + AGAINST[r.against] + ' ' + r.target + (r.diff ? ' (' + (r.diff > 0 ? '+' : '') + r.diff + ')' : '') + '</span><br><strong>' + STATE_WORD[r.state] + '.</strong> ' + esc(r.text.replace(/^(Right|Long|Short|Tight|Loose|Close)[:,] /, '').replace(/^./, function (c) { return c.toUpperCase(); })) + (r.alter && r.state !== 'right' ? ' <em>(' + ALTER_WORD[r.alter] + ')</em>' : '') + '</li>';
        }).join('') + '</ul>' + periodsHtml(res);
        if (list.length === 1) return (v ? '<div class="ov-verdict mini ' + v.level + '"><div><strong>' + v.title + '</strong><span>' + esc(v.text) + '</span></div></div>' : '') + body;
        return '<details class="fc-size"' + (i === best || best < 0 ? ' open' : '') + '><summary><strong>' + esc(nameOf(i)) + '</strong>' + (v ? ' <span class="fc-tag ' + v.level + '">' + esc(v.title) + '</span>' : '') + '</summary>' + body + '</details>';
      }).join('') : '<p class="small muted">Enter at least one measurement.</p>';
      // where the judgement comes from
      const props = def.fields.filter(function (f) { return f.prop && prop[f.prop] && prop[f.prop].lo != null; });
      h += '<p class="small muted fc-src">' + (hasRef ? 'Where you filled in your own garment, the new one is judged against it. ' : '') +
        (props.length ? 'The ' + props.map(function (f) { return f.label.split(',')[0].toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' ' + (props.length > 1 ? 'are' : 'is') + ' judged against the Proportion targets for your build' + (perName ? ' and the period chosen there (' + esc(perName) + ')' : '') + '. ' : '') +
        'The rest against your body plus the ease of the cut, or a tailoring rule.</p>';
    }

    h += '<h3>Your sizes</h3><p class="small">Worked out from your measurements. A starting point: brands cut differently, and the check above is the reliable test.</p><div class="fit-sizes">' + groups.map(function (g) {
      return '<div class="fit-group"><h4>' + g + '</h4><dl>' + sz.filter(function (x) { return x.group === g; }).map(function (x) {
        return x.needs ? '<div class="fit-row miss"><dt>' + x.label + '</dt><dd>needs ' + x.needs.map(labelOf).join(' and ').toLowerCase() + '</dd></div>'
          : '<div class="fit-row"><dt>' + x.label + ' ' + x.level.split('/').map(function (l) { return '<span class="badge ' + l + '">' + l + '</span>'; }).join(' ') + '</dt><dd><strong>' + esc(x.value) + '</strong><span>' + esc(x.how) + '</span></dd></div>';
      }).join('') + '</dl></div>';
    }).join('') + '</div>' +
      (sz.some(function (x) { return x.needs; }) ? '<p class="small muted">Missing measurements can be added on the <a href="#" data-goto-fit="you">You</a> tab.</p>' : '');

    h += '<h3>At the try-on</h3><p class="small">What to look for, in the order a tailor would, and why.</p>' + TRYON.map(function (g) {
      return '<details class="fit-try"><summary>' + g.name + '</summary><ul>' + g.items.map(function (i) { return '<li><strong>' + i[0] + '.</strong> ' + esc(i[1]) + '</li>'; }).join('') + '</ul></details>';
    }).join('');
    root.innerHTML = h;

    const redo = function () { api.save(); render(root, api); };
    const seg = function (id, key) { root.querySelectorAll('#' + id + ' button').forEach(function (b) { b.addEventListener('click', function () { fc[key] = b.dataset.v; redo(); }); }); };
    seg('fcKind', 'kind'); seg('fcWant', 'want'); seg('fcMode', 'mode');
    root.querySelectorAll('[data-goto-fit]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); api.goto(a.dataset.gotoFit); }); });
    const sys = root.querySelector('#fcSys'), n = root.querySelector('#fcN');
    if (sys) sys.addEventListener('change', function () { fc.label[fc.kind].sys = sys.value; redo(); });
    if (n) n.addEventListener('change', function () { fc.label[fc.kind].n = n.value; redo(); });
    const list = fc.sizes[fc.kind];
    root.querySelectorAll('[data-s]').forEach(function (i) { i.addEventListener('change', function () { list[+i.dataset.s].v[i.dataset.f] = i.value; redo(); }); });
    root.querySelectorAll('[data-ref]').forEach(function (i) { i.addEventListener('change', function () { fc.ref[fc.kind][i.dataset.ref] = i.value; redo(); }); });
    root.querySelectorAll('[data-sname]').forEach(function (i) { i.addEventListener('change', function () { list[+i.dataset.sname].n = i.value; redo(); }); });
    root.querySelectorAll('[data-sdel]').forEach(function (b) { b.addEventListener('click', function () { list.splice(+b.dataset.sdel, 1); redo(); }); });
    const add = root.querySelector('#fcAdd');
    if (add) add.addEventListener('click', function () { if (list.length < MAX_SIZES) list.push({ n: '', v: {} }); redo(); });
    root.querySelectorAll('[data-flat]').forEach(function (i) { i.addEventListener('change', function () { fc.flat[i.dataset.flat] = i.checked; redo(); }); });
  }

  window.VFIT = { CUT_NAME: CUT_NAME, render: render, clean: clean, checkLabel: checkLabel, LABELS: LABELS, sizes: sizes, collar: collar, watchRange: watchRange, lengthLetter: lengthLetter, CHECKS: CHECKS, checkGarment: checkGarment, verdictOf: verdictOf, bestSize: bestSize, periodFit: periodFit, TRYON: TRYON };
})();
