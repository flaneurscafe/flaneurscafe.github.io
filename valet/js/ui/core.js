/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — Shared by every tab: helpers, the profile and its storage, tabs, the "?" popovers.
   Part of the interface; the parts share window.VAPP (see core.js). */
// @ts-check
(function () {
  'use strict';
  /* The interface is split into parts (core, you, palette, chart-host, shape, main), loaded in that
     order. They share one object, window.VAPP (V here):
     - the values every part changes live on it: V.state (the profile), V.analysis (the colouring
       worked out from it), V.activeTab, V.activeSampler, V.previewing (a piece shown while hovering)
       and V.previewTimer;
     - helpers and constants from an earlier part are taken from it at the top of a later part;
     - a function in a later part is called through it (V.update), so it is looked up when called. */
  const V = window.VAPP = /** @type {ValetApp} */ ({});
  /* Touch screens. Instructions written for a mouse ("point at", "click") have a second wording for
     a screen with no hover, chosen when the text is drawn: V.say(mouse, touch) in scripts, and
     data-touch="…" on a sentence in the page (swapped once, below). Read once at load. */
  V.touch = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
  V.say = function (mouse, touch) { return V.touch ? touch : mouse; };
  /* A tab's result in one line, for anything that shows it elsewhere (the phone's sheet bar):
     V.result('outfit', 'Good outfit', 'good'). Kept in V.results, so a part that starts later reads
     what was announced before it, and sent as the event valet:result. level: good, ok, fix, bad or ''. */
  V.results = {};
  V.result = function (tab, text, level) {
    const r = { tab: tab, text: text || '', level: level || '' }, old = V.results[tab];
    if (old && old.text === r.text && old.level === r.level) return;
    V.results[tab] = r;
    document.dispatchEvent(new CustomEvent('valet:result', { detail: r }));
  };
  if (V.touch) Array.prototype.forEach.call(document.querySelectorAll('[data-touch]'), function (el) { el.textContent = el.getAttribute('data-touch'); });
  // the outfit as data lives in js/outfit.js
  const O = window.VOUTFIT, isHex = O.isHex, DEFAULT_OUTFIT = O.DEFAULT_OUTFIT, normOutfit = O.normOutfit, normWardrobe = O.normWardrobe;
  Object.assign(V, { showPalPane, cleanProfile, glassesToOutfit, infoBtn, load, newSummer, normOutfit, normWardrobe, openMeasures, save, showTab, showYouPane, upgrade });

  const VC = window.VC, E = window.VENGINE, D = window.VDATA, CHART = window.VCHART;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const STORE = 'valet.profile.v1';

  const SAMPLERS = [
    { key: 'white', label: 'White reference', sub: 'plain printer paper, held by your face — corrects the light' },
    { key: 'skin', label: 'Skin', sub: 'cheek or forehead, no shine' },
    { key: 'hair', label: 'Hair', sub: 'the colour it has, or had, before any grey', bald: { label: 'Brows', sub: 'or the beard, if that is darker' } },
    { key: 'eyes', label: 'Eyes', sub: 'the iris, not the pupil' }
  ];
  /* Measurement help. helper: 'alone' | 'easier' | 'needed' (is a second person needed on the body?)
     garment: how to get it from a garment instead, or null if a garment can't stand in. */
  const MEASURES = [
    { key: 'height', label: 'Height', what: 'Your height without shoes.',
      how: 'Stand straight against a wall, heels touching it; hold a book flat on your head, mark the wall under it, measure to the floor.',
      helper: 'alone', helperNote: 'A wall and a book are enough.',
      garment: null,
      use: 'Body ratios, jacket and coat length, pattern scale.' },
    { key: 'chest', label: 'Chest', what: 'The circumference of your chest at its fullest point.',
      how: 'Tape around the chest under the arms and across the shoulder blades, level all round. Breathe normally; don\u2019t puff out. Wear a thin shirt.',
      helper: 'easier', helperNote: 'Possible alone in front of a mirror, but a helper keeps the tape level across the back.',
      garment: 'Lay a knit or jacket that fits you well flat and buttoned; measure across from armpit to armpit and double it. That is the garment chest, which includes ease (usually 8\u201316 cm more than the body), so Valet will treat it as a reference garment, not as your body.',
      use: 'Target chest of shirts, knitwear, jackets and coats (body + ease).' },
    { key: 'waist', label: 'Waist', what: 'Your natural waist: the narrowest part of the torso, usually at or just above the navel.',
      how: 'Tape level around the body at the navel, relaxed, not pulled in. This is not your jeans size: high-rise trousers sit here, jeans sit lower.',
      helper: 'alone', helperNote: 'Easy alone.',
      garment: 'From high-rise trousers that fit at the navel: lay the waistband flat, closed, measure across and double it. Adds about 1\u20132 cm of ease. Jeans or low-rise trousers won\u2019t give your natural waist.',
      use: 'Chest\u2013waist drop (how shaped a jacket can be), trouser waist.' },
    { key: 'seat', label: 'Seat', what: 'The circumference around the fullest part of your hips and buttocks. Tailors call this the seat.',
      how: 'Stand with feet together; run the tape around the widest part of the bottom, level all round. Check the level in a mirror.',
      helper: 'alone', helperNote: 'Doable alone with a mirror.',
      garment: 'From trousers that fit: lay flat, measure straight across at the fullest point of the seat (about where the crotch seam meets the fly) and double it. Includes a few cm of ease.',
      use: 'Trouser and jacket fit over the hips; whether a jacket covers the seat.' },
    { key: 'neck', label: 'Neck', what: 'Neck circumference where a shirt collar sits.',
      how: 'Tape around the base of the neck, over the Adam\u2019s apple, with one finger slipped under it.',
      helper: 'alone', helperNote: 'Easy alone.',
      garment: 'Best source: a shirt whose collar fits when buttoned. Lay the collar open and flat; measure from the centre of the button to the far end of the buttonhole. That is your collar size.',
      use: 'Shirt collar size; collar height in the Proportion module.' },
    { key: 'shoulder', label: 'Shoulder width', what: 'The distance across the back from one shoulder bone to the other.',
      how: 'Find the bony point at the outer end of each shoulder, where the arm begins. Measure straight across the back between them, following its curve lightly.',
      helper: 'needed', helperNote: 'You can\u2019t see or reach across your own back; ask someone.',
      garment: 'Often more reliable: lay a jacket whose shoulders fit you flat and measure straight across the back from one shoulder seam to the other. A fitted jacket is usually 1\u20132 cm wider than the body measurement.',
      use: 'Jacket and coat shoulder width, lapel width, frame size, pattern scale.' },
    { key: 'arm', label: 'Arm (shoulder\u2013wrist)', what: 'Arm length from the shoulder bone to the wrist bone.',
      how: 'Arm hanging naturally, slightly bent. Measure from the shoulder bone, over the elbow, to the knob of the wrist bone.',
      helper: 'needed', helperNote: 'Measuring your own arm bends it; a helper gives a true reading.',
      garment: 'From a jacket whose sleeves are the right length: measure from the shoulder seam to the end of the sleeve. That is your ideal jacket sleeve; for a shirt add about 1\u20132 cm so the cuff shows.',
      use: 'Sleeve length of jackets, coats and shirts; how much cuff shows.' },
    { key: 'inseam', label: 'Inseam', what: 'Inside leg length, from the crotch to the floor.',
      how: 'Barefoot, back to a wall; hold a book spine-up between your legs, pressed gently up, mark the wall at its top edge and measure to the floor.',
      helper: 'easier', helperNote: 'The book trick works alone; a helper makes it quicker.',
      garment: 'From trousers that are the right length for you: measure the inside leg seam from the crotch seam to the hem. That gives your ideal trouser inseam (it already includes the break you like).',
      use: 'Leg-to-height ratio, rise recommendation, trouser length.' },
    { key: 'waistHeight', label: 'Waist height', what: 'Height of your natural waist from the floor: the level of the navel, where you measured your waist.',
      how: 'Barefoot, standing straight: tie a string round the waist at the navel, or mark it, and measure straight down to the floor at the side.',
      helper: 'easier', helperNote: 'Possible alone against a wall; a helper keeps the tape straight.',
      garment: 'Not from a garment: trousers sit where their cut puts them, not at your waist.',
      use: 'Trouser rise, the jacket\u2019s waist button, and where knitwear, waistcoats and ties should end.' },
    { key: 'backNeckFloor', label: 'Back-neck to floor', what: 'Height from the base of the neck at the back to the floor.',
      how: 'Bend your head forward: the bony bump at the base of the neck is the C7 vertebra. Measure from there straight down to the floor, standing straight, barefoot.',
      helper: 'needed', helperNote: 'The point is behind you; ask someone.',
      garment: 'Not from a garment. A jacket\u2019s back length tells you what you wear now, not what suits you. Alternative: height minus about 15% is a rough estimate.',
      use: 'Classic jacket length rule: about half of this.' },
    { key: 'wrist', label: 'Wrist', what: 'Wrist circumference, just above the wrist bone where a watch sits.',
      how: 'Wrap a soft tape (or a strip of paper, then lay it on a ruler) around the wrist just above the bone, snug but not tight.',
      helper: 'alone', helperNote: 'Easy alone.',
      garment: 'From a watch strap that fits: measure from the buckle pin to the hole you use, plus the length of the watch case and lugs.',
      use: 'Watch case size (Accessories on the Dresser).' },
    { key: 'hand', label: 'Hand', what: 'Hand circumference around the palm, over the knuckles, without the thumb.',
      how: 'Open your writing hand, fingers together, and wrap a soft tape around the widest part of the palm, just below the knuckles, leaving the thumb out. Snug, not tight.',
      helper: 'alone', helperNote: 'Easy alone.',
      garment: 'Not from a glove: leather stretches and makers differ. A glove that fits is the check, not the source.',
      use: 'Glove size (Fit & size).' },
    { key: 'head', label: 'Head', what: 'Head circumference where a hat sits.',
      how: 'Tape around the head across the middle of the forehead and just above the ears, level all round, snug.',
      helper: 'alone', helperNote: 'Easy alone in a mirror.',
      garment: 'From a hat that fits: the size inside the band, in centimetres, is this measurement.',
      use: 'Hat size (Fit & size).' },
    { key: 'foot', label: 'Foot length', what: 'The length of your longer foot, standing.',
      how: 'Stand on a sheet of paper with your heel against a wall, mark the tip of the longest toe, and measure from the wall to the mark. Do both feet and keep the longer.',
      helper: 'easier', helperNote: 'Easier if someone marks the toe while you stand straight.',
      garment: 'Not from shoes: makers\u2019 lasts differ. The foot itself is the reference.',
      use: 'Shoe size estimate (Fit & size).' },
    { key: 'faceWidth', label: 'Face width', what: 'The widest part of the face, usually across the cheekbones.',
      how: 'Look straight into a mirror; hold a ruler level in front of your face and read the outer edges of the cheekbones.',
      helper: 'easier', helperNote: 'Possible alone with a mirror; a helper reads it more accurately.',
      garment: 'From glasses that fit you well: the numbers inside the temple arm (e.g. 46\u25a122) give lens width and bridge. Total frame width is roughly 2 \u00d7 lens + bridge + about 10 mm; or measure the frame front with a ruler. This gives the frame width that suits your face, which is what the glasses module needs most.',
      use: 'Glasses frame width, collar spread, hat brim (Proportion).' },
    { key: 'faceLength', label: 'Face length', what: 'From the bottom of the chin to the bridge of the nose, between the eyes.',
      how: 'Look straight into a mirror; hold a ruler upright against the face and read from the bottom of the chin to the deepest point of the bridge of the nose.',
      helper: 'easier', helperNote: 'Possible alone with a mirror; a helper reads it more accurately.',
      garment: null,
      use: 'With face width, the shape of the face, for the collar\u2019s spread and point length (Proportion).' }
  ];
  const HELPER_TEXT = { alone: 'One person', easier: 'Easier with two', needed: 'Needs a second person' };

  /* Outfits saved by v0.2 were flat colour strings. */
  /* Profiles from before 1.5 named two acetate frames; they become acetate in that colour. */
  const GLASSES_OLD = { black: '#161616', tortoise: '#5b3a24' };
  function migrateGlasses(s) {
    if (s && GLASSES_OLD[s.glasses]) { s.glassesHex = GLASSES_OLD[s.glasses]; s.glasses = 'acetate'; }
  }
  /* Until 1.7 glasses were part of the profile (You tab); since then they are worn with an outfit
     (Dresser). A profile that had frames puts them on the current outfit and on every saved outfit
     that does not say otherwise, so nothing that was judged with them is judged without them. */
  function glassesToOutfit(s, fallbackOutfit) {
    if (!s) return s;
    migrateGlasses(s);
    const frame = s.glasses, hex = isHex(s.glassesHex) ? s.glassesHex : '#161616';
    delete s.glasses; delete s.glassesHex;
    if (!frame || frame === 'none' || ['gold', 'silver', 'acetate', 'clear'].indexOf(frame) < 0) return s;
    const put = function (o) {
      if (!o || typeof o !== 'object') return o;
      o = Object.assign({}, o); o.acc = Object.assign({}, o.acc || {});
      // an outfit saved before 1.7 has no glasses entry; the outfit a profile is loaded onto (the demo's)
      // has the default one, switched off: in both cases the profile's frames are what was worn
      if (!o.acc.glasses || !o.acc.glasses.on) o.acc.glasses = { on: true, frame: frame, hex: hex };
      return o;
    };
    s.outfit = put(s.outfit || fallbackOutfit || JSON.parse(JSON.stringify(DEFAULT_OUTFIT)));
    if (Array.isArray(s.wardrobe)) s.wardrobe = s.wardrobe.map(function (w) { return w && typeof w === 'object' ? Object.assign({}, w, { outfit: put(w.outfit) }) : w; });
    return s;
  }

  /* A profile opened from a file: everything that reaches the page's markup or a lookup is checked,
     so a damaged or hand-edited file cannot break the page or put markup into it. */
  function cleanProfile(s) {
    const hexOrNull = function (h) { return isHex(h) ? h : null; };
    const pick = function (v, list, dflt) { return list.indexOf(v) >= 0 ? v : dflt; };
    if (s.samples && typeof s.samples === 'object') ['white', 'skin', 'hair', 'eyes'].forEach(function (k) { s.samples[k] = hexOrNull(s.samples[k]); });
    if (s.summer && s.summer.samples && typeof s.summer.samples === 'object') ['white', 'skin'].forEach(function (k) { s.summer.samples[k] = hexOrNull(s.summer.samples[k]); });
    if (s.study && typeof s.study === 'object') ['face', 'accent', 'below'].forEach(function (k) { s.study[k] = hexOrNull(s.study[k]); });
    else s.study = null;
    if (s.theme != null && !isHex(s.theme)) s.theme = null;
    const namedOk = function (named) {
      if (!named || typeof named !== 'object') return {};
      const ok = {};
      if (named.skin && V.byId(V.F.skin.depths, named.skin.id)) ok.skin = named.skin;
      if (named.hair && V.byId(V.F.hair.bases, named.hair.id)) ok.hair = named.hair;
      if (named.eyes && V.byId(V.F.eyes, named.eyes.id)) ok.eyes = named.eyes;
      return ok;
    };
    s.named = namedOk(s.named);
    if (s.summer && typeof s.summer === 'object') s.summer.named = namedOk(s.summer.named);
    glassesToOutfit(s);
    s.redness = pick(s.redness, ['none', 'some', 'marked'], 'none');
    s.underEye = pick(s.underEye, ['none', 'some', 'deep'], 'none');
    if (s.hairStyle != null) s.hairStyle = pick(s.hairStyle, ['short', 'long', 'none'], 'short');
    if (s.name != null && typeof s.name !== 'string') s.name = '';
    if (typeof s.name === 'string') s.name = s.name.slice(0, 80);
    if (s.shape && typeof s.shape === 'object') {
      const sh = {};
      sh.shoulders = pick(s.shape.shoulders, ['average', 'square', 'sloping'], 'average');
      sh.stomach = pick(s.shape.stomach, ['average', 'flat', 'full'], 'average');
      sh.posture = pick(s.shape.posture, ['average', 'forward', 'erect'], 'average');
      sh.seat = pick(s.shape.seat, ['average', 'flat', 'prominent'], 'average');
      s.shape = sh;
    } else delete s.shape;
    if (s.period != null) s.period = pick(s.period, Object.keys(window.VPROP.PERIODS), 'classic');
    if (s.measurements && typeof s.measurements === 'object') Object.keys(s.measurements).forEach(function (k) { if (typeof s.measurements[k] !== 'number' || !isFinite(s.measurements[k])) delete s.measurements[k]; });
    return s;
  }
  /* Summer keeps its own skin (and the paper from the photo it came from). mode: 'estimate' (a light
     tan worked out from winter), 'same' (hardly tans) or 'own' (set by name or from a summer photo). */
  function newSummer(su) {
    su = su || {};
    return { mode: ['estimate', 'same', 'own'].indexOf(su.mode) >= 0 ? su.mode : 'estimate',
      samples: Object.assign({ white: null, skin: null }, su.samples || {}), manual: Object.assign({}, su.manual || {}), named: Object.assign({}, su.named || {}) };
  }
  const PLACEHOLDER = { skin: '#d6b5a2', hair: '#5a4636', eyes: '#5f6b73' };

  V.state = {
    samples: { white: null, skin: null, hair: null, eyes: null }, manual: {},
    useWhite: true, measurements: {}, redness: 'none', underEye: 'none', hairStyle: 'short', grey: 0, named: {}, fitMark: true,
    season: 'winter', summer: newSummer(),
    outfit: normOutfit(null), wardrobe: [], study: null, shape: {}, period: 'classic',
    myColours: [],  // colours read from photos of your own clothes (js/ui/photos.js)
    garments: []    // My garments: the clothes you own or might buy (js/closet.js)
  };
  V.previewing = null;   // a piece shown on the chart while hovering, not saved
  V.activeSampler = 'skin';
  V.activeTab = 'you';
  V.analysis = null;

  /* ---------- Persistence ---------- */
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(V.state)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) { /* ignore */ }
    // Nothing saved yet: start empty; the You tab offers the demo profile.
    if (!s || !s.samples) return;
    upgrade(s);
    glassesToOutfit(s);
    // A period that no longer exists (the 2020s revival was removed) falls back to today's classic.
    if (s.period != null && !(s.period in window.VPROP.PERIODS)) s.period = 'classic';
    s.outfit = normOutfit(s.outfit);
    s.wardrobe = normWardrobe(s.wardrobe);
    s.myColours = window.VPHOTOS.cleanColours(s.myColours);
    s.garments = window.VCLOSET.normGarments(s.garments);
    s.grey = Math.max(0, Math.min(100, +s.grey || 0)); s.named = s.named || {};
    s.fitMark = s.fitMark !== false;
    s.season = s.season === 'summer' ? 'summer' : 'winter'; s.summer = newSummer(s.summer);
    V.state = Object.assign(V.state, s);
  }
  /* Profiles from older versions, stored or opened from a file. */
  function upgrade(s) {
    if (!s.samples) return s;
    // v0.1 had no hair setting. KP's test profile is bald; anything else keeps the old
    // behaviour, where hair counted in full.
    if (!s.hairStyle) s.hairStyle = s.name === D.kp.name ? 'none' : 'short';
    // Without a white sample nothing was corrected in v0.1 either, so treat those colours as set by hand.
    if (!s.manual) s.manual = s.samples.white ? {} : { skin: true, hair: true, eyes: true };
    return s;
  }

  /* ---------- Tabs ---------- */
  /* Proportion and Fit are one entry in the menu, "Proportion & fit", with a switch at the top of each:
     the menu button opens the one used last. The Palette has four panes under one switch (showPalPane). */
  const SHAPE = ['proportion', 'fit'];
  function showTab(name) {
    const group = SHAPE.indexOf(name) >= 0;
    if (group) V.shapeSub = name;
    $$('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name || (group && b.dataset.group === 'shape'))); });
    $$('.sub-tabs [data-sub]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.sub === name)); });
    $$('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    V.activeTab = name;
    if (name === 'colour') V.renderColour();
    if (name === 'outfit') VWARD.render();
    if (name === 'proportion') V.renderProportion();
    if (name === 'fit') V.renderFit();
    V.mountChart();
    try { history.replaceState(null, '', '#' + name + (name === 'colour' && V.palPane && V.palPane !== 'colours' ? '/' + V.palPane : '')); } catch (e) { /* file:// */ }
    document.dispatchEvent(new Event('valet:layout'));   // the phone layout closes an open sheet
  }
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.group === 'shape' ? (V.shapeSub || 'proportion') : b.dataset.tab); });
  });
  $$('.sub-tabs [data-sub]').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.sub); }); });
  /* The Palette's panes: Your colours, Pairings, Colour map, Build around one colour. Each is a way of
     choosing colours for the study, which stays beside them (on a phone, in the bottom sheet). */
  function showPalPane(name) {
    const panes = $$('#tab-colour .pal-pane');
    if (!panes.some(function (p) { return p.dataset.pane === name; })) name = 'colours';
    V.palPane = name;
    panes.forEach(function (p) { p.hidden = p.dataset.pane !== name; });
    $$('#palTabs [data-pane]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.pane === name)); });
    if (V.activeTab === 'colour') {
      if (name === 'map' || name === 'theme') V.renderColour();      // a canvas drawn while hidden has no size
      try { history.replaceState(null, '', '#colour' + (name !== 'colours' ? '/' + name : '')); } catch (e) { /* file:// */ }
    }
  }
  $$('#palTabs [data-pane]').forEach(function (b) { b.addEventListener('click', function () { showPalPane(b.dataset.pane); }); });
  /* The measurements card is folded by default; links that send you to it open it. */
  /* The You tab has two parts: colouring, and measurements and shape. */
  function showYouPane(name) {
    const body = name === 'body';
    $('#youColour').hidden = body; $('#measureSection').hidden = !body;
    $('#youTabColour').setAttribute('aria-selected', String(!body));
    $('#youTabBody').setAttribute('aria-selected', String(body));
  }
  $('#youTabColour').addEventListener('click', function () { showYouPane('colour'); });
  $('#youTabBody').addEventListener('click', function () { showYouPane('body'); });
  // arrow keys move between the two, as in the main tabs
  $$('.you-tabs [role=tab]').forEach(function (b) {
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); const other = b.id === 'youTabColour' ? $('#youTabBody') : $('#youTabColour'); other.click(); other.focus();
    });
  });
  function openMeasures() {
    showTab('you'); showYouPane('body');
    $('.you-tabs').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  $$('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); if (a.dataset.goto === 'measures') openMeasures(); else showTab(a.dataset.goto); });
  });


  /* ---------- Info popovers (the "?" buttons) ---------- */
  const INFO = {
    'period': {
      title: 'Period', what: 'Which tailoring tradition the targets follow.',
      how: "Today's classic is the middle ground of current classic tailoring. The 1930s drape is the golden age: high-waisted trousers with braces, a broad draped chest, wide lapels, and short knits, waistcoats and ties that end at that high waistband. The 1940s broadened it; the 1950s Ivy sack suit softened the shoulder and narrowed the lapel; the 1960s were short, slim and low; the 1970s wide-lapelled and flared.",
      use: 'Each period cut its pieces to go together, so the targets are worked out from each other within it: the waistband sets where the knit, waistcoat and tie end.'
    },
    'glasses': {
      title: 'Glasses frames', what: 'The frames you wear most days.',
      how: 'Pick the material of the frame front. For acetate, pick its colour too: a typical one, or any colour.',
      use: 'Frames sit right at the face, so their temperature counts: gold is warm, silver cool, and an acetate frame is warm or cool by its colour (tortoiseshell warm, navy cool, black and grey neutral); colour verdicts take that into account. An acetate frame is also judged against the contrast your face carries, from the lightness of its colour: on a low-contrast face a black frame is seen before the face. The frame\'s width and lens depth for your face are on the Proportion tab.'
    },
    'redness': {
      title: 'Redness', what: 'Skin that flushes or stays red across the cheeks and nose, as with rosacea.',
      how: 'Judge it in daylight without make-up or a fresh shave. If the cheeks are often pinker than the forehead, choose Some.',
      use: 'Two effects at the face. A red or pink beside the skin is echoed by the red in it and picks it out. Green, the complement of red, makes the skin look redder by simultaneous contrast (Chevreul), the same rule colour analysts give as "avoid the complement of what you want to play down". Both are weaker for dark, muted colours; blues and greys are the calm choice.'
    },
    'underEye': {
      title: 'Under the eyes', what: 'A dark shadow under the eyes, from deep-set sockets or thin skin, that does not go with sleep.',
      how: 'Look in a mirror by a window. If the shadow is there on a rested morning, it is structural: choose Deep-set.',
      use: 'Clothes at the collar sit 15 to 20 cm below the eyes, too far to darken them. What matters: glasses, whose bottom rim sits at the height of the shadow (a browline or top-heavy frame avoids doubling it), and keeping one light element near the face on all-dark days (Style Guide, section 1).'
    },
    'hairStyle': {
      title: 'Hair', what: 'How much hair frames your face.',
      how: 'Pick the closest: no hair (bald or shaved), short, or long enough to reach the collar. With no hair, sample your brows where it says Brows.',
      use: 'Hair is the frame of the face. With hair, the step between hair and skin sets your contrast in full. Without it the brows carry the contrast and count for less, your skin is nearly all that is seen, and the collar has to do the framing. Short or long changes only your depth (how light or dark your head reads overall), not the colour verdicts.'
    },
    'undertone': {
      title: 'Undertone', what: 'Whether your skin leans pink (cool) or golden (warm). It is separate from how light or dark you are.',
      how: 'The best home test: white paper held by the face in daylight shows the skin as pinker or yellower beside it. Skin that burns and hardly tans is more often cool, skin that tans easily more often warm. The guides also use wrist veins (blue for cool, green for warm), but the colour a vein shows depends mostly on its depth and width and on how the skin scatters light, not on your pigments (How it works, section 16). If the tests disagree, choose Neutral.',
      use: 'Sets the temperature reading. Cool favours blues, greys and blue-reds at the face; warm favours earth colours and cream. Neutral holds neither against you. A photo with white paper measures this instead of guessing it.'
    },
    'hairTone': {
      title: 'Tone', what: 'The cast of the colour, in the words of a hair-colour chart: ash is greyer and cooler, golden is yellower and warmer.',
      how: 'Leave it on Natural unless you would describe your hair as ash or golden. Black and the reds have no tone setting.',
      use: 'Changes how vivid your colouring reads. Ash hair makes the whole face a little more muted, so very saturated colours overpower it sooner.'
    },
    'grey': {
      title: 'Grey', what: 'Roughly what share of the hair has lost its colour: 0% none, about 50% salt and pepper, 100% white.',
      how: 'Judge the whole head from a step back in a mirror, not the temples alone. A rough figure is enough.',
      use: 'Grey lightens and mutes the hair. On lighter skin that closes the gap between hair and skin, so contrast falls and softer combinations suit you; on deep skin it opens the gap, so contrast rises. Blond hair hardly changes, because blond and grey are about equally light.'
    },
    'fit': {
      title: 'Marks against the study', what: 'Every colour in the palette is tried in the selected place of the study (near the face, accent or below the belt), with the other places as they are, and the rules between colours are checked.',
      how: V.say('Colours struck through would break a rule there. Colours marked "!" would bend one. Point at any of them and the line beside the chart names the rule. Select another place and the marks change, because the same colour does a different job at the face, as an accent or below the belt.', 'Colours struck through would break a rule there. Colours marked "!" would bend one. Tap any of them and the line beside the chart names the rule. Select another place and the marks change, because the same colour does a different job at the face, as an accent or below the belt.'),
      use: 'A tier says whether a colour suits you. The marks say whether it suits the colours beside it. A tier 1 navy is still wrong as trousers under a forest shirt: both are dark, so the two halves blur.'
    },
    'distance': {
      title: 'From a distance', what: 'How the cloth looks from 1 m (talking), 3 m (across a room) and 10 m (across a street, outdoors in daylight, where fine detail stays visible longer than in a room). Each square shows the same patch, keeping only the detail the eye can still see at that distance, then enlarged so you can compare.',
      how: 'Move the scale slider and watch the squares. Fine and low-contrast detail goes first; colour-only detail goes sooner than light against dark. The words under each square say whether it reads as pattern, texture or plain there.',
      use: 'Across a room (3 m) decides whether a cloth counts towards the two-pattern limit at the face. This is why a navy birdseye counts as plain cloth and a gingham of the same size does not. The checks judge at 3 m in room light; the 10 m square is a preview, not a rule. The science is in How it works, section 11.'
    },
    'season': {
      title: 'Winter and summer', what: 'Skin is the one part of your colouring that changes with the time of year. A tan makes it darker and a little redder; hair and eyes stay as they are here.',
      how: 'Switch at the top of the page. Every tab follows: palette, outfit, chart. For summer skin, pick the depth you reach by late summer, sample a summer photo, or leave it on the estimate. The estimate is a light tan, the average change measured after two weeks of outdoor sun: lightness about 2.7 lower, slightly redder. Keep the undertone you have in winter.',
      use: 'A darker skin changes the light-dark step to your hair and lets pale colours separate from your face. Light colours, white above all, often move up a tier in summer. Colours close to tanned skin, such as camel and some pinks, can move down. The profile card lists exactly which. The season also changes the light and the surroundings, which Valet does not model: grey, weak winter light makes colours look quieter and darker, strong summer sun makes them louder and contrasts harder. On the Dresser the switch also decides which cloths are in season.'
    },
    'echo': {
      title: 'Echo', what: 'Colours from the library that repeat the colour of your eyes or your hair.',
      how: 'Use one near the feature it repeats: a tie or shirt for the eyes, a jacket, knit or shoes for the hair. Colours tagged T3 or T4 echo you but belong away from the face.',
      use: 'A classic technique in the tailoring literature (Flusser, Dressing the Man, 2002, pp. 23–24, 28–31). It rests on how the eye groups what it sees: colours that are alike are seen as belonging together (grouping by similarity, Wertheimer 1923), so a repeated colour reads as chosen and sends the eye back to the feature it matches.'
    },
    'useWhite': {
      title: 'White reference correction',
      what: 'Uses the white paper sample to remove the colour cast and exposure of the photo.',
      how: 'Leave on whenever the photo contains plain white paper in the same light as your face.',
      use: 'Without it, warm lamps read as warm skin. The temperature reading is then marked low confidence.'
    }
  };
  SAMPLERS.forEach(function (s) {
    INFO['s-' + s.key] = {
      white: { title: 'White reference', what: 'A sheet of plain, matte white printer paper in the photo.', how: V.say('Hold it beside your face, in the same light, not blown out to pure white. Click on it in the photo.', 'Hold it beside your face, in the same light, not blown out to pure white. Tap on it in the photo.'), use: 'Corrects the light’s colour cast and exposure for all other samples.' },
      skin: { title: 'Skin', what: 'Your skin colour, away from shadow, redness and shine.', how: V.say('Pick the depth that fits, then the undertone if you know it. Or, in a photo, click the cheek or the middle of the forehead, avoiding shiny highlights, blushing spots and shadow.', 'Pick the depth that fits, then the undertone if you know it. Or, in a photo, tap the cheek or the middle of the forehead, avoiding shiny highlights, blushing spots and shadow.'), use: 'The reference for every colour verdict: contrast, separation, temperature, Chevreul effect.' },
      hair: { title: 'Hair or brows', what: 'The colour your hair has where it still has pigment. With no hair, your eyebrows, or the beard if that is darker.', how: V.say('Pick the name that fits, or click a coloured mid-tone strand in the photo, not a highlight and not a grey hair. Then set the share of grey with the slider.', 'Pick the name that fits, or tap a coloured mid-tone strand in the photo, not a highlight and not a grey hair. Then set the share of grey with the slider.'), use: 'Sets your face contrast and depth, weighted by how much hair there is.' },
      eyes: { title: 'Eyes', what: 'The colour of the iris.', how: V.say('Pick the name that fits. In a photo, zoom in if you can and click the coloured ring, not the black pupil or a reflection.', 'Pick the name that fits. In a photo, zoom in if you can and tap the coloured ring, not the black pupil or a reflection.'), use: 'Contributes to contrast, depth and chroma.' }
    }[s.key];
  });
  function infoBtn(id) {
    return '<button type="button" class="info" data-info="' + id + '" aria-label="What is this?">?</button>';
  }
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.hidden = true; pop.setAttribute('role', 'dialog');
  document.body.appendChild(pop);
  let popFor = null;
  function closePop() { pop.hidden = true; popFor = null; }
  document.addEventListener('click', function (e) {
    const b = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest('.info'));
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.info.indexOf('m-') === 0) { closePop(); V.showGuide(b.dataset.info.slice(2), true); return; }
      if (popFor === b) { closePop(); return; }
      const i = INFO[b.dataset.info]; if (!i) return;
      pop.innerHTML = '<h4>' + esc(i.title) + '</h4>' +
        '<p><strong>What:</strong> ' + esc(i.what) + '</p>' +
        '<p><strong>How:</strong> ' + esc(i.how) + '</p>' +
        (i.helper ? '<p><strong>Who:</strong> ' + esc(i.helper) + '</p>' : '') +
        (i.garment ? '<p><strong>From a garment:</strong> ' + esc(i.garment) + '</p>' : '') +
        '<p><strong>Used for:</strong> ' + esc(i.use) + '</p>';
      pop.hidden = false; popFor = b;
      const r = b.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 24);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX - 20)) + 'px';
      pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
      return;
    }
    if (!/** @type {HTMLElement} */ (e.target).closest('.popover')) closePop();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });


  Object.assign(V, { $, $$, CHART, D, E, HELPER_TEXT, MEASURES, PLACEHOLDER, SAMPLERS, VC, esc });
})();
