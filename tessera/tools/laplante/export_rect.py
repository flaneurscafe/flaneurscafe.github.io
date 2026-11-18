"""Export as export.py, but straightened: items are segmented on the original pages (the segmentation reviewed by eye,
so item numbering is unchanged), then every item mask is rotated with its page (rotate.py) and cut
from the straightened full-size page. Usage: SEG_ORIG=1 python3 export_rect.py OUT plates tag"""
import os; os.environ['SEG_ORIG'] = '1'
import cv2, numpy as np, json, sys
from seg import PLATE, LEAF, segment, items, is_study, frame_lines
import glob, sys as _s
_s.path.insert(0, '/home/claude/dw')
from dewarp import field as dw_field
DW = {int(k): v for k, v in json.load(open('/home/claude/dw/dewarp.json')).items()}   # BnF pages: bow flattened (dewarp.py)
ROT = {}
for f in glob.glob('rot_*.json'): ROT.update({int(k): v for k, v in json.load(open(f)).items()})
OUT = sys.argv[1]
for d in ('plants', 'plants_plates', 'plants_thumbs'): os.makedirs(f'{OUT}/{d}', exist_ok=True)
MAXP, MAXA = 900, 1100
DROP = {'lp31_01', 'lp31_05'}                       # stray pieces of plate 31 (left out, as before)
POLY = {'lp46_03': [[850, 2830], [850, 2756], [876, 2746], [896, 2722], [960, 2690], [960, 2830]]}   # BnF stamp, inner-frame half px
def homog(half):
    P, L, sup = corners(half)
    w = ((P[1, 0] - P[0, 0]) + (P[2, 0] - P[3, 0])) / 2; h = ((P[3, 1] - P[0, 1]) + (P[2, 1] - P[1, 1])) / 2
    Q = np.float32([P[0], P[0] + [w, 0], P[0] + [w, h], P[0] + [0, h]]); return cv2.getPerspectiveTransform(P, Q)
def clean_paper(rgba, paper_bgr):
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    pap = cv2.cvtColor(np.uint8([[paper_bgr]]), cv2.COLOR_BGR2LAB)[0, 0].astype(np.float32)
    rgba[(np.linalg.norm(lab - pap, axis=2) < 14) & (rgba[..., 3] > 0)] = 0; return rgba
def keep_main(rgba, open_frac=0.0):
    m = (rgba[..., 3] > 128).astype(np.uint8)
    if open_frac: k = max(3, int(min(m.shape) * open_frac)); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    else: k = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats(m); big = 1 + np.argmax(st[1:, 4])
    keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((k + 2, k + 2), np.uint8)); rgba[keep == 0] = 0; return rgba
def trim_paper_edges(rgba, paper_bgr, frac=0.85):
    """A design cut-out sometimes carries a strip of bare paper along one edge (the gap to the next design): drop edge
    rows/columns that are almost entirely paper-coloured."""
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    pap = cv2.cvtColor(np.uint8([[paper_bgr]]), cv2.COLOR_BGR2LAB)[0, 0].astype(np.float32)
    pp = (np.linalg.norm(lab - pap, axis=2) < 16) | (rgba[..., 3] < 128)
    al = rgba[..., 3] > 8
    def frac_row(r): v = al[r]; return (pp[r] & v).sum() / max(1, v.sum()) if v.sum() > 0.2 * al.shape[1] else 1.0
    def frac_col(c): v = al[:, c]; return (pp[:, c] & v).sum() / max(1, v.sum()) if v.sum() > 0.2 * al.shape[0] else 1.0
    t, b, l, r = 0, al.shape[0] - 1, 0, al.shape[1] - 1
    lim = lambda n: int(0.25 * n)
    while t < lim(al.shape[0]) and frac_row(t) > frac: t += 1
    while al.shape[0] - 1 - b < lim(al.shape[0]) and frac_row(b) > frac: b -= 1
    while l < lim(al.shape[1]) and frac_col(l) > frac: l += 1
    while al.shape[1] - 1 - r < lim(al.shape[1]) and frac_col(r) > frac: r -= 1
    out = rgba.copy(); out[:t] = 0; out[b + 1:] = 0; out[:, :l] = 0; out[:, r + 1:] = 0
    return out
PAPER_FLOOD = {21}       # plates whose panels enclose the paper gaps between them
def flood_paper(rgba, paper_bgr, tol=11):
    """Remove bare paper that reaches the cut-out's edge (strict match to the page's paper colour)."""
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    pap = cv2.cvtColor(np.uint8([[paper_bgr]]), cv2.COLOR_BGR2LAB)[0, 0].astype(np.float32)
    pp = ((np.linalg.norm(lab - pap, axis=2) < tol) | (rgba[..., 3] < 128)).astype(np.uint8)
    pp = cv2.morphologyEx(pp, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lb = cv2.connectedComponents(pp, connectivity=4)
    edge = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]]))) - {0}
    m = np.isin(lb, list(edge)); m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    out = rgba.copy(); out[m & (pp > 0)] = 0
    return out
def trim_light_rows(rgba):
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32); al = rgba[..., 3] > 128
    ys = np.nonzero(al.any(1))[0]; b = ys.max()
    while b > ys.min() + 0.5 * (ys.max() - ys.min()):
        v = al[b]; L = lab[b][v, 0]; ch = np.hypot(lab[b][v, 1] - 128, lab[b][v, 2] - 128)
        if v.sum() and L.mean() > 205 and ch.mean() < 14: b -= 1
        else: break
    out = rgba.copy(); out[b + 1:] = 0; return out
