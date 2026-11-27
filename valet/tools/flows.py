# SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Valet: the Dresser's routes, recorded. Optional; the Node tests do not need it.

The Node tests check the rules; this checks the Dresser's screens. It walks the routes a person takes
through the Dresser (dressing a piece, its colour, cloth and pattern, the fixes, saving an outfit, My
garments, Saved outfits) in a headless Chrome, once on a wide window and once on a phone-sized one.
After every step it writes down what the page shows: the outfit as stored, the saved garments and
outfits, and every line of text visible in the Dresser and its verdict panel (a long line is kept as
its start and a fingerprint). It then compares that with the record in tests/flows.json.

Use it around any change to the page code (js/ui/): run it before, change the code, run it again.
A change meant to alter nothing visible (a restructure) must pass unchanged. A change made on
purpose shows here as differences: read every one, and if each is what you meant, record the new
behaviour with --update (the changed record then goes in the same commit as the change).

Needs Python 3 and Playwright, once:  pip install playwright && python -m playwright install chromium
Run from the project folder:          python tools/flows.py            (compare with the record)
                                      python tools/flows.py --update   (write the record)
                                      python tools/flows.py --list     (the steps, without running)
Exit code 1 on a difference, a missing control, or an error on the page.
"""
import asyncio, difflib, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'index.html').as_uri()
RECORD = ROOT / 'tests' / 'flows.json'
VIEWS = {'wide': {'viewport': {'width': 1280, 'height': 900}},
         'phone': {'viewport': {'width': 390, 'height': 844}, 'has_touch': True, 'is_mobile': True}}

# Helpers put into the page. Each returns true, or the name of what it could not find, so a control
# that disappears is recorded as missing instead of stopping the walk.
HELPERS = r"""
window.__t = {
  q: function (sel, re) { const all = [...document.querySelectorAll(sel)]; return re ? all.find(e => new RegExp(re).test(e.textContent)) : all[0]; },
  C: function (sel, re) { const e = __t.q(sel, re); if (!e) return 'missing ' + sel + (re ? ' /' + re + '/' : ''); e.click(); return true; },
  S: function (sel, v) { const e = __t.q(sel); if (!e) return 'missing ' + sel; e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); return true; },
  F: function (sel, v) { const e = __t.q(sel); if (!e) return 'missing ' + sel; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; },
  O: function (sel) { const e = __t.q(sel); if (!e) return 'missing ' + sel; e.open = true; e.dispatchEvent(new Event('toggle')); return true; },
  // open a piece's editor: a click on an open piece closes it, so only click a closed one
  P: function (k) { const el = document.querySelector('.ov-piece[data-k=' + k + ']'); if (!el) return 'missing piece ' + k; if (!el.classList.contains('open')) el.querySelector('.ov-pick').click(); return true; },
  V: function (v) { return __t.C('.dr-views [data-view=' + v + ']'); },
  all: function (...r) { const bad = r.filter(x => x !== true); return bad.length ? bad.join('; ') : true; }
};
"""

# What the page shows, made comparable: no ids, dates or timings.
SNAP = r"""() => {
  const fp = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const line = t => t.length > 90 ? t.slice(0, 70) + '… #' + fp(t) : t;
  const sorted = x => Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object' ? Object.keys(x).sort().reduce((o, k) => (o[k] = sorted(x[k]), o), {}) : x;
  const st = window.VAPP.state;
  const o = JSON.parse(JSON.stringify(st.outfit)); delete o.savedId;
  Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') delete o[k].gid; });
  const panel = document.querySelector('.tab-panel.active');
  return {
    outfit: JSON.stringify(sorted(o)),
    garments: (st.garments || []).map(g => [g.slot, g.name, g.own, JSON.stringify(sorted(g.piece))].join(' | ')),
    saved: (st.wardrobe || []).map(w => [w.name, w.mark || ''].join(' | ')),
    text: panel ? panel.innerText.split('\n').map(s => s.trim()).filter(Boolean).map(line) : []
  };
}"""

# The routes: [name, script run in the page, wait in ms]. Scripts use the helpers above.
ASK_WAIT = 'ask'   # wait until My garments has finished its search
STEPS = [
    ['open the Dresser', "__t.C('.tabs [data-tab=outfit]')", 400],
    ['occasion: business', "__t.C('[data-occ=business]')", 250],
    ['occasion: smart casual', "__t.C('[data-occ=smart]')", 250],
    # a piece: colour
    ['shirt: open', "__t.P('shirt')", 300],
    ['shirt: first suggestion', "__t.C('.sug')", 300],
    ['shirt: search the library for blue', "__t.F('.lib-q', 'blue')", 300],
    ['shirt: clear the search, family chip neutrals', "__t.all(__t.F('.lib-q', ''), __t.C('[data-fam=Neutral]'))", 300],
    ['shirt: a library colour', "__t.C('.swatches.lib .swatch', 'White')", 300],
    ['shirt: family chip, all', "__t.C('[data-fam=all]')", 300],
    # a piece: cloth, pattern, second colour
    ['shirt: cloth tab', "__t.C('.ed-tabs button[data-t=cloth]')", 300],
    ['shirt: poplin', "__t.C('.cloth[data-cloth=poplin]')", 300],
    ['shirt: bengal stripe', "__t.C('button.pat[data-type=bengal]')", 300],
    ['shirt: second colour, a quick pick', "__t.C('.sec-quick .sec-pick')", 300],
    ['shirt: More colours, search burgundy', "__t.all(__t.O('.sec-more'), __t.F('.sec-q', 'burg'))", 300],
    ['shirt: second colour from the library', "__t.C('.sec-lib .sec-pick')", 300],
    ['shirt: second colour covers a third', "__t.C('[data-cover=\"0.33\"]')", 300],
    ['shirt: scale', "(() => { const r = document.querySelector('.pat-scale'); if (!r) return 'missing .pat-scale'; r.value = r.max; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); return true; })()", 300],
    ['shirt: plain again', "__t.C('button.pat[data-type=solid]')", 300],
    # what it is, the collar
    ['shirt: colour tab', "__t.C('.ed-tabs button[data-t=colour]')", 300],
    ['shirt: button-down collar', "__t.C('[data-collar=buttondown]')", 300],
    ['shirt: contrast collar, white', "__t.C('.collar-col[data-ccol=\"#f7f6f2\"]')", 300],
    ['shirt: collar in its own colour', "__t.C('.collar-col[data-ccol=\"\"]')", 300],
    ['shirt: semi-spread collar', "__t.C('[data-collar=semispread]')", 300],
    ['shirt: a polo instead', "__t.C('.kind[data-kind=polo]')", 300],
    ['shirt: a shirt again', "__t.C('.kind[data-kind=shirt]')", 300],
    # a layer that is not worn yet: put on, knit, take off
    ['knit: put on', "__t.C('[data-add=mid]')", 300],
    ['knit: open', "__t.P('mid')", 300],
    ['knit: a cardigan', "__t.C('.kind[data-kind=cardigan]')", 300],
    ['knit: cloth tab', "__t.C('.ed-tabs button[data-t=cloth]')", 300],
    ['knit: chunky', "__t.C('[data-knit=chunky]')", 300],
    ['knit: lambswool', "__t.C('.cloth[data-cloth=lambswool]')", 300],
    ['knit: fine gauge', "__t.C('[data-knit=fine]')", 300],
    ['knit: take off', "__t.C('.ov-piece[data-k=mid] .ov-on')", 300],
    # shoes: broguing, another type
    ['shoes: open', "__t.P('shoes')", 300],
    ['shoes: oxfords', "__t.C('.kind[data-kind=oxford]')", 300],
    ['shoes: cloth tab', "__t.C('.ed-tabs button[data-t=cloth]')", 300],
    ['shoes: brogued', "__t.C('[data-brogue=brogue]')", 300],
    ['shoes: plain', "__t.C('[data-brogue=plain]')", 300],
    ['shoes: loafers', "__t.C('.kind[data-kind=loafer]')", 300],
    # jacket: tartan, then the advice and the fixes
    ['jacket: open', "__t.P('jacket')", 300],
    ['jacket: cloth tab', "__t.C('.ed-tabs button[data-t=cloth]')", 300],
    ['jacket: flannel', "__t.C('.cloth[data-cloth=flannel]')", 300],
    ['jacket: tartan', "__t.C('button.pat[data-type=tartan]')", 300],
    ['jacket: lock', "__t.C('.ov-piece[data-k=jacket] .ov-lock')", 250],
    ['shoes: chunky trainers, which fail with a jacket', "__t.all(__t.P('shoes'), __t.C('.kind[data-kind=chunky]'))", 400],
    ['a fix, the first offered', "__t.C('.fixes button:not([disabled])')", 400],
    ['undo the fix', "__t.C('#ovUndo')", 300],
    ['undo the trainers', "__t.C('#ovUndo')", 300],
    ['choose the best colours', "__t.C('#ovComplete')", 600],
    ['undo again', "__t.C('#ovUndo')", 300],
    ['jacket: unlock', "__t.C('.ov-piece[data-k=jacket] .ov-lock')", 250],
    ['jacket: keep this, fix the rest', "__t.all(__t.P('jacket'), __t.C('.ov-keep'))", 600],
    ['season: summer', "__t.C('[data-season=summer]')", 400],
    ['season: winter', "__t.C('[data-season=winter]')", 400],
    # an accessory
    ['watch: open', "__t.C('.acc-tile[data-a=watch] .acc-pick')", 300],
    ['watch: rubber strap', "__t.S('.acc-strap', 'rubber')", 300],
    ['watch: leather strap', "__t.S('.acc-strap', 'leather')", 300],
    # Saved outfits
    ['save the outfit', "__t.all(__t.F('#ovName', 'Route test'), __t.C('#ovSave [data-save=new]'))", 400],
    ['Saved outfits', "__t.V('wardrobe')", 400],
    ['mark it good', "__t.C('.dr-item [data-wmark=good]')", 300],
    ['wear it', "__t.C('.dr-item [data-wear]')", 400],
    # My garments, from the Outfit view
    ['jacket: save to my garments', "__t.all(__t.P('jacket'), __t.C('[data-gsave=new]'))", 400],
    ['trousers: save to my garments', "__t.all(__t.P('trousers'), __t.C('[data-gsave=new]'))", 400],
    ['shoes: save to my garments', "__t.all(__t.P('shoes'), __t.C('[data-gsave=new]'))", 400],
    ['shirt: save to my garments', "__t.all(__t.P('shirt'), __t.C('[data-gsave=new]'))", 400],
    ['jacket: what goes with it?', "__t.all(__t.P('jacket'), __t.C('[data-gask]'))", ASK_WAIT],
    ['mark the first outfit found good', "__t.C('.cl-outfit [data-mark=good]')", 300],
    # My garments: add one by hand
    ['add a garment', "__t.C('#clAdd')", 300],
    ['form: position, type, cloth, pattern', "__t.all(__t.S('#clEdit [data-f=slot]', 'trousers'), __t.S('#clEdit [data-f=kind]', 'trousers'), __t.S('#clEdit [data-f=cloth]', 'flannel'), __t.S('#clEdit [data-f=pat]', 'tartan'))", 300],
    ['form: colours and share', "__t.all(__t.S('#clEdit [data-col=hex]', '#1d2a44'), __t.S('#clEdit [data-col=hex2]', '#234238'), __t.S('#clEdit [data-f=cover]', '0.5'))", 300],
    ['form: add', "__t.C('#clEdit button[type=submit]')", 400],
    ['what goes with it? (from the note)', "__t.C('[data-nask]')", ASK_WAIT],
    ['close the answer', "__t.C('#clClose')", 300],
    ['edit it: thinking of buying', "__t.all(__t.C('.cl-item [data-edit]', ''), true)", 300],
    ['edit: untick I own it, save', "(() => { const c = document.querySelector('#clEdit [data-f=own]'); if (!c) return 'missing own'; c.checked = false; c.dispatchEvent(new Event('change')); return __t.C('#clEdit button[type=submit]'); })()", 400],
    ['delete a garment', "__t.C('.cl-item [data-del]')", 300],
    ['undo the delete', "__t.C('#clUndo')", 300],
    ['occasion of the outfits: business', "__t.C('[data-cocc=business]')", 300],
    ['which colour to buy', "__t.all(__t.O('.cl-buy'), __t.S('#clBuySlot', 'tie'), __t.C('#clBuyGo'))", ASK_WAIT],
    ['wear a garment', "__t.all(__t.V('garments'), __t.C('.cl-item [data-wear]'))", 400],
    # Saved outfits: delete and undo
    ['Saved outfits again', "__t.V('wardrobe')", 400],
    ['delete a saved outfit', "__t.C('.dr-item [data-del]')", 300],
    ['undo it', "__t.C('.dr-undo button, #drUndo')", 300],
    ['back to the outfit', "__t.V('outfit')", 300],
]

async def walk(browser, view, ctx, steps):
    c = await browser.new_context(**ctx); pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('page error: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    await pg.goto(PAGE); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#welcomeDemo').click()"); await pg.wait_for_timeout(600)
    await pg.evaluate(HELPERS)
    out = [{'step': 'the demo profile', 'ok': True, **(await pg.evaluate(SNAP))}]
    for name, script, wait in steps:
        ok = await pg.evaluate(script)
        if wait == ASK_WAIT:
            for _ in range(80):   # up to 20 s
                if await pg.evaluate("!!document.querySelector('.cl-sum, .cl-buylist, .cl-ask .dr-empty') && !document.querySelector('#clStop')"): break
                await pg.wait_for_timeout(250)
            await pg.wait_for_timeout(200)
        else:
            await pg.wait_for_timeout(wait)
        out.append({'step': name, 'ok': ok, **(await pg.evaluate(SNAP))})
    await c.close()
    return out, errs

KEYS = ['outfit', 'garments', 'saved', 'text']
def pack(rec):
    """The record keeps a value only where it changed from the step before ('=' otherwise), to stay small."""
    out = {}
    for view, steps in rec.items():
        prev, rows = {}, []
        for st in steps:
            row = {'step': st['step'], 'ok': st['ok']}
            for k in KEYS: row[k] = '=' if k in prev and prev[k] == st[k] else st[k]
            prev = st; rows.append(row)
        out[view] = rows
    return out
def unpack(rec):
    out = {}
    for view, rows in rec.items():
        prev, steps = {}, []
        for row in rows:
            st = dict(row)
            for k in KEYS:
                if st[k] == '=': st[k] = prev[k]
            prev = st; steps.append(st)
        out[view] = steps
    return out

def compare(old, new):
    """Differences, step by step: what changed and where."""
    diffs = []
    for view in new:
        a, b = old.get(view, []), new[view]
        if len(a) != len(b): diffs.append(f'{view}: {len(a)} steps recorded, {len(b)} now (the routes changed: run --update)')
        for i, (x, y) in enumerate(zip(a, b)):
            if x['step'] != y['step']: diffs.append(f'{view}, step {i}: recorded "{x["step"]}", now "{y["step"]}"'); break
            for key in ['ok'] + KEYS:
                if x[key] == y[key]: continue
                head = f'{view}, step {i} "{y["step"]}", {key}:'
                if key == 'text' or isinstance(x[key], list):
                    d = [l for l in difflib.unified_diff(x[key], y[key], lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]
                    diffs.append(head + '\n    ' + '\n    '.join(d[:12]) + ('\n    …' if len(d) > 12 else ''))
                else:
                    diffs.append(f'{head}\n    recorded {str(x[key])[:300]}\n    now      {str(y[key])[:300]}')
    return diffs

async def main():
    if '--list' in sys.argv:
        for i, s in enumerate(STEPS, 1): print(f'{i:3} {s[0]}')
        return 0
    new, errs = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for view, ctx in VIEWS.items():
            new[view], e = await walk(b, view, ctx, STEPS)
            errs += [f'{view}: {x}' for x in e]
        await b.close()
    missing = [f'{v}, "{s["step"]}": {s["ok"]}' for v in new for s in new[v] if s['ok'] is not True]
    for x in errs: print(x)
    if '--update' in sys.argv:
        RECORD.write_text(json.dumps(pack(new), indent=0, ensure_ascii=False))
        print(f'flows: record written ({sum(len(v) for v in new.values())} steps, {len(VIEWS)} windows)')
        for m in missing: print('  missing control:', m)
        return 1 if errs or missing else 0
    if not RECORD.exists(): print('flows: no record yet; run python tools/flows.py --update'); return 1
    diffs = compare(unpack(json.loads(RECORD.read_text())), new)
    for d in diffs[:30]: print(d)
    if len(diffs) > 30: print(f'… and {len(diffs) - 30} more')
    n = sum(len(v) for v in new.values())
    if diffs or errs: print(f'flows: {len(diffs)} difference(s), {len(errs)} error(s) in {n} steps. Read each: if every one is meant, run python tools/flows.py --update')
    else: print(f'flows: the Dresser behaves exactly as recorded ({n} steps, {len(VIEWS)} windows)')
    return 1 if diffs or errs else 0

sys.exit(asyncio.run(main()))
