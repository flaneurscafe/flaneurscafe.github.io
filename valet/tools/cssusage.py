# SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Valet: which rules of css/valet.css match nothing the page ever shows. Optional; a report, it changes nothing.

Runs the walks of tools/smoke.py (every tab, every visible button, the seasons, Fit) and
tools/flows.py (the Dresser's routes), on a wide window and a phone-sized one. After every step it
asks the page which selectors of css/valet.css match at least one element (states such as :hover,
:focus and ::before are taken off first, so a hover rule counts when its element exists). It lists
the rules none of whose selectors ever matched. A rule on the list is a candidate, not a verdict: it
may style a state no walk reaches (an error, an empty list, a warning). Rules for print are listed
apart. Look each one up before deleting it, and run smoke.py and flows.py after.

Needs Python 3 and Playwright, once:  pip install playwright && python -m playwright install chromium
Run from the project folder:          python tools/cssusage.py
"""
import asyncio, json, pathlib, re, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
CSS = (ROOT / 'css' / 'valet.css').read_text(encoding='utf-8')

def rules(css):
    """Each style rule: (line, selector text, the @media it sits in or '')."""
    s = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), css, flags=re.S)
    out, stack, i, start = [], [], 0, 0
    while i < len(s):
        ch = s[i]
        if ch == '{':
            head = s[start:i].strip()
            if head.startswith('@'): stack.append(head)
            else:
                out.append((s.count('\n', 0, start + len(s[start:i]) - len(s[start:i].lstrip())) + 1, head, ' '.join(x for x in stack if x.startswith('@media'))))
                stack.append(None)
            start = i + 1
        elif ch == '}':
            if stack: stack.pop()
            start = i + 1
        elif ch == ';' and (not stack or (stack[-1] or '').startswith('@')):
            start = i + 1   # an @import or a declaration-less statement
        i += 1
    return [r for r in out if not r[1].startswith(('from', 'to')) and not re.fullmatch(r'[\d.%,\s]+', r[1])]

RULES = rules(CSS)
# what is asked of the page: each selector with its states taken off
STRIP = re.compile(r'::?(hover|focus-visible|focus-within|focus|active|visited|before|after|placeholder|first-letter|first-line|selection|-webkit-[\w-]+|-moz-[\w-]+|marker|backdrop)\b(\([^)]*\))?')
SELS = sorted({STRIP.sub('', x).strip() or '*' for _, head, _ in RULES for x in head.split(',')})
MATCH = "(sels) => sels.filter(s => { try { return !!document.querySelector(s); } catch (e) { return true; } })"   # a selector the browser cannot read is not judged
seen = set()

class Page:
    """A page that, after each evaluate, notes which selectors match something now."""
    def __init__(self, pg): self.pg = pg
    def __getattr__(self, n): return getattr(self.pg, n)
    async def evaluate(self, *a):
        r = await self.pg.evaluate(*a)
        try: seen.update(await self.pg.evaluate(MATCH, [s for s in SELS if s not in seen]))
        except Exception: pass
        return r

class Browser:
    def __init__(self, b): self.b = b
    async def new_context(self, **kw):
        c = await self.b.new_context(**kw)
        class Ctx:
            async def new_page(self_): return Page(await c.new_page())
            async def close(self_): await c.close()
        return Ctx()
    async def close(self): await self.b.close()

async def main():
    import smoke, flows
    async with async_playwright() as p:
        b = Browser(await p.chromium.launch())
        for name, ctx in [('wide', {'viewport': {'width': 1280, 'height': 900}}), ('phone', {'viewport': {'width': 390, 'height': 844}, 'has_touch': True, 'is_mobile': True})]:
            await smoke.run(b, name, ctx)
            await flows.walk(b, name, ctx, flows.STEPS)
        await b.close()
    unused = [(ln, head, media) for ln, head, media in RULES if not any((STRIP.sub('', x).strip() or '*') in seen for x in head.split(','))]
    printing = [r for r in unused if 'print' in r[2]]
    rest = [r for r in unused if 'print' not in r[2]]
    print(f'css: {len(rest)} of {len(RULES)} rules matched nothing in these walks (and {len(printing)} print rules, not judged)')
    for ln, head, media in rest: print(f'  line {ln}: {re.sub(chr(10) + "|  +", " ", head)[:120]}' + (f'   [{media[:40]}]' if media else ''))

if __name__ == '__main__':
    asyncio.run(main())
