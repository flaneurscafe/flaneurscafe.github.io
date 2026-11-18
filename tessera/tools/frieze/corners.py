import cv2, numpy as np, json
from bands import feat, ncc
from seam import dy_sub, shear
SRC = '/home/claude/lp/outr/plants/'
# rotate each L so its corner is at the top left (rotation only, the drawing is never mirrored)
ROT = {'lp08_01': 0, 'lp54_01': 1, 'lp06_03': 2}            # number of 90° counter-clockwise turns
out = []
for i, k in ROT.items():
    a = np.ascontiguousarray(np.rot90(cv2.imread(SRC + i + '.webp', cv2.IMREAD_UNCHANGED), k))
    al = a[..., 3] > 128; H, W = al.shape
    th = int(np.nonzero(al[:, int(W * .9)])[0].max()) + 1          # horizontal arm thickness (at its far end)
    tv = int(np.nonzero(al[int(H * .9), :])[0].max()) + 1          # vertical arm thickness
    t = min(th, tv); blk = a[:t, :t].copy()
    arm = a[:th, t:].copy()                                       # the top arm, beyond the corner
    if H > W: arm = np.ascontiguousarray(np.rot90(a[t:, :tv], -1))  # the left arm is the long one: turned clockwise it reads like a top arm
    HU = 200; s = HU / arm.shape[0]; armS = cv2.resize(arm, (round(arm.shape[1] * s), HU), interpolation=cv2.INTER_AREA)
    I, M = feat(armS); L = armS.shape[1]
    best = (-2, None)
    for d in range(int(HU * 0.4), int(L * 0.6)):
        q = ncc(I[:, :L - d], I[:, d:], M[:, :L - d] & M[:, d:])
        if q > best[0]: best = (q, d)
    q, d = best
    st = int(np.argmin([np.abs(I[:, x] - I[:, x + d]).mean() for x in range(0, L - d)]))
    dy, _ = dy_sub(armS, st + 2, st + d + 2)
    if abs(dy) >= 0.2: armS = shear(armS, dy / d, st)
    unit = armS[:, st:st + d]
    blkS = cv2.resize(blk, (HU, HU), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'units/c_{i}.webp', blkS, [cv2.IMWRITE_WEBP_QUALITY, 90])
    cv2.imwrite(f'units/{i}.webp', unit, [cv2.IMWRITE_WEBP_QUALITY, 88])
    out.append(dict(id=i, th=th, tv=tv, period=d, t=round(q, 3), L=L, reps=round(L / d, 2)))
    print(out[-1])
    cv2.imwrite(f'dbg/c_{i}.jpg', np.hstack([cv2.cvtColor(blkS, cv2.COLOR_BGRA2BGR), np.hstack([cv2.cvtColor(unit, cv2.COLOR_BGRA2BGR)] * 3)]))
json.dump(out, open('corners.json', 'w'))
