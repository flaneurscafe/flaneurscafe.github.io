/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — what can be worn where. The outfit is a set of positions, each holding one garment
   type. The types and everything attached to them come from the Style Guide (sections 4 to 7):
   whether a garment frames the face, which patterns are used on it, and the largest pattern
   scale that suits it. Shared by the rules (engine.js), the outfit editor (ui/dresser.js), the
   Palette tab and the chart. Loads without a DOM. Storage keys are kept from earlier versions:
   'shirt' is the layer next to the neck and 'jacket' the outer layer.

   frame: what it gives the face. 'collar' (a collar that stands), 'neck' (a roll neck), 'lapel'
          (lapels or a coat collar), 'shawl' (a shawl collar), 'scarf', or null (nothing: a tee or
          a crew neck alone). Outfit Check, question 3: name the thing that frames the face.
   pats:  the patterns the guide uses on it (ids from patterns.js).
   maxScale: the largest pattern scale class that is usual on it; one class above is a bold move,
          two above is wrong. */
(function () {
  'use strict';
  const SOLID_ONLY = ['solid'];
  const POSITIONS = [
    // Headwear sits against the face, and on a bald head against the scalp, so it is scored at the
    // face like a collar. It adds a dark line above the face (Style Guide, section 1) but does not
    // frame it: the frame is at the neck. Warm donegal and herringbone caps belong to the warm theme.
    { key: 'hat', label: 'Headwear', face: true, optional: true, kinds: [
      { id: 'flatcap', name: 'Flat cap', f: 2, cloths: ['tweed', 'flannel', 'linen', 'cotton'], pats: ['solid', 'herringbone', 'houndstooth', 'glen'], maxScale: 'small' },
      { id: 'beanie', name: 'Beanie', f: 1, cloths: ['lambswool', 'merino', 'cashmere'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'cap', name: 'Baseball cap', f: 0, cloths: ['cotton', 'tweed', 'nylonmatte'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'trilby', name: 'Trilby', brim: true, f: 3, cloths: ['felt', 'tweed', 'straw'], pats: ['solid', 'herringbone', 'houndstooth'], maxScale: 'small' },
      { id: 'fedora', name: 'Fedora', brim: true, f: 4, cloths: ['felt', 'straw'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'homburg', name: 'Homburg', brim: true, f: 5, cloths: ['felt'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'bowler', name: 'Bowler', brim: true, f: 5, cloths: ['felt'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'panama', name: 'Panama', brim: true, f: 3, cloths: ['straw'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'boater', name: 'Boater', brim: true, f: 3, cloths: ['straw'], pats: SOLID_ONLY, maxScale: 'small' }
    ] },
    { key: 'shirt', label: 'Next to the neck', face: true, optional: false, kinds: [
      // tieable: a dress shirt's collar band and full button front, cut to take a tie, a waistcoat and double cuffs;
      // a polo's soft collar frames the face but is not cut for them
      { id: 'shirt', name: 'Shirt', frame: 'collar', collar: true, tieable: true, f: 5, cloths: ['oxford', 'poplin', 'shirttwill', 'linen', 'brushed', 'chambray', 'cflannel', 'satinshirt'], pats: ['solid', 'pinstripe', 'bengal', 'candy', 'gingham', 'tattersall'], maxScale: 'small' },
      { id: 'rollneck', name: 'Roll neck', frame: 'neck', f: 4, cloths: ['merino', 'cashmere', 'lambswool', 'cottonknit'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'knitpolo', name: 'Knitted polo', frame: 'collar', f: 3, cloths: ['merino', 'cottonknit', 'cashmere'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'polo', name: 'Polo shirt', frame: 'collar', f: 2, cloths: ['pique', 'jersey'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'tee', name: 'T-shirt', frame: null, f: 1, cloths: ['jersey', 'linen'], pats: ['solid', 'breton'], maxScale: 'small' }
    ] },
    { key: 'tie', label: 'Neckwear', face: true, optional: true, kinds: [
      { id: 'tie', name: 'Tie', needsCollar: true, knotted: true, f: 5, cloths: ['grenadine', 'silktwill', 'repsilk', 'knitsilk', 'woolchallis', 'linen', 'satin'], pats: ['solid', 'repp', 'pindot', 'foulard', 'paisley', 'houndstooth'], maxScale: 'small' },
      { id: 'bowtie', name: 'Bow tie', needsCollar: true, knotted: true, f: 5, cloths: ['silktwill', 'grenadine', 'woolchallis', 'satin'], pats: ['solid', 'pindot', 'foulard', 'paisley', 'houndstooth'], maxScale: 'small' },
      // a day cravat (ascot), worn inside an open shirt collar in place of a tie
      { id: 'cravat', name: 'Cravat (ascot)', needsCollar: true, knotted: true, f: 3, cloths: ['silktwill', 'woolchallis', 'cashmere'], pats: ['solid', 'paisley', 'foulard', 'pindot'], maxScale: 'small' }
    ] },
    // The scarf is its own position, worn over everything (listed beside the neckwear: the order of
    // POSITIONS is head to feet, inside to outside at the same height) (a coat, a jacket, a knit), so it can go
    // with a tie or cravat at the collar. It frames the face and needs no collar of its own.
    { key: 'scarf', label: 'Scarf', face: true, optional: true, kinds: [
      { id: 'scarf', name: 'Scarf', frame: 'scarf', f: null, cloths: ['cashmere', 'lambswool', 'silktwill', 'linen'], pats: ['solid', 'paisley', 'herringbone', 'houndstooth'], maxScale: 'medium' }
    ] },
    { key: 'mid', label: 'Mid layer', face: true, optional: true, kinds: [
      { id: 'crew', name: 'Crew-neck knit', frame: null, f: 3, cloths: ['merino', 'lambswool', 'cashmere', 'cottonknit', 'chunky'], pats: ['solid', 'breton'], maxScale: 'small' },
      { id: 'vneck', name: 'V-neck knit', frame: null, needsCollarUnder: true, f: 4, cloths: ['merino', 'lambswool', 'cashmere', 'cottonknit'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'cardigan', name: 'Cardigan', frame: null, f: 3, cloths: ['merino', 'lambswool', 'cashmere', 'chunky'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'shawl', name: 'Shawl-collar cardigan', frame: 'shawl', f: 2, cloths: ['lambswool', 'chunky', 'cashmere'], pats: SOLID_ONLY, maxScale: 'small' },
      // A waistcoat: tailored, open in a V like a V-neck, so it wants a collar under it; worn with
      // the suit as the third piece or on its own as an odd waistcoat. Its points cover the waistband.
      { id: 'waistcoat', name: 'Waistcoat', frame: null, needsCollarUnder: true, vest: true, f: 4, cloths: ['worsted', 'flannel', 'tweed', 'linen', 'cotton', 'corduroy', 'moleskin', 'merino'], pats: ['solid', 'nailhead', 'birdseye', 'herringbone', 'pinstripe', 'chalkstripe', 'houndstooth', 'glen', 'windowpane', 'tattersall'], maxScale: 'medium' }
    ] },
    // Jackets. A blazer is a jacket worn without its trousers, with metal or contrasting buttons
    // (buttons: metal buttons join the metals of the outfit, judged with the watch and buckle by the
    // one-metal rule). The casual jackets frame the face with a collar, not lapels.
    { key: 'jacket', label: 'Jacket', face: true, optional: true, kinds: [
      { id: 'jacket', name: 'Jacket', frame: 'lapel', suit: true, pocket: true, f: 5, cloths: ['hopsack', 'worsted', 'flannel', 'tweed', 'linen', 'fresco', 'seersucker', 'cotton', 'corduroy', 'lustre'], pats: ['solid', 'nailhead', 'birdseye', 'herringbone', 'pinstripe', 'chalkstripe', 'candy', 'houndstooth', 'glen', 'windowpane'], maxScale: 'medium' },
      { id: 'blazer', name: 'Blazer', frame: 'lapel', pocket: true, buttons: true, f: 4, cloths: ['hopsack', 'worsted', 'flannel', 'fresco', 'linen'], pats: ['solid', 'candy'], maxScale: 'medium' },
      { id: 'overshirt', name: 'Overshirt', frame: 'collar', f: 2, cloths: ['flannel', 'corduroy', 'cotton', 'denim', 'linen', 'moleskin'], pats: ['solid', 'herringbone', 'houndstooth', 'glen', 'gingham', 'windowpane'], maxScale: 'medium' },
      { id: 'waxed', name: 'Waxed jacket', frame: 'collar', f: 1, cloths: ['waxed'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'field', name: 'Field jacket', frame: 'collar', f: 1, cloths: ['cotton', 'gabardine', 'waxed'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'harrington', name: 'Harrington jacket', frame: 'collar', f: 1, cloths: ['cotton', 'gabardine'], pats: SOLID_ONLY, maxScale: 'small' }
    ] },
    // Coats: their own layer, over a jacket or a knit. Outerwear is judged by its colour at the face
    // and its weight; its formality is the register of the street, so it is checked only where a coat
    // is far from the occasion.
    { key: 'coat', label: 'Coat', face: true, optional: true, kinds: [
      { id: 'overcoat', name: 'Overcoat', frame: 'lapel', outer: true, pocket: true, f: 4, cloths: ['melton', 'cashmere', 'tweed', 'leather'], pats: ['solid', 'herringbone', 'houndstooth', 'glen', 'windowpane'], maxScale: 'large' },
      { id: 'chesterfield', name: 'Chesterfield', frame: 'lapel', outer: true, pocket: true, f: 5, cloths: ['melton', 'cashmere'], pats: ['solid', 'herringbone'], maxScale: 'medium' },
      { id: 'covert', name: 'Covert coat', frame: 'lapel', outer: true, pocket: true, f: 4, cloths: ['covert'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'trench', name: 'Trench coat', frame: 'lapel', outer: true, f: 3, cloths: ['gabardine'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'peacoat', name: 'Peacoat', frame: 'lapel', outer: true, f: 2, cloths: ['melton'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'duffle', name: 'Duffle coat', frame: 'collar', outer: true, f: 1, cloths: ['duffel'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'parka', name: 'Parka', frame: 'collar', outer: true, f: 0, cloths: ['nylonmatte', 'nylongloss', 'cotton'], pats: SOLID_ONLY, maxScale: 'small' }
    ] },
    { key: 'square', label: 'Pocket square', face: false, near: true, optional: true, needsPocket: true, kinds: [
      { id: 'square', name: 'Pocket square', f: null, cloths: ['linen', 'silktwill', 'woolchallis'], pats: ['solid', 'pindot', 'foulard', 'paisley', 'houndstooth'], maxScale: 'medium' }
    ] },
    // The lapel buttonhole (B): a single fresh flower, a fabric flower, or a metal lapel pin, worn in the
    // left lapel's buttonhole of a jacket, blazer or coat with lapels. Near the face, so its colour is
    // judged like the pocket square's; a pin is worn metal.
    { key: 'boutonniere', label: 'Buttonhole', face: false, near: true, optional: true, needsLapel: true, kinds: [
      // Three things go through the buttonhole, and each has one thing to set: a fresh flower its
      // colour only (it has no cloth); a fabric flower its colour and cloth (silk shines a little,
      // linen is summer cloth, so the sheen and season rules reach it); a pin its metal.
      { id: 'flower', name: 'Fresh flower', f: null, pats: SOLID_ONLY, maxScale: 'small',
        note: 'A real flower (a boutonnière): only its colour is chosen. It has no cloth, so there is nothing else to set.' },
      { id: 'fabric', name: 'Fabric flower', f: null, cloths: ['silktwill', 'knitsilk', 'linen'], pats: SOLID_ONLY, maxScale: 'small',
        note: 'A flower made of silk or linen, which keeps: its colour and its cloth are chosen, and the cloth brings the sheen and season rules with it, as on a tie.' },
      { id: 'pin', name: 'Lapel pin', f: null, metal: true, pats: SOLID_ONLY, maxScale: 'small',
        note: 'Worn metal, so only its metal is chosen, below.' }
    ] },
    { key: 'trousers', label: 'Trousers', face: false, optional: false, kinds: [
      { id: 'trousers', name: 'Trousers', f: 5, cloths: ['flannel', 'worsted', 'tweed', 'fresco', 'cotton', 'linen', 'corduroy', 'moleskin', 'denim', 'seersucker', 'lustre'], pats: ['solid', 'nailhead', 'birdseye', 'herringbone', 'pinstripe', 'chalkstripe', 'candy', 'houndstooth', 'glen', 'windowpane'], maxScale: 'medium' }
    ] },
    { key: 'socks', label: 'Socks', face: false, optional: true, kinds: [
      { id: 'socks', name: 'Socks', f: null, pats: ['solid', 'birdseye', 'pindot', 'breton', 'herringbone'], maxScale: 'small' }
    ] },
    { key: 'shoes', label: 'Shoes and belt', face: false, optional: false, kinds: [
      { id: 'oxford', name: 'Oxford', f: 5, cloths: ['calf', 'suede', 'patent'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'monk', name: 'Monk strap', f: 4, cloths: ['calf', 'suede'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'derby', name: 'Derby or brogue', f: 4, cloths: ['calf', 'suede'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'loafer', name: 'Loafer', f: 4, cloths: ['calf', 'suede'], pats: SOLID_ONLY, maxScale: 'small' },
      // Spectators (co-respondents): a brogue whose toe cap, heel and lace panel are in a second
      // colour, read at a distance as the mix of the two (engine.js, look). A brogue's formality step.
      // The old saying that they are a summer shoe is etiquette, not cloth weight, so it is not used.
      { id: 'spectator', name: 'Spectator (two-tone)', twoTone: true, f: 3, cloths: ['calf', 'suede'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'chelsea', name: 'Chelsea boot', f: 3, cloths: ['calf', 'suede'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'chukka', name: 'Chukka or desert boot', f: 2, cloths: ['suede', 'calf'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'trainer', name: 'Minimal trainer', f: 1, cloths: ['calf', 'suede', 'canvas'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'chunky', name: 'Chunky or technical trainer', f: 0, cloths: ['canvas', 'calf'], pats: SOLID_ONLY, maxScale: 'small' }
    ] },
    // Gloves: in the hand, away from the face. They follow the shoes or the coat (B).
    { key: 'gloves', label: 'Gloves', face: false, optional: true, kinds: [
      { id: 'leather', name: 'Leather gloves', f: 4, cloths: ['gloveleather'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'suede', name: 'Suede gloves', f: 3, cloths: ['suede'], pats: SOLID_ONLY, maxScale: 'small' },
      { id: 'knit', name: 'Knitted gloves', f: 1, cloths: ['lambswool', 'merino', 'cashmere'], pats: SOLID_ONLY, maxScale: 'small' }
    ] }
  ];
  /* Cloths (Style Guide sections 4 to 6). f: how formal, 1 casual to 5 business; a garment is as
     formal as the lower of its type and its cloth (tweed makes a jacket country, not business).
     season: 'summer', 'winter' or 'all'. sheen: 0 matte, 1 a soft sheen, 2 shiny (Outfit Check,
     question 4: anything glossy near the face fails). */
  const CLOTHS = {
    worsted: { name: 'Worsted wool', f: 5, season: 'all', sheen: 1 },
    lustre: { name: 'Lustrous worsted (shiny)', f: 4, season: 'all', sheen: 2 },
    flannel: { name: 'Flannel', f: 4, season: 'winter', sheen: 0 },
    fresco: { name: 'High-twist wool (fresco)', f: 4, season: 'summer', sheen: 0 },
    hopsack: { name: 'Hopsack', f: 4, season: 'all', sheen: 0 },
    tweed: { name: 'Tweed', f: 2, season: 'winter', sheen: 0 },
    linen: { name: 'Linen', f: 2, season: 'summer', sheen: 0 },
    seersucker: { name: 'Seersucker', f: 2, season: 'summer', sheen: 0 },
    cotton: { name: 'Cotton twill (chino)', f: 2, season: 'all', sheen: 0 },
    corduroy: { name: 'Corduroy', f: 2, season: 'winter', sheen: 0 },
    moleskin: { name: 'Moleskin', f: 2, season: 'winter', sheen: 0 },
    denim: { name: 'Denim', f: 2, season: 'all', sheen: 0 },          // dark jeans under a blazer are the smart-casual staple: relaxed, not sportswear
    poplin: { name: 'Poplin', f: 5, season: 'all', sheen: 0 },
    shirttwill: { name: 'Twill shirting', f: 5, season: 'all', sheen: 1 },
    oxford: { name: 'Oxford cloth', f: 3, season: 'all', sheen: 0 },
    brushed: { name: 'Brushed cotton', f: 2, season: 'winter', sheen: 0 },
    chambray: { name: 'Chambray', f: 2, season: 'all', sheen: 0 },
    cflannel: { name: 'Cotton flannel', f: 1, season: 'winter', sheen: 0 },
    satinshirt: { name: 'Sateen (shiny)', f: 3, season: 'all', sheen: 2 },
    pique: { name: 'Piqué', f: 2, season: 'summer', sheen: 0 },
    jersey: { name: 'Cotton jersey', f: 1, season: 'all', sheen: 0 },
    merino: { name: 'Fine merino', f: 4, season: 'all', sheen: 0 },
    cashmere: { name: 'Cashmere', f: 4, season: 'winter', sheen: 0 },
    lambswool: { name: 'Lambswool', f: 3, season: 'winter', sheen: 0 },
    cottonknit: { name: 'Cotton knit', f: 2, season: 'summer', sheen: 0 },
    chunky: { name: 'Chunky cable knit', f: 1, season: 'winter', sheen: 0 },
    grenadine: { name: 'Grenadine', f: 5, season: 'all', sheen: 0 },
    silktwill: { name: 'Silk twill', f: 5, season: 'all', sheen: 1 },
    satin: { name: 'Silk satin (shiny)', f: 5, season: 'all', sheen: 2 },
    knitsilk: { name: 'Knitted silk', f: 4, season: 'all', sheen: 0 },
    repsilk: { name: 'Silk repp', f: 5, season: 'all', sheen: 1 },
    woolchallis: { name: 'Wool', f: 4, season: 'winter', sheen: 0 },
    melton: { name: 'Melton or overcoat wool', f: 4, season: 'winter', sheen: 0 },
    covert: { name: 'Covert cloth', f: 4, season: 'all', sheen: 0 },
    duffel: { name: 'Duffel wool', f: 1, season: 'winter', sheen: 0 },
    gloveleather: { name: 'Glove leather (lambskin, deerskin or peccary)', f: 4, season: 'winter', sheen: 1, leather: true },
    gabardine: { name: 'Gabardine', f: 3, season: 'all', sheen: 0 },
    waxed: { name: 'Waxed cotton', f: 1, season: 'all', sheen: 1 },
    leather: { name: 'Leather, matte finish', f: 2, season: 'all', sheen: 0, leather: true },
    nylonmatte: { name: 'Technical shell, matte', f: 1, season: 'all', sheen: 0 },
    nylongloss: { name: 'Glossy nylon or down (shiny)', f: 1, season: 'winter', sheen: 2 },
    felt: { name: 'Felt', f: 4, season: 'winter', sheen: 0 },
    straw: { name: 'Straw', f: 3, season: 'summer', sheen: 0 },
    calf: { name: 'Calf leather', f: 5, season: 'all', sheen: 1, leather: true },
    suede: { name: 'Suede', f: 4, season: 'all', sheen: 0, leather: true },
    patent: { name: 'Patent leather (shiny)', f: 5, season: 'all', sheen: 2, leather: true },
    canvas: { name: 'Canvas', f: 1, season: 'summer', sheen: 0 }
  };
  Object.keys(CLOTHS).forEach(function (id) { CLOTHS[id].id = id; });
  /* The cloth of a piece: its own if the type uses it, else the type's first (its usual cloth). */
  /* Which patterns each cloth can carry (B: how the cloth is made, after the cloth books and
     merchants' bunches). A weave pattern such as herringbone, birdseye or nailhead is the cloth's own
     structure, so it exists only in woven wool (and, for a few, in tweed, linen or silk); a pile cloth
     (corduroy, moleskin) or denim carries none, because its ribs or twill already are its surface;
     shirting stripes and checks belong to cotton and linen shirtings; seersucker is itself a puckered
     stripe or check; printed figures (pin dot, foulard, paisley) are silk or wool challis; the
     regimental (repp) stripe is woven in silk repp. A cloth missing from this table carries any
     pattern its garment allows. Plain is always possible. */
  const CLOTH_PATS = {
    worsted: ['nailhead', 'birdseye', 'herringbone', 'pinstripe', 'chalkstripe', 'houndstooth', 'glen', 'windowpane', 'tattersall'],
    lustre: ['pinstripe'],
    flannel: ['herringbone', 'chalkstripe', 'houndstooth', 'glen', 'windowpane', 'tattersall'],
    fresco: ['pinstripe', 'glen', 'windowpane'],
    hopsack: ['windowpane'],
    tweed: ['herringbone', 'birdseye', 'houndstooth', 'glen', 'windowpane', 'tattersall'],
    linen: ['herringbone', 'windowpane', 'pinstripe', 'bengal', 'candy', 'gingham', 'glen'],
    seersucker: ['candy', 'bengal', 'gingham'],
    cotton: [], corduroy: [], moleskin: [], denim: [],
    poplin: ['pinstripe', 'bengal', 'candy', 'gingham', 'tattersall'],
    shirttwill: ['pinstripe', 'bengal', 'candy', 'tattersall'],
    oxford: ['bengal', 'candy'],
    brushed: ['gingham', 'tattersall'],
    chambray: [], satinshirt: [],
    cflannel: ['gingham', 'tattersall'],
    pique: [], jersey: ['breton'],
    merino: ['breton'], cottonknit: ['breton'], chunky: [],
    cashmere: ['breton', 'herringbone', 'houndstooth', 'paisley'],
    lambswool: ['breton', 'herringbone', 'houndstooth'],
    grenadine: [], satin: [], knitsilk: [],
    silktwill: ['pindot', 'foulard', 'paisley', 'houndstooth'],
    woolchallis: ['paisley', 'foulard', 'pindot', 'houndstooth'],
    repsilk: ['repp'],
    melton: [], covert: [], duffel: [], gloveleather: [], gabardine: [], waxed: [], leather: [], nylonmatte: [], nylongloss: [],
    felt: [], straw: [], calf: [], suede: [], patent: [], canvas: []
  };
  function patOK(clothId, patType) {
    if (!patType || patType === 'solid') return true;
    const l = CLOTH_PATS[clothId];
    return !l || l.indexOf(patType) >= 0;
  }

  function cloth(slot, piece) {
    const k = kind(slot, piece); if (!k || !k.cloths) return null;
    const id = piece && piece.cloth && k.cloths.indexOf(piece.cloth) >= 0 ? piece.cloth : k.cloths[0];
    return CLOTHS[id];
  }
  /* How formal a piece is: the lower of its type and its cloth; null for pieces that do not set the
     register (scarf, socks, pocket square). */
  function formality(slot, piece) {
    const k = kind(slot, piece); if (!k || k.f == null) return null;
    const c = cloth(slot, piece);
    return c ? Math.min(k.f, c.f) : k.f;
  }
  /* Brimmed hats: brim widths (cm at the side) and band colours offered first. */
  const BRIMS = [{ id: 'narrow', name: 'Narrow', cm: 'under 5 cm' }, { id: 'medium', name: 'Medium', cm: '5 to 6.5 cm' }, { id: 'wide', name: 'Wide', cm: 'over 6.5 cm' }];
  const BANDS = ['#161616', '#1d2a44', '#3d4045', '#5e1f2c', '#4a3326', '#8e9196', '#f7f6f2'];
  const OCCASIONS = [
    { id: 'casual', name: 'Casual', range: [1, 3], note: 'weekends and errands: tees, chinos, denim, knits, trainers' },
    { id: 'smart', name: 'Smart casual', range: [2, 4], note: 'a jacket without a tie, or a good knit; loafers, derbies, boots' },
    { id: 'business', name: 'Business', range: [4, 5], note: 'a suit or tailored jacket, shirt, usually a tie; leather shoes' },
    { id: 'evening', name: 'Evening', range: [3, 5], note: 'dinner or an event: dark, polished, a sharper finish' }
  ];

  const SLOTS = POSITIONS.map(function (p) { return p.key; });
  const FACE = POSITIONS.filter(function (p) { return p.face; }).map(function (p) { return p.key; });
  const byKey = {}; POSITIONS.forEach(function (p) { byKey[p.key] = p; });
  // Near the face: the face layers plus the pocket square, judged by tier and temperature.
  const NEAR = POSITIONS.filter(function (p) { return p.face || p.near; }).map(function (p) { return p.key; });

  /* Accessories: small metal pieces, some with a stone. They are judged on metal (Outfit Check,
     question 6: one metal, a two-tone watch the only exception), on what they need to be worn
     with, and, for a stone, as a small accent colour. Glasses frames are set with the face on
     the You tab and judged there; an earring is at the face too, so it is compared with them. */
  const METALS = [
    { id: 'silver', name: 'Silver or steel', warm: false, hex: '#b9bcc0' },
    { id: 'white', name: 'White gold or platinum', warm: false, hex: '#d6d6d2' },
    { id: 'gunmetal', name: 'Gunmetal', warm: false, hex: '#5d6166' },
    { id: 'gold', name: 'Yellow gold', warm: true, hex: '#c9a54a' },
    { id: 'rose', name: 'Rose gold', warm: true, hex: '#c58f78' },
    { id: 'twotone', name: 'Two-tone (steel and gold)', warm: null, hex: '#c2b48a', only: ['watch'] },
    { id: 'black', name: 'Black coated steel', warm: null, hex: '#2a2b2e', only: ['watch'] }
  ];
  const STONES = [
    { id: 'none', name: 'No stone' },
    { id: 'onyx', name: 'Onyx', hex: '#1b1b1e' },
    { id: 'lapis', name: 'Lapis lazuli', hex: '#26619c' },
    { id: 'sapphire', name: 'Sapphire', hex: '#1f4fb0' },
    { id: 'garnet', name: 'Garnet', hex: '#6e1a26' },
    { id: 'ruby', name: 'Ruby', hex: '#9b1b30' },
    { id: 'emerald', name: 'Emerald', hex: '#1f6e4a' },
    { id: 'amethyst', name: 'Amethyst', hex: '#6c3c8c' },
    { id: 'pearl', name: 'Mother of pearl', hex: '#ece9e2' },
    { id: 'diamond', name: 'Diamond', hex: '#e8eef2' },
    { id: 'carnelian', name: 'Carnelian', hex: '#b4502a' },
    { id: 'tigereye', name: 'Tiger’s eye', hex: '#9c6b2e' }
  ];
  const ACCESSORIES = [
    // Glasses: worn with an outfit, so set in the Dresser and saved with each outfit. At the face, so
    // judged with the colours there (temperature) and against the face's contrast (weight), and
    // compared with an earring rather than with the belt.
    { key: 'glasses', name: 'Glasses', glasses: true, face: true, metals: [],
      note: 'Frames sit at the face: a metal frame adds its temperature there, and an acetate frame is a line whose weight is judged against your contrast.' },
    { key: 'watch', name: 'Watch', watch: true, size: { label: 'Case diameter', min: 26, max: 50 }, metals: ['silver', 'white', 'gunmetal', 'gold', 'rose', 'twotone', 'black'] },
    { key: 'buckle', name: 'Belt buckle', metals: ['silver', 'gunmetal', 'gold'] },
    { key: 'cufflinks', name: 'Cufflinks', stone: true, size: { label: 'Face width', min: 8, max: 30 }, needs: 'cuffs', metals: ['silver', 'white', 'gunmetal', 'gold', 'rose'],
      note: 'Only with a shirt with double (French) cuffs.' },
    { key: 'tiebar', name: 'Tie bar', needs: 'tie', size: { label: 'Length', min: 25, max: 90 }, metals: ['silver', 'white', 'gunmetal', 'gold'],
      note: 'Holds a tie to the shirt, between the third and fourth button; narrower than the tie.' },
    { key: 'ring', name: 'Ring', stone: true, size: { label: 'Face width', min: 2, max: 30 }, metals: ['silver', 'white', 'gold', 'rose'],
      note: 'A signet or a wedding band. Most writers let a ring worn every day stand outside the matching rule.' },
    { key: 'earring', name: 'Earring (stud)', stone: true, face: true, size: { label: 'Diameter', min: 1, max: 20 }, metals: ['silver', 'white', 'gunmetal', 'gold', 'rose'],
      note: 'At the face, so it is read with your glasses frames and skin, not with the belt.' }
  ];
  /* A watch beyond its case: the strap or bracelet and the display. Whether
     it is mechanical or quartz cannot be seen and is not judged; a digital display can be, and is
     sport or casual (B). */
  const STRAPS = [
    { id: 'bracelet', name: 'Metal bracelet', coloured: false },
    { id: 'leather', name: 'Leather', coloured: true, leather: true },
    { id: 'suede', name: 'Suede', coloured: true, leather: true },
    { id: 'fabric', name: 'Fabric or NATO', coloured: true },
    { id: 'rubber', name: 'Rubber', coloured: true }
  ];
  const BUTTONS = [['self', 'Self-coloured', null], ['horn', 'Horn', null], ['gold', 'Gold metal', 'gold'], ['silver', 'Silver metal', 'silver'], ['pearl', 'Mother of pearl', null]];
  const FRAMES = [['gold', 'Gold metal'], ['silver', 'Silver or steel metal'], ['acetate', 'Acetate, in a colour'], ['clear', 'Clear or crystal']];
  const FRAME_COLOURS = [['Black', '#161616'], ['Dark tortoiseshell', '#5b3a24'], ['Honey tortoiseshell', '#a8743c'], ['Navy', '#1f2a44'], ['Grey', '#6e6f72'], ['Burgundy', '#5c1f2a']];
  const metalBy = {}; METALS.forEach(function (m) { metalBy[m.id] = m; });
  const stoneBy = {}; STONES.forEach(function (m) { stoneBy[m.id] = m; });
  const accBy = {}; ACCESSORIES.forEach(function (m) { accBy[m.key] = m; });

  const SCALE_ORDER = ['semi', 'small', 'medium', 'large', 'huge'];

  /* The garment type of a piece in a position (the first type when none is set). */
  function kind(slot, piece) {
    const pos = byKey[slot]; if (!pos) return null;
    const id = piece && piece.kind;
    return pos.kinds.find(function (k) { return k.id === id; }) || pos.kinds[0];
  }
  /* Can this neckwear go with this inner layer? A tie needs a collared shirt. */
  function neckwearAllowed(neckKind, innerKind) { return !neckKind.needsCollar || !!(innerKind && innerKind.tieable); }
  /* How far a scale class is above what is usual on the garment: 0 fine, 1 bold, 2 or more wrong. */
  function scaleOver(k, clsId) { return Math.max(0, SCALE_ORDER.indexOf(clsId) - SCALE_ORDER.indexOf(k.maxScale)); }

  window.VGARM = { FRAMES: FRAMES, FRAME_COLOURS: FRAME_COLOURS, STRAPS: STRAPS, BUTTONS: BUTTONS, CLOTH_PATS: CLOTH_PATS, patOK: patOK, BRIMS: BRIMS, BANDS: BANDS, CLOTHS: CLOTHS, cloth: cloth, formality: formality, OCCASIONS: OCCASIONS, POSITIONS: POSITIONS, SLOTS: SLOTS, FACE: FACE, NEAR: NEAR, METALS: METALS, STONES: STONES, ACCESSORIES: ACCESSORIES, metalBy: metalBy, stoneBy: stoneBy, accBy: accBy, byKey: byKey, kind: kind, neckwearAllowed: neckwearAllowed, scaleOver: scaleOver };
})();
