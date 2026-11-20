/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — rules engine for the profile, the Palette tab, the Dresser and the lightness chart.
   Every rule returns a verdict plus the reason and its evidence level:
   A = perception science, B = tailoring/colour convention, C = popular system. */
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
  /* ---------- Thresholds, named ----------
     The numbers How it works states, in one place: each is a starting value, written down so it can be
     argued with (section 1). A = from measurement or a definition, B = a working value or a convention;
     the section is where How it works explains it. Change a threshold here, and the text with it. */
  const PARAMS = {
    neutralHue: 57, leanSpan: 8,                   // B §3  skin hue read as neutral, and ±8° to fully cool or warm
    contrastMedium: 25, contrastHigh: 45,          // B §3  low under 25, medium to 45, high above
    bandLoMin: 8, bandLoFactor: 0.5,               // B §4  lower bound = max(8, 0.5 × contrast)
    bandHiFactor: 1.5, bandHiAdd: 15,              // B §4  upper bound = 1.5 × contrast + 15
    mergeFrom: 10, mergeTo: 20,                    // B §5  ΔE2000 from no separation to full
    chromaExcess: 35,                              // B §7  C* above your own colouring that arrives before you
    tier1Score: 0.8, tier1Floor: 0.7,              // B §8  tier 1: score, and weakest rule
    tier2Score: 0.62, tier2Floor: 0.45,            // B §8  tier 2
    nearFrom: 1.5, nearTo: 7,                      // A/B §10  ΔE2000: a match below 1.5, a near miss up to 7
    halvesL: 12,                                   // B §9–10  L* between top and bottom, or any pair, so they do not blur
    tieL: 12,                                      // B §10  L* between tie and shirt
    tonalDE: 12,                                   // B §11  a pattern's two colours within ΔE2000 12 count as texture
    sockDeepL: 40, sockDeepC: 0.12,                // B §10  a deep sock colour: L* under 40, OKLCH chroma 0.12 at most
    columnL: 15,                                   // A/B §13  a tonal column: main pieces within 15 L*
    formalWide: 3, formalMistake: 4,               // B §10  formality steps apart: a wide mix, and a mistake
    coatSteps: 5,                                  // B §10  a coat this far below what it covers
    familyHue: 35,                                 // B §9–10  colours within 35° of hue are one family
    squareSetDE: 5,                                // B §10  a pocket square this close to the tie, same pattern: bought as a set
    patternShareDE: 10,                            // B §11  two patterns share a colour when two of their colours are this close
    shortLegsPct: 30,                              // B §13  legs shorter than most: under the 30th percentile for the height
    ankleBridgeL: 15,                              // B §13  socks within 15 L* of the trousers bridge them to the shoes
    frameTall: 185, frameShort: 170,               // B §13  height (cm) that makes a frame large or small
    frameBroad: 48, frameNarrow: 43,               // B §13  shoulder width (cm) that makes a frame large or small
    watchByWrist: [[15.5, 34, 38], [17, 36, 40], [18.5, 38, 42], [Infinity, 40, 44]],   // B §10  wrist under (cm): case range (mm)
    watchOver: 4,                                  // B §10  mm over the range: large; more than this, far over
    cufflinksMax: 18, cufflinksFar: 24,            // B §10  classic up to 18 mm; past 24 nothing makes up for it
    ringMax: 15, ringFar: 20,                      // B §10  a classic face up to 15 mm
    studMax: 5, studFar: 8                         // B §10  a stud up to the pupil's size; past 8 it competes with the eyes
  };

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

  function analyseProfile(profile) {
    const grey = greyOf(profile), hairBase = corrected(profile, 'hair');
    const hex = {
      skin: corrected(profile, 'skin'),
      hair: hairShown(hairBase, grey),
      eyes: corrected(profile, 'eyes')
    };
    if (!hex.skin) return null;
    const lab = {};
    Object.keys(hex).forEach(function (k) { if (hex[k]) lab[k] = VC.hexToLab(hex[k]); });
    const feats = Object.keys(lab);
    const style = hairStyleOf(profile), H = HAIR[style], Ls = lab.skin[0];

    // Face contrast: the strongest weighted lightness step between the skin and a feature.
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
    const sMerge = dE < PARAMS.mergeFrom ? 0 : dE < PARAMS.mergeTo ? (dE - PARAMS.mergeFrom) / (PARAMS.mergeTo - PARAMS.mergeFrom) : 1;
    if (sMerge < 1) {
      rules.push({
        id: 'merge', level: 'A/B', score: sMerge,   // the distance is measured (A); 10 and 20 are where Valet draws the line (B)
        text: 'Close to your skin tone overall (ΔE2000 ' + round(dE, 1) + '): the face tends to blend into the garment.'
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

    const score = clamp(0.3 * sContrast + 0.2 * sMerge + 0.25 * sTemp + 0.25 * sChroma - simPenalty, 0, 1);
    // Weakest rule: a colour is only as good at the face as its worst failing. Redness counts here
    // too, as it is a fact of the skin the person has told us: a strong red or green beside a
    // marked redness cannot be a face colour however well it does otherwise. (The general
    // simultaneous-contrast notes stay in the score only: they are small pushes, not failings.)
    const sRed = rules.filter(function (r) { return r.id === 'red'; }).reduce(function (m, r) { return Math.min(m, r.score); }, 1);
    const weakest = Math.min(sContrast, sMerge, sTemp, sChroma, sRed);

    let tier;
    if (score >= PARAMS.tier1Score && weakest >= PARAMS.tier1Floor) tier = 1;
    else if (score >= PARAMS.tier2Score && weakest >= PARAMS.tier2Floor) tier = 2;
    // Tier 4 is "too vivid or too much against your colouring": the chroma rule or the heavy side of
    // the contrast rule says so. Any other colour that fails at the face is useful below the belt.
    else if (sChroma < 0.99 || (sContrast < 0.7 && sep >= lo)) tier = 4;
    else tier = 3;

    return {
      hex: hex, lab: lab, lch: lch, oklch: ok, neutral: neutral,
      temperature: tColour, score: score, tier: tier, rules: rules
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
    // a colour within ΔE 3 of a library colour is that colour to the eye (a picker nudged by one step)
    if (!hit) { const lab = VC.hexToLab(hex); hit = lib.find(function (c) { return VC.deltaE2000(lab, VC.hexToLab(c.hex)) < 3; }); }
    if (hit) return hit.family === 'Neutral';
    const c = okc(hex);
    return c[1] < 0.035 || (c[0] < 0.4 && c[1] < 0.1 && hueDist(c[2], 262) < 22);   // nearly grey, or navy
  }


  /* What a piece looks like: its colours, the colour it adds up to, and whether its pattern
     reads as pattern or as texture. */
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
    // visibility model in patterns.js (A, with B words). A tonal pattern (two colours within
    // ΔE 12) also counts as texture even where it is visible: the September revision's
    // "grey-on-grey reads as texture" convention (B).
    out.reads = { 1: P().reads(piece.hex, pat, 1), 3: P().reads(piece.hex, pat, 3) };
    out.tonal = dE < PARAMS.tonalDE;
    out.texture = out.tonal || out.reads[3].state !== 'pattern';
    out.visible = !out.texture;
    if (out.visible && cls.id === 'semi') out.cls = { id: 'small', label: 'small', hand: cls.hand };
    out.label = t.name + ', ' + (Math.round(pat.scale * 10) / 10) + ' cm';
    return out;
  }

  function checkOutfit(o, p) {
    const L = {}, worn = SLOTS.filter(function (k) { return o[k]; });
    worn.forEach(function (k) { L[k] = look(o[k]); });
    const face = FACE.filter(function (k) { return L[k]; });
    // the face layers, the pocket square and a buttonhole flower; a lapel pin is metal, judged with the metals
    const near = G.NEAR.filter(function (k) { return L[k] && !(k === 'boutonniere' && o[k].kind === 'pin'); });
    const out = [];
    const add = function (c) { c.group = c.group || 'colour'; c.level = c.level || 'B'; out.push(c); return c; };
    // Every position has a type, worn or not, so a rule can ask what is (or would be) there.
    // Pieces may be missing: the palette's study checks two or three colours on their own.
    const K = {}; SLOTS.forEach(function (k) { K[k] = G.kind(k, o[k]); });
    const nm = function (k) { return L[k].name + ' ' + K[k].name.toLowerCase(); };
    const lum = function (hex) { return VC.hexToLab(hex)[0]; };
    const lo = p.band[0], hi = p.band[1];      // the face's contrast band (section 4), the same as for a colour against the skin

    /* --- colour --- */
    const weak = !near.length ? [] : near.filter(function (k) { return scoreCached(L[k].mean, p).tier > 2; });
    if (near.length) add(weak.length
      ? { id: 'face', level: 'A/B', score: weak.every(function (k) { return k === 'square' || k === 'boutonniere'; }) ? 0.6 : 0.3, n: weak.length, slots: weak, text: 'Clashes with your skin: ' + weak.map(function (k) { const r = skinReasons(L[k].mean, p); return nm(k) + ' (tier ' + scoreCached(L[k].mean, p).tier + (r.length ? ', ' + r[0] : '') + ')'; }).join(' and ') + '. Swap it, or move that colour below the belt.' }
      : { id: 'face', level: 'A/B', score: 1, slots: face, text: 'Against your skin: everything near the face is tier 1 or 2 for you.' });

    // A light-dark step at the face (Outfit Check, question 2), in proportion to the face: the layer
    // next to the neck against the one that meets it at the neck. In the order they sit there: a
    // scarf, which lies against the collar whatever is worn over the shirt; else a knit or waistcoat,
    // which is put on before the jacket; else the jacket; else a coat worn straight over the shirt;
    // else a tie. A hat, or a coat over a jacket, is further out, so it neither rescues a flat shirt
    // and jacket nor is blamed for a strong step.
    let over = ['scarf', 'mid', 'jacket', 'coat', 'tie'].find(function (k) { return L[k]; });
    // a scarf is narrow: the layer over the shirt front beside it frames the face too, so the stronger step counts
    if (over === 'scarf') {
      const next = ['mid', 'jacket', 'coat'].find(function (k) { return L[k]; });
      if (next && Math.abs(lum(L.shirt.mean) - lum(L[next].mean)) > Math.abs(lum(L.shirt.mean) - lum(L.scarf.mean))) over = next;
    }
    if (L.shirt && over) {
      const best = Math.abs(lum(L.shirt.mean) - lum(L[over].mean)), pair = ['shirt', over];
      if (best < lo) add({ id: 'step', score: 0.35, slots: [over, 'shirt'], level: 'A/B',
        text: 'Light-dark step: ' + nm('shirt') + ' and ' + nm(over) + ' are close in lightness (' + round(best) + '; your face carries at least ' + round(lo) + '). The frame goes flat: make one clearly lighter or darker.' });
      else if (p.contrastLevel === 'low' && best > hi) add({ id: 'step', score: 0.6, slots: pair, level: 'A/B',
        text: 'Light-dark step: ' + nm('shirt') + ' against ' + nm(over) + ' (' + round(best) + ') is far stronger than your own low contrast.' });
      else add({ id: 'step', score: 1, slots: pair, level: 'A/B', text: 'Light-dark step: ' + nm('shirt') + ' against ' + nm(over) + ' (' + round(best) + ') gives the face a frame.' });
    } else if (L.shirt && K.shirt.frame) {
      add({ id: 'step', score: 0.75, slots: ['shirt'],
        text: 'One layer at the face: ' + (K.shirt.frame === 'neck' ? 'the roll neck' : 'the collar of the ' + K.shirt.name.toLowerCase()) + ' is the only frame. Fine on a warm day; a jacket, a knit or a tie adds a second (rule 8).' });
    }

    // What frames the face: a collar, a roll neck, a shawl collar, lapels or a scarf. A T-shirt
    // or a crew-neck knit leaves the neck bare, so the face has no edge (Outfit Check, question 2).
    const framers = face.filter(function (k) { return K[k].frame; });
    const necked = face.filter(function (k) { return k !== 'hat'; });
    if (framers.length) add({ id: 'frame', score: 1, slots: [],
      text: 'Frame: ' + framers.map(function (k) { return nm(k) + ' (' + { collar: 'collar', neck: 'roll neck', lapel: 'lapels', shawl: 'shawl collar', scarf: 'scarf' }[K[k].frame] + ')'; }).join(', ') + (framers.length > 1 ? ' frame' : ' frames') + ' the face.' });
    if (necked.length && !framers.length) add({ id: 'frame', score: 0.6, slots: [K.mid && L.mid ? 'mid' : 'shirt'],
      text: 'Nothing frames the face: ' + face.filter(function (k) { return k !== 'hat'; }).map(nm).join(' and ') + (face.filter(function (k) { return k !== 'hat'; }).length > 1 ? ' leave' : ' leaves') + ' the neck bare. A collar, a roll neck or a jacket gives the face an edge. Fine for casual summer wear.' });
    // A V-neck is cut to show a collar (and a tie); over a collarless top the V shows bare skin or a T-shirt.
    // a waistcoat is cut for a dress shirt (and a tie); a V-neck knit for any collar, a polo's included
    if (L.mid && K.mid.needsCollarUnder && !(K.mid.vest ? K.shirt.tieable : K.shirt.collar)) add({ id: 'layer', score: 0.65, slots: ['mid'],
      text: (K.mid.vest ? 'A waistcoat is cut to show a dress shirt\'s collar (and a tie). Over a ' + K.shirt.name.toLowerCase() + ' it does not sit right; wear a shirt under it.' : 'A V-neck knit is cut to show a shirt collar. Over a ' + K.shirt.name.toLowerCase() + ' the V frames nothing; choose a crew neck, or a collared shirt under it.') });
    if (L.tie && !G.neckwearAllowed(K.tie, K.shirt)) add({ id: 'neck', score: 0.2, slots: ['tie'],
      text: 'A ' + K.tie.name.toLowerCase() + ' needs a shirt\'s collar and full button front to sit under' + (K.shirt.collar ? '; a ' + K.shirt.name.toLowerCase() + '\'s soft collar and short placket are not cut for one' : '') + '. Take it off, or wear a shirt.' });

    // One temperature above the waist.
    const temps = near.map(function (k) { return [k, scoreCached(L[k].mean, p).temperature]; }).filter(function (t) { return Math.abs(t[1]) > 0.3; });
    const warm = temps.filter(function (t) { return t[1] > 0; }), cool = temps.filter(function (t) { return t[1] < 0; });
    if (warm.length && cool.length) {
      const odd = warm.length <= cool.length ? warm : cool;
      add({ id: 'temp', score: 0.5, n: odd.length, slots: odd.map(function (t) { return t[0]; }),
        text: 'Temperature: ' + odd.map(function (t) { return nm(t[0]); }).join(' and ') + ' is ' + (odd === warm ? 'warm' : 'cool') + ' among ' + (odd === warm ? 'cool' : 'warm') + ' pieces above the waist. One temperature at a time (rule 2).' });
    }

    // How many colours, and whether they get on (section 9). Wardrobe neutrals are free.
    const chrom = [];
    worn.forEach(function (k) {
      L[k].colours.forEach(function (hex, i) {
        if (i === 1 && !L[k].visible && !L[k].twoTone) return;   // a texture's accent does not count; a spectator's second leather does
        const c = okc(hex);
        if (!wardrobeNeutral(hex) && c[1] >= 0.06) chrom.push({ k: k, hex: hex, h: c[2], C: c[1], Lk: c[0], small: k === 'tie' || k === 'shoes' || k === 'socks' || k === 'square' || k === 'boutonniere' || k === 'gloves' || i === 1 });
      });
    });
    const fam = [];
    chrom.forEach(function (c) {
      const f = fam.find(function (g) { return hueDist(g.h, c.h) <= PARAMS.familyHue; });
      if (f) f.items.push(c); else fam.push({ h: c.h, items: [c] });
    });
    if (fam.length === 2) {
      const a = fam[0], b = fam[1], d = hueDist(a.h, b.h);
      const calm = function (g) { return g.items.every(function (c) { return c.Lk < 0.45 || c.C < 0.09; }); };
      const accent = a.items.every(function (c) { return c.small; }) || b.items.every(function (c) { return c.small; });
      const names = a.items[0].k + ' and ' + b.items[0].k;
      if (Math.abs(d - 180) <= 30) add({ id: 'harmony', score: calm(a) || calm(b) ? 1 : 0.7, slots: [b.items[0].k], level: 'B',
        text: 'Colours: the ' + names + ' are complementary (about ' + Math.round(d) + '° apart). ' + (calm(a) || calm(b) ? 'One is dark or muted, which keeps it calm.' : 'Lively; it calms down if one of them is dark or muted.') });
      else if (accent) add({ id: 'harmony', score: 0.9, slots: [], text: 'Colours: two colour families, but one is a small accent (' + names + '). Accents may stand apart.' });
      else add({ id: 'harmony', score: 0.45, slots: [b.items[0].k], text: 'Colours: the ' + names + ' are ' + Math.round(d) + '° apart in hue, neither neighbours nor opposites. Two such colours compete. Make one a neutral, or move them closer.' });
    } else if (fam.length > 2) {
      const big = fam.filter(function (g) { return !g.items.every(function (c) { return c.small; }); });
      add({ id: 'harmony', score: big.length > 2 ? 0.35 : 0.6, slots: chrom.filter(function (c) { return !c.small; }).map(function (c) { return c.k; }).slice(1),
        text: 'Colours: ' + fam.length + ' colour families in one outfit. The template that never fails is two neutrals and one colour (rule 4).' });
    } else {
      add({ id: 'harmony', score: 1, slots: [], text: fam.length ? 'Colours: one colour family against neutrals, the classic template.' : 'Colours: all neutrals. Calm; a colour near the face would add interest.' });
    }

    // Near misses: two pieces almost but not quite the same colour (A: they read as a failed match).
    // Pieces that meet or sit near each other; the tie and the floor are only compared with neighbours.
    const pairs = [['jacket', 'trousers'], ['mid', 'jacket'], ['shirt', 'mid'], ['tie', 'mid'], ['shirt', 'jacket'], ['shirt', 'tie'], ['tie', 'jacket'],
      ['mid', 'trousers'], ['trousers', 'shoes'], ['shirt', 'trousers'],
      ['scarf', 'jacket'], ['scarf', 'mid'], ['scarf', 'shirt'], ['tie', 'scarf'],
      ['coat', 'jacket'], ['coat', 'mid'], ['coat', 'trousers'], ['scarf', 'coat'], ['boutonniere', 'tie']];
    let suitText = null;
    pairs.forEach(function (pr) {
      if (!L[pr[0]] || !L[pr[1]]) return;
      const dE = VC.deltaE2000(VC.hexToLab(L[pr[0]].mean), VC.hexToLab(L[pr[1]].mean));
      if (dE < PARAMS.nearFrom && pr[0] === 'jacket' && pr[1] === 'trousers') {
        // a suit is one cloth as well as one colour; the same colour in two cloths looks like a
        // suit jacket that lost its trousers
        const cj = G.cloth('jacket', o.jacket), ct = G.cloth('trousers', o.trousers);
        const pj = L.jacket.pat, pt = L.trousers.pat, samePat = samePattern(pj, pt);
        if (K.jacket.suit && (!cj || !ct || cj.id === ct.id) && samePat) suitText = 'Jacket and trousers match in colour, cloth and pattern: this reads as a suit.';
        else if (K.jacket.suit && (!cj || !ct || cj.id === ct.id)) add({ id: 'orphan', group: 'formality', score: 0.5, slots: ['trousers'],
          text: 'Jacket and trousers are one colour and cloth but not one pattern (' + (pj.type === 'solid' ? 'plain' : L.jacket.typeName.toLowerCase()) + ' against ' + (pt.type === 'solid' ? 'plain' : L.trousers.typeName.toLowerCase()) + '): it reads as a suit jacket with the wrong trousers. Match the pattern, or make the trousers clearly different.' });
        else if (K.jacket.suit) add({ id: 'orphan', group: 'formality', score: 0.5, slots: ['trousers'],
          text: 'Jacket in ' + cj.name.toLowerCase() + ' and trousers in ' + ct.name.toLowerCase() + ', both ' + L.jacket.name.toLowerCase() + ': the same colour in two cloths looks like a suit jacket worn with the wrong trousers. Match the cloth too, or make the trousers clearly different.' });
      }
      else if (dE >= PARAMS.nearFrom && dE < PARAMS.nearTo) add({ id: 'near', score: 0.45, slots: [pr[1] === 'shoes' ? pr[0] : pr[1]], level: 'A/B',
        text: 'Near match: ' + nm(pr[0]) + ' and ' + nm(pr[1]) + ' are almost the same colour (ΔE ' + round(dE, 1) + '). Close but not equal reads as a mistake: match them or separate them.' });
    });
    if (suitText) add({ id: 'suit', score: 1, slots: [], text: suitText });

    // Top and bottom: clearly different in lightness, unless matched.
    const top = L.jacket ? 'jacket' : L.mid ? 'mid' : L.shirt ? 'shirt' : null;    // the outermost layer meets the trousers
    if (top && L.trousers) {
      const dTop = Math.abs(lum(L[top].mean) - lum(L.trousers.mean));
      const dETop = VC.deltaE2000(VC.hexToLab(L[top].mean), VC.hexToLab(L.trousers.mean));
      if (dETop >= PARAMS.nearTo && dTop < PARAMS.halvesL) add({ id: 'blur', score: 0.45, slots: ['trousers'],
        text: nm(top) + ' and ' + nm('trousers') + ' are close in lightness (step ' + round(dTop) + '): the two halves blur. Go clearly lighter or darker.' });

      // One colour from collar to shoe. A matching top and trousers in a wardrobe neutral is tonal
      // dressing (the guide's charcoal-on-charcoal and all-black evening outfits); in a colour it reads
      // as a uniform, and a colour is meant to be one piece among neutrals (rule 4). A coloured suit
      // is the exception: jacket and trousers cut as one.
      if (!(top === 'jacket' && K.jacket.suit && dETop < PARAMS.nearFrom)) {
        const cT = okc(L[top].mean), cB = okc(L.trousers.mean);
        if (!wardrobeNeutral(L[top].mean) && !wardrobeNeutral(L.trousers.mean) && cT[1] >= 0.03 && cB[1] >= 0.03 && hueDist(cT[2], cB[2]) <= 30) {
          const same = dETop < 10;
          add({ id: 'dose', score: same ? 0.4 : 0.6, slots: ['trousers'],
            text: nm(top) + ' and ' + nm('trousers') + ': ' + (same ? 'one colour from collar to shoe reads as a uniform' : 'one colour family over the top and the legs is most of the body') +
              '. A colour works best as one piece in an outfit of neutrals (rule 4): grey, charcoal or navy trousers' + (L.jacket ? '' : ', or a neutral jacket over it') + '.' });
        }
      }
    }

    // Below the belt.
    if (L.trousers && scoreCached(L.trousers.mean, p).tier === 4) add({ id: 'bold', score: 0.7, slots: ['trousers'],
      text: nm('trousers') + ': a tier 4 colour is loud anywhere. Allowed below the belt as the one bold move.' });
    if (L.shoes && L.trousers) {
      if (lum(L.shoes.mean) > lum(L.trousers.mean) + 8) add({ id: 'shoes', score: 0.6, slots: ['shoes'],
        text: 'Shoes lighter than the trousers pull the eye to the floor. Same depth or darker.' });
      const st = scoreCached(L.shoes.mean, p).temperature, topCool = face.every(function (k) { return scoreCached(L[k].mean, p).temperature <= 0.3; });
      if (st > 0.4 && lum(L.shoes.mean) > 45 && topCool) add({ id: 'shoes', score: 0.55, slots: ['shoes'],
        text: 'Light warm shoes clash with a cool outfit even at floor level. Keep brown shoes dark.' });
    }

    // Socks (Style Guide 5, Outfit Check): match the trousers or go a shade darker, so the leg line
    // runs unbroken into the shoe. A dark, deep colour (burgundy, forest) is the one allowed play.
    if (L.socks && L.trousers) {
      const lS = lum(L.socks.mean), lT = lum(L.trousers.mean), dE = VC.deltaE2000(VC.hexToLab(L.socks.mean), VC.hexToLab(L.trousers.mean));
      const sc = okc(L.socks.mean), dark = lS < PARAMS.sockDeepL && sc[1] <= PARAMS.sockDeepC;   // deep: dark and muted (burgundy, wine, forest), not royal blue
      if (lS > 82 && sc[1] < 0.04) add({ id: 'socks', score: 0.3, slots: ['socks'],
        text: 'White socks with shoes: the eye goes straight to the ankle. Match the trousers instead (no white socks with shoes).' });
      else if (dE < 7 || (lT - lS >= 0 && lT - lS <= 45 && (sc[1] < 0.06 || dE < 15))) add({ id: 'socks', score: 1, slots: ['socks'],
        text: nm('socks') + ': ' + (dE < PARAMS.nearTo ? 'match the trousers' : 'darker than the trousers') + ', so the leg line runs unbroken into the shoe.' });
      else if (sc[1] >= 0.06 && dark) add({ id: 'socks', score: 0.95, slots: ['socks'],
        text: nm('socks') + ': a deep colour at the ankle, the one small bit of colour the guide allows there (burgundy or forest with grey flannel).' });
      else if (lS > lT + 6) add({ id: 'socks', score: 0.45, slots: ['socks'],
        text: nm('socks') + ' are lighter than the trousers: a light band shows at every step and when seated. Match the trousers or go a shade darker.' });
      else add({ id: 'socks', score: 0.7, slots: ['socks'],
        text: nm('socks') + ': neither the trousers\' colour nor a shade darker, so the leg line breaks at the ankle. Navy, charcoal or burgundy are the safe set.' });
    }

    // Pocket square: needs a breast pocket; white linen is never wrong; matching the tie exactly
    // looks bought as a set. A square picks up a colour from the tie or shirt rather than copying it.
    if (L.square) {
      if (!((L.jacket && K.jacket.pocket) || (L.coat && K.coat.pocket))) add({ id: 'square', score: 0.2, slots: ['square'],
        text: 'A pocket square needs a breast pocket: a tailored jacket, a blazer, or an overcoat with one. Take it off, or wear one of them.' });
      else {
        const sq = VC.hexToLab(L.square.mean), white = sq[0] > 88 && okc(L.square.mean)[1] < 0.03;
        if (L.tie && K.tie.knotted && VC.deltaE2000(sq, VC.hexToLab(L.tie.mean)) < PARAMS.squareSetDE && L.square.pat.type === L.tie.pat.type)
          add({ id: 'square', score: 0.55, slots: ['square'], text: 'Square and ' + K.tie.name.toLowerCase() + ' are the same cloth: it looks bought as a set. Let the square pick up a colour from the tie or shirt, or wear white linen.' });
        else if (white) add({ id: 'square', score: 1, slots: ['square'], text: 'White linen square: never wrong.' });
      }
    }

    // The under-eye area (Style Guide section 1, September 2026 addendum). Knitwear at the collar
    // is too far below the eyes to darken them; what matters is that a face with a second dark
    // zone keeps a light element near it on the darkest days (rule 1).
    if (p.underEye && p.underEye !== 'none' && near.length && near.every(function (k) { return lum(L[k].mean) < 40; }))
      add({ id: 'light', score: 0.65, slots: [face.filter(function (k) { return k !== 'hat'; })[0] || face[0]],
        text: 'Everything near the face is dark, and your eye area is a dark zone of its own. Keep one light element there: a white or light shirt collar, a light layer, or a light square.' });

    // One statement per outfit (Style Guide rule 4 and the bold-day rule). Tier 2 is "the one chosen
    // colour": a second, different tier 2 colour at the face competes with it, and so does a
    // tier 4 below the belt. Neutrals are not statements, and two pieces of one colour count once.
    const stated = [];
    face.forEach(function (k) {
      const sc = scoreCached(L[k].mean, p);
      if (sc.tier !== 2 || wardrobeNeutral(L[k].mean)) return;      // a menswear neutral (camel, navy, brown) is not a statement
      const f = stated.find(function (g) { return g.h != null && hueDist(g.h, sc.oklch[2]) <= PARAMS.familyHue; });
      if (f) f.slots.push(k); else stated.push({ h: sc.oklch[2], slots: [k], what: nm(k) + ' (tier 2)' });
    });
    if (L.trousers && scoreCached(L.trousers.mean, p).tier === 4) stated.push({ h: null, slots: ['trousers'], what: nm('trousers') + ' (tier 4)' });
    if (stated.length > 1) add({ id: 'budget', score: stated.length === 2 ? 0.6 : 0.4, slots: stated.slice(1).map(function (g) { return g.slots[0]; }),
      text: 'Statements: ' + stated.map(function (g) { return g.what; }).join(' and ') + '. A deliberate colour works as the one chosen colour of an outfit; keep everything else tier 1 or neutral (rule 4).' });

    // Tie against shirt.
    if (L.tie && L.shirt && K.tie.knotted) {
      const dT = Math.abs(lum(L.tie.mean) - lum(L.shirt.mean)), dE = VC.deltaE2000(VC.hexToLab(L.tie.mean), VC.hexToLab(L.shirt.mean));
      const tn = K.tie.name, tl = tn.toLowerCase();
      if (dT < PARAMS.tieL && dE < PARAMS.mergeTo) add({ id: 'tie', score: 0.45, slots: ['tie'], text: tn + ' and shirt are too alike to separate. The ' + tl + ' is usually darker than the shirt.' });
      else if (lum(L.tie.mean) > lum(L.shirt.mean) + 12) add({ id: 'tie', score: 0.75, slots: ['tie'], text: tn + ' lighter than the shirt: possible, but a darker ' + tl + ' on a lighter shirt is the reliable order.' });
    }

    /* --- pattern --- */
    const pats = near.filter(function (k) { return L[k].visible; });   // the face layers and the pocket square, a hand from the face
    const allPats = worn.filter(function (k) { return L[k].visible; });
    const tex = worn.filter(function (k) { return L[k].texture; });
    // Why a patterned cloth does not count: tonal, or too fine or faint to read from 3 m.
    const texWhy = function (k) {
      const r = L[k].reads[3];
      return nm(k) + (L[k].tonal && r.state === 'pattern' ? ' (tonal)' : r.state === 'plain' ? ' (plain from 3 m)' : ' (texture from 3 m)');
    };
    if (!allPats.length) {
      add({ id: 'pcount', group: 'pattern', score: 1, slots: [],
        text: 'No visible pattern' + (tex.length ? '; ' + tex.map(texWhy).join(', ') + (tex.length > 1 ? ' read' : ' reads') + ' as texture, which adds interest without competing.' : '. Texture in the cloth adds interest without pattern (rule 6).') });
    }
    if (allPats.length && pats.length <= 2) add({ id: 'pcount', group: 'pattern', score: 1, slots: [],
      text: (pats.length ? pats.length + ' visible pattern' + (pats.length > 1 ? 's' : '') + ' near the face, within the limit of two.' : 'Pattern only below the face, where it competes least.') +
        (tex.length ? ' ' + tex.map(texWhy).join(', ') + (tex.length > 1 ? ' do' : ' does') + ' not count.' : '') });
    if (pats.length > 2) add({ id: 'pcount', group: 'pattern', score: 0.3, slots: pats.slice(1),
      text: pats.length + ' patterns near the face. At most two (rule 7): make one of them plain.', fix: { kind: 'solid', slot: pats[pats.length - 1] } });
    if (face.length >= 2 && face.every(function (k) { return L[k].visible; })) add({ id: 'anchor', group: 'pattern', score: 0.45, slots: pats.slice(-1),
      text: 'Every layer at the face is patterned. One plain layer anchors the others (rule 7).', fix: { kind: 'solid', slot: pats[pats.length - 1] } });
    const shareColour = function (A, B) { return A.colours.some(function (x) { return B.colours.some(function (y) { return VC.deltaE2000(VC.hexToLab(x), VC.hexToLab(y)) < PARAMS.patternShareDE; }); }); };
    for (let i = 0; i < pats.length; i++) for (let j = i + 1; j < pats.length; j++) {
      const A = L[pats[i]], B = L[pats[j]], ratio = Math.max(A.pat.scale, B.pat.scale) / Math.min(A.pat.scale, B.pat.scale);
      // two patterns of a different kind (a stripe and a check) and in different colours stay apart even at one
      // scale (Put This On: "color makes up for that"); alike in kind or colour, they interfere
      const apart = A.family !== B.family && !shareColour(A, B);
      if (ratio < 1.8 && apart) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 0.6, slots: [pats[j]],
        text: nm(pats[i]) + ' (' + A.label + ') and ' + nm(pats[j]) + ' (' + B.label + ') are at nearly the same scale, but different in kind and colour, which keeps them apart. A clearer difference in scale (about two or more) is the safer choice.' });
      else if (ratio < 1.8) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 0.4, slots: [pats[j]],
        text: nm(pats[i]) + ' (' + A.label + ') and ' + nm(pats[j]) + ' (' + B.label + ') are at nearly the same scale. Patterns of similar size interfere and seem to move; vary the scale by about two or more.' });
      else if (pats.length === 2) add({ id: 'pscale', group: 'pattern', level: 'A/B', score: 1, slots: [],
        text: nm(pats[i]) + ' and ' + nm(pats[j]) + ' are at different scales (' + A.label + ' against ' + B.label + '), so each keeps its own identity.' });
    }
    // the top layer and the trousers meet at the hips; the same scale interferes there too (unless a suit)
    const topP = L.jacket ? 'jacket' : L.mid ? 'mid' : null;
    if (topP && L[topP].visible && L.trousers && L.trousers.visible && !(topP === 'jacket' && suitWorn(o, L, K, (function () { const c = {}; ['jacket', 'trousers'].forEach(function (k) { c[k] = G.cloth(k, o[k]); }); return c; })()))) {
      const A = L[topP], Bt = L.trousers, ratio = Math.max(A.pat.scale, Bt.pat.scale) / Math.min(A.pat.scale, Bt.pat.scale);
      if (ratio < 1.8) add({ id: 'phip', group: 'pattern', level: 'A/B', score: 0.5, slots: ['trousers'],
        text: nm(topP) + ' (' + A.label + ') and ' + nm('trousers') + ' (' + Bt.label + ') meet at the hips at nearly the same scale: patterns of similar size interfere. Vary the scale by about two or more, or make one plain.' });
    }
    /* Echo (B): a pattern's colour picked up elsewhere in the outfit, subtly, ties it together
       (Gentleman's Gazette; Permanent Style). It helps but is not required, and the sources warn against
       obvious matching (Boyer), so this never lowers a verdict: a tick when it is done, a suggestion when
       it is not. Whether the colours relate at all is judged with every colour, under colours together. */
    {
      const elsewhere = function (k, hex) {
        return worn.find(function (o) { return o !== k && L[o].colours.some(function (h, i) { return (i === 0 || L[o].visible) && VC.deltaE2000(VC.hexToLab(h), VC.hexToLab(hex)) < PARAMS.patternShareDE; }); });
      };
      const echoed = [], loose = [];
      allPats.forEach(function (k) {
        L[k].colours.filter(function (h) { return !wardrobeNeutral(h); }).forEach(function (h) {
          const o = elsewhere(k, h); (o ? echoed : loose).push({ k: k, hex: h, o: o });
        });
      });
      if (loose.length) add({ id: 'pecho', group: 'pattern', score: 0.9, slots: [loose[0].k],
        text: 'The ' + colourName(loose[0].hex) + ' in the ' + nm(loose[0].k).toLowerCase() + ' appears nowhere else. Picking it up somewhere, subtly (socks, a pocket square, a knit), ties the outfit together; it is a choice, not a rule.' });
      else if (echoed.length) add({ id: 'pecho', group: 'pattern', score: 1, slots: [],
        text: 'The ' + colourName(echoed[0].hex) + ' in the ' + nm(echoed[0].k).toLowerCase() + ' is picked up by the ' + nm(echoed[0].o).toLowerCase() + ': a repeated colour ties the outfit together.' });
    }
    const medium = allPats.filter(function (k) { return L[k].cls.id === 'medium'; });
    if (medium.length > 1) add({ id: 'pmed', group: 'pattern', score: 0.5, slots: medium.slice(1),
      text: 'Two medium-scale patterns (' + medium.map(nm).join(', ') + '). The medium pattern is the one statement of an outfit.' });
    // Which patterns and what scale each garment type takes (Style Guide, section 7), from garments.js.
    worn.forEach(function (k) {
      const t = L[k].pat.type, cl = G.cloth(k, o[k]);
      if (t !== 'solid' && cl && !G.patOK(cl.id, t)) add({ id: 'ptype', group: 'pattern', score: 0.3, slots: [k],
        text: nm(k) + ': ' + L[k].typeName.toLowerCase() + ' is not made in ' + cl.name.toLowerCase().replace(/ \(shiny\)$/, '') + '. The weave or print does not exist in that cloth.' });
      else if (t !== 'solid' && K[k].pats.indexOf(t) < 0) add({ id: 'ptype', group: 'pattern', score: 0.6, slots: [k],
        text: nm(k) + ': ' + L[k].typeName.toLowerCase() + ' is not a cloth the guide uses for a ' + K[k].name.toLowerCase() + '.' +
          (K[k].pats.length > 1 ? ' It uses ' + K[k].pats.filter(function (x) { return x !== 'solid'; }).map(function (x) { return P().byId[x].name.toLowerCase(); }).join(', ') + '.' : ' It is worn plain.') });
    });
    allPats.forEach(function (k) {
      const c = L[k].cls.id, over = G.scaleOver(K[k], c), kn = K[k].name.toLowerCase();
      if (c === 'huge') add({ id: 'psize', group: 'pattern', score: 0.3, slots: [k], text: nm(k) + ': a repeat over 15 cm is too large to wear.' });
      else if (over >= 2) add({ id: 'psize', group: 'pattern', score: 0.4, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is far too big for a ' + kn + ', which takes ' + SCALE_TEXT[K[k].maxScale] + '.' });
      else if (over === 1 && o.propOn && o.frame === 'big') add({ id: 'psize', group: 'pattern', score: 0.8, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is a step above what a ' + kn + ' usually takes, but a broad frame carries it.' });
      else if (over === 1) add({ id: 'psize', group: 'pattern', score: 0.6, slots: [k], text: nm(k) + ': a ' + L[k].cls.label + ' repeat (' + L[k].label + ') is loud on a ' + kn + ', which usually takes ' + SCALE_TEXT[K[k].maxScale] + '. A bold move.' + (o.propOn && o.frame === 'small' ? ' On a slight frame even more so.' : '') });
      else if (over === 0 && o.propOn && o.frame === 'small' && c === 'medium') add({ id: 'psize', group: 'pattern', score: 0.85, slots: [k], text: nm(k) + ': a medium repeat (' + L[k].label + ') is at the top of what a slight frame carries; the smaller end of medium suits it better.' });
      if (FACE.indexOf(k) >= 0 && L[k].dL > hi) add({ id: 'pcontrast', group: 'pattern', level: 'A/B', score: 0.6, slots: [k],
        text: nm(k) + ': the pattern\'s own light-dark contrast (' + round(L[k].dL) + ') is stronger than your face carries (up to ' + round(hi) + '). It will take the attention.' });
    });
    if (allPats.length > 3) add({ id: 'pbusy', group: 'pattern', score: 0.5, slots: allPats.slice(3), text: allPats.length + ' patterned pieces in one outfit: busy.' });

    /* --- a brimmed hat: its band sits at the face; its brim follows the frame (B) --- */
    if (L.hat && K.hat.brim) hatChecks(o.hat, K.hat, p, add, nm, o.m || {});

    /* --- the whole outfit: sheen, formality, season (cloth and shoe type) --- */
    if (!o.study) wholeChecks(o, L, K, p, add, nm);

    /* --- proportion: the outfit's lines on the body, and cuts that belong together --- */
    if (o.propOn && !o.study) proportionChecks(o, L, K, add, nm);

    /* --- accessories --- */
    accessoryChecks(o.acc || {}, L, K, p, add, nm, o.occasion, o);
    const gl = framesOf(o), fw = frameWeight(p, gl);
    if (fw) add({ id: 'gweight', group: 'accessory', level: 'A/B', score: fw.score, slots: [], acc: 'glasses', text: fw.text });
    // Frames and the colours beside them (B): a metal or coloured frame is a second temperature at the
    // face, against you only when the pair pulls away from your colouring: warm frames with a warm
    // colour on a face that is not warm, cool frames with a cool colour on a warm face.
    const ft = frameTemp(gl);
    if (ft) {
      const fName = gl.frame === 'acetate' ? 'your ' + ft + '-coloured frames' : gl.frame + ' frames';
      const pull = ft === 'warm' ? p.tempLevel !== 'warm' : p.tempLevel === 'warm';
      const second = pull ? near.filter(function (k) { const t = scoreCached(L[k].mean, p).temperature; return ft === 'warm' ? t > 0.4 : t < -0.4; }) : [];
      if (second.length) add({ id: 'glasses', group: 'colour', score: 0.8, slots: second,
        text: 'With ' + fName + ', ' + second.map(nm).join(' and ') + (second.length > 1 ? ' are' : ' is') + ' a second ' + ft + ' note at the face, beside the frames. Let the frames be the one ' + ft + ' note: a ' + (ft === 'warm' ? 'cool or neutral' : 'warm or neutral') + ' colour there instead.' });
    }
    return checkRules(out);
  }

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
    if (L[top] && L.trousers) {
      const d = Math.abs(lum(top) - lum('trousers')), jacketHem = top === 'jacket';
      if (d >= 30 && jacketHem) ad({ id: 'pline', score: shortLegs ? 0.75 : 0.9, slots: [],
        text: 'A strong light-dark step at the ' + nm('jacket') + '\'s hem, over the hips: the eye starts the legs there, lower than the waist.' + legWord + (shortLegs ? ' Closer lightness between jacket and trousers moves the line up.' : '') });
      else if (d >= 30 && rise === 'low') ad({ id: 'pline', score: shortLegs ? 0.75 : 0.9, slots: [],
        text: 'The light-dark change sits at a low waistband, below your waist: the legs read shorter than they are.' + legWord + (shortLegs ? ' Higher-rise trousers move the line to your waist.' : '') });
      else if (d >= 30) ad({ id: 'pline', score: 1, slots: [], text: 'The light-dark change between top and trousers falls at the waistband, where the legs appear to start.' });
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
    // the collar against the face: the outfit does not record the collar's cut, so this is the
    // advice for the shirt you choose, from the face's proportions (Flusser: counterbalance, not repeat)
    // broad or long only beyond the tape's error (body.js); the percentile alone is not trusted
    const fs = pc.faceClass === 'broad' ? 70 : pc.faceClass === 'long' ? 30 : null, bald = o.hairStyle === 'none';
    if (L.shirt && K.shirt && K.shirt.collar && ((fs != null && (fs >= 70 || fs <= 30)) || bald)) ad({ id: 'pcollar', score: 1, slots: ['shirt'],
      text: (fs >= 70 ? 'Your face is broad for its length: a collar with longer points and a moderate spread balances it; a wide cutaway would widen it further.'
        : fs != null && fs <= 30 ? 'Your face is long for its width: a wider spread balances it; long narrow points would lengthen it further.' : '') +
        (bald ? (fs >= 70 || (fs != null && fs <= 30) ? ' ' : '') + 'With no hair the collar is the frame: a taller band stands up and does that job.' : '') });
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

  /* The band is a small colour right at the face, so it is judged like one: a band in a colour
     that does not suit you is noted (a navy band helps a natural straw panama, Style Guide). The
     brim should follow the frame: a narrow brim looks small on a tall, broad man, a wide one
     swamps a slight one; medium is the safe middle (B). m holds the body measurements, if any. */
  function hatChecks(piece, kd, p, add, nm, m) {
    const band = piece.band, nmHat = piece.name + ' ' + kd.name.toLowerCase();
    if (band) {
      const t = scoreCached(band, p).tier, dE = VC.deltaE2000(VC.hexToLab(band), VC.hexToLab(piece.hex));
      if (t > 2) add({ id: 'band', score: 0.7, slots: ['hat'], text: 'The band of the ' + nmHat + ' sits at the face, and its colour is tier ' + t + ' for you. A navy, charcoal, black or burgundy band would help.' });
      else if (dE < 6) add({ id: 'band', score: 0.9, slots: ['hat'], text: 'The band is almost the hat\'s colour, so it disappears; a band clearly darker than the hat gives it a line.' });
      else add({ id: 'band', score: 1, slots: [], text: 'Hat band: a colour that suits you at the face, clearly separate from the hat.' });
    }
    const brim = piece.brim || 'medium', h = +m.height || 0, sh = +m.shoulder || 0;
    const big = h >= PARAMS.frameTall || sh >= PARAMS.frameBroad, small = (h && h < PARAMS.frameShort) || (sh && sh < PARAMS.frameNarrow);
    if (brim === 'narrow' && big) add({ id: 'brim', score: 0.75, slots: ['hat'], text: 'A narrow brim looks small on a tall or broad frame; a medium brim keeps the hat in proportion to the shoulders.' });
    else if (brim === 'wide' && small) add({ id: 'brim', score: 0.75, slots: ['hat'], text: 'A wide brim can swamp a slight frame; a medium or narrow brim keeps the face the focus.' });
    else add({ id: 'brim', score: 1, slots: [], text: 'Brim: ' + brim + (h || sh ? ', in proportion to your frame.' : '. Medium is the safe middle for most frames.') });
  }

  /* Sheen, formality and season: what the cloths and shoe types say (Style Guide sections 4 to 6).
     o.occasion is 'casual', 'smart', 'business' or 'evening'; p.season is the season switch. */
  function wholeChecks(o, L, K, p, add, nm) {
    const C = {}, F = {};
    Object.keys(L).forEach(function (k) { C[k] = G.cloth(k, o[k]); F[k] = G.formality(k, o[k]); });
    // a dress shirt worn without a tie is open-collared: smart, not business (B)
    if (F.shirt != null && K.shirt.tieable && !(L.tie && K.tie.knotted)) F.shirt = Math.min(F.shirt, 4);
    const cn = function (k) { return C[k] ? C[k].name.toLowerCase().replace(/ \(shiny\)$/, '') : ''; };
    const what = function (k) { return L[k].name + ' ' + (C[k] ? cn(k) + ' ' : '') + K[k].name.toLowerCase(); };
    const occ = G.OCCASIONS.find(function (x) { return x.id === o.occasion; }) || G.OCCASIONS[1];

    // 4. Sheen: anything glossy near the face fails; below it, a caution; patent is for black tie.
    const shiny = Object.keys(L).filter(function (k) { return C[k] && C[k].sheen === 2; });
    const nearFace = G.NEAR.concat(['hat']);
    shiny.forEach(function (k) {
      if (nearFace.indexOf(k) >= 0) add({ id: 'sheen', group: 'sheen', score: 0.35, slots: [k], cloth: true,
        text: what(k) + ': shiny cloth near the face competes with the skin\'s own shine and makes everything look cheaper (Outfit Check, question 4). Choose the matte version.' });
      else if (k === 'shoes') {
        add({ id: 'sheen', group: 'sheen', score: o.occasion === 'evening' ? 0.85 : 0.55, slots: [k], cloth: true,
          text: 'Patent shoes are for black tie' + (o.occasion === 'evening' ? '; for a formal evening they are right.' : '. Polish calf to a glow instead.') });
      }
      else add({ id: 'sheen', group: 'sheen', score: 0.6, slots: [k], cloth: true, text: what(k) + ': shiny cloth looks cheap below the belt too. The matte version is the classic one.' });
    });
    if (!shiny.length) add({ id: 'sheen', group: 'sheen', score: 1, slots: [], text: 'Sheen: everything is matte or has only a soft sheen, which suits skin and keeps the outfit quiet.' });

    // Specific pairings from the Style Guide first; a piece named there is not repeated in the
    // general formality messages below.
    const shoeF = L.shoes ? F.shoes : null, tie = L.tie && K.tie.knotted, handled = {};
    const smart = Object.keys(L).some(function (k) { return k !== 'shoes' && F[k] != null && F[k] >= 3; });
    if (L.shoes && K.shoes.id === 'chunky' && smart) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.35, slots: ['shoes'], text: 'Chunky or technical trainers fail with anything smart: they pull the eye to the floor, and the eye should stay at the face (Style Guide, shoes).' });
    } else if (tie && shoeF != null && shoeF <= 1) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.4, slots: ['shoes'], text: 'A ' + K.tie.name.toLowerCase() + ' with trainers: the tie says business, the shoes say weekend. Wear leather shoes, or lose the tie.' });
    } else if (suitWorn(o, L, K, C) && shoeF != null && shoeF <= 1) {
      handled.shoes = true;
      add({ id: 'shoe', group: 'formality', score: 0.65, slots: ['shoes'], text: 'A suit with trainers is a fashion look rather than a classic one; loafers or derbies keep the suit\'s register.' });
    }
    if (tie && L.trousers && C.trousers && C.trousers.id === 'denim')
      add({ id: 'shoe', group: 'formality', score: 0.65, slots: ['tie'], text: 'A ' + K.tie.name.toLowerCase() + ' with denim: possible with a knitted or wool tie and a tweed jacket, otherwise the two halves disagree.' });

    // Formality: the pieces that set the register (not scarf, socks, square, hat or an overcoat).
    const reg = Object.keys(L).filter(function (k) { return F[k] != null && k !== 'hat' && k !== 'coat' && k !== 'gloves' && !handled[k]; });
    outerwear(o, L, K, F, C, p, add, what);
    const W = ['', 'casual', 'relaxed', 'smart casual', 'smart', 'business'];
    const word = function (f) { return f <= 0 ? 'sportswear' : W[f]; };
    if (reg.length) {
      const lo = reg.reduce(function (a, k) { return F[k] < F[a] ? k : a; }), hi = reg.reduce(function (a, k) { return F[k] > F[a] ? k : a; });
      const spread = F[hi] - F[lo];
      if (spread >= PARAMS.formalMistake) add({ id: 'formal', group: 'formality', score: 0.4, slots: [lo],
        text: what(hi) + ' (' + word(F[hi]) + ') and ' + what(lo) + ' (' + word(F[lo]) + ') are too far apart in formality: one of them looks like a mistake.' });
      else if (spread === PARAMS.formalWide) add({ id: 'formal', group: 'formality', score: 0.65, slots: [lo],
        text: what(hi) + ' (' + word(F[hi]) + ') with ' + what(lo) + ' (' + word(F[lo]) + '): a wide mix. It can work as a deliberate contrast; usually one step closer looks surer.' });
      else add({ id: 'formal', group: 'formality', score: 1, slots: [],
        text: 'Formality: the pieces sit within ' + (spread ? 'two steps' : 'one register') + ' of each other, from ' + word(F[lo]) + ' to ' + word(F[hi]) + '.' });
      // against the occasion
      const r = occ.range, under = reg.filter(function (k) { return F[k] < r[0]; }), over = reg.filter(function (k) { return F[k] > r[1]; });
      if (under.length) {
        const gap = r[0] - Math.min.apply(null, under.map(function (k) { return F[k]; }));
        add({ id: 'occasion', group: 'formality', score: gap >= 2 ? 0.4 : 0.7, slots: under,
          text: 'For ' + occ.name.toLowerCase() + ', ' + under.map(what).join(' and ') + (under.length > 1 ? ' are' : ' is') + ' too casual (' + occ.note + ').' });
      } else if (over.length) {
        add({ id: 'occasion', group: 'formality', score: over.some(function (k) { return F[k] - r[1] >= 2; }) ? 0.65 : 0.85, slots: over,
          text: 'For ' + occ.name.toLowerCase() + ', ' + over.map(what).join(' and ') + (over.length > 1 ? ' are' : ' is') + ' dressier than the occasion. Fine if you mean it; the room will notice.' });
      } else add({ id: 'occasion', group: 'formality', score: 1, slots: [], text: 'Right for ' + occ.name.toLowerCase() + ': ' + occ.note + '.' });
    }
    // Season: cloth weight against the season switch, and two seasons in one outfit.
    const season = p.season === 'summer' ? 'summer' : 'winter', other = season === 'summer' ? 'winter' : 'summer';
    const seasonal = Object.keys(L);
    const wrong = seasonal.filter(function (k) { return C[k] && C[k].season === other; });
    const sum = seasonal.filter(function (k) { return C[k] && C[k].season === 'summer'; }), win = seasonal.filter(function (k) { return C[k] && C[k].season === 'winter'; });
    if (sum.length && win.length) add({ id: 'season', group: 'season', score: 0.55, slots: [sum[0]],
      text: what(sum[0]) + ' and ' + what(win[0]) + ' belong to different seasons: summer and winter cloth in one outfit look as if one of them was a mistake.' });
    else if (wrong.length) add({ id: 'season', group: 'season', score: 0.65, slots: wrong,
      text: wrong.map(what).join(' and ') + ': ' + (season === 'winter' ? 'summer cloth in winter looks cold and out of place; flannel, tweed, wool and heavier knits belong now.' : 'winter cloth in summer is too warm, and looks it; linen, fresco, cotton and lighter knits belong now.') + ' (The season switch at the top sets this.)' });
    else add({ id: 'season', group: 'season', score: 1, slots: [], text: 'Season: the cloths suit ' + season + (win.length || sum.length ? '' : ', and all of them work year round') + '.' });
  }
  /* One cloth's pattern on two pieces: the same type, at the same repeat. */
  function colourName(hex) {
    const lab = VC.hexToLab(hex); let best = null, d = 1e9;
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
    return out;
  }

  /* ---------- The rules, one entry each ----------
     Every rule the checks can emit has one entry here, and only here: what it is called in a verdict
     ("Fails on …"), how much it weighs when outfits are compared, what a suggested colour is said to do
     when it mends the rule (null: a colour cannot change it, as with a watch's size), and the section of
     the Outfit Check card it belongs to (otherwise its group decides), and its kind:
       perceptual  the eye's response, measured (badge A or A/B in How it works): graded;
       convention  a tailoring or colour convention (B): graded, and labelled so;
       possibility a combination that cannot be worn (a pocket square with no breast pocket): the
                   editor and the suggestions prevent it, and if one gets through (an imported file)
                   the verdict says "Not possible as set" rather than judging the outfit's looks;
       context     advice about what does not change with the outfit (your frames, your face, your
                   build): shown as information, never counted in a verdict or a comparison.
     how: the id of the passage in How it works that explains the rule; the Dresser's "?" shows it. The rule itself, with its
     evidence badge and its thresholds, is written where it is checked. tests/rules.js fails if a rule
     is emitted without an entry, and checkOutfit warns once in the console. */
  const RULES = {
    acc: { name: 'an accessory without what it needs', weight: 1, reason: null, kind: 'possibility', how: 'r-size' },
    anchor: { name: 'no plain layer', weight: 1, reason: 'gives the patterns a plain anchor', kind: 'convention', how: 'r-pnear' },
    asize: { name: 'the size of an accessory', weight: 0.6, reason: null, kind: 'convention', how: 'r-size' },
    band: { name: 'the hat band', weight: 1, reason: null, section: 'skin', kind: 'convention', how: 'r-pgarment' },
    blur: { name: 'top and bottom blur', weight: 0.8, reason: 'separates top and bottom', section: 'contrast', kind: 'convention', how: 'r-blur' },
    bold: { name: 'a second loud colour', weight: 0.5, reason: 'quieter below the belt', section: 'colour', kind: 'convention', how: 'r-below' },
    bout: { name: 'a buttonhole without lapels', weight: 1, reason: null, kind: 'possibility', how: 'r-buttonhole' },
    brim: { name: 'the brim for the frame', weight: 1, reason: null, section: 'frame', kind: 'convention', how: 'r-pgarment' },
    budget: { name: 'too many statements', weight: 0.8, reason: 'leaves one deliberate colour', section: 'colour', kind: 'convention', how: 'r-statement' },
    coat: { name: 'a coat far from the occasion', weight: 1, reason: null, kind: 'convention', how: 'r-outer' },
    dose: { name: 'one colour head to toe', weight: 1, reason: 'keeps the colour to one piece', section: 'colour', kind: 'convention', how: 'r-dose' },
    face: { name: 'a colour at the face', weight: 1.6, reason: 'suits your face', section: 'skin', kind: 'perceptual', how: 'r-face' },
    formal: { name: 'pieces of different formality', weight: 1, reason: null, section: 'formality', kind: 'convention', how: 'r-formality' },
    frame: { name: 'nothing frames the face', weight: 0.8, reason: 'frames the face', section: 'frame', kind: 'convention', how: 'r-frame' },
    glasses: { name: 'a second warm or cool note beside the frames', weight: 1, reason: 'agrees with the frames', section: 'temperature', kind: 'convention', how: 'r-frames-temp' },
    gloves: { name: 'gloves for the occasion', weight: 1, reason: null, kind: 'convention', how: 'r-outer' },
    gweight: { name: 'the frames against the face', weight: 1, reason: null, kind: 'context', how: 'r-glasses' },
    harmony: { name: 'colours that compete', weight: 1, reason: 'sits with the other colours', section: 'colour', kind: 'convention', how: 'r-harmony' },
    hatf: { name: 'a hat far from the occasion', weight: 1, reason: null, kind: 'convention', how: 'r-outer' },
    layer: { name: 'a knit that does not suit the layer under it', weight: 0.6, reason: 'suits the layer under it', section: 'frame', kind: 'convention', how: 'r-frame' },
    light: { name: 'no light element near dark eyes', weight: 0.7, reason: 'a light element near the eyes', section: 'contrast', kind: 'convention', how: 'r-eyes' },
    metal: { name: 'the metal', weight: 0.6, reason: null, kind: 'convention', how: 'r-metal' },
    near: { name: 'a near match', weight: 1, reason: 'avoids a near match', section: 'colour', kind: 'perceptual', how: 'r-near' },
    neck: { name: 'a tie with no collar', weight: 1.5, reason: null, section: 'frame', kind: 'possibility', how: 'r-frame' },
    occasion: { name: 'the occasion', weight: 1, reason: null, section: 'formality', kind: 'convention', how: 'r-formality' },
    orphan: { name: 'a suit jacket with the wrong trousers', weight: 0.9, reason: 'no longer a suit jacket with the wrong trousers', section: 'formality', kind: 'convention', how: 'r-formality' },
    pankle: { name: 'a strong step at the ankle', weight: 1, reason: 'continues the leg into the shoe', kind: 'convention', how: 'r-lines' },
    pbusy: { name: 'too busy', weight: 0.6, reason: null, kind: 'convention', how: 'r-pnear' },
    pcollar: { name: 'the collar for the face', weight: 1, reason: null, kind: 'context', how: 'r-collar' },
    pcolumn: { name: 'a tonal column', weight: 1, reason: 'keeps the tonal column', kind: 'perceptual', how: 'r-lines' },
    pcontrast: { name: 'a pattern louder than the face', weight: 0.7, reason: 'a quieter pattern for the face', kind: 'perceptual', how: 'r-pcontrast' },
    pcount: { name: 'too many patterns', weight: 1.2, reason: 'one fewer visible pattern', kind: 'convention', how: 'r-pnear' },
    phip: { name: 'jacket and trouser patterns at the same scale', weight: 0.8, reason: null, kind: 'perceptual', how: 'r-pscale' },
    pline: { name: 'where the legs appear to start', weight: 1, reason: 'starts the legs at the waist', kind: 'convention', how: 'r-lines' },
    pmed: { name: 'two medium patterns', weight: 0.8, reason: null, kind: 'convention', how: 'r-pgarment' },
    pperiod: { name: 'cuts from different periods', weight: 1, reason: null, kind: 'convention', how: 'r-lines' },
    pscale: { name: 'patterns at the same scale', weight: 1, reason: null, kind: 'perceptual', how: 'r-pscale' },
    pseat: { name: 'low rise with a prominent seat', weight: 1, reason: null, kind: 'context', how: 'r-lines' },
    pecho: { name: "a pattern's colour picked up elsewhere", weight: 0.3, reason: 'picks up a colour from a pattern', kind: 'convention', how: 'r-pnear' },
    psize: { name: 'pattern size', weight: 0.8, reason: null, kind: 'convention', how: 'r-pgarment' },
    pstomach: { name: 'the rise and the stomach', weight: 1, reason: null, kind: 'context', how: 'r-lines' },
    ptie: { name: 'a tie past a high waistband', weight: 1, reason: null, kind: 'convention', how: 'r-lines' },
    ptype: { name: 'a pattern its cloth cannot carry', weight: 0.6, reason: null, kind: 'possibility', how: 'r-pcloth' },
    season: { name: 'the season', weight: 0.8, reason: null, section: 'season', kind: 'convention', how: 'r-season' },
    sheen: { name: 'a shiny cloth', weight: 1.1, reason: null, section: 'sheen', kind: 'convention', how: 'r-sheen' },
    shoe: { name: 'the shoes', weight: 0.9, reason: null, section: 'feet', kind: 'convention', how: 'r-formality' },
    shoes: { name: 'shoes against the trousers', weight: 0.6, reason: 'right depth for the trousers', section: 'feet', kind: 'convention', how: 'r-below' },
    socks: { name: 'the socks', weight: 0.6, reason: 'continues the leg line', section: 'feet', kind: 'convention', how: 'r-socks' },
    square: { name: 'the pocket square', weight: 0.5, reason: null, section: 'colour', kind: 'possibility', how: 'r-square' },
    step: { name: 'the light-dark step', weight: 1.2, reason: 'gives the face a clear frame', section: 'contrast', kind: 'perceptual', how: 'r-step' },
    stone: { name: 'a stone that echoes nothing', weight: 0.3, reason: 'echoes the stone', kind: 'convention', how: 'r-metal' },
    suit: { name: 'jacket and trousers read as a suit', weight: 1, reason: 'reads as a deliberate suit', section: 'colour', kind: 'convention', how: 'r-near' },
    temp: { name: 'mixed temperature', weight: 1, reason: 'keeps one temperature above the waist', section: 'temperature', kind: 'convention', how: 'r-temp' },
    tie: { name: 'tie against shirt', weight: 0.8, reason: 'stands clear of the shirt', section: 'colour', kind: 'convention', how: 'r-tie' },
    wstyle: { name: 'a sports watch with dressed-up clothes', weight: 1, reason: null, kind: 'convention', how: 'r-watch' }
  };

  const SECTIONS = [
    { id: 'skin', title: '1. Against your skin', q: 'Does every colour near the face suit your skin (tier 1 or 2)?' },
    { id: 'temperature', title: 'Temperature', q: 'One temperature near the face?' },
    { id: 'contrast', title: '2. Contrast', q: 'Is there a clear light-dark step at the face, and between top and bottom?' },
    { id: 'frame', title: '3. Frame', q: 'What frames the face?' },
    { id: 'sheen', title: '4. Sheen', q: 'Is anything glossy?' },
    { id: 'pattern', title: '5. Pattern', q: 'Two patterns at most near the face, different scales, one plain layer, a shared colour?', group: 'pattern' },
    { id: 'metal', title: '6. Metal and accessories', q: 'One metal, accessories of the right size?', group: 'accessory' },
    { id: 'feet', title: 'Feet', q: 'Shoes the trousers\' depth or darker, socks that continue the leg?' },
    { id: 'colour', title: 'Colours together', q: 'Two neutrals and one colour; no near misses; one statement?' },
    { id: 'proportion', title: 'Proportion', q: 'Where do the outfit\'s lines fall on your body, and do the cuts belong together?', group: 'proportion' },
    { id: 'formality', title: 'Formality', q: 'Do the pieces belong to one register, and to the occasion?' },
    { id: 'season', title: 'Season', q: 'Do the cloths suit the time of year?' }
  ];
  function sectionOf(c) {
    const r = RULES[c.id];
    if (r && r.section) return r.section;
    const s = SECTIONS.find(function (x) { return x.group && x.group === c.group; });
    return s ? s.id : 'colour';
  }
  const ruleOf = function (id) { return RULES[id] || null; };
  let warned = {};
  function checkRules(checks) {            // a rule emitted without an entry is a bug: say so once
    checks.forEach(function (c) { if (!RULES[c.id] && !warned[c.id] && typeof console !== 'undefined') { warned[c.id] = true; console.warn('Valet: rule "' + c.id + '" has no entry in RULES (engine.js)'); } });
    return checks;
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

  /* Coats, gloves, hats and the buttonhole (B). Only the occasion register (the same scale every
     garment is judged on) and what a piece physically needs are checked. Etiquette that rests on no
     principle Valet can state (which leather gloves should match, how many accents to wear, when a
     flower is costume) is left out on purpose; see How it works, section 10. */
  function outerwear(o, L, K, F, C, p, add, what) {
    const occ = o.occasion || 'smart', formal = occ === 'business' || occ === 'evening';
    const occWord = { casual: 'casual', smart: 'smart casual', business: 'business', evening: 'evening' }[occ];
    if (L.coat) {
      // Against what it is worn over: the most formal of the jacket and the knit. The general rule
      // calls four steps apart a mistake (wholeChecks); a coat comes off indoors and lives in the
      // register of the street, so it gets one step more: five apart, a parka over a worsted suit.
      const under = ['jacket', 'mid'].filter(function (k) { return L[k] && F[k] != null; }).sort(function (a, b) { return F[b] - F[a]; })[0];
      if (F.coat != null && under && F[under] - F.coat >= PARAMS.coatSteps) add({ id: 'coat', group: 'formality', score: 0.65, slots: ['coat'],
        text: 'A ' + K.coat.name.toLowerCase() + ' over ' + what(under) + ': the coat is sportswear and what it covers is the most formal tailoring, five steps apart. An overcoat, a covert coat or a trench coat goes over tailoring like this.',
        fixes: [{ label: 'An overcoat instead', slot: 'coat', kind: 'overcoat' }, { label: 'Take off the coat', slot: 'coat', on: false }] });
      else if (formal && F.coat <= 1) add({ id: 'coat', group: 'formality', score: 0.65, slots: ['coat'],
        text: 'A ' + K.coat.name.toLowerCase() + ' is casual outerwear; over ' + occWord + ' dress it sits two steps below the rest. An overcoat, a covert coat or a trench coat is in the same register.',
        fixes: [{ label: 'An overcoat instead', slot: 'coat', kind: 'overcoat' }, { label: 'Take off the coat', slot: 'coat', on: false }] });
      else add({ id: 'coat', group: 'formality', score: 1, slots: [],
        text: 'Coat: a ' + K.coat.name.toLowerCase() + ', in the register of the occasion.' });
    }
    if (L.gloves && K.gloves.id === 'knit' && formal) add({ id: 'gloves', group: 'formality', score: 0.65, slots: ['gloves'],
      text: 'Knitted gloves are casual; with ' + occWord + ' dress they sit below the rest, where leather or suede gloves are in the same register.',
      fixes: [{ label: 'Leather gloves instead', slot: 'gloves', kind: 'leather' }] });
    // A hat by its type against the occasion, a step of grace either side: a homburg or bowler with
    // casual dress, a baseball cap or beanie with business or evening dress.
    if (L.hat && K.hat.f != null) {
      const r = (G.OCCASIONS.find(function (x) { return x.id === occ; }) || G.OCCASIONS[1]).range, hn = K.hat.name.toLowerCase();
      if (K.hat.f > r[1] + 1) add({ id: 'hatf', group: 'formality', score: 0.65, slots: ['hat'],
        text: 'A ' + hn + ' is a formal town hat; with ' + occWord + ' dress it is two steps above the rest. A flat cap, a trilby or no hat is in the same register.',
        fixes: [{ label: 'A trilby instead', slot: 'hat', kind: 'trilby' }, { label: 'Take off the hat', slot: 'hat', on: false }] });
      else if (K.hat.f < r[0] - 1) add({ id: 'hatf', group: 'formality', score: 0.55, slots: ['hat'],
        text: 'A ' + hn + ' is ' + (K.hat.f <= 0 ? 'sportswear' : 'casual') + '; with ' + occWord + ' dress it is two steps below the rest. Go bareheaded, or wear a fedora or a homburg.',
        fixes: [{ label: 'Take off the hat', slot: 'hat', on: false }, { label: 'A fedora instead', slot: 'hat', kind: 'fedora' }] });
    }
    // The buttonhole: a flower or pin is worn through the lapel's buttonhole, so it needs lapels.
    if (L.boutonniere) {
      const lapel = (L.jacket && K.jacket.frame === 'lapel') || (L.coat && K.coat.frame === 'lapel');
      if (!lapel) add({ id: 'bout', group: 'formality', score: 0.2, slots: ['boutonniere'],
        text: 'A ' + (K.boutonniere.id === 'pin' ? 'lapel pin' : 'flower in the lapel') + ' is worn through the lapel buttonhole, so it needs lapels: a tailored jacket, a blazer or a coat with lapels.',
        fixes: [{ label: 'Take it off', slot: 'boutonniere', on: false }] });
    }
  }

  function accessoryChecks(acc, L, K, p, add, nm, occasion, o) {
    const A = G.ACCESSORIES, M = G.metalBy, worn = A.filter(function (a) { return acc[a.key] && acc[a.key].on; });
    const ad = function (c) { c.group = 'accessory'; c.slots = c.slots || []; return add(c); };
    const glf = framesOf(o), glassMetal = glf && (glf.frame === 'gold' || glf.frame === 'silver') ? glf.frame : null;
    const cool = p.tempLevel === 'cool', warm = p.tempLevel === 'warm';   // the profile's own bands (cool under -0.35, warm over 0.35)
    worn.forEach(function (a) {
      if (a.needs === 'cuffs' && !(L.shirt && K.shirt.tieable)) ad({ id: 'acc', score: 0.2, acc: a.key,
        text: 'Cufflinks need a shirt with double cuffs; a ' + K.shirt.name.toLowerCase() + ' has none.' });
      if (a.needs === 'tie' && !(L.tie && K.tie.id === 'tie')) ad({ id: 'acc', score: 0.2, acc: a.key, text: 'A tie bar needs a tie to hold.' });
    });
    // matching: everything but the ring and the face pieces
    const match = worn.filter(function (a) { return a.key !== 'ring' && !a.face && acc[a.key].metal !== 'twotone' && acc[a.key].metal !== 'black'; });
    // metal blazer buttons are worn metal too
    const btn = o && o.jacket && K.jacket && K.jacket.buttons ? G.BUTTONS.find(function (b) { return b[0] === (o.jacket.buttons || 'silver'); }) : null;
    if (btn && btn[2]) match.push({ key: 'buttons', name: 'Blazer buttons', btn: btn[2], slot: 'jacket' });   // checked even with no watch or belt
    if (o && o.boutonniere && K.boutonniere && K.boutonniere.id === 'pin') match.push({ key: 'pin', name: 'Lapel pin', btn: o.boutonniere.metal || 'silver', slot: 'boutonniere' });
    const metalOf = function (a) { return a.btn || acc[a.key].metal; };
    const fam = function (m) { return M[m] && M[m].warm ? 'warm' : 'cool'; };
    const fams = match.map(function (a) { return fam(metalOf(a)); }).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    const desc = function (list) { return list.map(function (a) { return a.name.toLowerCase() + ' in ' + M[metalOf(a)].name.toLowerCase(); }).join(', '); };
    if (fams.length > 1) {
      // match the odd one out to the majority
      const nWarm = match.filter(function (a) { return fam(metalOf(a)) === 'warm'; }).length, keepWarm = nWarm > match.length - nWarm;
      const odd = match.filter(function (a) { return (fam(metalOf(a)) === 'warm') !== keepWarm; });
      const to = keepWarm ? 'gold' : 'silver';
      ad({ id: 'metal', score: 0.5, text: 'Mixed metals: ' + desc(match) + '. Keep one metal through the outfit; a two-tone watch is the one exception.',
        fixes: odd.map(function (a) {
          const label = 'Make the ' + a.name.toLowerCase() + ' ' + to;
          // a worn accessory, the blazer's buttons or the lapel pin: each is set where it lives
          if (a.key === 'buttons') return { label: label, slot: 'jacket', set: { buttons: to } };
          if (a.key === 'pin') return { label: label, slot: 'boutonniere', set: { metal: to, hex: M[to].hex } };
          return a.metals.indexOf(to) >= 0 ? { label: label, acc: a.key, set: { metal: to } } : null;
        }).filter(Boolean).concat(odd.some(function (a) { return a.key === 'buttons'; }) ? [{ label: 'Horn buttons, which are not metal', slot: 'jacket', set: { buttons: 'horn' } }] : []).slice(0, 2) });
    }
    else if (match.length) {
      const f = fams[0];
      if (f === 'warm' && cool) ad({ id: 'metal', score: 0.45, text: 'Warm metal (' + desc(match) + ') against cool colouring: a stray warm note. Silver, steel or gunmetal agree with you.' });
      else if (f === 'cool' && warm) ad({ id: 'metal', score: 0.7, text: 'Cool metal (' + desc(match) + ') against warm colouring. Gold agrees with you better.' });
      else ad({ id: 'metal', score: 1, text: 'Metal: ' + desc(match) + ', one metal through the outfit' + (glassMetal && fam(glassMetal) !== f ? '. Your ' + glassMetal + ' frames are judged with your face, so the rest can stay as it is.' : '.') });
    }
    if (acc.ring && acc.ring.on && match.length && fam(acc.ring.metal) !== fams[0]) ad({ id: 'metal', score: 0.95,
      text: 'The ' + M[acc.ring.metal].name.toLowerCase() + ' ring differs from the other metal. A ring worn every day is usually let stand outside the matching rule.' });
    // the earring is at the face, beside the frames
    if (acc.earring && acc.earring.on) {
      const em = acc.earring.metal;
      if (glassMetal && fam(glassMetal) !== fam(em)) ad({ id: 'metal', score: 0.7, acc: 'earring',
        text: 'The ' + M[em].name.toLowerCase() + ' earring and your ' + glassMetal + ' frames are two metals at the face, a hand apart. Match them.',
        fixes: [{ label: 'Make the earring ' + (glassMetal === 'gold' ? 'gold' : 'silver'), acc: 'earring', set: { metal: glassMetal } }] });
      else if (fam(em) === 'warm' && cool && !glassMetal) ad({ id: 'metal', score: 0.75, acc: 'earring',
        text: 'A gold earring is a warm point at the face of cool colouring. Small, but it sits beside the skin; silver or white gold agrees with you.' });
      else ad({ id: 'metal', score: 1, text: 'Earring: a single small stud in ' + M[em].name.toLowerCase() + ' is the quiet choice' + (glassMetal ? ', and it agrees with your frames.' : '.') });
    }
    sizeChecks(acc, L, K, p, ad, worn, occasion, o);
    // Formality: a stud is unremarkable in casual and evening dress; in traditional business
    // dress it is still noticed, so it is a caution there, not a fault (B).
    if (acc.earring && acc.earring.on && occasion === 'business')
      ad({ id: 'acc', score: 0.8, acc: 'earring', text: 'For business, a stud is still noticed in traditional settings such as law, banking or a formal meeting. A small plain stud (silver, up to 4 mm) is the quiet choice; for the most formal days, leave it out.',
        fixes: [{ label: 'Take it off for business', acc: 'earring', set: { on: false } }] });

    // stones: a small accent that reads best echoing a colour already worn
    const colours = [];
    Object.keys(L).forEach(function (k) { L[k].colours.forEach(function (h) { colours.push(h); }); });
    worn.filter(function (a) { return a.stone && acc[a.key].stone && acc[a.key].stone !== 'none'; }).forEach(function (a) {
      const st = G.stoneBy[acc[a.key].stone]; if (!st || !st.hex) return;
      const c = okc(st.hex);
      if (c[1] < 0.06) return;                           // onyx, pearl, diamond: neutral
      const echo = colours.some(function (h) { const q = okc(h); return q[1] >= 0.04 && hueDist(q[2], c[2]) <= 35; });
      const warmStone = scoreCached(st.hex, p).temperature > 0.4;
      if (a.face && warmStone && cool) ad({ id: 'stone', score: 0.7, acc: a.key, text: st.name + ' at the ear is a warm point beside the skin. A cool or neutral stone (onyx, sapphire, diamond) agrees with you.' });
      else ad({ id: 'stone', score: echo ? 1 : 0.9, text: st.name + ' ' + a.name.toLowerCase().replace(' (stud)', '') + (echo ? ': echoes a colour in the outfit, so the accent looks chosen.' : ': a small accent of its own. It looks more deliberate when it echoes a colour you wear (lapis with navy, garnet with a burgundy tie).') });
    });
  }

  /* Sizes of accessories. Each has a classic range with its reason. Over the range, the check
     lists what elsewhere in the outfit carries the piece (each one done lifts the score), with a
     button for each that can be done here. Far over the range nothing compensates, and the check
     says to take it off for this outfit. Ties are taken as 8 cm wide, the width of every tie in
     the Style Guide. */
  const TIE_MM = 80;
  function watchRange(wrist) {
    if (!wrist) return [36, 40];
    const r = PARAMS.watchByWrist.find(function (w) { return wrist < w[0]; }); return [r[1], r[2]];
  }
  function sizeChecks(acc, L, K, p, ad, worn, occasion, o) {
    const has = function (k) { return acc[k] && acc[k].on; };
    const tie = !!(L.tie && K.tie.id === 'tie'), facePats = G.FACE.filter(function (k) { return L[k] && L[k].visible; });
    // A check over the range: comps are { done, text, fix } and lift the score from base to at most 0.85.
    const carry = function (key, base, head, comps) {
      const done = comps.filter(function (c) { return c.done; }), todo = comps.filter(function (c) { return !c.done; });
      const score = Math.min(0.85, base + 0.3 * done.length / Math.max(1, comps.length));
      ad({ id: 'asize', score: score, acc: key,
        text: head + (done.length ? ' Already helping: ' + done.map(function (c) { return c.text; }).join('; ') + '.' : '') +
          (todo.length ? ' To carry it: ' + todo.map(function (c) { return c.text; }).join('; ') + '.' : ''),
        fixes: todo.filter(function (c) { return c.fix; }).map(function (c) { return c.fix; }) });
    };
    const out = function (key, text, fix) { ad({ id: 'asize', score: 0.3, acc: key, text: text, fixes: [fix || { label: 'Take it off', acc: key, set: { on: false } }] }); };
    const ok = function (key, text) { ad({ id: 'asize', score: 1, acc: key, text: text }); };

    if (has('watch')) {
      const mm = +acc.watch.size || 38, r = watchRange(acc.wrist), over = mm - r[1];
      const why = (acc.wrist ? 'For a ' + acc.wrist + ' cm wrist the case suits ' + r[0] + '–' + r[1] + ' mm' : 'The classic dress range is 36–40 mm') + '.';
      if (over <= 0 && mm >= r[0] - 4) ok('watch', 'Watch, ' + mm + ' mm: ' + why + ' The lugs stay inside the wrist and the case slips under a shirt cuff, which is the classic aim with tailoring.');
      else if (over <= 0) ok('watch', 'Watch, ' + mm + ' mm: small for the wrist, the size of a vintage dress watch. Quiet and correct.');
      else if (over <= PARAMS.watchOver) carry('watch', 0.55, 'Watch, ' + mm + ' mm: large. ' + why + ' A bigger case overhangs the wrist and will not go under a shirt cuff, so it shows at every gesture.', [
        { done: !has('cufflinks'), text: 'no cufflinks, so the cuff does not have to close over it', fix: { label: 'Take off the cufflinks', acc: 'cufflinks', set: { on: false } } },
        { done: !tie, text: 'an open collar: a big watch belongs to casual dress', fix: { label: 'Take off the tie', slot: 'tie', on: false } },
        { done: !!(L.jacket && !K.jacket.suit) || !!L.mid || !!L.coat, text: 'a heavier layer (overshirt, coat or knit) to match its weight' }
      ]);
      else if (tie || has('cufflinks')) out('watch', 'Watch, ' + mm + ' mm: far over ' + r[1] + ' mm. ' + why + ' With a tie or cufflinks nothing makes up for it. For this outfit, take it off or wear a smaller watch; keep this one for casual days.');
      else carry('watch', 0.45, 'Watch, ' + mm + ' mm: far over ' + r[1] + ' mm. ' + why + ' It reads as sports equipment.', [
        { done: !L.jacket || !K.jacket.suit, text: 'no tailored jacket' },
        { done: !!(L.jacket && !K.jacket.suit) || !!L.mid, text: 'a heavy casual layer beside it' }
      ]);
    }
    // The watch against the occasion: a digital display and a rubber strap are sportswear, so with
    // business or evening dress they sit below the register, as a baseball cap or a parka would.
    // Strap colour, dial colour and case finish are a matter of taste and are not judged.
    if (has('watch')) {
      const w = acc.watch, strap = G.STRAPS.find(function (x) { return x.id === (w.strap || 'leather'); }) || G.STRAPS[1];
      const formal = occasion === 'business' || occasion === 'evening', occWord = occasion === 'evening' ? 'evening' : 'business';
      const notes = [];
      if (w.display === 'digital' && formal) notes.push([0.55, 'A digital display is sportswear; with ' + occWord + ' dress it sits below the rest, where an analogue watch is in the same register.', [{ label: 'An analogue watch', acc: 'watch', set: { display: 'analogue' } }]]);
      if (strap.id === 'rubber' && formal) notes.push([0.55, 'A rubber strap is sportswear; with ' + occWord + ' dress it sits below the rest, where leather or a bracelet is in the same register.', [{ label: 'A leather strap', acc: 'watch', set: { strap: 'leather' } }]]);
      notes.forEach(function (n) { ad({ id: 'wstyle', score: n[0], acc: 'watch', text: n[1], fixes: n[2] || [] }); });
    }
    if (has('cufflinks')) {
      const mm = +acc.cufflinks.size || 15, stone = acc.cufflinks.stone || 'none';
      if (mm <= PARAMS.cufflinksMax) ok('cufflinks', 'Cufflinks, ' + mm + ' mm: the classic size (about 12–18 mm). A link this size shows a little below the jacket sleeve and does not catch every light.');
      else if (mm <= PARAMS.cufflinksFar) carry('cufflinks', 0.55, 'Cufflinks, ' + mm + ' mm: large. Past about 18 mm a link stands out from the cuff and flashes at each gesture.', [
        { done: stone === 'none' || stone === 'onyx', text: 'plain metal or a dark stone, so it does not sparkle', fix: stone !== 'none' && stone !== 'onyx' ? { label: 'Use onyx links', acc: 'cufflinks', set: { stone: 'onyx' } } : null },
        { done: !has('tiebar'), text: 'no tie bar: one piece of metal at a time on the front', fix: { label: 'Take off the tie bar', acc: 'tiebar', set: { on: false } } },
        { done: !has('watch') || (+acc.watch.size || 38) <= watchRange(acc.wrist)[1], text: 'a watch within its range, so the wrists do not compete' }
      ]);
      else out('cufflinks', 'Cufflinks, ' + mm + ' mm: costume size. Nothing else in a classic outfit balances links this large. Take them off; plain 15 mm links or silk knots are the classic pair.');
    }
    if (has('tiebar') && tie) {
      const mm = +acc.tiebar.size || 45, f = mm / TIE_MM;
      if (f <= 0.78) ok('tiebar', 'Tie bar, ' + mm + ' mm: about ' + Math.round(f * 100) + '% of an 8 cm tie. The classic proportion is about three quarters of the tie\'s width, so the bar sits inside its edges.');
      else if (f <= 1) carry('tiebar', 0.55, 'Tie bar, ' + mm + ' mm: nearly the width of an 8 cm tie, so it reads as a line drawn across it.', [
        { done: false, text: 'a wider tie (9 cm) to bring it inside the edges, if you own one' },
        { done: acc.tiebar.metal === 'gunmetal', text: 'a matte metal that keeps it quiet' }
      ]);
      else out('tiebar', 'Tie bar, ' + mm + ' mm: longer than the tie is wide, so its ends stick out past the edges. Nothing else can hide that. Not for this tie: take it off, or keep it for a wider tie.');
    }
    if (has('ring')) {
      const mm = +acc.ring.size || 12;
      if (mm <= PARAMS.ringMax) ok('ring', 'Ring, ' + mm + ' mm: a classic signet or band size (up to about 15 mm across the face).');
      else if (mm <= PARAMS.ringFar) carry('ring', 0.6, 'Ring, ' + mm + ' mm: a large face. It draws the eye to the hand.', [
        { done: !has('cufflinks'), text: 'no cufflinks, so the hand carries one piece', fix: { label: 'Take off the cufflinks', acc: 'cufflinks', set: { on: false } } },
        { done: !has('watch') || (+acc.watch.size || 38) <= watchRange(acc.wrist)[1], text: 'a watch within its range' }
      ]);
      else out('ring', 'Ring, ' + mm + ' mm: a statement ring. In a classic outfit nothing balances it; take it off for this one.');
    }
    if (has('earring')) {
      const glf = framesOf(o), gm = glf && (glf.frame === 'gold' || glf.frame === 'silver') ? glf.frame : null, mm = +acc.earring.size || 4, st = acc.earring.stone || 'none';
      const bright = st === 'diamond' || st === 'pearl' || (st === 'none' && acc.earring.metal !== 'gunmetal');
      const why = ' The pupil is 2 to 8 mm and the iris about 12 mm: a stud up to about 5 mm reads as a point of light beside the face, and the eyes stay the focus.';
      if (mm <= PARAMS.studMax) ok('earring', 'Earring, ' + mm + ' mm: a small stud, one ear.' + why);
      else if (mm <= PARAMS.studFar) carry('earring', 0.5, 'Earring, ' + mm + ' mm: large for a stud.' + why + ' Past that it competes with them.', [
        { done: !bright, text: 'a dark or matte face (onyx, gunmetal) so it does not sparkle', fix: bright ? { label: 'Swap the stone for onyx', acc: 'earring', set: { stone: 'onyx' } } : null },
        { done: !gm || (G.metalBy[acc.earring.metal] || {}).warm === (gm === 'gold'), text: 'its metal matching your frames, so the face has one metal' },
        { done: !facePats.length, text: 'no pattern at the face, so it is the only detail there', fix: facePats.length ? { label: 'Make the ' + K[facePats[0]].name.toLowerCase() + ' plain', slot: facePats[0], pat: { type: 'solid' } } : null },
        { done: !L.square, text: 'no pocket square, one bright point near the face at a time', fix: L.square ? { label: 'Take off the square', slot: 'square', on: false } : null }
      ]);
      else out('earring', 'Earring, ' + mm + ' mm: past 8 mm it is an object beside the eye rather than a point.' + why + ' No change elsewhere quiets it in a classic outfit: take it off for these outfits, or wear a stud of 5 mm or less.');
    }
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
  const SHOE_COLOURS = ['Black', 'Chocolate', 'Mid brown', 'Tobacco', 'Cognac', 'Tan', 'Oxblood', 'Burgundy', 'Navy', 'Charcoal', 'White'];
  function slotFit(slot, hex, p, name, kindId) {
    const t = scoreCached(hex, p).tier, l = VC.hexToLab(hex)[0], neutral = wardrobeNeutral(hex);   // camel or tan trousers are neutrals in menswear
    let c = 0;
    if (FACE.indexOf(slot) >= 0) c += [0, 0.15, 0.9, 1.5][t - 1];
    if (slot === 'shirt' && (!kindId || kindId === 'shirt' || kindId === 'polo' || kindId === 'tee') && l < 70) c += 0.3;
    if (slot === 'mid' && l > 85) c += 0.2;
    if (slot === 'jacket' && l > 70) c += 0.4;
    if (slot === 'jacket' && !neutral) c += 0.15;
    if (slot === 'trousers') c += (t === 4 ? 0.35 : 0) + (neutral ? 0 : 0.2) + (l > 85 ? 0.25 : 0);
    if (slot === 'shoes') c += (name && SHOE_COLOURS.indexOf(name) < 0 ? 2 : 0) + (l > 55 && name !== 'White' ? 0.6 : 0);
    // coats, gloves and hats (B): a coat is a neutral and not pale; gloves are leather colours, like
    // shoes; a hat is a neutral, a straw hat may be light
    if (slot === 'coat') c += (neutral ? 0 : 0.45) + (l > 75 ? 0.4 : 0);
    if (slot === 'gloves') c += (name && SHOE_COLOURS.concat(['Mid grey', 'Grey', 'Camel', 'Tan']).indexOf(name) < 0 ? 1.2 : 0);
    if (slot === 'hat') c += (neutral ? 0 : 0.3) + (l > 75 && kindId !== 'panama' && kindId !== 'boater' ? 0.4 : 0);
    return c;
  }

  function withPiece(o, slot, hex, name) {
    const n = Object.assign({}, o);           // keeps the occasion, accessories and study flag too
    n[slot] = Object.assign({}, o[slot], { hex: hex, name: name || hex });
    return n;
  }

  /* Colours from the library ranked for one slot, given everything else that is worn. */
  function suggest(o, p, slot, n) {
    if (!o[slot]) return [];
    const base = checkOutfit(o, p), baseBy = {};
    base.forEach(function (c) { baseBy[c.id] = Math.min(baseBy[c.id] == null ? 1 : baseBy[c.id], c.score); });
    const res = window.VDATA.colours.map(function (c) {
      const chk = checkOutfit(withPiece(o, slot, c.hex, c.name), p), by = {};
      chk.forEach(function (x) { by[x.id] = Math.min(by[x.id] == null ? 1 : by[x.id], x.score); });
      let bestGain = 0, why = null;
      Object.keys(baseBy).forEach(function (id) { const g = (by[id] == null ? 1 : by[id]) - baseBy[id]; if (g > bestGain + 0.05 && (RULES[id] && RULES[id].reason)) { bestGain = g; why = (RULES[id] && RULES[id].reason); } });
      const t = scoreCached(c.hex, p).tier;
      // the tier is shown by its tag beside the name, so the reason only says why it helps here
      const left = chk.filter(function (x) { return x.score < 0.5; }).length;
      if (!why && left) why = (wardrobeNeutral(c.hex) ? 'a neutral; ' : '') + 'as good as any here; ' + left + ' rule' + (left > 1 ? 's fail' : ' fails') + ' elsewhere in the outfit';
      else if (!why) why = wardrobeNeutral(c.hex) ? 'a neutral; keeps every rule' : 'keeps every rule';
      return { hex: c.hex, name: c.name, tier: t, cost: penalty(chk) + slotFit(slot, c.hex, p, c.name, o[slot].kind), fails: chk.filter(function (x) { return x.score < 0.5; }).length, why: why };
    });
    res.sort(function (a, b) { return a.cost - b.cost; });
    // keep the list varied: no two suggestions closer than ΔE 6
    const pick = [];
    for (let i = 0; i < res.length && pick.length < (n || 8); i++) {
      if (o[slot].hex.toLowerCase() === res[i].hex.toLowerCase()) continue;
      if (pick.every(function (q) { return VC.deltaE2000(VC.hexToLab(q.hex), VC.hexToLab(res[i].hex)) > 6; })) pick.push(res[i]);
    }
    return pick;
  }

  /* What still works in one slot, given everything else that is worn. Every library colour is
     tried in the slot and the whole outfit is checked. A colour is blamed only for what it causes:
       - a problem that every colour gets, word for word, lies between other pieces ("stuck");
       - a problem is held against a colour only if another colour would have done better on that
         rule. Doing better is measured per rule as the summed shortfall, so a second near match
         or a second weak colour at the face still counts when one is already there.
     out:  it would make a rule fail (score under 0.5)
     care: it would bend a rule (under 0.7)
     ok:   it keeps every rule as well as any colour can. */
  function fitFor(o, p, slot) {
    const problems = function (hex, name) { return checkOutfit(withPiece(o, slot, hex, name), p).filter(function (c) { return c.score < 0.7; }); };
    const key = function (c) { return c.id + '|' + c.text; };
    const sev = function (probs) { const by = {}; probs.forEach(function (c) { by[c.id] = (by[c.id] || 0) + (1 - c.score) * (c.n || 1); }); return by; };
    const cands = window.VDATA.colours.map(function (c) { const pr = problems(c.hex, c.name); return { hex: c.hex.toLowerCase(), probs: pr, sev: sev(pr) }; });
    const seen = {}, best = {};
    cands.forEach(function (c) { c.probs.forEach(function (x) { seen[key(x)] = (seen[key(x)] || 0) + 1; best[x.id] = Infinity; }); });
    Object.keys(best).forEach(function (id) { cands.forEach(function (c) { best[id] = Math.min(best[id], c.sev[id] || 0); }); });
    const common = function (x) { return seen[key(x)] === cands.length; };
    const judge = function (probs, sv) {
      const issues = probs.filter(function (c) { return !common(c) && sv[c.id] > (best[c.id] || 0) + 0.05; }).sort(function (a, b) { return a.score - b.score; });
      return { state: !issues.length ? 'ok' : issues[0].score < 0.5 ? 'out' : 'care', why: issues.length ? issues[0].text : '', id: issues.length ? issues[0].id : null };
    };
    const byHex = {}, n = { ok: 0, care: 0, out: 0 };
    cands.forEach(function (c) { const j = judge(c.probs, c.sev); byHex[c.hex] = j; n[j.state]++; });
    // What no choice here can mend: the failures left on a colour that is itself blameless
    // (or, when none is, on the colour with the least against it).
    const clean = cands.filter(function (c) { return byHex[c.hex].state === 'ok'; });
    const ref = (clean.length ? clean : cands).slice().sort(function (a, b) { return penalty(a.probs) - penalty(b.probs); })[0];
    const stuck = ref.probs.filter(function (x) { return x.score < 0.5; }).map(function (x) { return x.text; });
    return { byHex: byHex, n: n, stuck: stuck,
      judge: function (hex, name) { if (byHex[hex.toLowerCase()]) return byHex[hex.toLowerCase()]; const pr = problems(hex, name); return judge(pr, sev(pr)); } };
  }

  /* Fill the open slots, keeping the locked ones. Best improvement first: at each step, make the
     single change (any open slot, any colour) that most lowers the total cost, until none helps. */
  function totalCost(o, p) {
    return penalty(checkOutfit(o, p)) + SLOTS.reduce(function (s, k) { return s + (o[k] ? slotFit(k, o[k].hex, p, o[k].name, o[k].kind) : 0); }, 0);
  }
  function complete(o, p, locked) {
    let cur = Object.assign({}, o);
    const open = SLOTS.filter(function (k) { return cur[k] && !locked[k]; });
    for (let step = 0; step < 6; step++) {
      const now = totalCost(cur, p), nowFails = verdict(checkOutfit(cur, p)).fails;
      let best = null;
      open.forEach(function (k) {
        suggest(cur, p, k, 3).forEach(function (c) {
          const next = withPiece(cur, k, c.hex, c.name), cost = totalCost(next, p);
          // a change that adds a failing rule is never better, whatever it saves elsewhere
          if (verdict(checkOutfit(next, p)).fails > nowFails) return;
          if (cost < now - 0.05 && (!best || cost < best.cost)) best = { next: next, cost: cost };
        });
      });
      if (!best) break;
      cur = best.next;
    }
    return cur;
  }

  /* Build around one colour: the old tailors' season colour, turned to one person. Where the colour
     itself can go on you, its nearest versions that suit you at the face when it does not, the
     neutrals and colours that go with it and suit you, and what to keep apart from it. */
  function themePalette(hex, p) {
    const sc = scoreCached(hex, p), lab = VC.hexToLab(hex), ok = okc(hex), lib = window.VDATA.colours;
    const neutralTheme = ok[1] < 0.04;
    const reason = sc.rules.filter(function (r) { return r.score < 0.85; }).sort(function (a, b) { return a.score - b.score; })[0];
    const scored = lib.filter(function (c) { return c.hex.toLowerCase() !== hex.toLowerCase(); }).map(function (c) {
      const s2 = scoreCached(c.hex, p), l2 = VC.hexToLab(c.hex), o2 = okc(c.hex);
      return { name: c.name, hex: c.hex, family: c.family, tier: s2.tier, score: s2.score, dE: VC.deltaE2000(lab, l2), dL: Math.abs(lab[0] - l2[0]), C: o2[1], h: o2[2] };
    });
    // the colour's own versions that work at the face, when it does not
    const versions = sc.tier > 2 ? scored.filter(function (c) { return c.tier <= 2 && c.dE < 30 && (neutralTheme || c.C >= 0.03) && (neutralTheme || hueDist(c.h, ok[2]) <= 40); })
      .sort(function (a, b) { return a.dE - b.dE; }).slice(0, 5) : [];
    const sep = function (c) { return c.dL >= 12 && c.dE >= 7; };
    const neutrals = scored.filter(function (c) { return c.family === 'Neutral' && c.tier <= 2 && sep(c); })
      .sort(function (a, b) { return a.tier - b.tier || b.score - a.score; }).slice(0, 6);
    const partners = [];
    scored.forEach(function (c) {
      if (c.family === 'Neutral' || c.tier > 2 || !sep(c) || c.C < 0.04) return;
      if (neutralTheme) { partners.push(Object.assign({ rel: 'any colour goes with a neutral' }, c)); return; }
      const d = hueDist(c.h, ok[2]);
      if (d <= 35) partners.push(Object.assign({ rel: 'neighbour: calm' }, c));
      else if (Math.abs(d - 180) <= 30) partners.push(Object.assign({ rel: 'opposite: lively, best dark or muted' }, c));
    });
    partners.sort(function (a, b) { return a.tier - b.tier || b.score - a.score; });
    const avoid = [];
    scored.forEach(function (c) {
      if (c.dE >= PARAMS.nearFrom && c.dE < PARAMS.nearTo) avoid.push(Object.assign({ why: 'almost the same colour: reads as a failed match' }, c));
      else if (!neutralTheme && c.C >= 0.08 && ok[1] >= 0.08 && hueDist(c.h, ok[2]) >= 60 && hueDist(c.h, ok[2]) <= 150) avoid.push(Object.assign({ why: 'competes: neither neighbour nor opposite' }, c));
    });
    avoid.sort(function (a, b) { return a.dE - b.dE; });
    const where = sc.tier === 1 ? { place: 'face', title: 'Suits you anywhere, at the face too', text: 'Build the outfit around it: a shirt, knit, tie or jacket in this colour, with the neutrals below.' }
      : sc.tier === 2 ? { place: 'face', title: 'Works at the face as the one deliberate colour', text: 'Wear it near the face as the outfit\'s single colour, and keep everything else neutral.' }
        : sc.tier === 3 ? { place: 'below', title: 'Not at your face: wear it below the belt', text: 'Trousers, shoes, a belt or a bag, with your neutrals and colours near the face.' + (versions.length ? ' Near the face, choose one of its versions that suit you.' : '') }
          : { place: 'below', title: 'Does not work for you near the face, and is loud anywhere', text: 'At most a small accent far from the face (socks, a bag), and only if you love it.' + (versions.length ? ' Better: one of its versions that does suit you.' : ' Choose another theme colour.') };
    return { hex: hex, tier: sc.tier, score: sc.score, neutral: neutralTheme, reason: reason ? reason.text : null, where: where,
      versions: versions, neutrals: neutrals, partners: partners.slice(0, 8), avoid: avoid.slice(0, 6) };
  }

  /* The study set up around a theme colour: the theme where it can go, and the neutral for the
     other place (and, with the theme below the belt, an accent) chosen together so that the three
     break as few rules as possible. Taking the first neutral and the first accent on their own can
     pair two colours that fail together (taupe beside moss: too close in lightness). */
  function themeStudy(hex, p, t) {
    t = t || themePalette(hex, p);
    const face = t.where.place === 'face';
    const piece = function (h, kind) { return h ? { hex: h, name: h, kind: kind, pat: { type: 'solid' } } : null; };
    const others = t.neutrals.length ? t.neutrals : [null];
    const accents = face ? [null] : [null].concat(t.partners.slice(0, 8));
    let best = null;
    others.forEach(function (n) {
      accents.forEach(function (acc) {
        const o = { study: true, shirt: piece(face ? hex : n && n.hex, 'shirt'), scarf: piece(acc && acc.hex, 'scarf'), trousers: piece(face ? n && n.hex : hex, 'trousers') };
        const checks = checkOutfit(o, p), v = verdict(checks);
        // fewest failures first, then the lowest penalty; an accent is worth a little, as the point
        // of a theme below the belt is to show what to wear with it
        const cost = v.fails * 10 + penalty(checks) - (acc ? 0.15 : 0);
        if (!best || cost < best.cost) best = { cost: cost, fails: v.fails, other: n, accent: acc };
      });
    });
    return { place: t.where.place, theme: hex, other: best && best.other ? best.other.hex : null, accent: best && best.accent ? best.accent.hex : null, fails: best ? best.fails : 0 };
  }

  /* Keep one piece and make the rest work around it. First every other open piece gets its best
     colour (complete); then layers are tried: putting on an outer layer, a knit or a collared
     shirt, or taking off an optional piece, kept only when it lowers the cost. What still fails
     on the kept piece afterwards is something no change elsewhere can mend: the piece is not for
     this outfit, or, when the failure is its colour at the face, not for you at the face. */
  function rescue(o, p, keep, locked) {
    const lock = Object.assign({}, locked || {}); lock[keep] = true;
    const copy = function (x) { const n = {}; Object.keys(x).forEach(function (k) { n[k] = x[k]; }); return n; };
    let cur = complete(copy(o), p, lock);
    const tries = [];
    const addLayer = function (slot, kind) {
      if (cur[slot] || lock[slot]) return;
      const seed = copy(cur); seed[slot] = { hex: '#1d2a44', name: 'Navy', kind: kind, pat: { type: 'solid' } };
      suggest(seed, p, slot, 3).concat([{ hex: '#1d2a44', name: 'Navy' }, { hex: '#f7f6f2', name: 'White' }]).forEach(function (c) {
        const t = copy(seed); t[slot] = Object.assign({}, seed[slot], { hex: c.hex, name: c.name }); tries.push(t);
      });
    };
    for (let round = 0; round < 2; round++) {
      tries.length = 0;
      addLayer('jacket', 'jacket'); addLayer('mid', 'crew');
      if (cur.shirt && !lock.shirt && !(G.kind('shirt', cur.shirt).collar)) {
        suggest(cur, p, 'shirt', 3).forEach(function (c) { const t = copy(cur); t.shirt = Object.assign({}, cur.shirt, { kind: 'shirt', hex: c.hex, name: c.name, pat: { type: 'solid' } }); tries.push(t); });
      }
      G.POSITIONS.forEach(function (pos) { if (pos.optional && cur[pos.key] && !lock[pos.key]) { const t = copy(cur); t[pos.key] = null; tries.push(t); } });
      const now = totalCost(cur, p);
      let best = null;
      tries.forEach(function (t) { const c = totalCost(t, p); if (c < now - 0.1 && (!best || c < best.c)) best = { t: t, c: c }; });
      if (!best) break;
      cur = complete(best.t, p, lock);
    }
    const checks = checkOutfit(cur, p);
    const left = checks.filter(function (c) { return c.score < 0.5 && (c.slots || []).indexOf(keep) >= 0; });
    const atFace = left.some(function (c) { return c.id === 'face'; });
    return { outfit: cur, left: left, atFace: atFace, ok: !left.length, verdict: verdict(checks) };
  }

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
        .sort(function (a, b) { return (a.tier > 2) - (b.tier > 2) || a.d - b.d; }).slice(0, 2);
      list.forEach(function (c) { out.push({ name: c.name, hex: c.hex, tier: c.tier, of: f[1] }); });
    });
    return out;
  }

  window.VENGINE = {
    analyseProfile: analyseProfile, bodyRatios: bodyRatios, scoreColour: scoreColour,
    RULES: RULES, PARAMS: PARAMS, ruleOf: ruleOf, kindOf: kindOf, checkOutfit: checkOutfit, verdict: verdict, penalty: penalty, suggest: suggest, complete: complete, rescue: rescue, themePalette: themePalette, themeStudy: themeStudy, SECTIONS: SECTIONS, sectionOf: sectionOf, watchRange: watchRange, summary: summary, look: look, SLOTS: SLOTS, FACE: FACE, TIER_TEXT: TIER_TEXT, corrected: corrected, HAIR: HAIR,
    echoes: echoes, hairShown: hairShown, frameWeight: frameWeight, frameTemp: frameTemp, framesOf: framesOf, skinClashes: skinClashes, skinReasons: skinReasons, fitFor: fitFor, seasonProfile: seasonProfile, TAN: TAN
  };
})();
