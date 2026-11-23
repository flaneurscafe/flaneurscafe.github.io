/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — The lightness chart (chart.js), moved to whichever tab is showing.
   Part of the interface; the parts share window.VAPP (see core.js). */
// @ts-check
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
    // spectators: plotted at the mix of their two leathers, as the rules judge them, and shown in both
    let shoesTwo = null;
    if (hex.shoes && o.shoes.kind === 'spectator' && o.shoes.hex2) {
      const p1 = window.VC.hexToLab(o.shoes.hex), p2 = window.VC.hexToLab(o.shoes.hex2);
      shoesTwo = [o.shoes.hex, o.shoes.hex2];
      hex.shoes = window.VC.labToHex([p1[0] * 0.6 + p2[0] * 0.4, p1[1] * 0.6 + p2[1] * 0.4, p1[2] * 0.6 + p2[2] * 0.4]);
    }
    return {
      skin: c.skin || PLACEHOLDER.skin, hair: c.hair || PLACEHOLDER.hair, eyes: c.eyes || PLACEHOLDER.eyes,
      hairStyle: V.state.hairStyle,
      outfit: hex, pats: pats, shoesTwo: shoesTwo,
      // a contrast collar (1.17): its own row, the colour that meets the jacket at the neck
      collar: hex.shirt ? window.VGARM.contrastCollar('shirt', V.previewing && V.previewing.slot === 'shirt' ? Object.assign({}, o.shirt, V.previewing.look) : o.shirt) : null,
      collarName: o.shirt && o.shirt.collarHex ? nameOf(o.shirt.collarHex) : '',
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
    $('#chartYouNote').textContent = (V.analysis ? 'Your colouring and the outfit from the Dresser, by lightness.' : 'Stand-in colours until you set your skin.') +
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
