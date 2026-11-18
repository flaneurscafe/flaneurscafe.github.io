"""Cut one clean repeat unit from each accepted printed border (full resolution), refine the period, test the
across-band mirror (sidle, p1m1) at a precise axis, start mirror units on an axis, other units at the cleanest seam."""
import cv2, numpy as np, json, os
from bands import load, feat, ncc
from seam import dy_sub, shear
R = {r['id']: r for r in json.load(open('bands_raw.json'))}
REJECT = {'p17_04', 'p26_03', 'lp17_04', 'lp44_04', 'p30_05', 'lp26_04', 'lp65_05'}
SIDLE = {'lp05_01', 'lp09_01', 'lp21_04', 'lp27_04', 'lp32_04', 'lp35_03', 'lp68_01', 'lp71_01', 'lp02_02', 'lp56_04', 'lp08_04', 'lp32_01', 'lp59_01'}   # by eye
CORNER = {'lp06_03', 'lp08_01'}
FORCE_P1 = {'lp26_04', 'lp59_01', 'p37_06'}
HU = 200                                   # unit height in px
os.makedirs('units', exist_ok=True)
def prep(i):
    a = load(i); r = R[i]
    if r['o'] == 'v': a = np.ascontiguousarray(np.rot90(a, -1))
    k = HU / a.shape[0]; a = cv2.resize(a, (round(a.shape[1] * k), HU), interpolation=cv2.INTER_AREA)
    return a, r['period'] * k
def refine_period(I, M, d0):
    L = I.shape[1]; best = (-2, d0)
    for d in np.arange(d0 * 0.96, d0 * 1.04, 0.25):
        di = int(round(d)); 
        if di >= L - 10: continue
        s = ncc(I[:, :L - di], I[:, di:], M[:, :L - di] & M[:, di:])
        if s > best[0]: best = (s, di)
    return best[1], best[0]
out = []
for i, r in R.items():
    if r['verdict'] not in ('verified', 'approximate') or i in REJECT or i in CORNER: continue
    a, d0 = prep(i); I, M = feat(a); L = a.shape[1]
    d, t = refine_period(I, M, d0)
    full = (a[..., 3] > 200).mean(0) > 0.97                           # columns fully inside the cut-out
    # mirror test: best axis c (half-pixel steps) inside the central part
    mq, mc = -2, None
    for c2 in range(int(L * 0.2) * 2, int(L * 0.8) * 2):
        c = c2 / 2; w = int(min(c, L - 1 - c, d)); 
        if w < d * 0.45: continue
        lo = int(np.ceil(c - w)); cols = np.arange(lo, int(c) + 1); mir = np.round(2 * c - cols).astype(int)
        q = ncc(I[:, cols], I[:, mir], M[:, cols] & M[:, mir])
        if q > mq: mq, mc = q, c
    grp = 'p1m1' if i in SIDLE else 'p1'
    # candidate starts: windows [st, st+d) fully inside, seam cost = difference between column st and st+d
    cand = [st for st in range(0, L - d) if full[st:st + d + 1].all()]
    if not cand: cand = list(range(0, L - d)); 
    if not cand: continue
    if grp == 'p1m1':
        ax = [c for c in np.arange(mc % (d / 2), L, d / 2)]
        cand2 = [int(round(c)) for c in ax if int(round(c)) in cand]
        cand = cand2 or cand
    cost = [float(np.abs(I[:, st] - I[:, min(L - 1, st + d)]).mean()) for st in cand]
    st = cand[int(np.argmin(cost))]
    # level the band: the same column one period later sits dy px lower when the printed band is slightly tilted
    dy, _ = dy_sub(a, st + 2, st + d + 2)
    if abs(dy) >= 0.2: a = shear(a, dy / d, st)
    unit = a[:, st:st + d].copy()
    rows = np.nonzero((unit[..., 3] > 128).mean(1) > 0.05)[0]; unit = unit[rows.min():rows.max() + 1]
    if grp == 'p1m1':                                                 # make the unit exactly symmetric about its centre
        pass
    cv2.imwrite(f'units/{i}.webp', unit, [cv2.IMWRITE_WEBP_QUALITY, 88])
    out.append(dict(id=i, w=int(unit.shape[1]), h=int(unit.shape[0]), group=grp, t=round(t, 3), mirror=round(mq, 3), reps=r['reps'],
                    verdict='verified' if t >= 0.72 and r['reps'] >= 2.4 else 'approximate', seam=round(min(cost), 1), dy=round(float(dy), 1)))
    print(i, out[-1], flush=True)
json.dump(out, open('units.json', 'w'), indent=0)
