"""Find printed borders (friezes) in the library cut-outs: repeat length by autocorrelation along the long axis,
frieze group from mirror / glide / half-turn tests, a clean repeat unit. Writes bands.json."""
import cv2, numpy as np, json, re, sys
LP = '/home/claude/lp/outr/plants/'; CO = '/home/claude/fz/ornaments/'
def load(i):
    a = cv2.imread((LP if i.startswith('lp') else CO) + i + '.webp', cv2.IMREAD_UNCHANGED)
    if a.shape[2] == 3: a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    return a
def feat(a):
    al = a[..., 3:4] / 255.; rgb = a[..., :3] * al + 255 * (1 - al)
    lab = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    return lab, a[..., 3] > 128
def ncc(A, B, M):
    a = A[M]; b = B[M]
    if a.size < 200: return -1
    a = a - a.mean(0); b = b - b.mean(0); return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-6))
def shift_scores(I, J, MI, MJ, lo, hi):
    L = I.shape[1]; out = {}
    for d in range(lo, hi):
        A, B = I[:, :L - d], J[:, d:]; M = MI[:, :L - d] & MJ[:, d:]
        out[d] = ncc(A, B, M)
    return out
def analyse(i):
    a = load(i); o = 'h'
    if a.shape[0] > a.shape[1]: a = np.ascontiguousarray(np.rot90(a, -1)); o = 'v'     # long axis horizontal (clockwise)
    H0, L0 = a.shape[:2]; k = 72 / H0; s = cv2.resize(a, (max(8, round(L0 * k)), 72), interpolation=cv2.INTER_AREA)
    I, M = feat(s); H, L = M.shape
    # columns fully outside the cut-out (L-shapes, ragged ends) do not count
    sc = shift_scores(I, I, M, M, max(4, int(0.25 * H)), int(L * 0.62))
    if not sc: return None
    ds = np.array(sorted(sc)); v = np.array([sc[d] for d in ds])
    peaks = [j for j in range(1, len(v) - 1) if v[j] >= v[j - 1] and v[j] >= v[j + 1] and v[j] > 0.3]
    if not peaks: return dict(id=i, o=o, verdict='none', t=float(v.max()))
    best = max(v[j] for j in peaks); j0 = min(j for j in peaks if v[j] >= 0.88 * best); d = int(ds[j0]); t = float(v[j0])
    # tests over a window of shifts: flipped copies
    def test(J, MJ):
        r = shift_scores(I, J, M, MJ, 0, min(L - 10, d + 2)) ; r2 = shift_scores(J, I, MJ, M, 1, min(L - 10, d + 2))
        allv = {**{x: y for x, y in r.items()}, **{-x: y for x, y in r2.items()}}
        b = max(allv, key=allv.get); return allv[b], b
    fx, bx = test(I[:, ::-1].copy(), M[:, ::-1].copy())
    fy, by = test(I[::-1].copy(), M[::-1].copy())
    fr, br = test(I[::-1, ::-1].copy(), M[::-1, ::-1].copy())
    thr = lambda f: f >= max(0.5, 0.85 * t)
    # flip-along test: shift b of the vertically flipped copy, modulo the period: ~0 -> mirror along, ~d/2 -> glide
    ph = (by % d) / d; hm = thr(fy) and (ph < 0.12 or ph > 0.88); gl = thr(fy) and 0.38 < ph < 0.62
    vm, rt = thr(fx), thr(fr)
    grp = ('p2mm' if vm and hm else 'p2mg' if vm and (rt or gl) else 'p1m1' if vm else 'p11m' if hm else
           'p2' if rt else 'p11g' if gl else 'p1')
    # vertical mirror axis position in cut-out columns: flipped copy shifted by b matches at axis c = (L - 1 + b) / 2
    axis = ((L - 1 - bx) / 2) % (d / 2) if vm else None
    reps = L / d; fill = float(M.mean())
    verdict = 'verified' if t >= 0.72 and reps >= 2.4 else 'approximate' if t >= 0.5 and reps >= 1.9 else 'reject'
    f = 1 / k
    return dict(id=i, o=o, L=L0, H=H0, period=round(d * f, 1), t=round(t, 3), reps=round(reps, 2), group=grp,
                scores=dict(vx=round(fx, 2), hy=round(fy, 2), ph=round(ph, 2), rot=round(fr, 2)),
                axis=None if axis is None else round(axis * f, 1), fill=round(fill, 3), verdict=verdict)
if __name__ == '__main__':
    ids = json.load(open(sys.argv[1])); out = []
    for i in ids:
        r = analyse(i)
        if r: out.append(r); print(r['id'], r.get('verdict'), r.get('period'), r.get('t'), r.get('reps'), r.get('group'), flush=True)
    json.dump(out, open(sys.argv[2], 'w'), indent=0)
