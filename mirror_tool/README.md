# Hinged mirrors · *Combinaisons ornementales* (1901)

An interactive reconstruction of the method described in the preface of
M. P. Verneuil, G. Auriol & A. Mucha, *Combinaisons ornementales se multipliant
à l'infini à l'aide du miroir* (Paris, Librairie Centrale des Beaux-Arts, c. 1901):
place ornaments from the book's plates, set a hinged pair, a parallel pair or a
single mirror, and see the reflected composition. The original text of the cover,
title page and preface (French / English, with notes) is available from the
button at the top right.

The page is fully static (one `index.html` plus image folders): no build step, no server code.

## Publish with GitHub Pages

1. Create a repository and push the contents of this folder to its root
   (`index.html`, `.nojekyll`, `plates/`, `thumbs/`, `ornaments/`, `othumbs_atlas.webp`).
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
listed if someone links to it. Note that this does not make the site private: anyone
with the link can open it, and on a free GitHub plan the repository itself must be
public (its files are then visible, and may be indexed, on github.com). To keep the
source private, use a private repository with a plan that allows Pages from private
repositories.

## Sources and credits

Plates: New York Public Library Digital Collections,
<https://digitalcollections.nypl.org/collections/0160f0f0-c6ec-012f-5675-3c075448cc4b>,
and the Internet Archive scan; the book is in the public domain. The ornaments were
segmented, deskewed and cleaned automatically (`segment_ornaments.py`).
