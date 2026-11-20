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
  /* What each Proportion and Fit item rests on: references by their number in How it works, section 19,
     and/or one of three honest labels. Read each against its section before changing it: it is a statement
     about evidence. tests/why.js checks that every item has an entry, that every number is a reference, and
     that an entry with no reference says why. */
  const KIND = {
    definition: 'A definition: a size standard, not an opinion.',
    working: 'Valet\u2019s working value: no published source.',
    uncited: 'A common tailoring convention, stated in How it works; no published source is cited for it yet.'
  };
  const SOURCES = {
    // Proportion targets (section 13)
    'target:glasses': { kind: 'uncited', note: 'The opticians\u2019 rule of thumb.' },
    'target:frameDepth': { refs: [50], kind: 'working', note: 'Flusser\u2019s counterbalance for the collar, applied to the lens by analogy; the millimetres are Valet\u2019s.' },
    'target:brim': { kind: 'uncited' },
    'target:collar': { refs: [49, 50] },
    'target:tieWidth': { refs: [50], note: 'Flusser: the tie matches the lapel (Dressing the Man, chapter 3).' },
    'target:tieLength': { kind: 'uncited', note: 'A period tendency, from tailoring histories; check it against period garments.' },
    'target:knit': { kind: 'uncited', note: 'A period tendency, from tailoring histories.' },
    'target:waistcoat': { kind: 'uncited', note: 'A period tendency, from tailoring histories.' },
    'target:shoulder': { refs: [50], note: 'Flusser, Dressing the Man, chapter 3.' },
    'target:gorge': { kind: 'uncited' },
    'target:lapel': { refs: [50], note: 'Flusser, Dressing the Man, chapter 3.' },
    'target:button': { kind: 'uncited' },
    'target:sleeve': { refs: [57] },
    'target:jacketLength': { kind: 'uncited' },
    'target:coat': { kind: 'uncited' },
    'target:rise': { refs: [65], note: 'Indirect: a study of the waistline of women\u2019s dresses, not of trousers.' },
    'target:opening': { kind: 'uncited' },
    'target:hem': { kind: 'uncited' },
    'target:pattern': { kind: 'working' },
    // Fit, your sizes (sections 10, 14 and 15)
    'size:Collar': { refs: [55, 56] },
    'size:Sleeve, centre back to cuff': { refs: [56] },
    'size:European size (German, Italian, French)': { refs: [52], kind: 'definition' },
    'size:UK and US size': { kind: 'uncited', note: 'The chest in inches, as shops label it.' },
    'size:Drop (chest minus waist)': { kind: 'uncited', note: 'Read off shops\u2019 size labels rather than any writer.' },
    'size:Jacket sleeve, from the shoulder seam': { refs: [57] },
    'size:Jacket length, back of the collar to the hem': { kind: 'uncited' },
    'size:Waist': { refs: [72] },
    'size:European size (German, Italian)': { refs: [72] },
    'size:Inside leg of the trousers': { kind: 'uncited' },
    'size:Watch case': { kind: 'working' },
    'size:Hat': { kind: 'definition' },
    'size:Shoes': { kind: 'definition', note: 'Paris points are a definition; the 1.5 cm a last adds to the foot is a makers\u2019 convention.' },
    // Fit, will it fit? (section 14)
    'against:yours': { kind: 'uncited', note: 'The method tailors and made-to-measure shops ask for.' },
    'against:proportion': { kind: 'uncited', note: 'The Proportion target for this length; its own Sources say what it rests on.' },
    'against:body': { refs: [53, 54] },
    'rule:sleeve': { refs: [57] },
    'rule:shoulder': { kind: 'uncited' },
    'rule:insole': { kind: 'definition', note: 'Paris points are a definition; the 1.5 cm a last adds to the foot is a makers\u2019 convention.' },
    'rule:inner': { kind: 'definition' },
    'label': { refs: [52, 72], kind: 'definition' },
    'periods': { kind: 'uncited', note: 'Period tendencies from tailoring histories, given as ranges; check them against period garments.' }
  };
  const BADGE = {
    'A': 'Badge A: measured science, or a definition (a size standard).',
    'A/B': 'Badge A/B: the measurement is science (A); the threshold that decides the verdict is Valet\u2019s working value (B).',
    'B': 'Badge B: a convention of tailoring, colour or fit, from published writers or the Style Guide.'
  };
  const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // the "Sources ›" pill for Proportion and Fit; empty when the item has no passage
  function button(how, level, src) {
    if (!how) return '';
    return '<button type="button" class="why-btn" data-how="' + esc(how) + '" data-level="' + esc(level || 'B') + '"' + (src ? ' data-src="' + esc(src) + '"' : '') + ' aria-expanded="false">' +
      'Sources<span class="rule-chev" aria-hidden="true"></span></button>';
  }
  function open(btn) {
    const host = btn.closest('.why-host') || btn.closest('li') || btn.parentElement;
    const was = host.querySelector(':scope > .rule-bubble');
    document.querySelectorAll('.rule-bubble').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.rule-help[aria-expanded="true"], .why-btn[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (was) return;                                         // a second press closes it
    const el = document.getElementById(btn.dataset.how); if (!el) return;
    if (btn.dataset.src) return sources(btn, host, el);
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
  /* Proportion and Fit: the references the item rests on, as listed in section 19 (with their links), or
     what it is instead; the explanation is a link at the foot. */
  function sources(btn, host, el) {
    const e = SOURCES[btn.dataset.src] || {}, lv = btn.dataset.level || 'B';
    const refs = (e.refs || []).map(function (n) {
      const li = document.getElementById('ref-' + n); if (!li) return '';
      const c = li.cloneNode(true); c.removeAttribute('id');
      c.querySelectorAll('.ref-n').forEach(function (x) { x.remove(); });       // the number is shown once, in its own column
      c.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
      return '<li><span class="src-n">' + n + '</span><span>' + c.innerHTML.trim() + '</span></li>';
    }).join('');
    const sec = el.closest('section'), h2 = sec && sec.querySelector('h2');
    const bubble = document.createElement('div');
    bubble.className = 'rule-bubble src-bubble'; bubble.setAttribute('role', 'note');
    bubble.innerHTML = '<p class="src-head"><strong>Sources</strong> <span class="badge ' + esc(lv.replace('/', '')) + '">' + esc(lv) + '</span></p>' +
      (refs ? '<ul class="src-list">' + refs + '</ul>' : '') +
      (e.kind ? '<p class="src-kind">' + esc(KIND[e.kind]) + '</p>' : '') + (e.note ? '<p class="src-note">' + esc(e.note) + '</p>' : '') +
      '<button type="button" class="rule-more">The explanation: How it works, ' + esc(h2 ? h2.textContent.trim() : 'this section') + ' \u2192</button>';
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
  window.VWHY = { MAP: MAP, SOURCES: SOURCES, KIND: KIND, BADGE: BADGE, button: button, open: open };
})();