man = []
for pl in [int(x) for x in sys.argv[2].split(',')]:
    leaf = LEAF[pl]; S = segment(leaf); its, _ = items(S)
    ho = cv2.imread('half_orig/n%03d.png' % leaf); Mh = np.array(ROT[pl]['M'], float)
    rfull = cv2.imread('rect/n%03d.jpg' % leaf); rhalf = cv2.imread('half/n%03d.png' % leaf)
    Hh, Wh = ho.shape[:2]; F = rfull.shape[0] / rhalf.shape[0]
    ix0, iy0, ix1, iy1 = S['box']
    x0, y0, x1, y1 = frame_lines(rhalf); m = 18
    wp = rfull[int((y0 - m) * F):int((y1 + m) * F), int((x0 - m) * F):int((x1 + m) * F)]
    k = 1600 / wp.shape[1]; wpi = cv2.resize(wp, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/plants_plates/lp_{pl:02d}.jpg', wpi, [cv2.IMWRITE_JPEG_QUALITY, 84])
    cv2.imwrite(f'{OUT}/plants_thumbs/lp_{pl:02d}.jpg', cv2.resize(wpi, (220, int(220 * wpi.shape[0] / wpi.shape[1])), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 82])
    study = is_study(pl); lab_h = cv2.cvtColor(rhalf, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    chh = np.hypot(lab_h[:, 1] - 128, lab_h[:, 2] - 128); sel = (lab_h[:, 0] > np.percentile(lab_h[:, 0], 80)) & (chh < 12)
    paper = np.median(rhalf.reshape(-1, 3)[sel], 0)          # the page's bare paper: bright, low-chroma pixels
    for n, o in enumerate(its, 1):
        oid = f'lp{pl:02d}_{n:02d}'
        if oid in DROP: continue
        bx0, by0, bx1, by1 = o['box']; mk = o['mask'].astype(np.float32)
        if oid in POLY:
            pm = np.zeros(mk.shape, np.uint8); cv2.fillPoly(pm, [np.int32(POLY[oid]) - [bx0, by0]], 1); mk[pm > 0] = 0
        # warp only the item's neighbourhood: translate to half-page coords, apply Mh
        pad = 6; X0, Y0, X1, Y1 = ix0 + bx0 - pad, iy0 + by0 - pad, ix0 + bx1 + pad, iy0 + by1 + pad
        corners_o = np.float32([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]).reshape(-1, 1, 2)
        cr = cv2.perspectiveTransform(corners_o, Mh).reshape(-1, 2)
        R0, R1 = np.floor(cr.min(0)).astype(int) - 2, np.ceil(cr.max(0)).astype(int) + 2
        T = np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]], float)          # item-local -> half coords handled below
        src_m = np.zeros((Y1 - Y0, X1 - X0), np.float32); src_m[pad:pad + mk.shape[0], pad:pad + mk.shape[1]] = mk
        # full-res target region and the map: full(rect) -> half(rect) -> half(orig) -> item-local
        fx0, fy0 = int(R0[0] * F), int(R0[1] * F); fx1, fy1 = int(R1[0] * F), int(R1[1] * F)
        fx0, fy0 = max(0, fx0), max(0, fy0)
        crop = rfull[fy0:fy1, fx0:fx1]; fh, fw = crop.shape[:2]
        Sfull = np.array([[1 / F, 0, fx0 / F], [0, 1 / F, fy0 / F], [0, 0, 1]])   # crop px -> rect half
        M = T @ np.linalg.inv(Mh) @ Sfull                                     # crop px -> item-local orig half
        if pl in DW:      # final page -> rotated page by the dewarp field (half px), then rotation back to the original page
            gx, gy = np.meshgrid(np.arange(fw, dtype=np.float32), np.arange(fh, dtype=np.float32))
            u = (gx + fx0) / F; v = (gy + fy0) / F
            Wd, Hd = int(np.ceil(rhalf.shape[1])), int(np.ceil(rhalf.shape[0]))
            dxh, dyh = dw_field(DW[pl], Wd, Hd, 1.0)
            ui = np.clip(u, 0, Wd - 1).astype(np.int32); vi = np.clip(v, 0, Hd - 1).astype(np.int32)
            us = u + dxh[vi, ui]; vs = v + dyh[vi, ui]
            Mi = T @ np.linalg.inv(Mh); den = Mi[2, 0] * us + Mi[2, 1] * vs + Mi[2, 2]
            mx = ((Mi[0, 0] * us + Mi[0, 1] * vs + Mi[0, 2]) / den).astype(np.float32); my = ((Mi[1, 0] * us + Mi[1, 1] * vs + Mi[1, 2]) / den).astype(np.float32)
            a = cv2.remap(src_m, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        else:
            a = cv2.warpPerspective(src_m, M, (fw, fh), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=0)
        a = cv2.GaussianBlur(a, (0, 0), 0.8 * F); a = np.clip((a - 0.5) * 2.2 + 0.5, 0, 1)
        rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA); rgba[..., 3] = (a * 255).astype(np.uint8)
        if oid == 'lp61_05': rgba = keep_main(clean_paper(rgba, paper))
        if oid == 'lp61_07': rgba = keep_main(clean_paper(rgba, paper), 0.012)
        if oid == 'lp46_03': rgba = keep_main(rgba)
        if pl in PAPER_FLOOD: rgba = flood_paper(rgba, paper)
        ys, xs = np.nonzero(rgba[..., 3] > 8); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        s = min(1.0, (MAXP if study else MAXA) / max(rgba.shape[:2]))
        if s < 1: rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        cv2.imwrite(f'{OUT}/plants/{oid}.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, 84])
        man.append(dict(id=oid, plate=pl, w=rgba.shape[1], h=rgba.shape[0], study=study, roundel=o['why'] == 'extra'))
    print(pl, len(its), flush=True)
json.dump(man, open(f'{OUT}/plants_manifest_{sys.argv[3]}.json', 'w'))
