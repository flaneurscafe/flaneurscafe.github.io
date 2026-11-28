# SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Valet: every fix the Dresser offers, recorded from the page. Optional; the Node tests do not need it.

The fix buttons under the Dresser's checks ("Try navy trousers", "Trousers in worsted instead",
"Make the tie plain"...) decide what to change; until 1.21 that decision lived in the page code.
This walks 60 seeded outfits (some with a piece locked) in winter, summer and autumn, in a headless
Chrome. For each it writes down every fix button under every check, presses each one in turn on a
fresh copy of the outfit, and writes down the outfit it leaves (the pieces that changed) and the
note it shows. It also presses Choose the best colours, and Keep this, fix the rest for each piece worn, and
writes down what each changes and its note. The record is tests/fixes.json; tests/fixes.js replays
it through js/dress.js in Node, so the page and the module must agree on every fix and both buttons.

Run it around a change to the fixes: before, to see the page as it is; after, to compare.
Needs Python 3 and Playwright, once:  pip install playwright && python -m playwright install chromium
Run from the project folder:          python tools/fixes.py            (compare with the record)
                                      python tools/fixes.py --update   (write the record)
Exit code 1 on a difference or an error on the page.
"""
import asyncio, json, os, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'index.html').as_uri()
RECORD = ROOT / 'tests' / 'fixes.json'
N, SEASONS = int(os.environ.get('FIXN', 60)), ['winter', 'summer', 'autumn']   # FIXN=… for a quicker partial run

# The outfits: seeded, so the same every run; built from the garment lists the page itself uses.
MAKE = r"""(n) => {
  const G = window.VGARM, O = window.VOUTFIT, VP = window.VPAT, D = window.VDATA;
  let seed = 20261128; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; const pick = a => a[Math.floor(rnd() * a.length)];
  const hexes = D.colours.map(c => c.hex), out = [];
  for (let i = 0; i < n; i++) {
    const raw = { occasion: pick(G.OCCASIONS.map(x => x.id)), locks: {} };
    G.POSITIONS.forEach(pos => {
      const kd = pick(pos.kinds), cloth = kd.cloths && kd.cloths.length ? pick(kd.cloths) : undefined;
      let pat = { type: 'solid' }; const t = pick(kd.pats.filter(t => t === 'solid' || !cloth || G.patOK(cloth, t)));
      if (t !== 'solid' && rnd() < 0.6) { const ty = VP.byId[t]; pat = { type: t, scale: +(ty.min + (ty.max - ty.min) * rnd()).toFixed(2), hex2: pick(hexes) }; }
      raw[pos.key] = { on: !pos.optional || rnd() < 0.5, hex: pick(hexes), kind: kd.id, cloth: cloth, pat: pat };
      if (kd.knit && rnd() < 0.3) raw[pos.key].knit = 'chunky';
    });
    if (rnd() < 0.15) { const k = pick(['shirt', 'trousers', 'jacket', 'shoes', 'tie']); raw.locks[k] = true; }
    out.push(O.normOutfit(raw));
  }
  return out;
}"""

# One outfit in one season: every fix offered, and what pressing each one does.
RUN = r"""async ([o, season]) => {
  const V = window.VAPP, O = window.VOUTFIT, src = JSON.stringify(o);
  const canon = x => JSON.stringify(x, Object.keys(x).sort());
  // the season changes the colouring: worked out once per case; each fix then starts from a fresh copy
  if (V.state.season !== season) { V.state.season = season; V.update(); }
  const set = () => { V.state.outfit = O.normOutfit(JSON.parse(src)); window.VWARD.render(); };
  set();
  const rows = [...document.querySelectorAll('#ovChecks li[data-ci]')].map(li => ({ ci: +li.dataset.ci,
    fixes: [...li.querySelectorAll('.fixes button[data-c]')].map(b => ({ label: b.textContent, hex: (b.querySelector('.d') || {}).style ? b.querySelector('.d').style.backgroundColor : undefined, disabled: b.disabled || undefined })) }))
    .filter(r => r.fixes.length).sort((x, y) => x.ci - y.ci);
  const before = JSON.parse(src);
  for (const r of rows) for (let j = 0; j < r.fixes.length; j++) {
    if (r.fixes[j].disabled) continue;
    set();
    const b = document.querySelector('#ovChecks li[data-ci="' + r.ci + '"] .fixes button[data-f="' + j + '"]');
    if (!b) { r.fixes[j].missing = true; continue; }
    b.click();
    const now = JSON.parse(JSON.stringify(V.state.outfit)), changed = {};
    Object.keys(Object.assign({}, now, before)).forEach(k => { if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) changed[k] = now[k] === undefined ? null : now[k]; });
    const note = document.querySelector('.ov-note');
    r.fixes[j].changed = changed; r.fixes[j].note = note ? note.textContent : '';
  }
  // the two buttons that change several pieces at once: Choose the best colours, and Keep this, fix
  // the rest for each piece worn (what each changes, and its note)
  const press = act => { set(); act(); const now = JSON.parse(JSON.stringify(V.state.outfit)), changed = {};
    Object.keys(Object.assign({}, now, before)).forEach(k => { if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) changed[k] = now[k] === undefined ? null : now[k]; });
    const note = document.querySelector('.ov-note'); return { changed: changed, note: note ? note.textContent : '' }; };
  const whole = { complete: press(() => document.querySelector('#ovComplete').click()), keep: {} };
  ['shirt', 'mid', 'jacket', 'trousers', 'shoes', 'tie'].forEach(k => { if (before[k] && before[k].on !== false) whole.keep[k] = press(() => window.VDRCORE.keepAndFix(k)); });
  return { rows: rows, whole: whole };
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1280, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(PAGE); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#welcomeDemo').click()"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('.tabs [data-tab=outfit]').click()"); await pg.wait_for_timeout(300)
        outfits = await pg.evaluate(MAKE, N)
        # the profile the fixes are worked out for (the demo), as the page holds it, for tests/fixes.js
        state = await pg.evaluate("(() => { const s = JSON.parse(JSON.stringify(window.VAPP.state)); delete s.outfit; delete s.wardrobe; delete s.garments; delete s.study; return s; })()")
        cases = []
        for se in SEASONS:
            for i, o in enumerate(outfits):
                r = await pg.evaluate(RUN, [o, se])
                cases.append({'i': i, 'season': se, 'rows': r['rows'], 'whole': r['whole']})
        await b.close()
    rec = {'state': state, 'outfits': outfits, 'cases': cases}
    nfix = sum(len(r['fixes']) for c in cases for r in c['rows']); nwhole = sum(1 + len(c['whole']['keep']) for c in cases)
    if errs:
        for e in errs[:10]: print('page error:', e)
    if '--update' in sys.argv:
        RECORD.write_text(json.dumps(rec, separators=(',', ':')))
        print(f'fixes: record written ({len(outfits)} outfits, {len(cases)} cases, {nfix} fixes, {nwhole} presses of the two outfit buttons)')
        sys.exit(1 if errs else 0)
    old = json.loads(RECORD.read_text())
    diffs = [f"outfit {c['i']} {c['season']}" for c, d in zip(cases, old['cases']) if c != d]
    if old['outfits'] != outfits or old['state'] != state: diffs.insert(0, 'the seeded outfits or the profile differ from the record')
    for d in diffs[:10]: print('differs:', d)
    print(f'fixes: {len(diffs)} of {len(cases)} cases differ' if diffs else f'fixes: the page offers and applies every fix, and both outfit buttons, exactly as recorded ({len(cases)} cases, {nfix} fixes, {nwhole} presses)')
    sys.exit(1 if diffs or errs else 0)

asyncio.run(main())
