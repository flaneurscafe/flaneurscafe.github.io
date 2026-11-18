"""Ornament extraction, version 2.

Changes from segment_ornaments.py (v1):
  * Rules: only THIN, STRAIGHT strokes are treated as plate rules (v1 used a long opening on all ink,
    which also caught thick ornament strokes and erased them, e.g. plates 12, 36, 48, 59).
  * Frame: the plate frame (rules + corner pieces + number roundel lying in the frame band) is kept
    whole as ONE item, never cut into corner pieces and line stubs.
  * Composition: the whole framed panel is also offered as one uncut item.
  * Separation: ornaments are grouped with a smaller gap (0.6% of width instead of 1.2%), then
    pieces lying inside another ornament's box, and small pieces close to one, are re-attached.
  * Noise: monograms, specks and line-only pieces are dropped instead of becoming ornaments.
"""
import cv2, numpy as np, json, os, sys

C = '/tmp/rev/cache'; OUT = sys.argv[1]
plates = [int(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else list(range(1, 61))
for d in ('ornaments', 'dbg'): os.makedirs(f'{OUT}/{d}', exist_ok=True)
S = 800
P = dict(thin=7, line_len=0.07, band=0.20, frame_zone=0.10, gap=0.006, small=0.06, tiny=0.056,
         attach=0.03, inside=0.9)


def cut_alpha(crop, reg, lin2):
    """v1 alpha: ink coverage inside the item's region, with rules removed, specks dropped, fringe un-premultiplied."""
    cf = crop.astype(np.float32); d2 = 255 - cf.min(-1)
    t = np.clip((d2 - 14) / (52 - 14), 0, 1); a = t * t * (3 - 2 * t)
    a = a * reg * (1 - lin2)
    core = (a > 0.35).astype(np.uint8)
    ncs, lb, stt, _ = cv2.connectedComponentsWithStats(core, 8)
    small = np.where(stt[:, 4] < 30)[0]; small = small[small > 0]
    if len(small):
        kill = cv2.dilate(np.isin(lb, small).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0; a[kill] = 0
    a[(a < 0.35) & (cv2.dilate(core, np.ones((3, 3), np.uint8)) == 0)] = 0
    ad = np.maximum(a, 0.08)[..., None]; col = 255 - (255 - cf) / ad
    out = np.clip(np.where(a[..., None] > 0, col, cf), 0, 255).astype(np.uint8)
    rgba = cv2.cvtColor(out, cv2.COLOR_BGR2BGRA); rgba[..., 3] = (a * 255).astype(np.uint8)
    return rgba


def save(rgba, oid):
    s = min(1.0, 820 / max(rgba.shape[:2]))
    if s < 1: rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/ornaments/{oid}.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, 82])
    return rgba.shape[1], rgba.shape[0]


manifest = []
# Auriol's 'GA' monogram, used to tell the signature from small real motifs
_t = np.asarray(cv2.imread('/tmp/rev/orig/ornaments/p09_05.webp', cv2.IMREAD_UNCHANGED))[..., 3] > 100
def _norm(m):
    ys, xs = np.nonzero(m)
    if len(xs) < 5: return None
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8) * 255
    return cv2.resize(m, (24, 24), interpolation=cv2.INTER_AREA) > 80
TPL = _norm(_t)
def mono_score(m):
    q = _norm(m)
    if q is None: return 0.0
    best = 0.0
    for f in (q, q[:, ::-1]):
        best = max(best, (f & TPL).sum() / max(1, (f | TPL).sum()))
    return best
