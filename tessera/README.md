# Tessera · mirrors, tiles & mosaics

A workshop for ornament, after M. P. Verneuil, G. Auriol & A. Mucha, *Combinaisons
ornementales se multipliant à l'infini à l'aide du miroir* (Paris, Librairie Centrale
des Beaux-Arts, c. 1901), with a second source of ornaments: E. Grasset (ed.), *La Plante et ses
applications ornementales* (Paris, Librairie Centrale des Beaux-Arts, E. Lévy, 1896). Three tabs feed one another:

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
| `js/laplante.js` | the second publication: the two publications' citations (`PUBS`), La Plante's plates (plant, signature) and items; loaded before `base.js` |
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
| `plants/`, `plants_atlas.webp` | La Plante: the 377 cut-outs (plant parts, designs, roundels) and their thumbnails |
| `plants_plates/`, `plants_thumbs/` | La Plante: all 72 plates, whole, and their thumbnails (inside Tessera a La Plante plate *n* is numbered 1000 + *n*) |
| `js/frieze.js`, `js/frieze-data.js`, `friezes/` | the Frieze maker: the seven frieze groups, frames with corners by the group's rule, tile sets; the 62 printed borders (one repeat each, `friezes/<id>.webp`) and Grasset's three printed corners (`friezes/c_<id>.webp`). Analysis scripts in `tools/frieze/` |
| `downloads/` | the two source books as restored PDFs (straightened, paper flattened, stains removed, BnF stamps kept; screen resolution, under 20 MB each). Full-resolution versions: `papers/period_sources/` in the project folder; scripts in `tools/restore/` |
| `tools/laplante/` | how the La Plante items were made: `seg.py` (segmentation), `overrides.json` (the corrections made by eye, per plate), `export.py`, `sym.py` (port of `symmetryOf()`), the manifest and `RESUME.md` |

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

The library keeps the two publications apart: the picker groups items by publication, cites each one at the top of
its group, and every item and ornament slot names its plate in a tooltip.

### 1. *Combinaisons ornementales* (c. 1901)


Plates: New York Public Library Digital Collections,
<https://digitalcollections.nypl.org/collections/0160f0f0-c6ec-012f-5675-3c075448cc4b>,
and the Internet Archive scan; the book is in the public domain. The ornaments were
segmented, deskewed and cleaned automatically (`segment_ornaments_v2.py`; the first
version, `segment_ornaments.py`, is kept for reference). The library has three kinds of
item per plate: single ornaments (274), the whole printed frame (58) and the whole plate,
uncut (58). ### 2. *La Plante et ses applications ornementales* (1896)

E. Grasset (ed.), Paris, Librairie Centrale des Beaux-Arts, E. Lévy, 1896, first series. Copy used: Smithsonian
Libraries, digitised for the Biodiversity Heritage Library, <https://archive.org/details/planteetsesappl00Gras>
(450 ppi page images; public domain per BHL), 53 plates. The 19 it lacks (5, 6, 21, 25, 28, 43, 46, 54, 59, 61,
63–68 and 70–72) are taken from the complete copy of the Bibliothèque nationale de France,
<https://gallica.bnf.fr/ark:/12148/btv1b10546212d> (full-size IIIF page images, about 5200 x 7400 px, view f = 11 + plate;
credit "Source gallica.bnf.fr / BnF"; the BnF allows free non-commercial
reuse with that credit, commercial reuse needs its licence). The second series is not included. Another copy: Schola Graphidis Art Collection, Hungarian University
of Fine Arts, Budapest, on Europeana (single plates, CC BY-SA 4.0, about 920 × 1300 px; it also has the second
series, and of the missing plates only 5, 43 and 46 are absent there). Plates are signed by M. P. Verneuil, E. Hervegh, C. G. Schlumberger, Anna Martin,
J. Milesi, G. Bourgeot, A. Poidevin, Marcelle Gaudin and Max Mangin (the signature of each plate is in `js/laplante.js`).
Items were cut out as printed, not traced: 178 plant parts from the study plates, 194 designs from the application
plates, 5 roundels or half-roundels. Their symmetry badges are measured only (not checked by eye), on parts and roundels only.

Lettering fonts: see `fonts/` and the About panel; nothing is loaded from a font service.
