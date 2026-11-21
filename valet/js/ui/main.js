/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — Files (demo, open, save), How it works, the update cycle, the welcome window and start-up.
   Part of the interface; the parts share window.VAPP (see core.js). */
(function () {
  'use strict';
  const V = window.VAPP;
  const { $, $$, D, E, cleanProfile, esc, fillSelects, load, marks, mountChart, nameOf, newSummer, normOutfit, normWardrobe, refreshEffects, renderColour, renderHair, renderMeasures, renderProfileCard, renderSamplers, renderSeason, save, showTab, showYouPane, syncChart, upgrade, warmPairs } = V;
  Object.assign(V, { update });

  /* ---------- Demo, import, export ---------- */
  function applyState(s) {
    s = V.glassesToOutfit(Object.assign({}, s), V.state.outfit);   // frames from an older profile go on the outfit
    V.state = {
      name: s.name || '', note: s.note || '',
      samples: Object.assign({ white: null, skin: null, hair: null, eyes: null }, s.samples || {}),
      useWhite: s.useWhite !== false,
      measurements: Object.assign({}, s.measurements || {}),
      redness: s.redness || 'none', underEye: s.underEye || 'none',
      hairStyle: E.HAIR[s.hairStyle] ? s.hairStyle : 'short',
      manual: Object.assign({}, s.manual || {}),
      grey: Math.max(0, Math.min(100, +s.grey || 0)), named: Object.assign({}, s.named || {}), fitMark: V.state.fitMark !== false,
      season: (s.season || V.state.season) === 'summer' ? 'summer' : 'winter', summer: newSummer(s.summer),
      // the body's shape goes with its measurements, so erase and the demo reset it
      outfit: normOutfit(s.outfit || V.state.outfit),
      // a profile without a wardrobe (the demo, an old file) keeps the one you have
      wardrobe: normWardrobe(Array.isArray(s.wardrobe) ? s.wardrobe : V.state.wardrobe), study: s.study || V.state.study, shape: s.shape && typeof s.shape === 'object' ? s.shape : {},
      period: s.period || V.state.period || 'classic', combos: Array.isArray(s.combos) ? s.combos.filter(function (c) { return c && typeof c.name === 'string' && ['face', 'accent', 'below'].every(function (k) { return c[k] == null || /^#[0-9a-f]{6}$/i.test(c[k]); }); }).slice(0, 24) : (V.state.combos || []), theme: s.theme || V.state.theme, fitCheck: window.VFIT.clean(s.fitCheck || V.state.fitCheck)
    };
    syncInputs(); update();
  }
  function syncInputs() {
    $('#useWhite').checked = V.state.useWhite;
    $('#redness').value = V.state.redness; $('#underEye').value = V.state.underEye;
    renderHair();
    renderMeasures();
  }
  function loadDemo() { applyState(JSON.parse(JSON.stringify(D.demo))); fileNote(''); }
  /* Buttons that replace or erase the profile ask for a second click: the first turns the button
     into the question, the second does it; after a few seconds it goes back. */
  function confirmed(btn, question, action) {
    if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; btn.textContent = btn.dataset.label; btn.classList.remove('armed'); action(); return; }
    btn.dataset.label = btn.textContent; btn.textContent = question; btn.classList.add('armed');
    btn.dataset.armed = String(setTimeout(function () { delete btn.dataset.armed; btn.textContent = btn.dataset.label; btn.classList.remove('armed'); }, 4000));
  }
  const hasProfile = function () { return !!(V.state.samples.skin || (V.state.named && V.state.named.skin) || Object.keys(V.state.measurements || {}).some(function (k) { return V.state.measurements[k] > 0; })); };
  $('#loadDemo').addEventListener('click', function (e) {
    if (!hasProfile() || V.state.name === D.demo.name) { loadDemo(); return; }
    confirmed(e.currentTarget, V.say('Replace your profile? Click again', 'Replace your profile? Tap again'), loadDemo);
  });
  $('#demoTop').addEventListener('click', function (e) { e.preventDefault(); if (!hasProfile()) loadDemo(); else { showTab('you'); $('#loadDemo').click(); $('#loadDemo').scrollIntoView({ block: 'center' }); } });
  $('#demoFromColour').addEventListener('click', function (e) { e.preventDefault(); loadDemo(); renderColour(); mountChart(); });
  /* The saved file carries the palette for both seasons, with the colouring and the reading it was
     built from, so the file is readable on its own. On opening, the colouring is the source: the
     palette is rebuilt from it with the current rules, and any colour whose tier differs from the
     saved palette is listed. A file with a palette but no colouring gets its colouring from the
     palette, as set by hand. */
  const VERSION = '1.11.3';
  function paletteFor(season) {
    const a = E.analyseProfile(E.seasonProfile(V.state, season)); if (!a) return null;
    const r1 = function (x) { return Math.round(x * 10) / 10; };
    return {
      colouring: { skin: a.hex.skin, hair: a.hairBase || null, eyes: a.hex.eyes || null, grey: a.grey, hairStyle: a.hairStyle },
      reading: { contrast: r1(a.contrast), contrastLevel: a.contrastLevel, depth: r1(a.depth), depthLevel: a.depthLevel,
        temperature: a.tempLevel, chroma: r1(a.chroma), chromaLevel: a.chromaLevel, confidence: a.confidence },
      core: (function () {
        const sm = E.summary(a), nh = function (l) { return l.map(function (c) { return { name: c.name, hex: c.hex }; }); };
        return { base: nh(sm.neutrals), colour: nh(sm.colours), deliberate: nh(sm.deliberate), below: nh(sm.below),
          echo: E.echoes(a).map(function (c) { return { name: c.name, hex: c.hex, of: c.of }; }) };
      })(),
      tiers: [1, 2, 3, 4].map(function (t) {
        return { tier: t, title: E.TIER_TEXT[t].title, note: E.TIER_TEXT[t].note,
          colours: D.colours.filter(function (c) { return E.scoreColour(c.hex, a).tier === t; }).map(function (c) { return { name: c.name, hex: c.hex }; }) };
      })
    };
  }
  function tierMap(block) {
    const m = {};
    ((block && block.tiers) || []).forEach(function (t) { (t.colours || []).forEach(function (c) { if (c && c.hex) m[c.hex.toLowerCase()] = { tier: t.tier, name: c.name }; }); });
    return m;
  }
  const hexOk = function (h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); };
  /* Colouring taken from a palette-only file. */
  function colouringFromPalette(s) {
    const w = s.palette.winter.colouring, su = s.palette.summer && s.palette.summer.colouring;
    s.samples = { white: null, skin: w.skin, hair: hexOk(w.hair) ? w.hair : null, eyes: hexOk(w.eyes) ? w.eyes : null };
    s.manual = { skin: true, hair: true, eyes: true }; s.named = {};
    if (w.grey != null) s.grey = w.grey;
    if (w.hairStyle) s.hairStyle = w.hairStyle;
    if (su && hexOk(su.skin)) s.summer = su.skin.toLowerCase() === w.skin.toLowerCase() ? { mode: 'same' } : { mode: 'own', samples: { white: null, skin: su.skin }, manual: { skin: true } };
  }
  function openFile(s, fileName) {
    if (!s || typeof s !== 'object' || (s.app && s.app !== 'valet')) throw new Error('not valet');
    const pal = s.palette && s.palette.winter ? s.palette : null;
    const hasColouring = !!(s.samples && (s.samples.skin || (s.named && s.named.skin)));
    const fromPalette = !hasColouring && pal && pal.winter.colouring && hexOk(pal.winter.colouring.skin);
    if (!hasColouring && !fromPalette && !s.outfit) throw new Error('empty');
    if (fromPalette) colouringFromPalette(s);
    cleanProfile(s);
    upgrade(s);
    applyState(s);
    const what = s.name ? '“' + s.name + '”' : fileName;
    let msg;
    if (fromPalette) msg = 'Opened ' + what + '. It held a palette but no colouring, so the colouring was taken from the palette, as set by hand.';
    else if (!pal) msg = 'Opened ' + what + '. It was saved before files carried the palette; the palette is built from its colouring.';
    else {
      const changed = [];
      ['winter', 'summer'].forEach(function (season) {
        if (!pal[season]) return;
        const was = tierMap(pal[season]), now = tierMap(paletteFor(season));
        Object.keys(now).forEach(function (h) { if (was[h] && was[h].tier !== now[h].tier) changed.push(now[h].name + ' ' + was[h].tier + '→' + now[h].tier + ' (' + season + ')'); });
      });
      msg = 'Opened ' + what + '. ' + (!changed.length ? 'The palette matches the one saved in the file.'
        : changed.length + ' colour' + (changed.length > 1 ? 's sit' : ' sits') + ' in a different tier from the saved palette' + (s.valet && s.valet !== VERSION ? ' (saved with Valet ' + s.valet + '; the rules have changed since)' : '') +
          '. The palette shown follows the current rules: ' + changed.slice(0, 8).join(', ') + (changed.length > 8 ? ' and ' + (changed.length - 8) + ' more' : '') + '.');
    }
    fileNote(msg);
  }
  function fileNote(msg) { const n = $('#fileNote'); n.textContent = msg || ''; n.hidden = !msg; }
  $('#exportBtn').addEventListener('click', function () {
    const out = Object.assign({ app: 'valet', version: 2, valet: VERSION, saved: new Date().toISOString().slice(0, 10) }, V.state);
    if (V.analysis) out.palette = { season: V.state.season, winter: paletteFor('winter'), summer: paletteFor('summer') };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'valet-' + ((V.state.name || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile') + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    fileNote(out.palette ? 'Saved, with the palette for winter and summer.' : 'Saved. There is no colouring yet, so the file has no palette.');
  });
  $('#importInput').addEventListener('change', function (e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      try { openFile(JSON.parse(t), f.name); } catch (err) { fileNote('That file is not a Valet profile.'); }
    });
    e.target.value = '';
  });
  $('#clearBtn').addEventListener('click', function (e) { confirmed(e.currentTarget, V.say('Erase colouring and measurements? Click again', 'Erase colouring and measurements? Tap again'), eraseProfile); });
  function eraseProfile() {
    Object.keys(marks).forEach(function (k) { delete marks[k]; });
    applyState({}); fileNote('');
    $('#canvasWrap').hidden = true;
    $('#photoHint').textContent = 'No photo loaded. You can also set the colours by hand below.';
  }

  /* ---------- How it works: table of contents ---------- */
  function buildToc() {
    $('#howToc').innerHTML = $$('#howArticle section:not([hidden])').map(function (s) {
      return '<a href="#' + s.id + '">' + esc($('h2', s).textContent) + '</a>';
    }).join('');
    $$('#howToc a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById(a.getAttribute('href').slice(1)).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------- Update cycle ---------- */
  function update(keepSamplers) {
    V.analysis = E.analyseProfile(E.seasonProfile(V.state));
    warmPairs();
    renderSeason();
    save();
    if (!keepSamplers) renderSamplers(); else refreshEffects();
    renderProfileCard();
    if ($('#tab-colour').classList.contains('active')) renderColour();
    if (V.activeTab === 'outfit') VWARD.render();
    mountChart();
  }

  load();
  fillSelects();
  syncInputs();
  buildToc();
  update();
  const hash = (location.hash || '').slice(1);
  VWARD.init({
    state: function () { return V.state; }, analysis: function () { return V.analysis; }, nameOf: nameOf, save: save,
    commit: function () { save(); syncChart(); if (V.activeTab === 'colour') renderColour(); },
    preview: function (slot, look) {
      V.previewing = slot ? { slot: slot, look: look } : null;
      clearTimeout(V.previewTimer); V.previewTimer = setTimeout(syncChart, slot ? 30 : 120);
    },
    resetOutfit: function () { const locks = V.state.outfit.locks; V.state.outfit = normOutfit(null); V.state.outfit.locks = locks; },
    setOutfit: function (o) { V.state.outfit = normOutfit(o); },
    normWardrobe: normWardrobe, version: VERSION,
    analysisFor: function (season) { return E.analyseProfile(E.seasonProfile(V.state, season)); },
    season: function () { return V.state.season; }
  });
  // open the tab named in the address (#proportion, #fit…)
  /* The address names a tab, and for the Palette a pane (#colour/pairs). It is read at load and whenever
     it changes while Valet is open (a link inside the page, a bookmark, the browser's back button). */
  function route(h) {
    const top = h.split('/')[0], sub = h.split('/')[1];
    if (top === 'colour' || top === 'palette') { V.showPalPane(sub || 'colours'); showTab('colour'); return true; }
    if (['you', 'outfit', 'how', 'proportion', 'fit'].indexOf(top) >= 0) { showTab(top); return true; }
    if (top === 'measurements') { showTab('you'); showYouPane('body'); return true; }
    return false;
  }
  route(hash);
  window.addEventListener('hashchange', function () { route((location.hash || '').slice(1)); });
  /* ---------- Welcome: what Valet is and how to use it ----------
     Shown once on the first visit, then from the version tag in the masthead. Escape, the close
     button or a click outside it closes it; focus goes back where it was. */
  const WELCOME = 'valet.welcome.v1';
  let welcomeFrom = null;
  function openWelcome() {
    welcomeFrom = document.activeElement;
    $('#welcomeDemo').hidden = hasProfile();
    $('#welcomeDemoLine').hidden = hasProfile();
    $('#welcomeStart').textContent = hasProfile() ? 'Back to my colouring' : 'Set my colouring';
    $('#welcomeOv').hidden = false; document.body.classList.add('ov-open');
    $('#welcomeClose').focus();
  }
  function closeWelcome(then) {
    $('#welcomeOv').hidden = true; document.body.classList.remove('ov-open');
    try { localStorage.setItem(WELCOME, '1'); } catch (e) { /* storage unavailable */ }
    if (then) then(); else if (welcomeFrom && welcomeFrom.focus) welcomeFrom.focus();
  }
  $('#verTag').addEventListener('click', openWelcome);
  $('#welcomeClose').addEventListener('click', function () { closeWelcome(); });
  $('#welcomeOv').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeWelcome(); });
  $('#welcomeStart').addEventListener('click', function () { closeWelcome(function () { showTab('you'); }); });
  $('#welcomeDemo').addEventListener('click', function () { closeWelcome(function () { loadDemo(); showTab('colour'); }); });
  // the same, from the link in "What it takes" near the top, so a phone reader need not scroll to the buttons
  $('#welcomeDemoLink').addEventListener('click', function (e) { e.preventDefault(); $('#welcomeDemo').click(); });
  $('#welcomeHow').addEventListener('click', function () { closeWelcome(function () { showTab('how'); }); });
  document.addEventListener('keydown', function (e) {
    if ($('#welcomeOv').hidden) return;
    if (e.key === 'Escape') { closeWelcome(); return; }
    if (e.key === 'Tab') {   // keep focus inside the window
      const f = $$('#welcomeOv button:not([hidden]), #welcomeOv a[href]'), i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
    }
  });
  let seen = false;
  try { seen = !!localStorage.getItem(WELCOME); } catch (e) { seen = true; }
  if (!seen && !hash) openWelcome();

  // arrow keys move between the choices of a segmented control
  document.addEventListener('keydown', function (e) {
    const b = e.target.closest && e.target.closest('.seg[role="radiogroup"] button');
    if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const all = $$('button', b.parentNode), n = all[(all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    n.focus(); n.click(); e.preventDefault();
  });
})();
