"""Cut the parts and designs out of the plates of Grasset (ed.), La Plante et ses applications ornementales (1896).
Source: Internet Archive item planteetsesappl00Gras (Smithsonian Libraries copy, digitised for the Biodiversity
Heritage Library), full-size page images. Works on half-size copies; cut-outs are taken from the full-size pages.

A plate is a sheet of paper inside a double-rule frame. Everything that is not bare paper reachable from the frame
is an item: a plant part on the study plates, a design (panel, border, vase…) on the application plates. Paper
enclosed by an item (a white petal, the ground of a design, a gap between stems) stays with it, as printed."""
import cv2, os, numpy as np, json, os, sys

SRC = '/mnt/user-data/uploads/art noveau mirrors/_to_delete/lp_pages/'
PLATE = {10:1,12:2,14:3,16:4,18:7,20:8,22:9,24:10,26:11,28:12,30:13,32:14,34:15,36:16,38:17,40:18,42:19,44:20,46:22,48:23,
         50:24,52:26,54:27,56:29,58:30,60:31,62:32,64:33,66:34,68:35,70:36,72:37,74:38,76:39,78:40,80:41,82:42,84:44,86:45,
         88:47,90:48,92:49,94:50,96:51,98:52,100:53,102:55,104:56,106:57,108:58,110:60,112:62,114:69}
# The 19 plates missing from the Internet Archive copy, from the BnF copy (Gallica ark:/12148/btv1b10546212d, PDF
# download, 1024-px pages upscaled to the Internet Archive geometry). Leaf = 200 + plate.
GALLICA = [5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63, 64, 65, 66, 67, 68, 70, 71, 72]
PLATE.update({200 + p: p for p in GALLICA})
GSRC = '/home/claude/lp/gal/hires/'
src_orig = lambda leaf: (GSRC if leaf >= 200 else SRC) + 'n%03d.jpg' % leaf
# pages straightened to their printed frame by rectify.py (rotation + keystone); rectify.py reads src_orig
RECT = '/home/claude/lp/rect/'
ORIG = os.environ.get('SEG_ORIG') == '1'      # segment on the original (unstraightened) pages, as reviewed by eye
HALF = 'half_orig/' if ORIG else 'half/'
src = (lambda leaf: src_orig(leaf)) if ORIG else (lambda leaf: RECT + 'n%03d.jpg' % leaf if os.path.exists(RECT + 'n%03d.jpg' % leaf) else src_orig(leaf))
LEAF = {v: k for k, v in PLATE.items()}
is_study = lambda pl: pl % 3 == 1

def frame_lines(half):
    """The four inner frame rules: positions (x0, y0, x1, y1) just inside the double rule, in half-size pixels."""
    g = cv2.cvtColor(half, cv2.COLOR_BGR2GRAY); H, W = g.shape
    bg = cv2.medianBlur(g, 41); dark = ((bg.astype(int) - g) > 22).astype(np.uint8)
    thin = dark & (1 - cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)))
    hl = cv2.morphologyEx(thin, cv2.MORPH_OPEN, np.ones((1, 161), np.uint8))
    vl = cv2.morphologyEx(thin, cv2.MORPH_OPEN, np.ones((161, 1), np.uint8))
    # allow a slight skew: close small vertical steps before opening
    hl |= cv2.morphologyEx(cv2.dilate(thin, np.ones((3, 1), np.uint8)), cv2.MORPH_OPEN, np.ones((1, 241), np.uint8)) & cv2.dilate(thin, np.ones((3, 1), np.uint8))
    vl |= cv2.morphologyEx(cv2.dilate(thin, np.ones((1, 3), np.uint8)), cv2.MORPH_OPEN, np.ones((241, 1), np.uint8)) & cv2.dilate(thin, np.ones((1, 3), np.uint8))
    rows = hl.sum(1) / W; cols = vl.sum(0) / H
    def side(prof, lo, hi, outer_first):
        for thr in (0.30, 0.18, 0.10, 0.05):
            idx = [i for i in range(int(lo), int(hi)) if prof[i] > thr]
            if idx: break
        if not idx: return None
        o = idx[0] if outer_first else idx[-1]
        grp = [i for i in idx if abs(i - o) < 34]         # the double rule: outer and inner line
        return (max(grp) if outer_first else min(grp))
    y0 = side(rows, 250, 450, True); y1 = side(rows, 3050, 3300, False)
    x0 = side(cols, 200, 430, True); x1 = side(cols, 2120, 2330, False)
    return x0, y0, x1, y1

