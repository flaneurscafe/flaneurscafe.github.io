# Tessera · mirrors, tiles & mosaics

A workshop for ornament, after M. P. Verneuil, G. Auriol & A. Mucha, *Combinaisons
ornementales se multipliant à l'infini à l'aide du miroir* (Paris, Librairie Centrale
des Beaux-Arts, c. 1901). Three tabs feed one another:

- **Tile maker**: ornaments from the book's plates (or your own pictures) reflected in
  hinged or parallel mirrors, Brewster's kaleidoscope or the 17 wallpaper groups, cut
  into tiles. The original text of the cover, title page and preface (French / English,
  with notes) opens from *How it works*.
- **Mosaic maker**: mosaics cut from an image (Roman rows, Roman following the outlines,
  trencadís), laid by hand from baskets of pieces (free form, with an optional faded
  guide image), or set in letters; edited piece by piece. Pieces never overlap.
- **Compose**: a board where saved tiles and mosaics are snapped, cut and fitted into a
  surface. Every tile reopens for editing in the tab that made it.

The page is fully static: no build step, no server code. It also works opened straight
from the folder (`file://`). Version: see the *info* button (bottom right).

## Files

| Path | What it holds |
| --- | --- |
| `index.html` | the page: markup of the three tabs, How it works, About, the original text |
| `css/tessera.css` | all styles |
| `js/base.js` | constants, small helpers, the Tile maker state `S`, plate loading |
| `js/mirrors.js` | Tile maker: angles, the source sheet, handles, the mirror view |
| `js/methods.js` | Tile maker: methods and sources, the 17 plane groups, symmetric ornaments |
| `js/tilemaker-ui.js` | Tile maker: status, render loop, controls, Gaudí's panot, the tiled surface |
| `js/compose.js` | Compose: tile library (IndexedDB), board, snapping, Fit to an edge, tile set-ups and editing |
| `js/mosaic-cut.js` | cutting an image into tesserae (Roman, following the outlines, trencadís), keeping pieces apart |
| `js/mosaic-maker.js` | the Mosaic maker tab: view, tools, free form, guide image, lettering, sending to Compose |
| `js/compose-board.js` | Compose: undo, selection panel, board interaction, export, projects, the demo, switching tabs |
| `js/sheet.js` | Tile maker: ornament slots, symmetry, the ornament library, plates, My images, the dial demo |
| `js/help.js` | How it works, About (version), the original text |
| `js/main.js` | start-up; runs last |
| `js/demo-data.js` | the first-visit demo (generated data, 1.2 MB: no need to read it) |
| `fonts/` | the lettering fonts, unmodified, each with its licence file (all SIL Open Font License 1.1): Cinzel, Boecklins Universe (after Arnold Böcklin, 1904), Gloria (after Emil Gursch, 1898), Federant (after Feder Antiqua, 1911). The About panel lists them and carries the licence text |
| `ornaments/`, `othumbs_atlas.webp` | the ornament library and its thumbnails |
| `plates/`, `thumbs/` | the 60 plates and their thumbnails |

The scripts are plain (non-module) scripts sharing one global scope, loaded in the
order of `index.html`; `main.js` must stay last. Saved work lives in the browser
(IndexedDB `mirror-tool-tiles`, localStorage `mt.*`); projects and mosaics are saved
as JSON files (`combinaisons-mirror-tool`, `combinaisons-mosaic`).

## Publish with GitHub Pages

1. Create a repository and push the contents of this folder to its root
   (`index.html`, `.nojekyll`, `css/`, `js/`, `fonts/`, `plates/`, `thumbs/`, `ornaments/`, `othumbs_atlas.webp`).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repository>/` after a minute or two.

All paths are relative, so it works from a project sub-path. `.nojekyll` makes
GitHub serve the files as they are.

### Search engines

`index.html` carries `<meta name="robots" content="noindex, nofollow, noimageindex, noarchive">`,
so Google and other well-behaved crawlers will not list the page or its images.
Deliberately there is **no** `robots.txt` blocking it: a crawler that is blocked from
fetching the page cannot see the `noindex` tag, and the bare URL could then still be
listed if someone links to it. This does not make the site private: anyone with the
link can open it.

## Sources and credits

Plates: New York Public Library Digital Collections,
<https://digitalcollections.nypl.org/collections/0160f0f0-c6ec-012f-5675-3c075448cc4b>,
and the Internet Archive scan; the book is in the public domain. The ornaments were
segmented, deskewed and cleaned automatically (`segment_ornaments_v2.py`; the first
version, `segment_ornaments.py`, is kept for reference). The library has three kinds of
item per plate: single ornaments (274), the whole printed frame (58) and the whole plate,
uncut (58). Lettering fonts: see `fonts/` and the About panel; nothing is loaded from a font service.
