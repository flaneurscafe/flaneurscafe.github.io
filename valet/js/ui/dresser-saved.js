/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser, part 2 of 5: Saved outfits (the outfits you have composed, checked and kept),
   their marks, export and import. Shares the Dresser's helpers and state through window.VDRCORE (js/ui/dresser.js). */
// @ts-check
(function () {
  'use strict';
  const DR = window.VDRCORE;
  const VC = window.VC, E = window.VENGINE, D = window.VDATA, VP = window.VPAT, O = window.VOUTFIT, X = window.VDRESS;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const escs = function (s) { return esc(s).replace(/#[0-9a-fA-F]{6}\b/g, function (h) { return '<span class="hexsw" style="background:' + h + '" role="img" aria-label="colour ' + h + '" title="' + h + '"></span>'; }); };
  const G = window.VGARM;


  /* ---------- The wardrobe: outfits you have composed, checked and kept ----------
     Saved in your profile (in this browser, and in the file when you save it). Grouped first by
     season, read from the cloths (winter cloth only: winter; summer cloth only: summer; neither: all
     year; both: mixed, which the season rule notes in winter and summer and accepts in spring and autumn),
     then by the occasion. Each verdict is worked out again when the wardrobe is
     shown, so it follows your colouring if that changes. */
  DR.view = 'outfit'; let removed = null, wNote = '', onlyDisagree = false;
  const SEASONS = O.SEASONS, seasonOf = O.seasonOf, clothWord = O.clothWord;
  function wardrobe() { const st = DR.S(); if (!Array.isArray(st.wardrobe)) st.wardrobe = []; return st.wardrobe; }
  /* The colouring a saved outfit is judged with: a summer outfit with your summer colouring and the
     summer season, a winter one with winter's; an all-year outfit with the season you are in now. */
  DR.aCache = {};
  function analysisFor(w, aNow) {
    if (w.season !== 'summer' && w.season !== 'winter') return aNow;   // all year and mixed: the season you are in
    if (aNow && aNow.season === w.season) return aNow;
    if (!DR.aCache[w.season]) DR.aCache[w.season] = DR.api.analysisFor(w.season);
    return DR.aCache[w.season] || aNow;
  }
  function saveOutfit(asNew) {
    const list = wardrobe(), cur = DR.S().outfit, o = O.snapshotOutfit(cur);
    const name = (cur.name || '').trim() || O.autoName(o, DR.api.nameOf);
    const existing = !asNew && cur.savedId ? list.find(function (w) { return w.id === cur.savedId; }) : null;
    // a changed outfit is no longer the one you marked
    if (existing && O.outfitSig(existing.outfit) !== O.outfitSig(o)) { delete existing.mark; delete existing.marked; delete existing.markVerdict; delete existing.fromMarks; }
    if (existing) { existing.outfit = o; existing.name = name; existing.season = seasonOf(o); existing.occasion = o.occasion; existing.saved = new Date().toISOString().slice(0, 10); DR.lastNote = 'Updated in Saved outfits: ' + name + '.'; }
    else {
      const id = O.newId();
      list.push({ id: id, name: name, season: seasonOf(o), occasion: o.occasion || 'smart', saved: new Date().toISOString().slice(0, 10), outfit: o });
      cur.savedId = id; DR.lastNote = 'Saved: ' + name + '.';
    }
    if (!cur.name) cur.name = name;
    DR.api.save(); DR.render();
  }
  function renderSave() {
    const box = $('#ovSave'); if (!box) return;
    const cur = DR.S().outfit, inList = cur.savedId && wardrobe().some(function (w) { return w.id === cur.savedId; });
    box.innerHTML = inList
      ? '<button type="button" class="btn small" data-save="update">Update saved outfit</button><button type="button" class="btn ghost small" data-save="new">Save as new</button>'
      : '<button type="button" class="btn small" data-save="new">Save outfit</button>';
    $$('[data-save]', box).forEach(function (b) { b.addEventListener('click', function () { saveOutfit(b.dataset.save === 'new'); }); });
  }
  function setView(v) {
    DR.view = v;
    $$('.dr-views [data-view]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.view === v)); });
    $('#drOutfit').hidden = v !== 'outfit'; $('#drWardrobe').hidden = v !== 'wardrobe'; $('#drGarments').hidden = v !== 'garments';
    const body = $('#outfitBody'); if (body) body.classList.toggle('wardrobe-view', v !== 'outfit');   // the lists use the whole width
    if (v === 'wardrobe') renderWardrobe(DR.api.analysis());
    if (v === 'garments') window.VCLOSETUI.render();
    document.dispatchEvent(new Event('valet:layout'));
    if (window.scrollY > 0 && $('.dr-views')) $('.dr-views').scrollIntoView({ block: 'nearest' });
  }
  const MARK_NAMES = { good: 'Good', mid: 'So-so', bad: 'Bad' };
  function markSeg(w) {
    return '<span class="cl-marks" role="group" aria-label="Your verdict on ' + esc(w.name) + '">' + O.MARKS.map(function (m) {
      return '<button type="button" class="btn ghost small cl-mark m-' + m + '" data-wmark="' + m + '" aria-pressed="' + (w.mark === m) + '">' + MARK_NAMES[m] + '</button>';
    }).join('') + '</span>';
  }
  /* Marks set from My garments: the saved outfit with the same pieces and occasion carries the mark;
     an outfit not saved yet is saved with it, and taken out again if the mark is cleared. */
  function findBySig(sig) { return wardrobe().find(function (w) { return O.outfitSig(w.outfit) === sig; }) || null; }
  function markOf(sig) { const w = findBySig(sig); return w ? w.mark || null : null; }
  function setMark(o, sig, m, info) {
    const list = wardrobe(), today = new Date().toISOString().slice(0, 10);
    let w = findBySig(sig);
    if (!m) {
      if (w) { delete w.mark; delete w.marked; delete w.markVerdict; if (w.fromMarks) list.splice(list.indexOf(w), 1); }
    } else if (w) { w.mark = m; w.marked = today; w.markVerdict = info.verdict; }
    else {
      const snap = O.snapshotOutfit(o);
      w = { id: O.newId(), name: info.name, saved: today, season: seasonOf(snap), occasion: snap.occasion || 'smart', outfit: snap,
        mark: m, marked: today, markVerdict: info.verdict, from: info.from, fromMarks: true };
      list.push(w);
    }
    DR.api.save();
    const cnt = $('#drCount'); if (cnt) cnt.textContent = list.length ? '(' + list.length + ')' : '';
  }
  function renderWardrobe(a) {
    const list = wardrobe(), cnt = $('#drCount'); if (cnt) cnt.textContent = list.length ? '(' + list.length + ')' : '';
    const box = $('#drWardrobe'); if (!box || DR.view !== 'wardrobe' || !a) return;
    // your marks against Valet's verdicts (from My garments, or set here)
    list.forEach(function (w) { w.season = seasonOf(w.outfit); });   // from the cloths as the rules now read them, not as saved
    const vOf = {}; list.forEach(function (w) { vOf[w.id] = E.verdict(E.checkOutfit(DR.engineOutfit(w.outfit), analysisFor(w, a))); });
    const marked = list.filter(function (w) { return w.mark; });
    const against = marked.filter(function (w) { return O.disagrees(w.mark, vOf[w.id].level); });
    if (!against.length) onlyDisagree = false;
    const shown = onlyDisagree ? against : list;
    const undoBar = (removed ? '<div class="dr-undo">Removed “' + esc(removed.item.name) + '”. <button type="button" class="btn ghost small" id="drUndo">Undo</button></div>' : '') +
      '<div class="dr-tools"><button type="button" class="btn ghost small" id="drPrint"' + (list.length ? '' : ' disabled') + '>Print or save as PDF</button>' +
      '<button type="button" class="btn ghost small" id="drExport"' + (list.length ? '' : ' disabled') + '>Export saved outfits</button>' +
      '<label class="btn ghost small">Import saved outfits<input type="file" id="drImport" accept="application/json,.json" hidden></label></div>' +
      (wNote ? '<p class="dr-note" role="status">' + esc(wNote) + '</p>' : '') +
      (marked.length ? '<div class="dr-marks"><p>You have marked ' + marked.length + ' outfit' + (marked.length === 1 ? '' : 's') + '. ' +
        (against.length ? 'You and Valet disagree on <strong>' + against.length + '</strong>: you call it good and Valet fails it, or you call it bad and Valet passes it. Those are the cases that show where a rule may be wrong.' : 'Valet agrees with all of them.') + '</p>' +
        (against.length ? '<label class="dr-only"><input type="checkbox" id="drOnly"' + (onlyDisagree ? ' checked' : '') + '> Show only where we disagree</label>' : '') + '</div>' : '');
    if (!list.length) { box.innerHTML = undoBar + '<p class="dr-empty">Nothing saved yet. Put an outfit together under <strong>Outfit</strong>, check it, and press <strong>Save outfit</strong>. Saved outfits are grouped here by season and occasion.</p>'; wireUndo(box); return; }
    const occName = {}; G.OCCASIONS.forEach(function (x) { occName[x.id] = x.name; });
    const order = O.seasonOrder(a && a.season);
    box.innerHTML = undoBar + order.map(function (se) {
      const inSeason = shown.filter(function (w) { return w.season === se[0]; }); if (!inSeason.length) return '';
      return '<section class="dr-season"><h3>' + se[1] + ' <span class="dr-n">' + inSeason.length + '</span></h3><div class="dr-occs">' + G.OCCASIONS.map(function (oc) {
        const items = inSeason.filter(function (w) { return (w.occasion || 'smart') === oc.id; }); if (!items.length) return '';
        return '<div class="dr-occgroup"><h4 class="dr-occ">' + esc(oc.name) + '</h4><ul class="dr-list">' + items.map(function (w) {
          const v = vOf[w.id], dis = w.mark && O.disagrees(w.mark, v.level);
          const strip = G.SLOTS.filter(function (k) { return w.outfit[k] && w.outfit[k].on !== false; }).map(function (k) {
            return '<i title="' + esc(DR.api.nameOf(w.outfit[k].hex) + ' ' + G.kind(k, w.outfit[k]).name.toLowerCase()) + '" style="' + DR.chipStyle(w.outfit[k]) + '"></i>';
          }).join('');
          const isCur = DR.S().outfit.savedId === w.id;
          return '<li class="dr-item lv-' + esc(v.level || '') + (isCur ? ' cur' : '') + (dis ? ' disagree' : '') + '" data-id="' + esc(w.id) + '"><div class="dr-strip" aria-hidden="true">' + strip + '</div>' +
            '<div class="dr-text"><strong>' + esc(w.name) + '</strong><span class="dr-verdict">Valet: ' + esc(v.title || '') + (v.level === 'fix' || v.level === 'bad' ? ' <span class="dr-why">(' + esc(String(v.text).replace(/^Fails on /, '').replace(/\..*$/, '')) + ')</span>' : '') + '</span>' +
            '<span class="dr-mine">You: ' + markSeg(w) + (dis ? ' <span class="dr-dis">disagree</span>' : '') + '</span>' +
            '<span class="dr-date">Saved ' + esc(w.saved || '') + (isCur ? ' · being worn' : '') + '</span></div>' +
            '<div class="dr-acts"><button type="button" class="btn small" data-wear>Wear</button><button type="button" class="btn ghost small" data-del aria-label="Delete ' + esc(w.name) + '">Delete</button></div></li>';
        }).join('') + '</ul></div>';
      }).join('') + '</div></section>';
    }).join('');
    $$('.dr-item', box).forEach(function (li) {
      const id = li.dataset.id;
      $('[data-wear]', li).addEventListener('click', function () {
        const w = list.find(function (x) { return x.id === id; }); if (!w) return;
        DR.snapshot(); DR.api.setOutfit(Object.assign(JSON.parse(JSON.stringify(w.outfit)), { savedId: id, name: w.name }));
        setView('outfit'); DR.commit('Wearing “' + w.name + '” from Saved outfits.');   // commit: saves, redraws the chart and the rows
      });
      $('[data-del]', li).addEventListener('click', function () {
        const i = list.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
        removed = { item: list[i], at: i }; list.splice(i, 1); DR.api.save(); DR.render();
      });
      $$('[data-wmark]', li).forEach(function (b) {
        b.addEventListener('click', function () {
          const w = list.find(function (x) { return x.id === id; }); if (!w) return;
          if (w.mark === b.dataset.wmark) { delete w.mark; delete w.marked; delete w.markVerdict; }
          else { w.mark = b.dataset.wmark; w.marked = new Date().toISOString().slice(0, 10); w.markVerdict = vOf[id].title; }
          DR.api.save(); renderWardrobe(DR.api.analysis());
        });
      });
    });
    const only = $('#drOnly', box); if (only) only.addEventListener('change', function () { onlyDisagree = only.checked; renderWardrobe(DR.api.analysis()); });
    wireUndo(box);
  }
  /* Export and import. A wardrobe file holds only the saved outfits, to move them to another browser,
     keep a copy or share them. Importing adds to the wardrobe: an outfit already there is skipped, and
     a different one that happens to carry the same id is kept under a new id. A full profile file is
     accepted too; only its wardrobe is taken. */
  function exportWardrobe() {
    const out = { app: 'valet', kind: 'wardrobe', version: 1, valet: DR.api.version, saved: new Date().toISOString().slice(0, 10), wardrobe: wardrobe() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'valet-wardrobe-' + out.saved + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    wNote = 'Exported ' + out.wardrobe.length + ' outfit' + (out.wardrobe.length === 1 ? '' : 's') + '.'; renderWardrobe(DR.api.analysis());
  }
  function importWardrobe(data) {
    if (!data || data.app !== 'valet' || !Array.isArray(data.wardrobe)) { wNote = 'That file has no saved Valet outfits in it.'; return; }
    const incoming = DR.api.normWardrobe(data.wardrobe), list = wardrobe();
    const r = O.mergeWardrobe(list, incoming), added = r.added, same = r.same;
    if (!incoming.length) wNote = 'The file holds no saved outfits.';
    else wNote = 'Imported ' + added + ' outfit' + (added === 1 ? '' : 's') + (same ? '; ' + same + ' already saved' + (same === 1 ? ' was' : ' were') + ' skipped' : '') + '.';
    if (added) DR.api.save();
  }
  function wireUndo(box) {
    const ex = $('#drExport', box); if (ex) ex.addEventListener('click', exportWardrobe);
    const pr = $('#drPrint', box); if (pr) pr.addEventListener('click', DR.printWardrobe);
    const im = $('#drImport', box);
    if (im) im.addEventListener('change', function (e) {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { let d = null; try { d = JSON.parse(t); } catch (err) { /* not JSON */ } importWardrobe(d); DR.render(); });
      e.target.value = '';
    });
    const u = $('#drUndo', box); if (u) u.addEventListener('click', function () { if (removed) { wardrobe().splice(removed.at, 0, removed.item); removed = null; DR.api.save(); DR.render(); } });
  }
  Object.assign(DR, { analysisFor: analysisFor, clothWord: clothWord, markOf: markOf, renderSave: renderSave, renderWardrobe: renderWardrobe, seasonOf: seasonOf, setMark: setMark, setView: setView, wardrobe: wardrobe });
})();