def segment(leaf, dbg=None):
    pl = PLATE[leaf]; full = cv2.imread(src(leaf)); half = cv2.imread(HALF + 'n%03d.png' % leaf)
    H, W = half.shape[:2]; x0, y0, x1, y1 = frame_lines(half)
    if None in (x0, y0, x1, y1): raise RuntimeError(f'plate {pl}: frame not found {x0, y0, x1, y1}')
    pad = 7; ix0, iy0, ix1, iy1 = x0 + pad, y0 + pad, x1 - pad, y1 - pad           # inside the frame
    lab = cv2.cvtColor(cv2.GaussianBlur(half, (0, 0), 1.0), cv2.COLOR_BGR2LAB).astype(np.float32)
    # paper colour: a smooth field fitted to the lightest, flattest pixels inside the frame
    inner = lab[iy0:iy1, ix0:ix1]; h, w = inner.shape[:2]
    ring = np.concatenate([lab[max(0, y0 - 60):y0 - 22, x0:x1].reshape(-1, 3), lab[y1 + 22:y1 + 60, x0:x1].reshape(-1, 3),
                           lab[y0:y1, max(0, x0 - 60):x0 - 22].reshape(-1, 3), lab[y0:y1, x1 + 22:x1 + 60].reshape(-1, 3)])
    paper = np.median(ring, 0)
    d = np.sqrt(((inner - paper) * np.array([1.0, 1.6, 1.6])) ** 2).sum(-1) if False else np.linalg.norm((inner - paper) * np.array([1.0, 1.6, 1.6], np.float32), axis=2)
    study = is_study(pl)
    T = 15.0
    ink = (d > T).astype(np.uint8)
    # close hairline gaps in outlines so that the paper outside cannot leak into a part
    barrier = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    free = (1 - barrier).astype(np.uint8)
    # outside paper = free pixels connected to the frame's inside edge
    ff = np.zeros((h + 2, w + 2), np.uint8); canvas = free.copy()
    n, lb = cv2.connectedComponents(free, connectivity=4)
    edge = np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]])); edge = edge[edge > 0]
    area = np.bincount(lb.ravel(), minlength=n)
    out_lab = set(edge.tolist())
    outside = np.isin(lb, list(out_lab)).astype(np.uint8)
    outside = cv2.dilate(outside, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) & (1 - ink) | outside
    fg = (1 - outside).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # paper enclosed by an item: candidates for 'gap between stems' (decided by eye, see overrides.json)
    enc = cv2.morphologyEx(((fg == 1) & (ink == 0)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ne, le, se, _ = cv2.connectedComponentsWithStats(enc, 4)
    cands = []
    for i in range(1, ne):
        if se[i, 4] < 3500: continue
        m = (le == i).astype(np.uint8); dt = cv2.distanceTransform(m, cv2.DIST_L2, 3); py, px = np.unravel_index(dt.argmax(), dt.shape)
        cands.append(dict(id=i, pt=(int(px), int(py)), area=int(se[i, 4])))
    cands.sort(key=lambda c: -c['area'])
    if not study:
        # a long straight band of bare paper inside an item separates two designs printed side by side
        for i in range(1, ne):
            bw, bh, a = se[i, 2], se[i, 3], se[i, 4]
            if min(bw, bh) <= 90 and max(bw, bh) >= 0.22 * min(h, w) and a >= 0.7 * bw * bh:
                fg[cv2.dilate((le == i).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0] = 0
    return dict(pl=pl, full=full, half=half, box=(ix0, iy0, ix1, iy1), fg=fg, ink=ink, paper=paper, study=study, frame=(x0, y0, x1, y1), enc=le, cands=cands)

OV = json.load(open('overrides.json')) if os.path.exists('overrides.json') else {}
def shape_mask(sh, h, w):
    m = np.zeros((h, w), np.uint8)
    if sh[0] == 'circle': cv2.circle(m, (int(sh[1]), int(sh[2])), int(sh[3]), 1, -1)
    elif sh[0] == 'ellipse': cv2.ellipse(m, ((sh[1], sh[2]), (sh[3], sh[4]), sh[5]), 1, -1)
    elif sh[0] == 'rect': cv2.rectangle(m, (int(sh[1]), int(sh[2])), (int(sh[3]), int(sh[4])), 1, -1)
    elif sh[0] == 'poly': cv2.fillPoly(m, [np.array(sh[1], np.int32)], 1)
    return m

def items(S):
    """Returns (items, leftover mask). Per-plate corrections made by eye come from overrides.json (half-size pixels inside the frame):
    gaps  = points inside enclosed paper that is really background (a gap between stems), made transparent;
    cuts  = line segments [x0,y0,x1,y1(,width)] separating designs that are printed touching;
    drop  = points on pieces to leave out (signatures, labels); join = lists of points on pieces forming one item;
    extra = shapes cut out as items of their own although they overlap another item (a roundel lying over a pattern);
    only  = shapes: restrict an item (found at point) to a shape."""
    ov = OV.get(str(S['pl']), {})
    fg = S['fg'].copy(); h, w = fg.shape; study = S['study']
    for sh in ov.get('fill', []): fg[shape_mask(sh, h, w) > 0] = 1; S['fg'][shape_mask(sh, h, w) > 0] = 1
    if study and S['pl'] in GALLICA:
        # the BnF pages are framed a little wider: the inner frame rules are left inside the box. Remove long straight
        # rows/columns of ink near the edges (plants on study plates never run along the frame).
        for y in list(range(0, 90)) + list(range(h - 90, h)):
            if fg[y].mean() > 0.35: fg[max(0, y - 3):y + 4] = 0
        for x in list(range(0, 90)) + list(range(w - 90, w)):
            if fg[:, x].mean() > 0.35: fg[:, max(0, x - 3):x + 4] = 0
    for (px, py) in ov.get('gaps', []):
        i = S['enc'][py, px]
        if i > 0: fg[cv2.dilate((S['enc'] == i).astype(np.uint8), np.ones((5, 5), np.uint8)) & (1 - S['ink']) > 0] = 0
    for c in ov.get('cuts', []):
        cv2.line(fg, (int(c[0]), int(c[1])), (int(c[2]), int(c[3])), 0, int(c[4]) if len(c) > 4 else 9)
    for sh in ov.get('erase', []): fg[shape_mask(sh, h, w) > 0] = 0
    if ov.get('split'):
        ix0, iy0, ix1, iy1 = S['box']; L = cv2.cvtColor(S['half'][iy0:iy1, ix0:ix1], cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
        L = cv2.GaussianBlur(L, (0, 0), 1.2); S['splits'] = []
        for sp in ov['split']:
            kind, pos, a, b = sp[:4]; a, b = int(max(0, a)), int(min(b, (w if kind == 'h' else h) - 1)); rng = sp[4] if len(sp) > 4 else 28
            best = (-1, pos)
            for q in range(int(pos - rng), int(pos + rng) + 1):
                if kind == 'h':
                    if q < 2 or q >= h - 2: continue
                    sc = np.abs(L[q + 2, a:b] - L[q - 2, a:b]).mean()
                else:
                    if q < 2 or q >= w - 2: continue
                    sc = np.abs(L[a:b, q + 2] - L[a:b, q - 2]).mean()
                if sc > best[0]: best = (sc, q)
            q = best[1] if rng > 0 else int(pos)
            if kind == 'h': cv2.line(fg, (a, q), (b, q), 0, 5); S['splits'].append((a, q, b, q))
            else: cv2.line(fg, (q, a), (q, b), 0, 5); S['splits'].append((q, a, q, b))
    if not study and not ov.get('noopen'):
        # designs are solid blocks: a hairline (an inner rule round the plate, a stray stroke) must not tie two of them together
        op = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
        n0, l0 = cv2.connectedComponents(op, connectivity=8); lab_f = l0.astype(np.float32)
        for _ in range(7):                                   # give each block back its own fine edge (lace, tendrils), up to 14 px
            grown = cv2.dilate(lab_f, np.ones((5, 5), np.uint8)); take = (lab_f == 0) & (fg > 0); lab_f[take] = grown[take]
        fg = (lab_f > 0).astype(np.uint8)
        n, lb, st, cen = cv2.connectedComponentsWithStats(fg, 8)
        # pieces that grew into each other keep their own label
        lb = lab_f.astype(np.int32); n = int(lb.max()) + 1
        st = np.zeros((n, 5), np.int64); st[:, 4] = np.bincount(lb.ravel(), minlength=n)
    else:
        n, lb, st, cen = cv2.connectedComponentsWithStats(fg, 8)
    # a split divides the whole block it crosses, along its line (the drawn line may stop short of the block's edge)
    for (sx0, sy0, sx1, sy1) in S.get('splits', []):
        vert = sx0 == sx1
        if vert:
            ys_ = np.arange(sy0, sy1); band = np.concatenate([lb[ys_, max(0, sx0 - 6)], lb[ys_, min(w - 1, sx0 + 6)]])
        else:
            xs_ = np.arange(sx0, sx1); band = np.concatenate([lb[max(0, sy0 - 6), xs_], lb[min(h - 1, sy0 + 6), xs_]])
        band = band[band > 0]
        if not len(band): continue
        t = int(np.bincount(band).argmax()); m = lb == t
        yy, xx = np.nonzero(m); side = (xx > sx0) if vert else (yy > sy0)
        lb[yy[side], xx[side]] = n; n += 1
        st = np.zeros((n, 5), np.int64); st[:, 4] = np.bincount(lb.ravel(), minlength=n)
    A = h * w; big_t = 0.0015 * A if study else 0.004 * A
    big_t = ov.get('big', big_t)
    big = [i for i in range(1, n) if st[i, 4] >= big_t]
    small = [i for i in range(1, n) if 60 <= st[i, 4] < big_t]
    owner = {i: i for i in big}
    if small:
        reach = ov.get('reach', 17 if study else 6)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach + 1, 2 * reach + 1))
        bigmap = np.where(np.isin(lb, big), lb, 0).astype(np.int32)
        near = cv2.dilate(bigmap.astype(np.float32), k).astype(np.int32)
        smallmask = np.isin(lb, small).astype(np.uint8)
        g2 = ov.get('group', 9 if study else 3)
        n2, l2 = cv2.connectedComponents(cv2.dilate(smallmask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * g2 + 1, 2 * g2 + 1))), connectivity=8)
        l2 = l2 * smallmask
        for c in range(1, n2):
            m = l2 == c; ids = np.unique(lb[m]); tgt = near[m]; tgt = tgt[tgt > 0]
            if len(tgt) > 0.02 * m.sum() and len(tgt) >= 8:
                t = int(np.bincount(tgt).argmax())
                for i in ids: owner[int(i)] = t
            else:
                for i in ids: owner[int(i)] = -c
    at = lambda p: owner.get(int(lb[int(p[1]), int(p[0])]))
    for grp in ov.get('join', []):
        ts = [at(p) for p in grp]; ts = [t for t in ts if t is not None]
        for i in list(owner):
            if owner[i] in ts[1:]: owner[i] = ts[0]
    dropped = {at(p) for p in ov.get('drop', [])} - {None}
    groups = {}
    for i, t in owner.items(): groups.setdefault(t, []).append(i)
    out = []; used = np.zeros((h, w), np.uint8)
    def add(m, why=''):
        a = int(m.sum())
        if a == 0: return
        ys, xs = np.nonzero(m); bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        out.append(dict(mask=m[bx[1]:bx[3], bx[0]:bx[2]].astype(bool), box=bx, area=a, why=why))
    for t, ids in groups.items():
        if t in dropped: continue
        m = np.isin(lb, ids); a = int(m.sum())
        if a < ov.get('min', 700 if study else big_t): continue
        ys, xs = np.nonzero(m); bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        # the signature: a small low box or line of lettering in a bottom corner of the frame
        if bh < 0.026 * h and bw < 0.24 * w and ys.max() > 0.95 * h and a < 0.006 * A: continue
        if min(bw, bh) < 18: continue
        for o in ov.get('only', []):
            if at(o[0]) == t: m = m & (shape_mask(o[1], h, w) > 0)
        used |= m.astype(np.uint8); add(m)
    for sh in ov.get('extra', []):
        add((shape_mask(sh, h, w) > 0) & (S['fg'] > 0), 'extra')
    inside = lambda b, r: b[0] >= r[0] and b[1] >= r[1] and b[2] <= r[2] and b[3] <= r[3]
    # dropin: leftovers (frame rules, a signature on a rule) whose box lies inside a rect are left out
    out = [o for o in out if not any(inside(o['box'], r) for r in ov.get('dropin', []))]
    # mergein: a piece cut off at the frame whose box lies inside a rect goes back to the biggest item touching the rect
    for r in ov.get('mergein', []):
        sm = [o for o in out if inside(o['box'], r) and not o['why']]
        if not sm: continue
        sid = {id(o) for o in sm}; hit = [o for o in out if id(o) not in sid and not o['why'] and o['box'][0] <= r[2] and o['box'][2] >= r[0] and o['box'][1] <= r[3] and o['box'][3] >= r[1]]
        if not hit: continue
        t = max(hit, key=lambda o: o['area'])
        bx = (min([t['box'][0]] + [o['box'][0] for o in sm]), min([t['box'][1]] + [o['box'][1] for o in sm]),
              max([t['box'][2]] + [o['box'][2] for o in sm]), max([t['box'][3]] + [o['box'][3] for o in sm]))
        m = np.zeros((bx[3] - bx[1], bx[2] - bx[0]), bool)
        for o in [t] + sm:
            b = o['box']; m[b[1] - bx[1]:b[3] - bx[1], b[0] - bx[0]:b[2] - bx[0]] |= o['mask']
        t.update(mask=m, box=bx, area=int(m.sum())); out = [o for o in out if id(o) not in sid]
    out.sort(key=lambda o: (round(o['box'][1] / (0.12 * h)), o['box'][0]))
    return out, (fg > 0) & (used == 0)

