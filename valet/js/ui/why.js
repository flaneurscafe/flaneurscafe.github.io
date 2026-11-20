/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the explanation bubble shared by the Dresser ("Why"), Proportion and Fit ("Sources").
   A button carries data-how, the id of the passage in How it works that explains the rule or target,
   and data-level, its badge. Pressing it opens, under its item, the opening of that passage (taken from
   the page itself, so it cannot drift from it), what the badge means, and a link to the whole passage.
   One listener serves the whole page, so a tab that redraws needs no new wiring.
   The maps below say which passage explains each Proportion target, each Fit size row and each kind of
   Fit result; tests/why.js checks that every one is mapped and every passage exists. */
(function () {
  'use strict';
  const MAP = {
    // Proportion: a target's id -> its passage (How it works, section 13)
    target: {
      glasses: 'p-glasses', frameDepth: 'p-glasses', collar: 'r-collar', brim: 'p-also', pattern: 'p-also', gorge: 'p-also',
      shoulder: 'p-shoulder', lapel: 'p-shoulder', tieWidth: 'p-shoulder', tieLength: 'p-periods', knit: 'p-periods', waistcoat: 'p-periods',
      button: 'p-button', sleeve: 'f-lengths', jacketLength: 'p-jacket', coat: 'p-jacket', rise: 'p-rise', opening: 'p-hem', hem: 'p-hem'
    },
    // Fit, Your sizes: a row's label -> its passage (sections 10, 14 and 15)
    size: {
      'Collar': 'f-collar', 'Sleeve, centre back to cuff': 'f-lengths', 'European size (German, Italian, French)': 'f-eu', 'UK and US size': 'f-ukus',
      'Drop (chest minus waist)': 'f-drop', 'Jacket sleeve, from the shoulder seam': 'f-lengths', 'Jacket length, back of the collar to the hem': 'p-jacket',
      'Waist': 'f-labels', 'European size (German, Italian)': 'f-labels', 'Inside leg of the trousers': 'f-lengths', 'Watch case': 'r-size',
      'Hat': 'f-hats', 'Shoes': 'f-hats'
    },
    // Fit, Will it fit?: what a measurement was checked against -> its passage and badge (section 14)
    against: { yours: ['f-yours', 'A'], proportion: ['f-targets', 'B'], body: ['f-ease', 'B'] },
    // ... and a field's own rule, by the measurement (sections 14 and 15)
    rule: { insole: 'f-hats', inner: 'f-hats', shoulder: 'f-lengths', sleeve: 'f-lengths' },
    label: 'f-labels', periods: 'f-periods'
  };
  const BADGE = {
    'A': 'Badge A: measured science, or a definition (a size standard).',
    'A/B': 'Badge A/B: the measurement is science (A); the threshold that decides the verdict is Valet\u2019s working value (B).',
    'B': 'Badge B: a convention of tailoring, colour or fit, from published writers or the Style Guide.'
  };
  const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // the "Sources ›" pill for Proportion and Fit; empty when the item has no passage
  function button(how, level, label) {
    if (!how) return '';
    return '<button type="button" class="why-btn" data-how="' + esc(how) + '" data-level="' + esc(level || 'B') + '" aria-expanded="false">' +
      esc(label || 'Sources') + '<span class="rule-chev" aria-hidden="true"></span></button>';
  }
  function open(btn) {
    const host = btn.closest('.why-host') || btn.closest('li') || btn.parentElement;
    const was = host.querySelector(':scope > .rule-bubble');
    document.querySelectorAll('.rule-bubble').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.rule-help[aria-expanded="true"], .why-btn[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (was) return;                                         // a second press closes it
    const el = document.getElementById(btn.dataset.how); if (!el) return;
    const txt = el.textContent.replace(/\s+/g, ' ').replace(/^\s*(A\/B|A|B|C)(\s+(A|B))?\s+/, '').trim();
    let short = txt;
    if (txt.length > 320) { const cut = txt.slice(0, 320), stop = cut.lastIndexOf('. '); short = stop > 120 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '\u2026'; }
    const sec = el.closest('section'), h2 = sec && sec.querySelector('h2');
    const lv = btn.dataset.level || 'B';
    const bubble = document.createElement('div');
    bubble.className = 'rule-bubble'; bubble.setAttribute('role', 'note');
    bubble.innerHTML = '<p>' + esc(short) + '</p>' + (BADGE[lv] ? '<p class="rule-badge-note">' + esc(BADGE[lv]) + '</p>' : '') +
      '<button type="button" class="rule-more">How it works, ' + esc(h2 ? h2.textContent.trim() : 'the rule') + ' \u2192</button>';
    host.appendChild(bubble); btn.setAttribute('aria-expanded', 'true');
    bubble.querySelector('.rule-more').addEventListener('click', function () {
      const tab = document.querySelector('.tabs [data-tab=how]'); if (tab) tab.click();
      setTimeout(function () { el.scrollIntoView({ block: 'center' }); el.classList.add('rule-flash'); setTimeout(function () { el.classList.remove('rule-flash'); }, 2200); }, 60);
    });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (ev) {
      const btn = ev.target.closest && ev.target.closest('.rule-help[data-how], .why-btn[data-how]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation(); open(btn);
    });
  }
  window.VWHY = { MAP: MAP, BADGE: BADGE, button: button, open: open };
})();
