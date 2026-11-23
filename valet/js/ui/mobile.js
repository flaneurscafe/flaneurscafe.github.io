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
// @ts-check
(function () {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const narrow = window.matchMedia('(max-width: 860px)');

  const LABEL = { you: 'Your profile and chart', colour: 'Study and chart', proportion: 'Your figure and try-on', outfit: 'Verdict and chart' };

  /* One line on the bar: how things stand on this tab, as the tab itself announced it
     (VAPP.result, in core.js). Tabs without a result show only their label. */
  function summary(tab) {
    const r = window.VAPP && window.VAPP.results[tab];
    return r ? { text: r.text, level: r.level } : { text: '', level: '' };
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
      refresh(aside);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    // keep each bar's summary current: a tab announces its result when it draws it
    document.addEventListener('valet:result', function (e) {
      $$('.tab-panel aside.side').forEach(function (a) { if (tabOf(a) === /** @type {CustomEvent} */ (e).detail.tab) refresh(a); });
    });

    // the chosen tab stays in view in the tab bar (switching tabs closes an open sheet: valet:layout, below)
    $$('.tabs [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { if (narrow.matches && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
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

    markSheet();
  }
  /* The page leaves room at the bottom for the bar when the open tab has one. */
  function markSheet() {
    const p = $('.tab-panel.active'), a = p && $('aside.side', p);
    document.body.classList.toggle('has-sheet', !!(a && getComputedStyle(a).display !== 'none'));
  }
  // the layout changed: a tab was switched (core.js showTab), or a tab hid its side panel (the
  // Dresser's Saved outfits view)
  document.addEventListener('valet:layout', function () { closeAll(); markSheet(); });

  /* ---------- Touch screens (no hover), at any width ----------
     The instructions choose their own wording for a touch screen when they are drawn (VAPP.say and
     data-touch, in core.js). What is left here: tooltips (title text), which a phone never shows,
     appear in a short message when something that has one but does nothing else is tapped. */
  const touch = window.matchMedia('(hover: none)');
  let toast = null, toastTimer = 0;
  function showTip(text) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'tip-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = text; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 4500);
  }
  function setUpTouch() {
    if (!touch.matches) return;
    document.addEventListener('click', function (e) {
      const t = /** @type {HTMLElement} */ (e.target), el = t.closest && t.closest('[title]');
      if (!el || el.closest('button, a, input, select, label, summary, [role=button], [role=radio], [role=tab]')) return;
      showTip(el.getAttribute('title'));
    });
  }

  function start() { setUp(); setUpTouch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