def debug(S, its, left, path):
    ix0, iy0, ix1, iy1 = S['box']; v = S['half'][iy0:iy1, ix0:ix1].copy(); ov = OV.get(str(S['pl']), {})
    bgm = S['fg'] == 0
    v[bgm] = (v[bgm] * 0.35 + np.array([255, 120, 0]) * 0.65).astype(np.uint8)
    gapm = (S['fg'] == 1) & np.isin(S['enc'], [S['enc'][py, px] for px, py in ov.get('gaps', [])] or [-1])
    v[gapm] = (v[gapm] * 0.4 + np.array([255, 200, 0]) * 0.6).astype(np.uint8)
    v[left] = (v[left] * 0.3 + np.array([255, 0, 255]) * 0.7).astype(np.uint8)
    for c in list(ov.get('cuts', [])) + list(S.get('splits', [])): cv2.line(v, (int(c[0]), int(c[1])), (int(c[2]), int(c[3])), (0, 255, 0), 7)
    for k, o in enumerate(its):
        x0, y0, x1, y1 = o['box']; col = (0, 140, 255) if o['why'] else (0, 0, 255)
        cv2.rectangle(v, (x0, y0), (x1, y1), col, 3); cv2.putText(v, str(k + 1), (x0 + 6, y0 + 46), 0, 1.6, col, 5)
    if S['study']:
        done = {S['enc'][py, px] for px, py in ov.get('gaps', [])}
        for j, c in enumerate(S['cands'][:40]):
            if c['id'] in done: continue
            cv2.circle(v, c['pt'], 9, (0, 0, 0), -1); cv2.putText(v, chr(65 + j) if j < 26 else chr(71 + j), (c['pt'][0] + 10, c['pt'][1] + 14), 0, 1.3, (0, 0, 0), 4)
    for x in range(0, v.shape[1], 250):
        cv2.line(v, (x, 0), (x, 26), (0, 0, 0), 3); cv2.putText(v, str(x), (x + 4, 24), 0, 0.8, (0, 0, 0), 2)
    for y in range(250, v.shape[0], 250):
        cv2.line(v, (0, y), (26, y), (0, 0, 0), 3); cv2.putText(v, str(y), (2, y - 4), 0, 0.8, (0, 0, 0), 2)
    v = cv2.resize(v, None, fx=0.4, fy=0.4, interpolation=cv2.INTER_AREA)
    cv2.putText(v, 'Pl.%d' % S['pl'], (v.shape[1] - 110, v.shape[0] - 10), 0, 0.9, (0, 0, 255), 2)
    cv2.imwrite(path, v)

if __name__ == '__main__':
    os.makedirs('dbg', exist_ok=True)
    pls = sorted(LEAF) if sys.argv[1] == 'all' else [int(x) for x in sys.argv[1].split(',')]
    for pl in pls:
        S = segment(LEAF[pl]); its, left = items(S); debug(S, its, left, f'dbg/pl{pl:02d}.jpg')
        print(pl, S['frame'], len(its), 'cands', ' '.join(f"{chr(65+j) if j<26 else chr(71+j)}{c['pt']}" for j, c in enumerate(S['cands'][:40])) if S['study'] else '', flush=True)
