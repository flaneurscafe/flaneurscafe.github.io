# SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Valet: a quick browser check. Optional; the Node tests do not need it.

Opens index.html in a headless Chrome, on a wide window and on a phone-sized one, loads the demo
profile, switches through the four seasons (the skin, the profile card and a season note and its
fix on the Dresser), opens every tab and presses every visible button in it (except ones that delete, reset,
import, export, print or save), opens and closes the Colours from photos window, then opens Fit
and presses each garment. Reports any error the page
writes to the console. Nothing is saved; it uses a fresh browser each time.

Needs Python 3 and Playwright, once:  pip install playwright && python -m playwright install chromium
Run from the project folder:          python tools/smoke.py
Exit code 1 if there was an error.
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
SKIP = r'/delete|remove|clear|reset|import|export|print|save|photo|undo|start over/i'

async def run(browser, name, ctx):
    c = await browser.new_context(**ctx); pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('error: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    await pg.goto(PAGE); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#welcomeDemo').click()"); await pg.wait_for_timeout(800)
    # The season switch (1.20): every tab follows it; spring keeps the winter skin, autumn lies
    # between winter and summer; on the Dresser the demo's flannel trousers are noted in summer, the
    # note's fix puts them in a cloth that is in season, and spring and autumn note nothing
    sk = {}
    for se in ['winter', 'spring', 'summer', 'autumn']:
        await pg.evaluate(f"document.querySelector('#season button[data-season={se}]').click()"); await pg.wait_for_timeout(250)
        sk[se] = await pg.evaluate("""() => { const a = window.VAPP.analysis, t = document.querySelector('#profileCard .season-tag');
            return { season: a.season, L: a.lab.skin[0], tag: t ? t.textContent : '', pressed: document.querySelector('#season [aria-checked=true]').dataset.season }; }""")
        if sk[se]['season'] != se or sk[se]['tag'] != se or sk[se]['pressed'] != se: errs.append(f'season {se}: the page shows {sk[se]}')
    if not (abs(sk['spring']['L'] - sk['winter']['L']) < 0.01 and sk['summer']['L'] < sk['autumn']['L'] < sk['winter']['L']):
        errs.append('season: skin lightness ' + ', '.join(f"{k} {v['L']:.1f}" for k, v in sk.items()) + ' (spring should equal winter, autumn lie between)')
    await pg.evaluate("document.querySelector('.tabs [data-tab=outfit]').click()"); await pg.wait_for_timeout(300)
    note = "() => [...document.querySelectorAll('#tab-outfit li')].find(l => /winter cloth in summer/.test(l.textContent))"
    seasonFix = 'not tried'
    for se in ['spring', 'autumn', 'summer']:
        await pg.evaluate(f"document.querySelector('#season button[data-season={se}]').click()"); await pg.wait_for_timeout(300)
        has = await pg.evaluate(f"!!({note})()")
        mid = await pg.evaluate(f"[...document.querySelectorAll('#tab-outfit li')].some(l => /Season: {se}: winter cloth suits a cool {se} day/.test(l.textContent))")
        if se != 'summer' and (has or not mid): errs.append(f'season {se}: the flannel trousers are not judged as in-between cloth (noted as in summer: {has})')
        if se == 'summer':
            if not has: errs.append('season summer: the demo\'s flannel trousers are not noted'); continue
            await pg.evaluate(f"({note})().querySelector('button[data-c]:not([disabled])').click()"); await pg.wait_for_timeout(300)
            after = await pg.evaluate("""() => { const t = window.VAPP.state.outfit.trousers; return { cloth: t.cloth, season: window.VGARM.CLOTHS[t.cloth].season }; }""")
            still = await pg.evaluate(f"!!({note})()")
            seasonFix = after['cloth']
            if after['season'] == 'winter' or still: errs.append(f'season summer: the fix left {after}, note still shown: {still}')
    await pg.evaluate("document.querySelector('#season button[data-season=winter]').click()"); await pg.wait_for_timeout(200)
    print(f"{name}: seasons, skin L* " + ', '.join(f"{k} {v['L']:.1f}" for k, v in sk.items()) + f"; summer fix put the trousers in {seasonFix}")
    tabs = await pg.evaluate("[...document.querySelectorAll('.tabs [data-tab]')].map(b => b.dataset.tab)")
    for t in tabs:
        await pg.evaluate(f"document.querySelector('.tabs [data-tab={t}]').click()"); await pg.wait_for_timeout(400)
        n = await pg.evaluate("""() => { let n = 0;
            document.querySelectorAll('.tab-panel.active button').forEach(b => {
              if (b.offsetParent && !%s.test(b.textContent || '')) { b.click(); n++; } }); return n; }""" % SKIP)
        await pg.wait_for_timeout(300)
        print(f'{name}: {t}, {n} buttons')
    # Dresser: the Colours from photos window opens from a piece and closes with Escape
    await pg.evaluate("document.querySelector('.tabs [data-tab=outfit]').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('.ov-piece[data-k=jacket] .ov-pick').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('.mine-open').click()"); await pg.wait_for_timeout(300)
    shown = await pg.evaluate("!document.querySelector('#photoOv').hidden")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    gone = await pg.evaluate("document.querySelector('#photoOv').hidden")
    if not (shown and gone): errs.append('Colours from photos: did not open and close')
    print(f'{name}: Colours from photos opened and closed')
    # My garments: save the jacket, trousers and shoes from the editor, ask about the jacket, mark the
    # first outfit found and find the mark in Saved outfits
    await pg.evaluate("document.querySelector('.dr-views [data-view=outfit]').click()"); await pg.wait_for_timeout(200)
    for k in ['jacket', 'trousers', 'shoes']:
        for _ in range(2):   # a click on an open piece closes it: open it again
            await pg.evaluate(f"document.querySelector('.ov-piece[data-k={k}] .ov-pick').click()"); await pg.wait_for_timeout(150)
            if await pg.evaluate("!!document.querySelector('[data-gsave=new]')"): break
        await pg.evaluate("document.querySelector('[data-gsave=new]') && document.querySelector('[data-gsave=new]').click()"); await pg.wait_for_timeout(150)
    await pg.evaluate("document.querySelector('.dr-views [data-view=garments]').click()"); await pg.wait_for_timeout(200)
    have = await pg.evaluate("document.querySelectorAll('.cl-item').length")
    await pg.evaluate("document.querySelector('.cl-item [data-ask]').click()")
    for _ in range(40):
        if await pg.evaluate("!!document.querySelector('.cl-sum')"): break
        await pg.wait_for_timeout(250)
    found = await pg.evaluate("document.querySelectorAll('.cl-outfit').length")
    await pg.evaluate("document.querySelector('.cl-outfit [data-mark=good]') && document.querySelector('.cl-outfit [data-mark=good]').click()")
    await pg.evaluate("document.querySelector('.dr-views [data-view=wardrobe]').click()"); await pg.wait_for_timeout(200)
    marked = await pg.evaluate("document.querySelectorAll('.dr-item [data-wmark=good][aria-pressed=true]').length")
    if have != 3 or not found or marked != 1: errs.append(f'My garments: {have} garments saved, {found} outfits found, {marked} marked')
    print(f'{name}: My garments, {have} garments, {found} outfits found, {marked} marked')
    await pg.evaluate("document.querySelector('.dr-views [data-view=outfit]').click()"); await pg.wait_for_timeout(200)
    # Fit: each garment
    await pg.evaluate("document.querySelector('.tabs [data-tab=proportion]').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("[...document.querySelectorAll('.tab-panel.active button')].find(b => b.textContent.trim() === 'Fit').click()"); await pg.wait_for_timeout(400)
    k = await pg.evaluate("[...document.querySelectorAll('.tab-panel.active button')].filter(b => b.offsetParent).length")
    for i in range(k):
        await pg.evaluate("""(i) => { const b = [...document.querySelectorAll('.tab-panel.active button')].filter(b => b.offsetParent)[i];
            if (b && !%s.test(b.textContent || '')) b.click(); }""" % SKIP, i)
        await pg.wait_for_timeout(100)
    print(f'{name}: Fit, {k} buttons')
    await c.close()
    return errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = await run(b, 'wide', {'viewport': {'width': 1280, 'height': 900}})
        errs += await run(b, 'phone', {'viewport': {'width': 390, 'height': 844}, 'has_touch': True, 'is_mobile': True})
        await b.close()
    for e in errs: print(e)
    print('no errors' if not errs else f'{len(errs)} errors')
    sys.exit(1 if errs else 0)

asyncio.run(main())
