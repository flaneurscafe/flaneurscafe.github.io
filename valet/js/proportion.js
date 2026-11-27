/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — Proportion. From the body model (body.js), where each garment should end and how wide
   its parts should be on this frame, within a period whose pieces were cut to go together.

   Every target is graded B: where a garment should end and how wide its parts should be is tailoring
   convention (Flusser, Dressing the Man, 2002, ch. 3, pp. 34–61; the classic fitting rules), even though turning it
   into centimetres for this body is plain geometry. Following the rule of the whole project, nothing
   graded C is used: the periods come from tailoring histories, not from makers' own descriptions.
   Every target is a range, widened by how sure the measurements behind it are.

   Lengths of garments are given as tailors measure them: a jacket, knit or coat down the centre
   back from the base of the collar (about the C7 bump), so the figure is the same one a shop's
   size chart or a tailor gives. Each target also says where its hem lands on the body.

   Loads without a DOM (the tests run it in Node); the page is drawn by render(). */
// @ts-check
(function () {
  'use strict';
  const B = window.VBODY;
  const r1 = function (x) { return Math.round(x * 10) / 10; };
  const rr = function (x) { return Math.round(x * 2) / 2; };   // to the half centimetre

  /* Periods: proportions that were cut to work with each other. Only what differs is listed;
     everything is a range. Sources in How it works (Proportion, #p-period-sources), where each
     figure is cited with its page. Trouser bottoms in the trade are measured around (twice the
     flat width, US Commercial Standard CS166-50, 1950); a period's figure in inches around, for
     a man of average size, is turned into openingFrac by halving it and dividing by an average
     shoe of 29 cm (a 26 cm foot plus 3). Figures no source gives are marked unsourced. */
  const PERIODS = {
    classic: {
      name: "Today's classic",
      note: 'Mid to high rise, medium lapels, a jacket that covers the seat: the middle ground classic tailoring has settled on.',
      jacketShift: [0, 0],          // cm against half of back-neck to floor
      shoulderAdd: [1, 2.5],        // jacket shoulder (seam to seam, flat) over the body shoulder
      lapelFrac: [0.45, 0.55],      // share of the distance from collar to shoulder line
      waistband: [-3, 0],           // cm from the navel waist: negative = below it
      buttonBelow: [0, 2],          // waist button below the natural waist
      openingFrac: [0.6, 0.7],      // trouser hem, flat across, as a share of the shoe's length
      knitOver: [3, 6],             // a knit's hem below the waistband
      breakWord: 'a slight break: the hem just touches the shoe at the front',
      turnUp: function (h) { return h < 178 ? [4, 4.2] : [4.3, 4.5]; }   // Flusser p. 61: 1⅝ in under 5 ft 10 in, 1¾ in if taller
    },
    '1930s': {
      name: '1930s drape',
      note: 'The golden age: trousers high at the natural waist or above, worn with braces; a broad, draped chest and wide lapels; short knitwear, waistcoats and ties that end at that high waistband.',
      jacketShift: [0, 1],          // 29–29½ in on a size 40 (Schoeffler pp. 15–16; Progressive Tailor 1936–37): about today's length
      shoulderAdd: [2, 4],
      lapelFrac: [0.55, 0.65],
      waistband: [0, 3],
      buttonBelow: [0, 1.5],
      openingFrac: [0.76, 0.86],    // 17½–18½ in around for suits, 19–20 for slacks (Progressive Tailor 1930, 1936–37; Schoeffler pp. 14, 86)
      openingSrc: '17½ to 18½ inches for suits, 19 to 20 for slacks: The Progressive Tailor 1930–37; Schoeffler and Gale, pp. 14, 86',
      knitOver: [0, 2.5],
      breakWord: 'a slight to full break over turn-ups; the full leg falls straight to the shoe',
      turnUp: function (h) { return h < 172 ? [4, 4.5] : [4.5, 5.5]; }
    },
    '1940s': {
      name: '1940s',
      note: 'The 1930s line made broader: wide, padded shoulders, wide (often peaked) lapels, full trousers at the natural waist; knit vests and sleeveless pullovers ending at the waistband. From 1942 the war orders capped jacket length and trouser width and banned turn-ups and pleats; the post-war bold look (1948) brought back broad shoulders and wide lapels.',
      jacketShift: [0, 1.5],        // war orders: at most 29¾ in for a size 37 (Federal Register 1942); longer after the war is unsourced
      shoulderAdd: [2.5, 4.5],
      lapelFrac: [0.55, 0.68],
      waistband: [0, 1.5],          // L-224 (1942) banned "any type of high-rise": at the natural waist
      buttonBelow: [0, 1.5],
      openingFrac: [0.76, 0.82],    // at most 18½ in around at the bottom (Federal Register 1942; Schoeffler p. 29); post-war unsourced
      openingSrc: 'at most 18½ inches: the War Production Board orders of 1942',
      knitOver: [0, 3],
      breakWord: 'a slight to full break over turn-ups',
      turnUp: function (h) { return h < 172 ? [4, 4.5] : [4.5, 5.5]; }
    },
    '1950s': {
      name: '1950s Ivy',
      note: 'The natural-shouldered sack suit: little padding, a straight body, narrower lapels and ties, trousers lower and slimmer than before; knitwear long enough to cover the waistband.',
      jacketShift: [0, 0.5],
      shoulderAdd: [0.5, 1.5],
      lapelFrac: [0.4, 0.48],       // direction only: 1950's trim look took ¾ in off the lapels (Schoeffler pp. 31, 72)
      waistband: [-4, -1],          // direction only: the Continental's low rise (Flusser p. 116; Schoeffler p. 96); the figure is unsourced
      buttonBelow: [1, 3],
      openingFrac: [0.7, 0.78],     // mid-1950s slacks "tapered sharply to 17½ inches" (Schoeffler p. 95; Flusser p. 116); 16 in by 1963
      openingSrc: '17½ inches in the mid-1950s, 16 by 1963: Schoeffler and Gale, pp. 95, 97',
      knitOver: [3, 6],
      breakWord: 'a slight break or none',
      turnUp: function (h) { return h < 172 ? [3.5, 4] : [4, 4.5]; }
    },
    '1960s': {
      name: '1960s slim',
      note: 'Short, slim jackets with narrow lapels and skinny ties; trousers lower and narrow, often without turn-ups and without a break; knitwear longer, over the lower waistband.',
      jacketShift: [-2, -0.5],      // direction only: the shorter Continental jacket (Schoeffler p. 35); the figure is unsourced
      shoulderAdd: [0.5, 1.5],
      lapelFrac: [0.3, 0.4],        // direction only: narrow lapels in 1964 (Schoeffler p. 38)
      waistband: [-6, -3],          // direction only: low-rise, hip-riding slacks from 1963 (Schoeffler pp. 43, 97; Flusser p. 116)
      buttonBelow: [0.5, 2.5],
      openingFrac: [0.6, 0.72],     // 1963: 14 in (slimmest) to 15 and 16 in around (Men's Wear, quoted by Schoeffler p. 97)
      openingSrc: '14 to 16 inches in 1963: Men\'s Wear, in Schoeffler and Gale, p. 97',
      knitOver: [4, 8],
      breakWord: 'no break: the hem just meets the shoe',   // Esquire, April 1962 (Schoeffler p. 97)
      turnUp: function () { return null; }
    },
    '1970s': {
      name: '1970s',
      note: 'Fitted jackets with wide lapels and wide ties; trousers fitted through the thigh and flared at the hem, with a full break; turn-ups rare.',
      jacketShift: [0, 1],
      shoulderAdd: [1.5, 3],
      lapelFrac: [0.65, 0.8],       // wide lapels (Schoeffler p. 44); the figures are unsourced
      waistband: [-2, 1],           // both: high rises and low ones in 1972 (Schoeffler p. 100)
      buttonBelow: [0, 2],
      openingFrac: [0.85, 1.0],     // flared (Schoeffler pp. 44, 80); the figures are unsourced
      knitOver: [3, 6],
      breakWord: 'a full break over the shoe',
      turnUp: function () { return null; }
    }
  };

  /* Frame size, for things that scale with the whole figure (hat brim, pattern repeat): big for a
     tall or broad man, small for a short or narrow one. Same thresholds as the Dresser's brim. */
  function frameSize(m) {
    m = m || {};
    const h = +m.height || 0, sh = +m.shoulder || 0;
    if (h >= 185 || sh >= 48) return 'big';
    if ((h && h < 170) || (sh && sh < 43)) return 'small';
    return h || sh ? 'medium' : null;
  }

  const ORDER = ['glasses', 'frameDepth', 'brim', 'collar', 'tieWidth', 'tieLength', 'knit', 'waistcoat',
    'shoulder', 'balance', 'gorge', 'lapel', 'button', 'sleeve', 'jacketLength', 'coat',
    'rise', 'opening', 'hem', 'pattern'];
  /* One target: { id, group, label, lo, hi, unit, text, why, grade, uses, est, note } */
  function targets(m, shape, periodId, extra) {
    const P = PERIODS[periodId] || PERIODS.classic, d = B.derive(m, shape), v = d.v, out = [];
    extra = extra || {};
    const H = v.height;
    const add = function (t) { out.push(Object.assign({ unit: 'cm', grade: 'B', uses: [], est: [] }, t)); };
    const missing = function (keys) { return keys.filter(function (k) { return !(v[k] > 0); }); };
    const estOf = function (keys) { return keys.filter(function (k) { return d.est[k]; }); };
    const unc = function (keys) { return keys.reduce(function (s, k) { return s + (d.est[k] ? 3 : (B.UNC[k] || 1)) ** 2; }, 0) ** 0.5; };
    const need = function (id, group, label, keys) { add({ id: id, group: group, label: label, needs: keys }); };
    const legP = d.pct.legRatio;

    /* ---------- Jacket ---------- */
    if (v.backNeckFloor) {
      const base = v.backNeckFloor / 2, u = Math.max(1, unc(['backNeckFloor']) / 2);
      // shorter legs for the height: the shorter end, which leaves more leg; longer legs the longer end
      const lean = legP == null ? 0 : legP < 30 ? -0.75 : legP > 70 ? 0.75 : 0;
      const lo = rr(base + P.jacketShift[0] + lean - u), hi = rr(base + P.jacketShift[1] + lean + u);
      const hemLo = v.backNeckFloor - hi, hemHi = v.backNeckFloor - lo;
      let seat = '';
      if (v.inseam) {
        const above = hemHi - v.inseam;   // the shortest length: how far its hem sits above the crotch
        seat = above <= 1 ? ' At either end it covers the seat.' : above <= 5 ? ' At the shorter end it may not quite cover the seat, which a jacket should; choose the longer end if it does not.' : ' Check the shorter end in a mirror: it may stop short of the seat.';
      }
      add({ id: 'jacketLength', group: 'Jacket', label: 'Length, centre back from the base of the collar', lo: lo, hi: hi,
        text: 'Half your back-neck-to-floor height (' + r1(v.backNeckFloor) + ' / 2 = ' + r1(base) + ')' + (lean < 0 ? ', at the shorter end because your legs are shorter than most for your height: a jacket that ends higher leaves them more length' : lean > 0 ? ', at the longer end, which your longer legs carry' : '') +
          '. The hem lands ' + Math.round(hemLo) + ' to ' + Math.round(hemHi) + ' cm from the floor.' + seat,
        why: 'Roughly half of the figure is jacket and half trouser, and the jacket covers the curve of the seat (Flusser, Dressing the Man, pp. 40–41).',
        uses: ['backNeckFloor', 'inseam'], est: estOf(['backNeckFloor', 'inseam']) });
    } else need('jacketLength', 'Jacket', 'Length', ['height or back-neck to floor']);

    if (v.backNeckFloor && v.waistHeight) {
      const at = v.backNeckFloor - v.waistHeight, u = Math.max(0.5, unc(['backNeckFloor', 'waistHeight']) / 2);
      add({ id: 'button', group: 'Jacket', label: 'Waist button, its height from the floor', lo: rr(v.waistHeight - P.buttonBelow[1] - u), hi: rr(v.waistHeight - P.buttonBelow[0] + u),
        text: 'At your natural waist (' + Math.round(v.waistHeight) + ' cm from the floor), or up to ' + P.buttonBelow[1] + ' cm below it. On the jacket that is about ' + Math.round(at + (P.buttonBelow[0] + P.buttonBelow[1]) / 2) + ' cm down the back from the base of the collar.',
        why: 'The button divides the body so that torso and legs look their longest; Flusser places it half an inch below the natural waist (Dressing the Man, pp. 41–42).',
        uses: ['backNeckFloor', 'waistHeight'], est: estOf(['backNeckFloor', 'waistHeight']) });
    }

    if (v.shoulder) {
      const big = d.pct.faceWidth != null && d.pct.height != null && d.pct.faceWidth - d.pct.height > 30;
      const slope = shape.shoulders === 'sloping' ? ' Sloping shoulders: some padding keeps the line level.' : shape.shoulders === 'square' ? ' Square shoulders: a soft, natural shoulder is enough.' : '';
      add({ id: 'shoulder', group: 'Jacket', label: 'Shoulder, seam to seam across the back (laid flat)', lo: rr(v.shoulder + P.shoulderAdd[0] + (big ? 0.5 : 0)), hi: rr(v.shoulder + P.shoulderAdd[1] + (big ? 1 : 0)),
        text: 'Your shoulder, ' + r1(v.shoulder) + ' cm, plus ' + P.shoulderAdd[0] + ' to ' + P.shoulderAdd[1] + ' cm' + (big ? ', a little more because your face is broad for your height: the shoulders frame the head' : '') + '.' + slope,
        why: 'The shoulders frame the head: too narrow and the head looks larger, too wide and it looks small (Flusser, Dressing the Man, p. 37).',
        uses: ['shoulder', 'faceWidth'], est: [] });
    } else need('shoulder', 'Jacket', 'Shoulder', ['shoulder']);

    if (H) {
      const hp = d.pct.height, high = hp != null && hp < 30, low = hp != null && hp > 70;
      add({ id: 'gorge', group: 'Jacket', label: 'Gorge, where collar and lapel meet', unit: '',
        text: (P.lapelFrac[0] >= 0.55 ? 'High, as the period cut it, angled up towards the shoulder. ' : '') +
          (high ? 'A high gorge suits you: it lifts the eye and lengthens the lapel line, which a shorter figure gains from.' : low ? 'Mid or a little lower suits your height; a very high gorge looks pinched on a tall man.' : 'Mid height, roughly level with the collarbone.') ,
        why: 'The gorge sets how long the lapel line looks: higher lengthens the figure, lower shortens it; it follows the build, not fashion (Flusser, Dressing the Man, pp. 42–43).', uses: ['height'], est: [] });
    }
    if (shape.posture === 'forward' || shape.posture === 'erect') {
      const fwd = shape.posture === 'forward';
      add({ id: 'balance', group: 'Jacket', label: 'Balance, back against front', unit: '',
        text: fwd ? 'With head and shoulders forward, a jacket cut for an upright figure rides up at the back, stands away from the neck and swings open at the front hem. Look for, or ask for, a longer back and a shorter front, and a collar that sits close.'
          : 'With a very erect stance, chest forward, a jacket cut for an upright figure pulls at the front and sags across the back. Look for, or ask for, a longer front and a shorter back.',
        why: 'A tailor calls this the balance of the jacket: front and back lengths set for the posture, so the hem hangs level.', uses: [], est: [] });
    }

    let lapel = null;
    if (v.shoulder && v.neck) {
      // half the jacket's shoulder, less half the neck's width (its circumference over pi), is the
      // distance from collar to shoulder line; the lapel takes a share of it
      const js = v.shoulder + (P.shoulderAdd[0] + P.shoulderAdd[1]) / 2, span = js / 2 - v.neck / (2 * Math.PI);
      lapel = [rr(span * P.lapelFrac[0]), rr(span * P.lapelFrac[1])];
      add({ id: 'lapel', group: 'Jacket', label: 'Lapel, at its widest', lo: lapel[0], hi: lapel[1],
        text: 'From the collar to the shoulder line is about ' + r1(span) + ' cm on your jacket; the lapel takes ' + Math.round(P.lapelFrac[0] * 100) + ' to ' + Math.round(P.lapelFrac[1] * 100) + ' % of it' + (P.lapelFrac[0] >= 0.55 ? ', a wide lapel, as the period cut it' : P.lapelFrac[1] <= 0.45 ? ', a narrow lapel, as the period cut it' : ', about halfway') + '.',
        why: "The jacket's shoulder sets the lapel: a broad man needs a fuller lapel, a narrow one a slimmer lapel (Flusser, Dressing the Man, p. 43).",
        uses: ['shoulder', 'neck'], est: [] });
    } else need('lapel', 'Jacket', 'Lapel width', missing(['shoulder', 'neck']));

    // Flusser, pp. 44 and 59: the sleeve ends where the wrist breaks with the hand, and no less than half an
    // inch of shirt cuff shows; on long arms three quarters of an inch to an inch
    if (v.arm) {
      const ap = d.pct.arm, cuff = ap != null && ap >= 70 ? [1.9, 2.5] : ap != null && ap <= 30 ? [1.3, 1.6] : [1.3, 1.9];
      add({ id: 'sleeve', group: 'Jacket', label: 'Sleeve, from the shoulder seam', lo: rr(v.arm - cuff[1]), hi: rr(v.arm - cuff[0]),
        text: 'Where the wrist meets the hand, so ' + cuff[0] + ' to ' + cuff[1] + ' cm of shirt cuff shows below it' + (ap != null && ap >= 70 ? ': a little more, because your arms are longer than most.' : '.'),
        why: 'A line of cuff finishes the sleeve, as a line of collar finishes the neck: no less than half an inch, more on long arms (Flusser, Dressing the Man, pp. 44, 59).',
        uses: ['arm'], est: [] });
    }

    /* ---------- Shirt and tie ---------- */
    if (lapel) add({ id: 'tieWidth', group: 'Shirt and tie', label: 'Tie, at its widest', lo: lapel[0], hi: lapel[1],
      text: 'The width of your lapel, within half a centimetre either way.', why: 'Tie and lapel are read together; one much wider than the other looks borrowed.', uses: ['shoulder', 'neck'], est: [] });

    const waistband = v.waistHeight ? [v.waistHeight + P.waistband[0], v.waistHeight + P.waistband[1]] : null;
    if (v.backNeckFloor && waistband) {
      // the knot sits at the top of the breastbone, about 8 cm below the C7 level in the survey
      const knot = v.backNeckFloor - 8, hang = [knot - waistband[1], knot - waistband[0]];
      add({ id: 'tieLength', group: 'Shirt and tie', label: 'Tie, hanging from the knot to the tip', lo: rr(hang[0]), hi: rr(hang[1] + 1),
        text: 'The tip ends at the waistband, which in this period sits ' + Math.round(waistband[0]) + ' to ' + Math.round(waistband[1]) + ' cm from the floor.' + (P.waistband[0] >= 0 ? ' With high-waisted trousers that is a short tie: tie a larger knot, or choose a shorter tie.' : ''),
        why: 'Ties were cut for the trousers of their time: the high waists of the 1930s made for shorter ties.',
        uses: ['backNeckFloor', 'waistHeight'], est: estOf(['backNeckFloor', 'waistHeight']) });
    }

    if (v.faceWidth) {
      const fs = d.pct.faceShape, wide = d.faceClass === 'broad', long = d.faceClass === 'long';   // beyond the tape's error only (body.js)
      const bald = extra.hairStyle === 'none';
      add({ id: 'collar', group: 'Shirt and tie', label: 'Collar', unit: '', text:
        (wide ? 'Your face is broad for its length: longer points and a moderate spread (point or semi-spread) counterbalance it; a wide cutaway widens it further.'
          : long ? 'Your face is long for its width: a wider spread balances it; long narrow points lengthen it further.'
            : 'A semi-spread suits a face of your proportions' + (d.faceClass === 'middle' && (fs >= 65 || fs <= 35) ? ' (it leans ' + (fs >= 65 ? 'broad' : 'long') + ', but within what a tape measure can tell)' : '') + '; point lengths of about 7 to 8 cm.') +
        (bald ? ' Without hair the collar is the frame: choose a taller band, which stands up on its own.' : '') +
        ' About 1 to 1.5 cm of collar shows above the jacket collar at the back.',
        why: 'The collar frames the face and should counterbalance it, not repeat it (Flusser, Dressing the Man, pp. 46, 123–125).',
        uses: ['faceWidth', 'faceLength'], est: [], note: fs == null ? 'Add your face length for the face-shape part.' : '' });
    } else need('collar', 'Shirt and tie', 'Collar', ['faceWidth']);

    /* ---------- Trousers ---------- */
    if (waistband && v.inseam) {
      // front rise: crotch seam to the top of the waistband, about the height difference plus 8 cm for the curve under the body
      const curve = 8 + (shape.stomach === 'full' ? 1.5 : 0);
      const rise = [waistband[0] - v.inseam + curve, waistband[1] - v.inseam + curve], u = unc(['waistHeight', 'inseam']) / 2;
      add({ id: 'rise', group: 'Trousers', label: 'Front rise, crotch seam to the top of the waistband', lo: rr(rise[0] - u), hi: rr(rise[1] + u),
        text: 'For a waistband ' + (P.waistband[0] >= 0 ? 'at or above your natural waist' : P.waistband[1] <= -3 ? 'a few centimetres below your natural waist' : 'at or just below your natural waist') + ', ' + Math.round(waistband[0]) + ' to ' + Math.round(waistband[1]) + ' cm from the floor.' +
          (legP != null && legP < 40 ? ' Your legs are shorter than most for your height, so the higher end lengthens the leg line.' : '') +
          (shape.stomach === 'full' ? ' A little more rise in front for a fuller stomach, so the waistband stays level.' : '') +
          (shape.seat === 'prominent' ? ' With a prominent seat or a hollow lower back the back of the trousers has further to go than the front: look for a higher back rise, side adjusters or braces. A low, slim cut gaps at the back of the waistband and pulls under the seat.' : '') +
          (shape.seat === 'flat' ? ' With a flat seat, trousers cut for an average one sag under it: look for a trimmer seat, or have a tailor take in the seat seam. Pleats in front do not make it worse.' : ''),
        why: 'The waistband is where the legs appear to start, and tailors place it at or a little above the body\'s waist. The evidence is indirect: a study of dresses found a waistline higher than the body\'s preferred (Kim et al. 2020).',
        grade: 'B', uses: ['waistHeight', 'inseam'], est: estOf(['waistHeight', 'inseam']) });
    } else need('rise', 'Trousers', 'Rise', missing(['waistHeight', 'inseam']));

    if (v.foot) {
      const shoe = v.foot + 3, full = d.pct.seat != null && d.pct.seat >= 70 ? 1 : 0;
      const lo = rr(shoe * P.openingFrac[0] + full), hi = rr(shoe * P.openingFrac[1] + full);
      add({ id: 'opening', group: 'Trousers', label: 'Leg opening, the hem laid flat', lo: lo, hi: hi,
        text: 'About ' + Math.round(P.openingFrac[0] * 100) + ' to ' + Math.round(P.openingFrac[1] * 100) + ' % of your shoe\'s length (a shoe is about ' + Math.round(shoe) + ' cm)' + (full ? ', a little wider for a fuller seat, so the leg does not taper too hard' : '') + '. Around: ' + Math.round(lo * 2) + ' to ' + Math.round(hi * 2) + ' cm.',
        why: 'The bottom should cover about two thirds of the shoe and be wide enough to conceal the laces (Flusser, Dressing the Man, pp. 48, 61): too narrow and a large foot looks larger, too wide and a small one looks smaller.' +
          (periodId && periodId !== 'classic' ? ' The period\'s width is its trade figure, inches around the bottom for a man of average size, scaled to your shoe' + (P.openingSrc ? ' (' + P.openingSrc + ')' : ' (no figure found: a tendency only)') + '.' : ''),
        uses: ['foot', 'seat'], est: [] });
    } else need('opening', 'Trousers', 'Leg opening', ['foot']);

    if (H) {
      const tu = P.turnUp(H);
      add({ id: 'hem', group: 'Trousers', label: 'Length and turn-ups', lo: tu ? tu[0] : null, hi: tu ? tu[1] : null,
        text: P.breakWord.charAt(0).toUpperCase() + P.breakWord.slice(1) + '. ' + (tu ? 'Turn-ups ' + tu[0] + ' to ' + tu[1] + ' cm deep for your height.' : 'Usually no turn-ups in this period.'),
        why: 'A deeper turn-up on a taller man keeps it in scale (Flusser, Dressing the Man, p. 61: 1⅝ inches under 5 ft 10 in, 1¾ if taller); a narrower leg breaks sooner, so it is cut a little shorter.', uses: ['height'], est: [] });
    }

    /* ---------- Knitwear and waistcoat: their length follows the trousers of the period ---------- */
    if (v.backNeckFloor && waistband) {
      const hem = [waistband[0] - P.knitOver[1], waistband[1] - P.knitOver[0]];
      add({ id: 'knit', group: 'Knitwear and waistcoat', label: 'Knit, centre back from the base of the collar', lo: rr(v.backNeckFloor - hem[1]), hi: rr(v.backNeckFloor - hem[0]),
        text: 'Its hem ' + (P.knitOver[0] === 0 ? 'meets or just covers' : 'covers') + ' the waistband: ' + Math.round(hem[0]) + ' to ' + Math.round(hem[1]) + ' cm from the floor.' +
          (P.waistband[0] >= 0 ? ' Short by today\'s measure, because the trousers are high: worn with lower trousers it would leave a band of shirt showing.' : ' A short 1930s-length knit needs high-waisted trousers under it.'),
        why: 'A knit and the trousers under it must meet: the period sets where the waistband is, and the knit ends there.',
        uses: ['backNeckFloor', 'waistHeight'], est: estOf(['backNeckFloor', 'waistHeight']) });
      add({ id: 'waistcoat', group: 'Knitwear and waistcoat', label: 'Waistcoat, front point below the waistband', lo: 1, hi: 3,
        text: 'Its points cover the waistband by 1 to 3 cm, so no shirt shows between.' + (P.waistband[0] >= 0 ? ' With braces and high trousers this is the period\'s line.' : ' Over mid-rise trousers that means a longer waistcoat than a 1930s one.'),
        why: 'The waistcoat and trousers meet at the waistband; a gap breaks the figure in two. The waistband must be covered by the waistcoat (Flusser, Dressing the Man, p. 60).', uses: [], est: [] });
    }

    /* ---------- Coat ---------- */
    if (v.backNeckFloor && H) {
      const knee = H * 0.278;   // mid-kneecap height, median share of height in the survey
      const short = d.pct.height != null && d.pct.height < 30;
      const hem = short ? [knee + 2, knee + 8] : [knee - 8, knee + 4];
      add({ id: 'coat', group: 'Coat', label: 'Overcoat, centre back from the base of the collar', lo: rr(v.backNeckFloor - hem[1]), hi: rr(v.backNeckFloor - hem[0]),
        text: (short ? 'Just above the knee, which keeps a shorter figure from being swallowed' : 'From just above to a little below the knee') + ': the hem ' + Math.round(hem[0]) + ' to ' + Math.round(hem[1]) + ' cm from the floor. Over a jacket it must cover the jacket by a hand at least.',
        why: 'A coat ending at the knee divides the figure where the leg bends, which reads natural.', uses: ['backNeckFloor', 'height'], est: estOf(['backNeckFloor']) });
    }

    /* ---------- Face ---------- */
    if (v.faceWidth) add({ id: 'glasses', group: 'Face', label: 'Glasses, the frame front', lo: rr(v.faceWidth - 0.5), hi: rr(v.faceWidth + 0.3),
      text: 'About the width of your face at the cheekbones; the temples should not bow outwards or leave a gap.', why: 'Frames wider than the face make it look narrow, narrower ones make it look broad.',
      uses: ['faceWidth'], est: [] });
    // Lens depth: the collar's counterbalance rule (section 13) applied to the frame. The
    // millimetres are working values within the usual range of men's frames.
    if (v.faceWidth && v.faceLength && d.pct.faceShape != null) {
      const broad = d.faceClass === 'broad', long = d.faceClass === 'long';   // beyond the tape's error only (body.js)
      const dep = long ? [36, 42] : broad ? [30, 35] : [32, 38];
      add({ id: 'frameDepth', group: 'Face', label: 'Glasses, the depth of each lens', unit: 'mm', lo: dep[0], hi: dep[1],
        text: (long ? 'Your face is long for its width: a deeper lens breaks up the length.'
          : broad ? 'Your face is broad for its length: a shallower lens leaves more of the face showing below it.'
            : 'A medium depth suits a face of your proportions.') +
          ' Frame specifications list it as the lens height. Varifocal lenses usually need a lens about 30 mm deep or more, so the optician has the last word.',
        why: 'Like the collar, the frame should counterbalance the face, not repeat it: a deep lens shortens a long face, a shallow one keeps a broad face from looking shorter still.',
        uses: ['faceWidth', 'faceLength'], est: [] });
    } else if (v.faceWidth) need('frameDepth', 'Face', 'Glasses, the depth of each lens', ['faceLength']);

    const fs = frameSize(m);
    if (fs) {
      const brim = fs === 'big' ? [6, 7] : fs === 'small' ? [4.5, 5.5] : [5, 6.5];
      add({ id: 'brim', group: 'Hat', label: 'Brim width', lo: brim[0], hi: brim[1],
        text: fs === 'big' ? 'Medium to wide: a narrow brim looks small on a tall or broad frame.' : fs === 'small' ? 'Narrow to medium: a wide brim can swamp a slight frame.' : 'Medium, the middle for most frames.',
        why: 'The brim is read against the shoulders: it should look in scale with the frame below it.', uses: ['height', 'shoulder'], est: [] });
      const rep = fs === 'big' ? [6, 9] : fs === 'small' ? [3, 5] : [4, 7];
      add({ id: 'pattern', group: 'Pattern', label: 'A medium pattern on a jacket, one repeat', lo: rep[0], hi: rep[1],
        text: (fs === 'big' ? 'The upper end of medium: a broad frame carries a larger repeat, and a small one reads as busy on it.' : fs === 'small' ? 'The lower end of medium: a large repeat swamps a slight frame.' : 'The middle of medium, about a lapel\'s width or a little less.') + ' Shirts and ties stay small whatever the frame.',
        why: 'A pattern is read against the area it fills: the same check looks larger on a narrow chest than a broad one, and small patterns exaggerate a tall man\'s length (Flusser, Dressing the Man, pp. 50, 54).', uses: ['height', 'shoulder'], est: [] });
    }

    // the page reads top down, and at each level from the inner layer out: face and hat, then shirt
    // and tie, knit or waistcoat, jacket, coat; then the trousers; the pattern scale, which runs
    // through every layer, last
    out.sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
    return { period: periodId in PERIODS ? periodId : 'classic', d: d, list: out };
  }

  /* The person's proportions in words, for the page: each with its percentile, neutral. */
  function describe(d) {
    const p = d.pct, out = [];
    const line = function (key, label, text) { if (p[key] != null) out.push({ key: key, label: label, pct: p[key], text: text(B.words(p[key])) }); };
    line('height', 'Height', function (w) { return 'Your height is ' + w + ' of the men in the survey.'; });
    line('legRatio', 'Legs for your height', function (w) { return 'Your inside leg, as a share of your height, is ' + w + '.'; });
    line('torsoRatio', 'Torso for your height', function (w) { return 'Back-neck to crotch, as a share of your height, is ' + w + '.'; });
    line('waistHeightRatio', 'Waist height', function (w) { return 'Your natural waist, as a share of your height, sits ' + w.replace('among the lowest tenth', 'lower than most').replace('among the highest tenth', 'higher than most') + '.'; });
    line('drop', 'Chest to waist', function (w) { return 'The difference between chest and waist is ' + w + '.'; });
    line('faceShape', 'Face, width to length', function (w) { return 'Your face, width against length, is ' + w + '.'; });
    line('frame', 'Frame (wrist for height)', function (w) { return 'Your wrist for your height, a measure of bone frame, is ' + w + '.'; });
    return out;
  }

  window.VPROP = { PERIODS: PERIODS, targets: targets, describe: describe, frameSize: frameSize };
})();
