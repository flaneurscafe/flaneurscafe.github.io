/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — The lightness chart (chart.js), moved to whichever tab is showing.
   Part of the interface; the parts share window.VAPP (see core.js). */
(function () {
  'use strict';
  const V = window.VAPP;
  const { $, CHART, PLACEHOLDER, PLACES, nameOf, study } = V;
  Object.assign(V, { mountChart, syncChart, syncChartSoon });

  /* ---------- The lightness chart (chart.js): one chart, moved to whichever tab is showing ---------- */
  function chartProps() {
    if (V.activeTab === 'colour') return studyProps();
    const a = V.analysis, o = V.state.outfit, c = a ? a.hex : {}, hex = {}, pats = {};
    window.VGARM.SLOTS.forEach(function (k) {
      let x = o[k];
      if (V.previewing && V.previewing.slot === k) x = Object.assign({}, x, { on: true }, V.previewing.look);
      hex[k] = x.on === false ? '' : x.hex; pats[k] = x.pat;
    });
    return {
      skin: c.skin || PLACEHOLDER.skin, hair: c.hair || PLACEHOLDER.hair, eyes: c.eyes || PLACEHOLDER.eyes,
      hairStyle: V.state.hairStyle,
      outfit: hex, pats: pats,
      names: (function () { const n = {}; window.VGARM.SLOTS.forEach(function (k) { n[k] = nameOf(hex[k] || o[k].hex); }); return n; })(),
      kinds: (function () { const n = {}; window.VGARM.SLOTS.forEach(function (k) { n[k] = window.VGARM.kind(k, o[k]).name; }); return n; })(),
      analysis: a, previewSlot: V.previewing ? V.previewing.slot : null
    };
  }
  /* On the Palette tab the chart shows the study: its places as rows, named by place. */
  function studyProps() {
    const a = V.analysis, c = a ? a.hex : {}, st = study(), hex = {}, names = {}, kinds = {};
    PLACES.forEach(function (p) {
      const h = V.previewing && V.previewing.slot === p.slot ? V.previewing.look.hex : st[p.key];
      hex[p.slot] = h || ''; names[p.slot] = h ? nameOf(h) : ''; kinds[p.slot] = p.label;
    });
    return {
      skin: c.skin || PLACEHOLDER.skin, hair: c.hair || PLACEHOLDER.hair, eyes: c.eyes || PLACEHOLDER.eyes,
      hairStyle: V.state.hairStyle,
      outfit: hex, pats: {}, names: names, kinds: kinds, analysis: a, previewSlot: V.previewing ? V.previewing.slot : null, study: true
    };
  }
  function syncChart() {
    if (!CHART) return;
    CHART.update(chartProps());
    $('#chartYouNote').textContent = (V.analysis ? 'Your colouring and the outfit from the Outfit check, by lightness.' : 'Stand-in colours until you set your skin.') +
      ' The green zone is the lightness that frames your face.';
  }
  let chartTimer = 0; V.previewTimer = 0;
  function syncChartSoon() { clearTimeout(chartTimer); chartTimer = setTimeout(syncChart, 220); }
  function mountChart() {
    if (!CHART) return;
    if (V.activeTab === 'colour' && V.analysis) CHART.mount($('#chartColour'));
    else if (V.activeTab === 'outfit' && V.analysis) CHART.mount($('#chartOutfit'));
    else if (V.activeTab === 'you') CHART.mount($('#chartYou'));
    else return;
    syncChart();
  }

})();