for n in plates:
    full = cv2.imread(f'{C}/full_{n:02d}.png'); wb = cv2.imread(f'{C}/wb_{n:02d}.png'); H0, W0 = full.shape[:2]
    k = S / W0; img = cv2.resize(full, (S, int(H0 * k)), interpolation=cv2.INTER_AREA); h, w = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0]; paper = np.median(lab[L >= np.percentile(L, 40)], axis=0)
    ink = (np.sqrt(((lab - paper) ** 2 * np.array([0.6, 1.4, 1.4])).sum(-1)) > 28).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    m = int(0.012 * w); ink[:m] = 0; ink[-m:] = 0; ink[:, :m] = 0; ink[:, -m:] = 0

    # ---- rules: thin AND straight (a thick swirl survives the thin test even if it is long)
    thin = ink & (1 - cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((P['thin'], P['thin']), np.uint8)))
    lines = np.zeros_like(ink)
    for ker in [np.ones((1, int(w * P['line_len'])), np.uint8), np.ones((int(h * P['line_len']), 1), np.uint8)]:
        lines |= cv2.morphologyEx(thin, cv2.MORPH_OPEN, ker)
    b = int(P['band'] * min(w, h)); band = np.zeros_like(ink); band[:b] = 1; band[-b:] = 1; band[:, :b] = 1; band[:, -b:] = 1
    lines &= band
    # frame rectangle = extent of the rules, if they run along at least three sides
    # frame rectangle: on each side, the row/column of the band holding the most rule pixels
    F = None; sides = {}
    rowh = lines.sum(1).astype(float); colh = lines.sum(0).astype(float)
    def peak(hist, lo, hi, need):
        seg = np.convolve(hist[lo:hi], np.ones(5), 'same')
        i = int(seg.argmax()); return (lo + i) if seg[i] >= need else None
    sides['top'] = peak(rowh, 0, b, 0.25 * w); sides['bottom'] = peak(rowh, h - b, h, 0.25 * w)
    sides['left'] = peak(colh, 0, b, 0.25 * h); sides['right'] = peak(colh, w - b, w, 0.25 * h)
    found = {k_: v for k_, v in sides.items() if v is not None}
    if os.environ.get('DBG'): print('sides', sides, b, rowh.max(), colh.max())
    if len(found) >= 3:
        ys, xs = np.nonzero(ink)   # a missing side falls back to the printed extent
        x0 = found.get('left', xs.min()); x1 = found.get('right', xs.max()); y0 = found.get('top', ys.min()); y1 = found.get('bottom', ys.max())
        F = (int(x0), int(y0), int(x1), int(y1))
    # rules count only along the frame itself: panel borders and straight stems inside the plate are kept
    strip = np.zeros_like(ink)
    if F is not None:
        sw = max(4, int(0.022 * w)); x0, y0, x1, y1 = F
        strip[max(0, y0 - sw):y0 + sw, max(0, x0 - sw):x1 + sw] = 1; strip[max(0, y1 - sw):y1 + sw, max(0, x0 - sw):x1 + sw] = 1
        strip[max(0, y0 - sw):y1 + sw, max(0, x0 - sw):x0 + sw] = 1; strip[max(0, y0 - sw):y1 + sw, max(0, x1 - sw):x1 + sw] = 1
        lines &= strip
    else:
        lines[:] = 0
    linesD = cv2.dilate(lines, np.ones((5, 5), np.uint8))
    # cut ornaments free of the frame: nothing connects across a thin band around the rules
    cutband = np.zeros_like(ink); rc = int(0.045 * w)
    if F is not None:
        cutband = cv2.dilate(lines, np.ones((7, 7), np.uint8))
        x0, y0, x1, y1 = F; t_ = 3
        cutband[max(0, y0 - t_):y0 + t_, x0:x1] = 1; cutband[max(0, y1 - t_):y1 + t_, x0:x1] = 1   # the frame edges themselves
        cutband[y0:y1, max(0, x0 - t_):x0 + t_] = 1; cutband[y0:y1, max(0, x1 - t_):x1 + t_] = 1
        for cx, cy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):                                   # and around its corners
            cv2.circle(cutband, (int(cx), int(cy)), rc, 1, 3)
    ink2 = ink & (1 - linesD)
    ink2g = ink2 & (1 - cutband)

    # ---- group strokes into pieces (small gap), then classify
    r = max(3, int(P['gap'] * w)) | 1
    grp = cv2.morphologyEx(ink2g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    nc, labels, stats, _ = cv2.connectedComponentsWithStats(grp, 8)
    pieces = []
    for i in range(1, nc):
        x, y, bw, bh, a = stats[i]; ic = int(ink2g[labels == i].sum())
        if ic < 25: continue
        pieces.append(dict(ids=[i], box=[x, y, x + bw, y + bh], ink=ic))
    fz = int(P['frame_zone'] * min(w, h))
    def at_corner(bx):
        # a corner piece of the frame is small and centred near a corner of the frame
        if F is None: return False
        x0, y0, x1, y1 = F
        if max(bx[2] - bx[0], bx[3] - bx[1]) > 0.28 * min(w, h): return False
        cx_, cy_ = (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2
        d_ = min(np.hypot(cx_ - X, cy_ - Y) for X, Y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)))
        straddles = bx[0] < x0 - 3 or bx[1] < y0 - 3 or bx[2] > x1 + 3 or bx[3] > y1 + 3
        return d_ < 0.11 * w or (straddles and d_ < 0.16 * w)
    def in_frame_zone(bx):
        # otherwise a frame piece lies mostly ON or outside the frame line, never mostly inside the panel
        if F is None: return False
        if at_corner(bx): return True
        x0, y0, x1, y1 = F; t_ = 6
        ix0, iy0, ix1, iy1 = max(bx[0], x0 + t_), max(bx[1], y0 + t_), min(bx[2], x1 - t_), min(bx[3], y1 - t_)
        inner = max(0, ix1 - ix0) * max(0, iy1 - iy0) / max(1, (bx[2] - bx[0]) * (bx[3] - bx[1]))
        return inner < 0.5
    def area(bx): return max(0, bx[2] - bx[0]) * max(0, bx[3] - bx[1])
    def inter(a, b): return area([max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])])
    def gapd(a, b):
        dx = max(0, max(a[0], b[0]) - min(a[2], b[2])); dy = max(0, max(a[1], b[1]) - min(a[3], b[3])); return np.hypot(dx, dy)
    def merge(a, b):
        a['ids'] += b['ids']; a['ink'] += b['ink']
        a['box'] = [min(a['box'][0], b['box'][0]), min(a['box'][1], b['box'][1]), max(a['box'][2], b['box'][2]), max(a['box'][3], b['box'][3])]
    def inside_panel(bx):
        if F is None: return True
        x0, y0, x1, y1 = F
        return bx[0] > x0 + 6 and bx[1] > y0 + 6 and bx[2] < x1 - 6 and bx[3] < y1 - 6
    # small pieces: join the ornament whose STROKES are close (pixel distance, not box distance);
    # small pieces far from any stroke are noise (specks, the artist's monogram) and are dropped
    from scipy import ndimage as ndi
    def pinfo(plist):
        lab2piece = {}
        for q in plist:
            for i in q['ids']: lab2piece[i] = q
        return lab2piece
    def nearest(target_pieces):
        m_ = np.isin(labels, [i for q in target_pieces for i in q['ids']]) & (ink2g > 0)
        if not m_.any(): return None, None
        return ndi.distance_transform_edt(~m_, return_indices=True)
    def attach_small(plist, maxdim, near, far_drop):
        bigs = [q for q in plist if max(q['box'][2] - q['box'][0], q['box'][3] - q['box'][1]) >= maxdim]
        dt, idx = nearest(bigs)
        if dt is None: return plist, []
        l2p = pinfo(bigs); out = []; drop = []
        for p in plist:
            if p in bigs: continue
            pm = np.isin(labels, p['ids']) & (ink2g > 0)
            if not pm.any(): continue
            ys_, xs_ = np.nonzero(pm); d = dt[ys_, xs_]; j = int(d.argmin())
            tgt = l2p.get(int(labels[idx[0][ys_[j], xs_[j]], idx[1][ys_[j], xs_[j]]]))
            if d[j] < near * w and tgt is not None: out.append((tgt, p))
            elif far_drop and max(p['box'][2] - p['box'][0], p['box'][3] - p['box'][1]) < 0.05 * w:
                x0_, y0_, x1_, y1_ = p['box']; sc = mono_score(pm[y0_:y1_ + 1, x0_:x1_ + 1])
                if os.environ.get('DBG'): print('small', n, p['box'], round(sc, 2))
                if sc > 0.42 and (x1_ - x0_) > 1.15 * (y1_ - y0_): drop.append(p)   # the artist's monogram (wider than tall)
        for tgt, p in out:
            merge(tgt, p); plist.remove(p)
        for p in drop: plist.remove(p)
        return plist, drop
    frame_pieces = [p for p in pieces if in_frame_zone(p['box'])]
    orn = [p for p in pieces if not in_frame_zone(p['box'])]
    # outside the frame entirely (margin junk) -> drop
    if F is not None:
        orn = [p for p in orn if not (p['box'][2] < F[0] or p['box'][0] > F[2] or p['box'][3] < F[1] or p['box'][1] > F[3])]

    # faint line drawings break into many small pieces at the small gap: re-join small pieces lying close together
    smallp = lambda q: max(q['box'][2] - q['box'][0], q['box'][3] - q['box'][1]) < P['small'] * w
    changed = True
    while changed:
        changed = False
        sm_ = [q for q in orn if smallp(q)]
        for i_, A in enumerate(sm_):
            for B in sm_[i_ + 1:]:
                if gapd(A['box'], B['box']) < 0.012 * w:
                    merge(A, B); orn.remove(B); changed = True; break
            if changed: break
    orn, far_small = attach_small(orn, P['small'] * w, 0.016, True)
    orn, _ = attach_small(orn, 0.12 * w, 0.010, False)       # medium pieces only when their strokes nearly touch
    for p in [q for q in orn if min(q['box'][2] - q['box'][0], q['box'][3] - q['box'][1]) < 0.035 * w]:
        c = [q for q in orn if q is not p and min(q['box'][2] - q['box'][0], q['box'][3] - q['box'][1]) >= 0.035 * w and gapd(p['box'], q['box']) < 0.012 * w]
        if c: merge(min(c, key=lambda q: gapd(p['box'], q['box'])), p); orn.remove(p)
    dropped = [('speck/monogram', p) for p in far_small]
    for p in list(orn):
        bw, bh = p['box'][2] - p['box'][0], p['box'][3] - p['box'][1]
        if max(bw, bh) < 0.025 * w: dropped.append(('speck/monogram', p)); orn.remove(p)
        elif min(bw, bh) < 0.015 * w: dropped.append(('line only', p)); orn.remove(p)
    if n <= 2:   # cover and title page: lines of lettering are not ornaments (the whole page is kept as a panel)
        txt = [p for p in orn if n == 1 or (p['box'][3] - p['box'][1]) < 0.065 * w]
        dropped += [('lettering (title page)', p) for p in txt]; orn = [p for p in orn if p not in txt]
    orn.sort(key=lambda p: (p['box'][1] // 40, p['box'][0]))
    np.savez_compressed(f'{OUT}/dbg/m{n:02d}.npz', lines=lines, frame=np.isin(labels, [i for p in frame_pieces for i in p['ids']]), k=k,
                        F=np.array(F if F is not None else (-1, -1, -1, -1)))

    # ---- write items (crop from the whitened full-resolution plate)
    def write(oid, box, regmask, kind, keep_lines=False, pad=3):
        x0, y0, x1, y1 = max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad)
        X0, Y0, X1, Y1 = [int(round(v / k)) for v in (x0, y0, x1, y1)]
        crop = wb[Y0:Y1, X0:X1]
        reg = cv2.resize(regmask[y0:y1, x0:x1].astype(np.uint8), (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_NEAREST)
        reg = cv2.dilate(reg, np.ones((9, 9), np.uint8))
        lin2 = np.zeros(reg.shape, np.float32) if keep_lines else cv2.resize(linesD[y0:y1, x0:x1], (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_NEAREST).astype(np.float32)
        ww, hh = save(cut_alpha(crop, reg, lin2), oid)
        manifest.append(dict(id=oid, plate=n, w=ww, h=hh, box=[X0, Y0, X1 - X0, Y1 - Y0], kind=kind))
    kept = 0
    for p in orn:
        kept += 1; regm = np.isin(labels, p['ids'])
        regm = regm | (cv2.dilate(regm.astype(np.uint8), np.ones((11, 11), np.uint8)).astype(bool) & (cutband > 0) & (ink2 > 0))
        write(f'p{n:02d}_{kept:02d}', p['box'], regm, 'ornament')
    if F is not None:
        fm = linesD.astype(bool) | np.isin(labels, [i for p in frame_pieces for i in p['ids']])
        write(f'p{n:02d}_frame', [F[0] - 4, F[1] - 4, F[2] + 4, F[3] + 4], fm, 'frame', keep_lines=True, pad=6)
        allm = ink.astype(bool)
        write(f'p{n:02d}_panel', [F[0] - 4, F[1] - 4, F[2] + 4, F[3] + 4], allm, 'panel', keep_lines=True, pad=6)
    else:  # no printed frame: the whole printed area is the panel
        ys, xs = np.nonzero(ink)
        write(f'p{n:02d}_panel', [xs.min(), ys.min(), xs.max(), ys.max()], ink.astype(bool), 'panel', keep_lines=True, pad=6)

    dbg = (img * 0.55 + 255 * 0.45).astype(np.uint8)
    dbg[lines > 0] = (255, 0, 255)
    for p in frame_pieces: x0, y0, x1, y1 = p['box']; cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 190, 255), 1)
    if F is not None: cv2.rectangle(dbg, (F[0], F[1]), (F[2], F[3]), (255, 120, 0), 2)
    for why, p in dropped: x0, y0, x1, y1 = p['box']; cv2.rectangle(dbg, (x0, y0), (x1, y1), (120, 120, 120), 1)
    for i, p in enumerate(orn):
        x0, y0, x1, y1 = p['box']; cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 150, 0), 2)
        cv2.putText(dbg, str(i + 1), (x0 + 3, y0 + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 120, 0), 2)
    cv2.imwrite(f'{OUT}/dbg/d{n:02d}.jpg', dbg, [cv2.IMWRITE_JPEG_QUALITY, 75])
    print(n, 'frame' if F is not None else 'no-frame', len(orn), 'ornaments', len(dropped), 'dropped', flush=True)
    for why, p in dropped: manifest.append(dict(id=None, plate=n, dropped=why, box=[int(v / k) for v in p['box']]))
json.dump(manifest, open(f'{OUT}/manifest.json', 'w'))
