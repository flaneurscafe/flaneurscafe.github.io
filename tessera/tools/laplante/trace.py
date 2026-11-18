"""Trace the outer frame rule of a straightened La Plante page along its whole length: per position along the rule,
the first dark line met coming from the page margin. Returns sampled points for top/bottom/left/right (half-size px)."""
import cv2, numpy as np, sys
sys.path.insert(0, '/home/claude/lp')
from seg import frame_lines
def trace(half, step=6, win=40):
    g = cv2.GaussianBlur(cv2.cvtColor(half, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.2)
    x0, y0, x1, y1 = frame_lines(half); H, W = g.shape; out = {}
    paper = np.median(g[: max(10, int(y0) - 30), :])
    thr = paper - 45
    def first_dark(prof, rev):
        idx = np.arange(len(prof))[::-1] if rev else np.arange(len(prof))
        for i in idx:
            if prof[i] < thr:
                # refine: centre of this dark run
                j = i; 
                while 0 <= j < len(prof) and prof[j] < thr: j += -1 if rev else 1
                return (i + j) / 2
        return None
    def side(name, along, fixed, rev, horiz):
        pts = []
        for t in range(int(along[0]), int(along[1]), step):
            if horiz: lo = int(max(0, fixed - win)); prof = g[lo:int(fixed + win), t]
            else: lo = int(max(0, fixed - win)); prof = g[t, lo:int(fixed + win)]
            r = first_dark(prof, rev)
            if r is not None: pts.append((t, lo + r))
        out[name] = np.array(pts, np.float32)
    m = 50
    side('top', (x0 + m, x1 - m), y0, False, True); side('bottom', (x0 + m, x1 - m), y1, True, True)
    side('left', (y0 + m, y1 - m), x0, False, False); side('right', (y0 + m, y1 - m), x1, True, False)
    return out, (x0, y0, x1, y1)
def bow(pts):
    """deviation from the straight chord: max |residual| of a line fit, and of a quadratic (curvature)"""
    if len(pts) < 30: return None
    t, v = pts[:, 0], pts[:, 1]
    for _ in range(3):
        c = np.polyfit(t, v, 2); r = v - np.polyval(c, t); k = np.abs(r) < max(1.5, 3 * np.median(np.abs(r)))
        t, v = t[k], v[k]
    l = np.polyfit(t, v, 1); q = np.polyfit(t, v, 2)
    lin = v - np.polyval(l, t); return float(np.ptp(np.polyval(q, t) - np.polyval(l, t))), float(np.std(v - np.polyval(q, t)))
if __name__ == '__main__':
    from seg import PLATE
    rows = []
    for leaf, pl in sorted(PLATE.items(), key=lambda kv: kv[1]):
        o, _ = trace(cv2.imread('/home/claude/lp/half/n%03d.png' % leaf))
        b = {k: bow(v) for k, v in o.items()}
        rows.append((pl, leaf, b)); print(pl, leaf, ' '.join(f"{k}:{v[0]:.1f}/{v[1]:.1f}" if v else f"{k}:-" for k, v in b.items()), flush=True)
