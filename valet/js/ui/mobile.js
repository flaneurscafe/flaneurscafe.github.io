/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the phone layout. When the page is one column (860 px wide or less), three things change:
   - Each tab's side panel (chart, verdict, study, profile) becomes a sheet pinned to the bottom of
     the screen. Collapsed, it is one bar that says what it holds and how things stand; a tap opens
     it over the page, which keeps its place underneath. Before, the panel sat below the whole tab,
     thousands of pixels down.
   - The header scrolls away, but its tab bar stays at the top of the screen.
   - How it works gets a button back to its contents.
   On wider screens none of this applies: the sheet bar and the button are hidden by CSS. */
(function () {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const narrow = window.matchMedia('(max-width: 860px)');

  const LABEL = { you: 'Your profile and chart', colour: 'Study and chart', proportion: 'Your figure and try-on', outfit: 'Verdict and chart' };

  /* One line on the bar: how things stand on this tab, read from what the tab already shows. */
  function summary(tab) {
    if (tab === 'outfit') {
      const v = $('#ovVerdict strong'), box = $('#ovVerdict');
      return { text: v ? v.textContent.trim() : '', level: box ? (box.className.match(/\b(good|ok|fix|bad)\b/) || [])[1] || '' : '' };
    }
    if (tab === 'colour') {
      const n = $('#tryNote'); const t = n ? n.textContent.trim() : '';
      const first = t.split(/\.\s/)[0];
      return { text: first ? first.replace(/\.?$/, '.') : 'Put a colour in the study', level: /clash|weak|fails?/i.test(t) ? 'bad' : '' };
    }
    return { text: '', level: '' };
  }

  let backdrop = null;
  function panelOf(aside) { return aside.closest('.tab-panel'); }
  function tabOf(aside) { const p = panelOf(aside); return p ? p.id.replace(/^tab-/, '') : ''; }

  function setOpen(aside, open) {
    aside.classList.toggle('sheet-open', open);
    const bar = $('.sheet-bar', aside);
    bar.setAttribute('aria-expanded', String(open));
    $('.sb-act', bar).textContent = open ? 'Close' : 'Show';
    document.body.classList.toggle('sheet-is-open', open);
    backdrop.hidden = !open;
    if (open) aside.scrollTop = 0;
  }
  function closeAll() { $$('.side.sheet-open').forEach(function (a) { setOpen(a, false); }); }

  function refresh(aside) {
    const bar = $('.sheet-bar', aside); if (!bar) return;
    const s = summary(tabOf(aside)), el = $('.sb-sum', bar);
    // write only on a change: the bar sits inside the panel it watches, so every write would wake the watcher again
    if (el.textContent !== s.text) el.textContent = s.text;
    if (bar.dataset.level !== s.level) bar.dataset.level = s.level;
  }

  function setUp() {
    // the footer's text also lives in the info dialog, where it is easy to reach on any screen
    const foot = $('.foot'), wf = $('#welcomeFoot');
    if (foot && wf) wf.innerHTML = foot.innerHTML;
    backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop'; backdrop.hidden = true;
    backdrop.addEventListener('click', closeAll);
    document.body.appendChild(backdrop);

    $$('.tab-panel aside.side').forEach(function (aside, i) {
      const tab = tabOf(aside);
      if (!aside.id) aside.id = 'side-' + (tab || i);
      const bar = document.createElement('button');
      bar.type = 'button'; bar.className = 'sheet-bar';
      bar.setAttribute('aria-expanded', 'false'); bar.setAttribute('aria-controls', aside.id);
      bar.innerHTML = '<span class="sb-grip" aria-hidden="true"></span><span class="sb-text"><strong class="sb-label">' +
        (LABEL[tab] || 'Results') + '</strong><span class="sb-sum"></span></span><span class="sb-act">Show</span>';
      bar.addEventListener('click', function () { setOpen(aside, !aside.classList.contains('sheet-open')); });
      aside.insertBefore(bar, aside.firstChild);
      // keep the bar's summary current as the tab updates itself
      const watch = tab === 'outfit' ? $('#ovVerdict') : aside;
      if (watch && window.MutationObserver) new MutationObserver(function (list) {
        if (list.every(function (m) { return bar.contains(m.target); })) return;   // our own writes
        refresh(aside);
      }).observe(watch, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
      refresh(aside);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

    // switching tabs closes an open sheet and keeps the chosen tab in view in the tab bar
    $$('.tabs [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        closeAll();
        if (narrow.matches && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' });
        markSheet();
      });
    });

    // the header scrolls away up to its tab bar, which then stays at the top
    const mast = $('.masthead'), tabs = $('.tabs');
    function stick() { if (mast && tabs) document.documentElement.style.setProperty('--mast-hide', (narrow.matches ? tabs.offsetTop : 0) + 'px'); }
    stick(); window.addEventListener('resize', stick);
    if (narrow.addEventListener) narrow.addEventListener('change', function () { stick(); closeAll(); markSheet(); });

    // How it works: a way back to the contents from deep in the article
    const top = document.createElement('button');
    top.type = 'button'; top.id = 'howTop'; top.className = 'how-top'; top.hidden = true;
    top.innerHTML = '<span aria-hidden="true">↑</span> Contents';
    top.addEventListener('click', function () { const t = $('#howToc'); if (t) t.scrollIntoView({ block: 'start' }); });   // instant: the article is 60,000 px
    document.body.appendChild(top);
    window.addEventListener('scroll', function () {
      const how = $('#tab-how'), toc = $('#howToc');
      top.hidden = !(narrow.matches && how && how.classList.contains('active') && toc && toc.getBoundingClientRect().bottom < 0);
    }, { passive: true });

    // tabs also change without a click (the welcome's demo button opens the Palette): watch the panels
    if (window.MutationObserver) $$('.tab-panel').forEach(function (p) {
      new MutationObserver(function () { if (!p.classList.contains('active')) { const a = $('aside.side', p); if (a && a.classList.contains('sheet-open')) setOpen(a, false); } markSheet(); })
        .observe(p, { attributes: true, attributeFilter: ['class'] });
    });
    markSheet();
  }
  /* The page leaves room at the bottom for the bar when the open tab has one. */
  function markSheet() {
    const p = $('.tab-panel.active');
    document.body.classList.toggle('has-sheet', !!(p && $('aside.side', p)));
  }

  /* ---------- Touch screens (no hover), at any width ----------
     The instructions were written for a mouse: "point at", "hover", "click". On a touch screen they
     are rewritten as the page shows them, specific sentences first so that each still says what
     really happens, then "click" becomes "tap". Tooltips (title text), which a phone never shows,
     appear in a short message when something that has one but does nothing else is tapped. */
  const touch = window.matchMedia('(hover: none)');
  const SAY = [
    [/Hover a colour or cloth to try it on; click to keep it\./g, 'Tap a colour or cloth to wear it; Undo takes it back.'],
    [/Hover a colour anywhere to try it:/g, 'Tap a colour anywhere to try it:'],
    [/Point at a square for the nearest named colour; click it to put it in the study,/g, 'Tap a square to put the nearest named colour in the study,'],
    [/Point at a colour in the palette to see it in the selected place/g, 'Tap a colour in the palette to put it in the selected place'],
    [/Point at a colour in the palette to try one there/g, 'Tap a colour in the palette to put one there'],
    [/Point at a colour, or put one in the study, to see why it suits you or not/g, 'Put a colour in the study to see why it suits you or not'],
    [/; point at it for why/g, '; put it back in the study to see why'],
    [/the colour you point at, or the one in the selected place/g, 'the colour in the selected place'],
    [/\bPoint at\b/g, 'Tap'], [/\bpoint at\b/g, 'tap'],
    [/\bhover a colour\b/g, 'tap a colour'], [/\bHover a colour\b/g, 'Tap a colour'],
    [/\bClick\b/g, 'Tap'], [/\bclick\b/g, 'tap'], [/\bclicking\b/g, 'tapping'], [/\bClicking\b/g, 'Tapping']
  ];
  function retextNode(n) {
    let t = n.nodeValue, o = t;
    if (!t || !/[Pp]oint at|[Hh]over|[Cc]lick/.test(t)) return;
    SAY.forEach(function (r) { t = t.replace(r[0], r[1]); });
    if (t !== o) n.nodeValue = t;
  }
  function retext(root) {
    if (root.nodeType === 3) { retextNode(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.nodeName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n; while ((n = w.nextNode())) retextNode(n);
  }
  let toast = null, toastTimer = 0;
  function showTip(text) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'tip-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = text; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 4500);
  }
  function setUpTouch() {
    if (!touch.matches) return;
    retext(document.body);
    if (window.MutationObserver) new MutationObserver(function (list) {
      list.forEach(function (m) { if (m.type === 'characterData') retextNode(m.target); else m.addedNodes.forEach(retext); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', function (e) {
      const el = e.target.closest && e.target.closest('[title]');
      if (!el || el.closest('button, a, input, select, label, summary, [role=button], [role=radio], [role=tab]')) return;
      showTip(el.getAttribute('title'));
    });
  }

  function start() { setUp(); setUpTouch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
