/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — rules engine for the profile, the Palette tab, the Dresser and the lightness chart.
   Every rule returns a verdict plus the reason and its evidence level:
   A = perception science, B = tailoring/colour convention, C = popular system. */
// @ts-check
(function () {
  'use strict';
  const VC = window.VC;

  const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  const round = function (x, d) { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; };

  /* ---------- Profile ---------- */

  /* The white reference a sample was taken with. In summer the skin may come from a second
     photo, with its own sheet of paper; hair and eyes keep the first. */
  function whiteFor(profile, key) {
    return key === 'skin' && profile.skinWhite !== undefined ? profile.skinWhite : profile.samples.white;
  }
  function corrected(profile, key) {
    const raw = profile.samples[key];
    if (!raw) return null;
    // A colour set by hand is already meant as the true colour; only photo samples are corrected.
    if (profile.manual && profile.manual[key]) return raw;
    const white = whiteFor(profile, key);
    // paper blown out to pure white has lost the cast it should measure, and paper in shadow would
    // brighten everything by the shadow's depth: neither is used (How it works, section 2)
    if (profile.useWhite && white && !whiteUnusable(white)) {
      return VC.rgbToHex(VC.whiteBalance(VC.hexToRgb(raw), VC.hexToRgb(white)));
    }
    return raw;
  }

  function whiteUnusable(hex) {
    const rgb = VC.hexToRgb(hex);
    return Math.max(rgb[0], rgb[1], rgb[2]) >= 252 || VC.labToLch(VC.hexToLab(hex))[0] < 55;
  }

  /* Winter and summer. Skin is the one feature that changes with the time of year. Winter is the
     base profile. Summer uses its own skin if one is set; otherwise it is estimated from winter:
     either the same (for people who hardly tan) or a light tan, the mean change measured on the
     face and neck after two weeks of outdoor sun in late summer (Jiang et al. 2022): L* -2.7,
     a* +0.9, b* +0.3. A longer or deeper tan should be set by name. */
  const TAN = [-2.7, 0.9, 0.3];
  function tanned(hex) { const l = VC.hexToLab(hex); return VC.labToHex([l[0] + TAN[0], l[1] + TAN[1], l[2] + TAN[2]]); }
  function seasonProfile(st, season) {
    season = season || st.season || 'winter';
    if (season !== 'summer') return st;
    const su = st.summer || {};
    const p = Object.assign({}, st, {
      season: 'summer',
      samples: Object.assign({}, st.samples), manual: Object.assign({}, st.manual), named: Object.assign({}, st.named || {})
    });
    if (su.mode === 'own' && su.samples && su.samples.skin) {
      p.samples.skin = su.samples.skin;
      p.manual.skin = !!(su.manual && su.manual.skin);
      p.skinWhite = su.samples.white || null;
      if (su.named && su.named.skin) p.named.skin = su.named.skin; else delete p.named.skin;
    } else {
      const w = corrected(st, 'skin');
      if (!w) return p;
      p.samples.skin = su.mode === 'same' ? w : tanned(w);
      p.manual.skin = true;          // already a true colour; nothing to correct
      delete p.named.skin;
      // Temperature confidence follows the winter reading it was derived from.
      p.tanFrom = { manual: !!(st.manual && st.manual.skin), white: st.samples.white, estimate: su.mode !== 'same' };
    }
    return p;
  }

  /* How much each feature counts. Working values (B), not measurements.
     edge:  weight of the hair-or-brow edge in the contrast reading. Hair frames the face, so it
            counts in full; brows alone are a thin line, so the same lightness step counts for less.
     area:  rough share of the head that the hair colour covers, used for depth. */
  const HAIR = {
    none: { label: 'no hair', edge: 0.8, area: 0.08, feature: 'brows' },
    short: { label: 'short hair', edge: 1, area: 0.45, feature: 'hair' },
    long: { label: 'long hair', edge: 1, area: 0.85, feature: 'hair' }
  };
  const EYE_AREA = 0.08;
  /* The iris is the smallest feature of the face. At talking distance it spans well under a degree
     of visual angle, so its edge with the skin lies at higher spatial frequencies than the hairline's,
     where the eye's contrast sensitivity falls (Campbell and Robson 1968): the same lightness step
     counts for less there (A for the mechanism). How much less is a working value (B). Counting the
     iris step in full made white hair over dark eyes read as high contrast, which it does not look. */

  const EYE_EDGE = 0.6;
  /* The white of the eye is not sampled; a typical in-photo lightness is assumed. It only matters
     for deeper skin, where it is the strongest light-dark step in the face. */
  const SCLERA_L = 80, SMALL_FEATURE = EYE_EDGE;   // the whites of the eyes are as small as the iris, so they count alike

  function hairStyleOf(profile) { return HAIR[profile.hairStyle] ? profile.hairStyle : 'short'; }

  /* Grey hair. A head of greying hair is pigmented strands and white strands side by side, far
     too fine to resolve at talking distance, so the eye sees one blended colour (A). How light
     that blend is, is less certain (B): flat patches would average in linear light, but hair is
     a translucent mass in which dark strands shadow the white ones, and plain averaging makes a
     quarter-grey head look far lighter than it does. Valet blends in CIELAB, which falls between
     the two. The sampled or named colour is the pigmented hair; grey is the share of white
     strands, 0 to 100. */
  function greyOf(profile) { return clamp(+profile.grey || 0, 0, 100); }
  function mixLab(hexA, hexB, t) {
    const a = VC.hexToLab(hexA), b = VC.hexToLab(hexB);
    return VC.labToHex(a.map(function (v, i) { return v * (1 - t) + b[i] * t; }));
  }
  function hairShown(baseHex, grey) {
    if (!baseHex || !grey) return baseHex;
    return mixLab(baseHex, window.VDATA.features.whiteHair, grey / 100);
  }

  /* The difference between two hue angles in degrees, 0 to 180. */
  function hueDist(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  /** @returns {ValetAnalysis | null} */
  function analyseProfile(profile) {
    const grey = greyOf(profile), hairBase = corrected(profile, 'hair');
    const hex = {
      skin: corrected(profile, 'skin'),
      hair: hairShown(hairBase, grey),
      eyes: corrected(profile, 'eyes')
    };
    if (!hex.skin) return null;
    const lab = /** @type {{ [feature: string]: number[] }} */ ({});
    Object.keys(hex).forEach(function (k) { if (hex[k]) lab[k] = VC.hexToLab(hex[k]); });
    const feats = Object.keys(lab);
    const style = hairStyleOf(profile), H = HAIR[style], Ls = lab.skin[0];

    // Face contrast: the strongest weighted lightness step between the skin and a feature.
    /** @type {{ key?: string, pair: string, L: number, dL: number, w: number, assumed?: boolean, value?: number }[]} */
    const edges = [];
    if (lab.hair) edges.push({ key: 'hair', pair: 'skin – ' + H.feature, L: lab.hair[0], dL: Math.abs(Ls - lab.hair[0]), w: H.edge });
    if (lab.eyes) edges.push({ key: 'eyes', pair: 'skin – eyes', L: lab.eyes[0], dL: Math.abs(Ls - lab.eyes[0]), w: EYE_EDGE });
    edges.push({ pair: 'skin – whites of the eyes', L: SCLERA_L, dL: Math.abs(Ls - SCLERA_L), w: SMALL_FEATURE, assumed: true });
    let contrast = 0, contrastPair = '', contrastEdge = null;
    edges.forEach(function (e) { e.value = e.dL * e.w; if (e.value > contrast) { contrast = e.value; contrastPair = e.pair; contrastEdge = e; } });
    const contrastLevel = contrast < PARAMS.contrastMedium ? 'low' : contrast < PARAMS.contrastHigh ? 'medium' : 'high';

    // Depth: lightness averaged by how much of the head each colour covers.
    let wSum = 1, depth = Ls;
    if (lab.hair) { depth += lab.hair[0] * H.area; wSum += H.area; }
    if (lab.eyes) { depth += lab.eyes[0] * EYE_AREA; wSum += EYE_AREA; }
    depth /= wSum;
    const depthLevel = depth > 62 ? 'light' : depth > 45 ? 'medium' : 'deep';

    // Temperature lean from the skin's hue angle.
    const skinLch = VC.labToLch(lab.skin);
    const h = skinLch[2];
    const lean = clamp((h - PARAMS.neutralHue) / PARAMS.leanSpan, -1, 1); // -1 cool .. +1 warm
    const tempLevel = lean < -0.35 ? 'cool' : lean > 0.35 ? 'warm' : 'neutral';
    const src = profile.tanFrom || { manual: !!(profile.manual && profile.manual.skin), white: whiteFor(profile, 'skin') };
    const byHand = src.manual;
    const whiteOk = !byHand && !!(profile.useWhite && src.white) && !VC.whiteProblem(src.white);
    let confidence = whiteOk ? 'medium' : 'low';
    if (confidence === 'medium' && Math.abs(lean) > 0.8 && !(profile.tanFrom && profile.tanFrom.estimate)) confidence = 'good';

    // Chroma: how vivid the person's own colouring is. An unweighted mean on purpose: the eyes
    // are small, but they are where people look.
    const chroma = feats.reduce(function (s, k) { return s + VC.labToLch(lab[k])[1]; }, 0) / feats.length;
    const chromaLevel = chroma < 14 ? 'muted' : chroma < 24 ? 'moderate' : 'clear';

    // What the grey has changed, for the explanation on the You tab.
    let noGrey = null;
    if (grey > 0 && hairBase && !profile._noGrey) {
      const q = analyseProfile(Object.assign({}, profile, { grey: 0, _noGrey: true }));
      noGrey = { contrast: q.contrast, contrastLevel: q.contrastLevel, depth: q.depth, depthLevel: q.depthLevel, chroma: q.chroma, chromaLevel: q.chromaLevel,
        hairStep: q.lab.hair ? Math.abs(q.lab.skin[0] - q.lab.hair[0]) : 0 };
    }

    return {
      hex: hex, lab: lab, grey: grey, hairBase: hairBase, noGrey: noGrey, season: profile.season || 'winter', tanFrom: profile.tanFrom || null,
      contrast: contrast, contrastPair: contrastPair, contrastLevel: contrastLevel, edges: edges, contrastEdge: contrastEdge,
      band: [Math.max(PARAMS.bandLoMin, contrast * PARAMS.bandLoFactor), contrast * PARAMS.bandHiFactor + PARAMS.bandHiAdd],
      depth: depth, depthLevel: depthLevel,
      skinHue: h, lean: lean, tempLevel: tempLevel, confidence: confidence,
      // the skin was read from a photo with a white reference (not typed in or picked by name, not read
      // without white): only then does a clash with it fail an outfit (checkOutfit, the face rule)
      skinMeasured: confidence !== 'low',
      chroma: chroma, chromaLevel: chromaLevel,
      hairStyle: style, hairLabel: H.label,
      redness: profile.redness || 'none', underEye: profile.underEye || 'none'
    };
  }

  /* Body ratios for the profile card, placed among the survey's men (ANSUR II, body.js) in neutral
     words. The shoulder is not compared: Valet measures it along the back, the survey straight across. */
  function bodyRatios(m) {
    if (!m) return [];
    const B = window.VBODY, out = [];
    if (m.inseam && m.height) {
      const r = m.inseam / m.height, pc = B ? B.percentile('legRatio', r) : null;
      out.push({ label: 'Leg to height', value: round(r, 3), note: pc != null ? 'inside leg ' + B.words(pc) + ' for the height (percentile ' + pc + ')' : '' });
    }
    if (m.chest && m.waist) {
      const d = m.chest - m.waist, pc = B ? B.percentile('drop', d) : null;
      out.push({ label: 'Chest–waist drop', value: d + ' cm', note: pc != null ? B.words(pc) + ' (percentile ' + pc + ')' : '' });
    }
    if (m.backNeckFloor && m.height) out.push({ label: 'Jacket length guide', value: round(m.backNeckFloor / 2, 1) + ' cm', note: 'half of back-neck to floor' });
    return out;
  }

  /* The named thresholds and the table of rules are in js/rules.js (window.VRULES). */
  const R = window.VRULES, PARAMS = R.PARAMS, RULES = R.RULES, SECTIONS = R.SECTIONS, sectionOf = R.sectionOf, ruleOf = R.ruleOf, checkRules = R.checkRules;

  /* ---------- Colour scoring near the face ---------- */

  function falloff(x, lo, hi, soft) {
    if (x >= lo && x <= hi) return 1;
    const d = x < lo ? lo - x : x - hi;
    return clamp(1 - d / soft, 0, 1);
  }

  function scoreColour(hex, p) {
    const lab = VC.hexToLab(hex);
    const lch = VC.labToLch(lab);
    const ok = VC.rgbToOklch(VC.hexToRgb(hex));
    const C = lch[1];
    const neutral = ok[1] < 0.04;
    const rules = [];

    // 1. Contrast matching (A/B)
    //    Definition (lower bound) can come from lightness or hue, so it uses the overall
    //    colour difference; heaviness (upper bound) is a matter of lightness alone.
    const dL = Math.abs(lab[0] - p.lab.skin[0]);
    const dE = VC.deltaE2000(lab, p.lab.skin);
    const sep = Math.max(dL, dE * 1.2);
    const lo = Math.max(8, p.contrast * 0.5);
    const hi = p.contrast * PARAMS.bandHiFactor + PARAMS.bandHiAdd;
    const sContrast = sep < lo ? falloff(sep, lo, 999, 20) : falloff(dL, 0, hi, 20);
    rules.push({
      id: 'contrast', level: 'A/B', score: sContrast,
      text: sContrast >= 0.99
        ? 'Separation from your skin (' + round(sep) + ') and lightness step (' + round(dL) + ') sit inside your face-contrast band (' + round(lo) + '–' + round(hi) + ').'
        : sep < lo
          ? 'Too little separation from your skin (' + round(sep) + ' vs at least ' + round(lo) + '): little definition at the face.'
          : 'Heavier contrast against your skin (' + round(dL) + ') than your own colouring carries (up to ' + round(hi) + '): the clothes can dominate the face.'
    });

    // 2. Merging (A)
    let sMerge = dE < PARAMS.mergeFrom ? 0 : dE < PARAMS.mergeTo ? (dE - PARAMS.mergeFrom) / (PARAMS.mergeTo - PARAMS.mergeFrom) : 1;
    // A white or near-white lighter than the skin is the exception (B): CIEDE2000 weighs lightness
    // differences less near white, so white comes out "close" to fair skin, yet a white collar is the
    // classic frame of the face [Flusser p. 123]. Its weak separation is a note, never a failing.
    const whiteish = ok[1] < PARAMS.whiteC && lab[0] >= p.lab.skin[0] + PARAMS.whiteAboveL;
    if (whiteish) sMerge = Math.max(sMerge, PARAMS.whiteMergeFloor);
    if (sMerge < 1) {
      rules.push({
        id: 'merge', level: 'A/B', score: sMerge,   // the distance is measured (A); 10 and 20 are where Valet draws the line (B)
        text: whiteish
          ? 'Close to your skin tone by the formula (ΔE2000 ' + round(dE, 1) + '), but a white lighter than the skin still frames the face; best as the light half of a step under a darker layer.'
          : 'Close to your skin tone overall (ΔE2000 ' + round(dE, 1) + '): the face tends to blend into the garment.'
      });
    }

    // 3. Temperature (B)
    const tColour = neutral ? VC.hueTemperature(lch[2]) * Math.min(1, C / 25) * 0.6
      : VC.hueTemperature(lch[2]) * Math.min(1, C / 25);
    let sTemp;
    if (p.tempLevel === 'neutral') sTemp = 1 - Math.abs(tColour) * 0.25;
    else sTemp = 1 - Math.max(0, -tColour * p.lean);
    sTemp = clamp(sTemp, 0, 1);
    const tWord = tColour > 0.3 ? 'warm' : tColour < -0.3 ? 'cool' : 'temperature-neutral';
    rules.push({
      id: 'temp', level: 'B', score: sTemp,
      text: sTemp >= 0.85
        ? 'A ' + tWord + ' colour that agrees with your ' + p.tempLevel + ' colouring.'
        : 'A ' + tWord + ' colour against your ' + p.tempLevel + ' colouring: the temperatures pull against each other at the face.' +
          (p.confidence === 'low' ? ' Your temperature reading is low confidence, so check this one in daylight.' : '')
    });

    // 4. Chroma (B)
    const excess = C - (p.chroma + PARAMS.chromaExcess);
    const sChroma = excess > 0 ? clamp(1 - excess / 40, 0, 1) : 1;
    rules.push({
      id: 'chroma', level: 'B', score: sChroma,
      text: sChroma >= 0.99
        ? 'Saturation (C* ' + round(C) + ') within what your colouring carries.'
        : 'More saturated (C* ' + round(C) + ') than your colouring (C* ' + round(p.chroma) + '): the colour arrives before you do.'
    });

    // 5. Simultaneous contrast (A) — induced shift of the skin's appearance
    let simPenalty = 0;
    if (!neutral || C > 8) {
      const k = 0.1;
      const da = -k * lab[1], db = -k * lab[2];
      const skin = p.lab.skin;
      if (da > 2 && skin[1] > 14 && !(p.redness && p.redness !== 'none')) {   // with redness set, the redness rule below judges this push
        simPenalty += 0.1;
        rules.push({ id: 'sim', level: 'A/B', score: 0.6,
          text: 'Simultaneous contrast: this green/cyan side pushes your skin toward red, so ruddiness reads stronger.' });
      } else if (db < -2.5 && skin[0] > 62) {
        simPenalty += 0.08;
        rules.push({ id: 'sim', level: 'A/B', score: 0.6,
          text: 'Simultaneous contrast: a yellow/orange neighbour pushes fair skin toward blue-grey, which can look washed out.' });
      } else if (da < -2 && skin[1] < 10) {
        simPenalty += 0.08;
        rules.push({ id: 'sim', level: 'A/B', score: 0.6,
          text: 'Simultaneous contrast: a red neighbour pulls colour out of low-pink skin, which can read sallow.' });
      } else if (db > 2.5 && skin[2] > 20) {
        simPenalty += 0.06;
        rules.push({ id: 'sim', level: 'A/B', score: 0.7,
          text: 'Simultaneous contrast: a blue/violet neighbour pushes already-yellow skin further toward yellow.' });
      } else if (db > 2.5) {
        rules.push({ id: 'sim', level: 'A/B', score: 1,
          text: 'Simultaneous contrast: a blue/violet neighbour adds a little warmth to your skin, a flattering push.' });
      }
    }

    // Redness (rosacea, a ruddy or flushing skin), B with an A mechanism. Two effects at the face:
    // a red or pink beside the skin is echoed by the red in it and picks it out, and green, the
    // complement of red, pushes the skin toward red by simultaneous contrast (Chevreul; the same
    // rule colour analysts give as "avoid the complement of what you want to play down"). Both
    // grow with the garment's saturation; a dark colour reflects less light onto the face.
    if (p.redness && p.redness !== 'none') {
      const ok = VC.rgbToOklch(VC.hexToRgb(hex)), oh = ok[2], oC = ok[1], oL = ok[0];
      const amt = p.redness === 'marked' ? 1 : 0.5;
      const redHue = hueDist(oh, 15) <= 35, greenHue = hueDist(oh, 160) <= 40;
      if (redHue && oC > 0.03) {
        const pen = amt * Math.min(1, (oC - 0.03) / 0.08) * (oL > 0.45 ? 0.2 : 0.1);
        simPenalty += pen;
        rules.push({ id: 'red', level: 'A/B', score: clamp(1 - pen * 4, 0.4, 1),
          text: 'Redness: a red or pink beside the face is echoed by the red in your skin and picks it out' + (oL > 0.45 ? '.' : '; dark as this is, the effect is mild.') });
      } else if (greenHue && oC > 0.03) {
        const pen = amt * Math.min(1, (oC - 0.03) / 0.08) * (oL > 0.45 ? 0.12 : 0.07);
        simPenalty += pen;
        rules.push({ id: 'red', level: 'A/B', score: clamp(1 - pen * 4, 0.5, 1),
          text: 'Redness: green is the complement of red, so beside the face it makes the skin look redder (simultaneous contrast).' + (oC < 0.07 || oL < 0.42 ? ' Muted and dark as this is, the push is small.' : '') });
      } else if (oC > 0.04 && hueDist(oh, 250) <= 50) {
        rules.push({ id: 'red', level: 'A/B', score: 1, text: 'Redness: a blue neither echoes the red in your skin nor pushes it; the calm choice for a ruddy skin.' });
      }
    }

    const CW = PARAMS.colourWeights;
    const score = clamp(CW.contrast * sContrast + CW.merge * sMerge + CW.temp * sTemp + CW.chroma * sChroma - simPenalty, 0, 1);
    // Weakest rule: a colour is only as good at the face as its worst failing. Redness counts here
    // too, as it is a fact of the skin the person has told us: a strong red or green beside a
    // marked redness cannot be a face colour however well it does otherwise. (The general
    // simultaneous-contrast notes stay in the score only: they are small pushes, not failings.)
    const sRed = rules.filter(function (r) { return r.id === 'red'; }).reduce(function (m, r) { return Math.min(m, r.score); }, 1);
    const weakest = Math.min(sContrast, sMerge, sTemp, sChroma, sRed);

    const tierOf = function (sc, wk) {
      if (sc >= PARAMS.tier1Score && wk >= PARAMS.tier1Floor) return 1;
      if (sc >= PARAMS.tier2Score && wk >= PARAMS.tier2Floor) return 2;
      // Tier 4 is "too vivid or too much against your colouring": the chroma rule or the heavy side of
      // the contrast rule says so. Any other colour that fails at the face is useful below the belt.
      if (sChroma < 0.99 || (sContrast < 0.7 && sep >= lo)) return 4;
      return 3;
    };
    const tier = tierOf(score, weakest);
    // Temperature alone keeps the colour from the face when, with temperature counted as met, it would be
    // tier 1 or 2, and temperature is also its weakest rule (a colour that is weaker on another rule is not
    // a clash of temperature alone, even if temperature tips it). A low-confidence temperature reading
    // makes such a clash a note (checkOutfit).
    const othersMin = Math.min(sContrast, sMerge, sChroma, sRed);
    const tierNoTemp = sTemp >= 1 ? tier : tierOf(clamp(score + CW.temp * (1 - sTemp), 0, 1), othersMin);

    return {
      hex: hex, lab: lab, lch: lch, oklch: ok, neutral: neutral,
      temperature: tColour, score: score, tier: tier, tempOnly: tier > 2 && tierNoTemp <= 2 && sTemp <= othersMin, rules: rules
    };
  }

  const TIER_TEXT = {
    1: { title: 'Tier 1 — anywhere', note: 'Safe at the face; the base of the wardrobe.' },
    2: { title: 'Tier 2 — deliberate colour', note: 'Works at the face as the one chosen colour of an outfit.' },
    3: { title: 'Tier 3 — below the belt', note: 'Weak at the face but useful away from it: trousers, shoes, belts.' },
    4: { title: 'Tier 4 — never at the face', note: 'Too vivid or too much against your colouring near the face; small accents at most.' }
  };

  /* ---------- The outfit as a whole: verification, suggestions, completion ----------
     An outfit has one entry per position in garments.js (hat, shirt, tie, mid, jacket, square,
     trousers, socks, shoes); each piece is { hex, name, pat, kind }, and an optional position
     that is not worn is null. All rules here are convention (B) unless badged otherwise; each
     check names the slots it is about. */

  /* Positions and garment types come from garments.js: a position is where a piece sits (next
     to the neck, neckwear, mid layer, outer layer, trousers, shoes); the type says what it is
     (a shirt or a roll neck, a jacket or a coat) and carries what the rules need. Only the two
     mandatory positions must be filled, so a summer outfit can be a shirt and trousers. */
  const G = window.VGARM;
  const SLOTS = G.SLOTS;
  const FACE = G.FACE;
  const SCALE_TEXT = { small: 'small scale (a repeat under 3 cm)', medium: 'up to medium scale (9 cm)', large: 'up to coat scale (15 cm)' };
  const P = function () { return window.VPAT; };

  function scoreCached(hex, p) {
    if (!p._sc) Object.defineProperty(p, '_sc', { value: {}, enumerable: false });
    return p._sc[hex] || (p._sc[hex] = scoreColour(hex, p));
  }
  function okc(hex) { return VC.rgbToOklch(VC.hexToRgb(hex)); }
  function isNeutral(hex) { return okc(hex)[1] < 0.06; }
  /* A wardrobe neutral in the menswear sense: the library's Neutral family (navy, greys, black,
     white, the creams and browns) or anything nearly grey. Forest or bottle green can be as muted
     as navy and still count as a colour: the Style Guide lists them as Tier 2 colour. */
  function wardrobeNeutral(hex) {
    const h = hex.toLowerCase(), lib = window.VDATA.colours;
    let hit = lib.find(function (c) { return c.hex.toLowerCase() === h; });
    // the nearest library colour within neutralSnapDE is that colour: a picker nudged a step, or a colour
    // sampled from a photo that has drifted a little, keeps its name (and whether it is a neutral)
    if (!hit) {
      const lab = VC.hexToLab(hex); let d = PARAMS.neutralSnapDE;
      lib.forEach(function (c) { const e = VC.deltaE2000(lab, VC.hexToLab(c.hex)); if (e < d) { d = e; hit = c; } });
    }
    if (hit) return hit.family === 'Neutral';
    const c = okc(hex);
    return c[1] < 0.035 || (c[0] < 0.4 && c[1] < 0.1 && hueDist(c[2], 262) < 22);   // nearly grey, or navy
  }

  /* What a piece looks like: its colours, the colour it adds up to, and whether its pattern
     reads as pattern or as texture. */
  /** @param {ValetPiece} piece @returns {ValetLook} */
  function look(piece) {
    const pat = P() ? P().norm(piece.pat) : { type: 'solid' };
    const out = { hex: piece.hex, name: piece.name || piece.hex, pat: pat, mean: piece.hex, colours: [piece.hex], visible: false, texture: false };
    // A two-tone shoe (spectator): toe cap, heel and lace panel in a second colour, about 40% of what
    // shows. Read from a distance as the mix of the two, and never as a pattern.
    if (piece.hex2 && piece.kind === 'spectator') {
      const a = VC.hexToLab(piece.hex), b = VC.hexToLab(piece.hex2);
      out.mean = VC.labToHex([a[0] * 0.6 + b[0] * 0.4, a[1] * 0.6 + b[1] * 0.4, a[2] * 0.6 + b[2] * 0.4]);
      out.colours = [piece.hex, piece.hex2]; out.twoTone = true;
      return out;
    }
    if (pat.type === 'solid') return out;
    const t = P().byId[pat.type], cls = P().scaleClass(pat.scale);
    const dE = VC.deltaE2000(VC.hexToLab(piece.hex), VC.hexToLab(pat.hex2));
    out.mean = P().mean(piece.hex, pat); out.colours = [piece.hex, pat.hex2];
    out.cls = cls; out.typeName = t.name; out.family = t.family;
    out.dL = Math.abs(VC.hexToLab(piece.hex)[0] - VC.hexToLab(pat.hex2)[0]);
    // What it reads as across a room (3 m, the distance the Style Guide judges at), from the
    // visibility model in patterns.js (A, with B words). There is no separate rule for tonal
    // patterns: a low-contrast pattern counts as texture exactly when the model says the eye
    // cannot read it at 3 m, and as a pattern when it can.
    out.reads = { 1: P().reads(piece.hex, pat, 1), 3: P().reads(piece.hex, pat, 3) };
    out.texture = out.reads[3].state !== 'pattern';   // the measured model decides; a low-contrast (tonal) pattern is texture when the eye cannot read it
    out.visible = !out.texture;
    if (out.visible && cls.id === 'semi') out.cls = { id: 'small', label: 'small', hand: cls.hand };
    out.label = t.name + ', ' + (Math.round(pat.scale * 10) / 10) + ' cm';
    return out;
  }

  /* What the eye sees of a piece at the face (Flusser, Dressing the Man, pp. 21-24; How it works,
     section 11). A pattern that reads as a pattern at 3 m is resolved into its colours, so it is
     judged by them: each colour that covers a fair share of the cloth (PARAMS.patternMajor). A plain
     piece, a two-tone shoe, or a pattern that reads only as texture is seen as the one colour it adds
     up to. x: a piece as look() returns it. */
  function seenColours(x) {
    if (!x) return [];
    if (!x.visible || x.twoTone || !x.pat || x.pat.type === 'solid') return [x.mean];
    const c = P().coverOf(x.pat), out = [];
    if (1 - c >= PARAMS.patternMajor) out.push(x.hex);
    if (c >= PARAMS.patternMajor) out.push(x.pat.hex2);
    return out.length ? out : [x.mean];
  }
  /* Of those colours, the one that sits best at the face: the lowest tier, then the highest score. */
  function bestAtFace(x, p) {
    return seenColours(x).map(function (h) { return { hex: h, s: scoreCached(h, p) }; })
      .sort(function (a, b) { return a.s.tier - b.s.tier || b.s.score - a.s.score; })[0];
  }

  /* The layer the shirt is judged against for the light-dark step at the face: the first worn of a
     scarf, a knit or waistcoat, the jacket, a coat worn straight over the shirt, a tie; a scarf is
     narrow, so when the layer beside it makes the stronger step over the shirt, that one counts.
     has(k): whether the piece is worn; light(k): its lightness L*. Used by checkOutfit and the chart. */
  function stepOver(has, light) {
    let over = ['scarf', 'mid', 'jacket', 'coat', 'tie'].find(has);
    if (over === 'scarf' && has('shirt')) {
      const next = ['mid', 'jacket', 'coat'].find(has);
      if (next && Math.abs(light('shirt') - light(next)) > Math.abs(light('shirt') - light('scarf'))) over = next;
    }
    return over || null;
  }

  /* The checks, in the order they run and are listed. Each name is a file in js/checks/ that calls
     part(name, fn) when it loads; index.html loads them after this file, and tests/load.js does the
     same for the tests. A missing file stops checkOutfit with its name rather than silently skipping. */
  const ORDER = ['skin', 'contrast', 'frame', 'colours', 'feet', 'square', 'accents', 'pattern', 'hat', 'whole', 'collar', 'lines', 'accessories'];
  const PARTS = {};
  /** @param {string} name @param {(ctx: ValetCtx) => void} fn */
  function part(name, fn) {
    if (ORDER.indexOf(name) < 0) throw new Error('Valet: unknown check part ' + name);
    PARTS[name] = fn;
  }

  /** @param {{ [slot: string]: any }} o the outfit (engineOutfit) @param {ValetAnalysis} p @returns {ValetCheck[]} */
  function checkOutfit(o, p) {
    const L = {}, worn = SLOTS.filter(function (k) { return o[k]; });
    worn.forEach(function (k) { L[k] = look(o[k]); });
    // A contrast (Winchester) collar: the collar is another colour from the body, almost always white.
    // It is what sits against the neck, so the light-dark step at the face is read from it; the body
    // still shows in the V of the jacket, so the skin is checked against both (section 10).
    const collarHex = L.shirt ? G.contrastCollar('shirt', o.shirt) : null;
    const LC = collarHex ? look({ hex: collarHex, name: o.shirt.collarName || collarHex.toUpperCase(), pat: { type: 'solid' } }) : null;
    const face = FACE.filter(function (k) { return L[k]; });
    // the face layers, the pocket square and a buttonhole flower; a lapel pin is metal, judged with the metals
    const near = G.NEAR.filter(function (k) { return L[k] && !(k === 'boutonniere' && o[k].kind === 'pin'); });
    const out = [];
    const add = /** @param {ValetCheck} c */ function (c) { c.group = c.group || 'colour'; c.level = c.level || 'B'; out.push(c); return c; };
    // Every position has a type, worn or not, so a rule can ask what is (or would be) there.
    // Pieces may be missing: the palette's study checks two or three colours on their own.
    const K = {}; SLOTS.forEach(function (k) { K[k] = G.kind(k, o[k]); });
    const nm = function (k) { return L[k].name + ' ' + K[k].name.toLowerCase(); };
    const lum = function (hex) { return VC.hexToLab(hex)[0]; };
    const lo = p.band[0], hi = p.band[1];      // the face's contrast band (section 4), the same as for a colour against the skin

    // The checks themselves are in js/checks/, one classic script per question of the card (or per
    // group of rules); each registered itself with part(). They run here in ORDER, each adding its
    // findings to out, so the order of the findings is the order of ORDER.
    const ctx = { o: o, p: p, L: L, K: K, LC: LC, collarHex: collarHex, face: face, near: near, out: out, add: add, nm: nm, lum: lum, lo: lo, hi: hi, worn: worn };
    ORDER.forEach(function (n) {
      if (!PARTS[n]) throw new Error('Valet: js/checks/' + n + '.js is not loaded');
      PARTS[n](ctx);
    });
    return checkRules(out);
  }

  /* One cloth's pattern on two pieces: the same type, at the same repeat. */
  function colourName(hex) {
    const lab = VC.hexToLab(hex); let best = /** @type {any} */ (null), d = 1e9;
    window.VDATA.colours.forEach(function (c) { const e = VC.deltaE2000(lab, VC.hexToLab(c.hex)); if (e < d) { d = e; best = c; } });
    return best ? best.name.toLowerCase() : 'colour';
  }
  function samePattern(pj, pt) { return pj.type === pt.type && (pj.type === 'solid' || Math.abs(pj.scale - pt.scale) < 0.3); }
  function suitWorn(o, L, K, C) {
    return !!(L.jacket && L.trousers && K.jacket.suit && C.jacket && C.trousers && C.jacket.id === C.trousers.id &&
      samePattern(L.jacket.pat, L.trousers.pat) && VC.deltaE2000(VC.hexToLab(L.jacket.mean), VC.hexToLab(L.trousers.mean)) < 1.5);
  }

  /* The Outfit Check card's order: six questions, then the feet, then what this tool adds. Each
     check belongs to one section by its id. */
  /* ---------- Clashes with your skin ----------
     The colour rules already say why a colour is weak at the face; these turn the weakest one or
     two into a short reason, and list every piece near the face that clashes. Shared by the
     Dresser's warning and the chart, so both name the same pieces for the same reasons. */
  function skinReasons(hex, p) {
    const s = scoreCached(hex, p);
    const failing = s.rules.filter(function (r) { return r.score < 0.7; }).sort(function (x, y) { return x.score - y.score; });
    const list = failing.length ? failing : s.rules.slice().sort(function (x, y) { return x.score - y.score; }).slice(0, 1);
    const out = [];
    list.forEach(function (r) {
      let t;
      if (r.id === 'temp') t = (s.temperature > 0 ? 'too warm' : 'too cool') + ' for your ' + (p.tempLevel === 'neutral' ? '' : p.tempLevel + ' ') + 'colouring';
      else if (r.id === 'merge') t = 'too close to your skin colour, so the face blends into it';
      else if (r.id === 'contrast') t = /^Too little/.test(r.text) ? 'too little light-dark separation from your skin' : 'heavier than the contrast your face carries';
      else if (r.id === 'chroma') t = 'more vivid than your own colouring';
      else if (r.id === 'sim') t = 'shifts how your skin looks beside it (Chevreul)';
      else if (r.id === 'red') t = 'brings out redness in your skin';
      else if (r.id === 'glasses') t = 'a second warm or cool note beside your frames';
      else t = r.text.replace(/\.$/, '').toLowerCase();
      if (out.indexOf(t) < 0) out.push(t);
    });
    return out.slice(0, 2);
  }
  function skinClashes(o, p) {
    const out = [];
    if (!p) return out;
    G.NEAR.forEach(function (k) {
      if (!o[k] || (k === 'boutonniere' && o[k].kind === 'pin')) return;     // a lapel pin is judged as metal
      const L = look(o[k]), t = scoreCached(L.mean, p).tier;
      if (t <= 2) return;
      out.push({ slot: k, name: L.name, piece: G.kind(k, o[k]).name.toLowerCase(), tier: t, hex: L.mean,
        reasons: skinReasons(L.mean, p), patterned: L.pat.type !== 'solid', soft: G.FACE.indexOf(k) < 0 });
    });
    // a contrast collar sits against the neck: a colour at the face of its own
    const ch = o.shirt ? G.contrastCollar('shirt', o.shirt) : null, ct = ch ? scoreCached(ch, p).tier : 0;
    if (ct > 2) out.push({ slot: 'shirt', name: o.shirt.collarName || ch.toUpperCase(), piece: 'shirt collar', tier: ct, hex: ch, reasons: skinReasons(ch, p), patterned: false, soft: false });
    return out;
  }

  /* ---------- Glasses: the frame's weight against the face (A/B) ----------
     Section 4's rule applied to the one dark line that is always at the face. A thick acetate
     frame is a solid light-dark edge across the face; its lightness step against the skin is
     compared with the upper bound of the face's own contrast band (contrast × 1.5 + 15), the same
     bound that judges a jacket or tie. Above it, the frame is the strongest edge at the face and
     is seen before the face (A: the step is measured; B: where it becomes too much is the
     convention of section 4). Metal frames are thin lines and clear frames show the skin through
     them, so only acetate is judged. Frame lightness by material is Valet's working value. */
  /* The frame's own temperature: gold warm, silver cool; an acetate frame by its hue, scaled down
     for low chroma as any colour is (section 7), so black and grey frames are neutral. */
  /* The glasses worn with an outfit (o.acc.glasses), or null. */
  function framesOf(o) {
    const g = o && o.acc && o.acc.glasses;
    if (!g || !g.on) return null;
    const frame = ['gold', 'silver', 'acetate', 'clear'].indexOf(g.frame) >= 0 ? g.frame : 'gold';
    return { frame: frame, hex: frame === 'acetate' ? (/^#[0-9a-f]{6}$/i.test(g.hex || '') ? g.hex : '#161616') : null };
  }
  function frameTemp(g) {
    if (!g) return null;
    if (g.frame === 'gold') return 'warm';
    if (g.frame === 'silver') return 'cool';
    if (g.frame !== 'acetate' || !g.hex) return null;
    const lch = VC.labToLch(VC.hexToLab(g.hex)), t = VC.hueTemperature(lch[2]) * Math.min(1, lch[1] / 25);
    return t > 0.35 ? 'warm' : t < -0.35 ? 'cool' : null;
  }
  function frameWeight(p, g) {
    if (!p || !g || g.frame !== 'acetate' || !g.hex || !p.lab || !p.lab.skin) return null;
    const fL = VC.hexToLab(g.hex)[0];
    const step = Math.abs(p.lab.skin[0] - fL), hi = p.contrast * PARAMS.bandHiFactor + PARAMS.bandHiAdd;
    const name = 'acetate';
    if (step <= hi) return { score: 1, step: step, hi: hi,
      text: 'Glasses: your acetate frame against your skin (lightness step ' + round(step) + ') is within the contrast your face carries (up to ' + round(hi) + '), so it reads as part of the face.' };
    const lighter = fL < p.lab.skin[0] ? 'A lighter frame (honey tortoiseshell, grey or clear) or a thin metal one' : 'A darker frame or a thin metal one';
    return { score: 0.75, step: step, hi: hi,
      text: 'Glasses: your ' + name + ' frame against your skin (lightness step ' + round(step) + ') is stronger than the contrast your face carries (up to ' + round(hi) + '), so it is seen before the face. ' + lighter + ' would sit with the face rather than over it.' };
  }

  function watchRange(wrist) {
    if (!wrist) return [36, 40];
    const r = PARAMS.watchByWrist.find(function (w) { return wrist < w[0]; }); return [r[1], r[2]];
  }

  /* One number for comparing outfits: the sum of shortfalls, weighted. */
  function kindOf(c) { return (RULES[c.id] && RULES[c.id].kind) || 'convention'; }
  function penalty(checks) { return checks.reduce(function (s, c) { return kindOf(c) === 'context' ? s : s + (1 - c.score) * ((RULES[c.id] && RULES[c.id].weight) || 1); }, 0); }

  function verdict(checks) {
    checks = checks.filter(function (c) { return kindOf(c) !== 'context'; });   // advice about you, not about the outfit
    const fails = checks.filter(function (c) { return c.score < 0.5; }).length, warns = checks.filter(function (c) { return c.score >= 0.5 && c.score < 0.85; }).length;
    const impossible = checks.filter(function (c) { return c.score < 0.5 && kindOf(c) === 'possibility'; });
    // the first sentence of each (no lookbehind: Safari before 16.4 cannot parse one)
    const first = function (t) { const m = String(t).match(/^.*?\.(?=\s|$)/); return m ? m[0] : String(t); };
    if (impossible.length) return { level: 'bad', title: 'Not possible as set', impossible: impossible.length,
      text: impossible.map(function (c) { return first(c.text); }).join(' ') + ' Mend this first; the outfit is judged once it can be worn.', fails: fails, warns: warns };
    const what = checks.filter(function (c) { return c.score < 0.5; }).map(function (c) { return (RULES[c.id] && RULES[c.id].name) || c.id; })
      .filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    if (fails >= 2) return { level: 'bad', title: 'Start again', text: 'Fails on ' + what.join(', ') + '. Fix the first one below; the others often follow.', fails: fails, warns: warns };
    if (fails === 1) return { level: 'fix', title: 'One fix away', text: 'Fails on ' + what[0] + '. Apply its fix and this is a good outfit.', fails: fails, warns: warns };
    if (warns) return { level: 'ok', title: 'Works', text: warns + ' thing' + (warns > 1 ? 's' : '') + ' to be aware of, nothing that fails.', fails: 0, warns: warns };
    return { level: 'good', title: 'Good outfit', text: 'Every rule passes.', fails: 0, warns: 0 };
  }

  /* How well a colour suits a slot on its own, before the outfit is considered. */
  /* Usual roles of each slot (B): light shirts, darker ties and jackets, neutral trousers, shoes in
     leather colours. These only break ties between outfits that pass the same rules. */

  /* Suggestions, Choose the best colours, Keep this and the theme palettes are in js/suggest.js,
     which adds them to window.VENGINE. */

  /* A profile summary: the palette at a glance and the daylight tests that would firm it up. */
  function summary(p) {
    const all = window.VDATA.colours.map(function (c) { return Object.assign({ name: c.name }, scoreCached(c.hex, p)); });
    const spread = function (list, n) {
      const out = [];
      list.forEach(function (c) { if (out.length < n && out.every(function (q) { return VC.deltaE2000(q.lab, c.lab) > 12; })) out.push(c); });
      return out;
    };
    const byScore = function (a, b) { return b.score - a.score; };
    const neutrals = spread(all.filter(function (c) { return c.tier === 1 && wardrobeNeutral(c.hex); }).sort(byScore), 6);
    const colours = spread(all.filter(function (c) { return c.tier === 1 && !wardrobeNeutral(c.hex); }).sort(byScore), 8);
    const deliberate = spread(all.filter(function (c) { return c.tier === 2; }).sort(byScore), 6);
    const below = spread(all.filter(function (c) { return c.tier === 3; }).sort(byScore), 5);
    const tests = [];
    if (p.confidence !== 'good') tests.push({ title: 'Temperature: navy against camel', pair: ['#1d2a44', '#c19a6b'],
      text: 'Hold both at the jaw by a window. If navy looks clean and camel faintly muddy, the cool reading holds. Your temperature confidence is ' + p.confidence + '.' });
    if (p.chromaLevel !== 'clear' || p.chroma > 20) tests.push({ title: 'Clear or soft: cobalt against slate', pair: ['#2a52be', '#5a6f8c'],
      text: 'If cobalt makes the skin clearer and the eyes brighter, you carry clear colour. If it wears you and slate looks calm, lean soft. Your chroma reads ' + p.chromaLevel + ' (C* ' + round(p.chroma) + ').' });
    if (Math.abs(p.contrast - 25) < 6 || Math.abs(p.contrast - 45) < 6) tests.push({ title: 'Contrast: optic white against écru', pair: ['#f7f6f2', '#ece4d2'],
      text: 'Your contrast (' + round(p.contrast) + ') sits near a boundary. If white sharpens the face, you are at the higher end; if it looks harsh and écru looks right, the lower.' });
    if (p.hairStyle === 'none') tests.push({ title: 'Brows', pair: [p.hex.hair || '#5a4636', p.hex.skin],
      text: 'With no hair the brows set your contrast. Sample them in daylight; a groomed, defined brow reads darker than a sparse one.' });
    if (p.underEye === 'deep') tests.push({ title: 'If you wear glasses: the bottom rim', pair: ['#1b1b1e', p.hex.skin],
      text: 'With deep-set eyes the frames are the one thing at the height of the shadow. In a mirror by a window, check that the bottom rim does not sit on the shadow and double it; a browline or a frame with its weight at the top avoids that.' });
    if (p.redness !== 'none') tests.push({ title: 'Redness: navy against bottle green', pair: ['#1d2a44', '#1f4d3a'],
      text: 'Hold both at the jaw in daylight. Navy should leave the skin calm; if the green makes the cheeks look redder, keep greens below the collar or in dark, muted versions.' });
    return { neutrals: neutrals, colours: colours, deliberate: deliberate, below: below, tests: tests };
  }

  /* Echo (B): the menswear writers' second technique after contrast is to repeat one of your own
     colours, eyes or hair, somewhere in the outfit. For each feature, the library colours of the
     same hue, best tier first. A feature with almost no colour (grey eyes, black hair) is echoed
     by a neutral of similar depth. */
  function echoes(p) {
    const all = window.VDATA.colours.map(function (c) { return Object.assign({ name: c.name }, scoreCached(c.hex, p)); });
    const out = [];
    [['eyes', 'eyes'], ['hair', p.hairStyle === 'none' ? 'brows' : 'hair']].forEach(function (f) {
      const hex = p.hex[f[0]]; if (!hex) return;
      const o = okc(hex), lab = VC.hexToLab(hex);
      const list = all.filter(function (c) {
        if (o[1] < 0.03) return c.oklch[1] < 0.03 && Math.abs(c.lab[0] - lab[0]) < 18;
        return c.oklch[1] >= 0.03 && hueDist(c.oklch[2], o[2]) <= 28;
      }).map(function (c) { return Object.assign({ d: VC.deltaE2000(c.lab, lab) }, c); })
        .sort(function (a, b) { return Number(a.tier > 2) - Number(b.tier > 2) || a.d - b.d; }).slice(0, 2);
      list.forEach(function (c) { out.push({ name: c.name, hex: c.hex, tier: c.tier, of: f[1] }); });
    });
    return out;
  }

  window.VENGINE = {
    ORDER: ORDER, part: part,
    // the helpers the files in js/checks/ share with this one
    kit: { VC: VC, G: G, PARAMS: PARAMS, FACE: FACE, SLOTS: SLOTS, P: P, SCALE_TEXT: SCALE_TEXT, round: round, look: look, seenColours: seenColours, bestAtFace: bestAtFace, skinReasons: skinReasons, stepOver: stepOver, scoreCached: scoreCached, okc: okc, wardrobeNeutral: wardrobeNeutral, hueDist: hueDist, samePattern: samePattern, suitWorn: suitWorn, colourName: colourName, framesOf: framesOf, frameWeight: frameWeight, frameTemp: frameTemp, watchRange: watchRange, isNeutral: isNeutral },
    analyseProfile: analyseProfile, bodyRatios: bodyRatios, scoreColour: scoreColour,
    RULES: RULES, PARAMS: PARAMS, stepOver: stepOver, seenColours: seenColours, bestAtFace: bestAtFace, ruleOf: ruleOf, kindOf: kindOf, wardrobeNeutral: wardrobeNeutral, checkOutfit: checkOutfit, verdict: verdict, penalty: penalty, SECTIONS: SECTIONS, sectionOf: sectionOf, watchRange: watchRange, summary: summary, look: look, SLOTS: SLOTS, FACE: FACE, TIER_TEXT: TIER_TEXT, corrected: corrected, HAIR: HAIR,
    okc: okc, hueDist: hueDist, scoreCached: scoreCached, round: round, G: G,
    echoes: echoes, hairShown: hairShown, frameWeight: frameWeight, frameTemp: frameTemp, framesOf: framesOf, skinClashes: skinClashes, skinReasons: skinReasons, seasonProfile: seasonProfile, TAN: TAN
  };
})();
