"""Write the La Plante items for Tessera: cut-outs (webp, transparent outside the item), whole plates and thumbnails,
and a manifest. Item masks come from seg.py (half-size); cut-outs are taken from the full-size page images."""
import cv2, numpy as np, json, os, sys
from seg import PLATE, LEAF, SRC, segment, items, is_study
OUT = sys.argv[1]
for d in ('plants', 'plants_plates', 'plants_thumbs'): os.makedirs(f'{OUT}/{d}', exist_ok=True)
MAXP, MAXA = 900, 1100
man = []
sel = [int(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else sorted(LEAF)
for pl in sel:
    leaf = LEAF[pl]; S = segment(leaf); its, _ = items(S); full = S['full']
    ix0, iy0, ix1, iy1 = S['box']; F = full.shape[0] / S['half'].shape[0]
    # whole plate, inside the outer frame (as printed), and its thumbnail
    x0, y0, x1, y1 = S['frame']; m = 18
    wp = full[int((y0 - m) * F):int((y1 + m) * F), int((x0 - m) * F):int((x1 + m) * F)]
    k = 1600 / wp.shape[1]; wpi = cv2.resize(wp, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/plants_plates/lp_{pl:02d}.jpg', wpi, [cv2.IMWRITE_JPEG_QUALITY, 84])
    th = cv2.resize(wpi, (220, int(220 * wpi.shape[0] / wpi.shape[1])), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/plants_thumbs/lp_{pl:02d}.jpg', th, [cv2.IMWRITE_JPEG_QUALITY, 82])
    study = is_study(pl)
    for n, o in enumerate(its, 1):
        bx0, by0, bx1, by1 = o['box']; pad = 3
        X0, Y0 = max(0, bx0 - pad), max(0, by0 - pad); X1, Y1 = bx1 + pad, by1 + pad
        msk = np.zeros((Y1 - Y0, X1 - X0), np.float32); msk[by0 - Y0:by1 - Y0, bx0 - X0:bx1 - X0] = o['mask']
        fx0, fy0 = int(round((ix0 + X0) * F)), int(round((iy0 + Y0) * F))
        fw, fh = int(round((X1 - X0) * F)), int(round((Y1 - Y0) * F))
        crop = full[fy0:fy0 + fh, fx0:fx0 + fw]; fh, fw = crop.shape[:2]
        a = cv2.resize(msk, (fw, fh), interpolation=cv2.INTER_LINEAR)
        a = cv2.GaussianBlur(a, (0, 0), 0.8 * F)
        a = np.clip((a - 0.5) * 2.2 + 0.5, 0, 1)
        rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA); rgba[..., 3] = (a * 255).astype(np.uint8)
        ys, xs = np.nonzero(rgba[..., 3] > 8); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        lim = MAXP if study else MAXA
        s = min(1.0, lim / max(rgba.shape[:2]))
        if s < 1: rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        oid = f'lp{pl:02d}_{n:02d}'
        cv2.imwrite(f'{OUT}/plants/{oid}.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, 84])
        man.append(dict(id=oid, plate=pl, w=rgba.shape[1], h=rgba.shape[0], study=study, roundel=o['why'] == 'extra'))
    print(pl, len(its), flush=True)
tag = sys.argv[3] if len(sys.argv) > 3 else 'all'
json.dump(man, open(f'{OUT}/plants_manifest_{tag}.json', 'w'))
