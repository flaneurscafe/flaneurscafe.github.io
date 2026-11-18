"""Bundle the page into one self-contained HTML file (styles and scripts inlined).

Only for places that take a single page file (the claude.ai artifact); the site
itself needs no build step. Usage, from the folder that holds index.html:

    python3 tools/bundle_single_file.py tessera_single.html

Each script stays a separate <script> block, in the same order, so the page behaves
exactly as with the separate files. The image folders are still loaded relative to the page.
"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css' / 'tessera.css').read_text(encoding='utf-8')
import base64
def font_data(m):   # the font files (unmodified) travel inside the page as data URLs; their licences are in the About panel
    data = (root / 'fonts' / m.group(1)).read_bytes()
    return "url('data:font/ttf;base64," + base64.b64encode(data).decode('ascii') + "')"
css = re.sub(r"url\('\.\./fonts/([\w.-]+\.ttf)'\)", font_data, css)
html = html.replace('<link rel="stylesheet" href="css/tessera.css">', '<style>\n' + css + '</style>', 1)
def inline(m):
    code = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + code.replace('</script', '<\\/script') + '</script>'
html, n = re.subn(r'<script src="(js/[\w.-]+\.js)"></script>', inline, html)
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'tessera_single.html')
out.write_text(html, encoding='utf-8')
print(f'{out}: {n} scripts inlined, {len(html):,} bytes')
