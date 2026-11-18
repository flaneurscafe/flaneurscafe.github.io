# La Plante → Tessera: work in progress (paused 13 Nov 2026)

Goal: add the plates of Grasset (ed.), *La Plante et ses applications ornementales* (1896) to Tessera as a second
publication in the ornament library, cut out as printed (no tracing), grouped per publication, with sources cited.

## Status
1. DONE  Page images: Internet Archive item `planteetsesappl00Gras` (Smithsonian Libraries copy, digitised for BHL;
         public domain per BHL), full-size pages `page/n{leaf}_w3200.jpg` (5038×7060, 450 ppi), even leaves 10–114.
         Copies are in `_to_delete/lp_pages/` (182 MB). This copy lacks plates 5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63–68, 70–72.
2. DONE  Segmentation (`seg.py`, corrections in `overrides.json`), checked by eye on every plate:
         study plates: whole plant parts, paper enclosed between stems made transparent ("gaps");
         application plates: each design separately (splits between designs printed touching),
         plus roundels as items of their own (plates 23 and 42; plate 42's roundel is clipped by its panel in the print).
3. DONE  Plant name and signature per plate (below).
4. NEXT  `python3 export.py <outdir>` (half-size masks → full-size cut-outs, whole plates, thumbnails, manifest).
         Needs `half/` (half-size copies, made from the pages by the first block in seg.py's history: resize ½ INTER_AREA → half/nNNN.png)
         and SRC in seg.py pointing at the full-size pages. Then review the cut-outs on a checkerboard.
5. TODO  Tessera: library grouped by publication (Combinaisons 1901 / La Plante 1896) with plant + study/application filters;
         Whole plates tab grouped the same way; thumbnails atlas for the new items; loadLib path for `plants/`.
6. TODO  Citations: About → Sources, How it works, picker caption per item (plate, plant, signed artist, holding library),
         README Sources table, papers/README.
7. TODO  Browser test (picker, place, tile, Compose reopen of saved tiles, console errors).

## Plates: plant (FR / EN) and signature
1–3 Iris (Iris) · 4 Pavot (Poppy) · 7–9 Nénuphar (Water-lily) · 10–12 Ancolie (Columbine) · 13–15 Courge (Gourd) ·
16–18 Couronne impériale (Crown imperial) · 19–20 Géranium sauvage (Wild geranium) · 22–24 Cyclamen ·
26–27 Sagittaire (Arrow-head) · 29–30 Jonquille (Jonquil) · 31–33 Perce-neige (Snowdrop) · 34–36 Sceau de Salomon (Solomon's seal) ·
37–39 Muguet (Lily of the valley) · 40–42 Capucine (Nasturtium) · 44–45 Pissenlit (Dandelion) · 47–48 Glycine (Wisteria) ·
49–51 Lilas (Lilac) · 52–53 Marronnier (Horse chestnut) · 55–57 Aconit (Monkshood) · 58, 60 Chardon (Thistle) ·
62 Pervenche (Periwinkle) · 69 Églantier (Wild rose). Study plates are 1, 4, 7 … (3k+1); the others are applications.

Signatures (read on the plates): M. P. Verneuil 1, 2, 4, 7, 8, 10, 11, 13, 14, 16, 17, 26, 29, 31, 32, 34, 35, 40, 41, 44, 47, 55, 56, 58 ·
E. Hervegh 3, 22, 23, 30, 37, 38, 51, 69 · C. G. Schlumberger 9, 15 · Anna Martin 12, 24, 27, 42, 49, 50, 57 ·
J. Milesi 18, 19, 20, 33, 45, 52, 53, 60 · G. Bourgeot 36 · A. Poidevin 39, 48 · Marcelle Gaudin 62.


## Gallica plates added (14 Nov 2026)
The 19 plates missing from the Internet Archive copy (5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63-68, 70-72) were cut from
the BnF copy: papers/period_sources/Grasset_La_Plante_..._Gallica_BnF_complete.pdf (Gallica ark:/12148/btv1b10546212d;
plate n = PDF page 13+n, checked against the printed "Pl. n" on every page). The PDF holds 1024-px pages only (Gallica's
IIIF server has 5190 x 7390 but refuses scripted downloads), so the pages were upscaled (Lanczos x 4.92 + light unsharp)
to the IA geometry and placed at gal/full/n2NN.jpg (leaf = 200 + plate; seg.GALLICA, seg.src()).
seg.py additions: inner frame rules removed on Gallica study plates; overrides 'dropin' (drop leftovers inside a rect)
and 'mergein' (put a piece cut off at the frame back into its item). Extras over a pattern on plates 6, 59, 65, 71 are
also erased from the pattern under them; on 66 (book over wallpaper) the wallpaper keeps it, as for 23 and 42.
Roundels (kind 3): lp06_04, lp23_04, lp42_04, lp68_03, lp71_05. Totals: 377 items = 178 parts, 194 designs, 5 roundels.
Captions: 64-66 Butter-cup / Bouton d'Or / Die Goldblume; 70-72 Chrysanthemum / Chrysanthème / Das Chrysanthemum.
New signatures: Max Mangin (6), Marcelle Gaudin (21, 61), Anna Martin (54, 63), A. Poidevin (66, 72).
Upgrade path: replace gal/full pages with full-resolution IIIF images (downloaded by hand) and re-run export.py for
those plates; overrides are in half-size pixels of the same geometry, so they still apply.

## Full-size Gallica images (14 Nov 2026, later)
The user downloaded the 19 plates at full size from Gallica's IIIF server into bnf_download/ (native_<plate>.jpg,
~5200 x 7400). NB the IIIF view number is f = 11 + plate (the PDF has 2 extra front pages: page = 13 + plate).
Each was matched to the PDF page (affine ECC, corr 0.999, pure scale ~0.97) and resampled into the same geometry:
gal/hires/n2NN.jpg; seg.GSRC now points there. Overrides re-checked: 21 (h split 1373), 25/28/43 (dropin rects),
46 (BnF stamp erased), 61 and 28 (flecks erased); lp46_03, lp61_05, lp61_07 also cleaned on the exported webp.

## Straightening and restored PDFs (14 Nov 2026, evening)
- rotate.py + skew4.py: every page is rotated by its measured skew (projection profiles of all strong horizontal and
  vertical edges; -0.53 to +0.94 deg, BnF pages most). A first attempt (rectify.py, homography to the frame rules) was
  dropped: the double frame rule made the corner fit unreliable. Residual skew after rotation <= 0.01 deg.
- export_rect.py: items are segmented on the ORIGINAL pages (SEG_ORIG=1, the segmentation reviewed by eye, numbering
  unchanged), the masks rotated with the page, and cut from the straightened full-size page. Clean-ups built in:
  lp31_01/05 dropped, BnF stamp on lp46_03, flecks on lp61_05/07, paper flood on plate 21; plate 21 h-split at 1312.
- tools/restore/: restore.py (paper flattening, BnF stamp inpainting, despeckle), compile_lp.py (each plate placed on
  one 1850 x 2556 page template with its frame at the same position; margins cleaned to the lettering), front_lp.py,
  compile_co.py (Combinaisons: NYPL cover + preface, IA title + plates 3-60), build_pdf.py (img2pdf + pikepdf,
  bookmarks, XMP metadata). Full PDFs in papers/period_sources/, web PDFs (<20 MB) in tessera/downloads/.
- BnF ownership stamps are KEPT in the PDF (user's choice, 14 Nov); the La Plante plates use one scale (S_ALL) so captions stay on the page.
