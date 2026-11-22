/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the rule registry: every named threshold (PARAMS) and every rule the checks can emit
   (RULES), with the Outfit Check card's sections. Data only; the checks that use them are in
   js/engine.js, and tests/rules.js and tests/boundaries.js check that the two agree. window.VRULES. */
(function () {
  'use strict';
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
    whiteC: 0.02, whiteAboveL: 5, whiteMergeFloor: 0.6,  // B §5  a white (OKLCH chroma under 0.02, 5 L* or more above the skin) is at worst tier 2 for separation, never failed
    chromaExcess: 35,                              // B §7  C* above your own colouring that arrives before you
    tier1Score: 0.8, tier1Floor: 0.7,              // B §8  tier 1: score, and weakest rule
    tier2Score: 0.62, tier2Floor: 0.45,            // B §8  tier 2
    nearFrom: 1.5, nearTo: 7,                      // A/B §10  ΔE2000: a match below 1.5, a near miss up to 7 (leather shoes are not compared with the trousers)
    stepNear: 0.8,                                 // B §10  a light-dark step at the face short of the lower bound but within 80% of it is a note, not a failure
    halvesL: 12,                                   // B §9–10  L* between top and bottom, or any pair, so they do not blur
    tieL: 12,                                      // B §10  L* between tie and shirt
    sockDeepL: 40, sockDeepC: 0.12,                // B §10  a deep sock colour: L* under 40, OKLCH chroma 0.12 at most
    sockFamilyHue: 35, sockLoudC: 0.2,             // B §10  socks in the trousers' colour family: hue within 35°; electric or neon from OKLCH chroma 0.2 (royal blue, 0.16, is strong but not electric); neutral below 0.025
    columnL: 15,                                   // A/B §13  a tonal column: main pieces within 15 L*
    formalWide: 3, formalMistake: 4,               // B §10  formality steps apart: a wide mix, and a mistake
    coatSteps: 5,                                  // B §10  a coat this far below what it covers
    neutralSnapDE: 6,                              // B §10  a colour this close to a library colour is that colour (a picker step, a photo's drift)
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

  /* ---------- The rules, one entry each ----------
     Every rule the checks can emit has one entry here, and only here: what it is called in a verdict
     ("Fails on …"), how much it weighs when outfits are compared, what a suggested colour is said to do
     when it mends the rule (null: a colour cannot change it, as with a watch's size), and the section of
     the Outfit Check card it belongs to (otherwise its group decides), and its kind:
       perceptual  the eye's response, measured (badge A or A/B in How it works): graded. The kind
                   follows what is measured; a B note on its threshold in PARAMS (face, step) says only
                   where the number comes from, which is what the A/B badge means, not a contradiction;
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
    socks: { name: 'the socks', weight: 0.6, reason: 'takes the trousers\' colour family', section: 'feet', kind: 'convention', how: 'r-socks' },
    denimtie: { name: 'neckwear with jeans', weight: 1, reason: null, section: 'formality', kind: 'convention', how: 'r-formality' },
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
    { id: 'pattern', title: '5. Pattern', q: 'Two patterns at most near the face, at different scales, with one plain layer?', group: 'pattern' },
    { id: 'metal', title: '6. Metal and accessories', q: 'One metal, accessories of the right size?', group: 'accessory' },
    { id: 'feet', title: 'Feet', q: 'Shoes the trousers\' depth or darker, socks taken from the trousers?' },
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

  window.VRULES = { PARAMS: PARAMS, RULES: RULES, SECTIONS: SECTIONS, sectionOf: sectionOf, ruleOf: ruleOf, checkRules: checkRules };
})();
