"""Whole-page skew: the angle that makes the strong horizontal edges fall into the sharpest rows AND the strong vertical
edges into the sharpest columns (sum of squared projection histograms), refined to 0.01 deg."""
import cv2, numpy as np
def page_angle(half, lo=-2.0, hi=2.0):
    g = cv2.GaussianBlur(cv2.cvtColor(half, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.0)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    thr = np.percentile(np.hypot(gx, gy), 97)
    hy, hx = np.nonzero((np.abs(gy) > thr) & (np.abs(gy) > 3 * np.abs(gx)))   # horizontal edges
    vy, vx = np.nonzero((np.abs(gx) > thr) & (np.abs(gx) > 3 * np.abs(gy)))   # vertical edges
    def score(a):
        t = np.tan(np.radians(a))
        r = np.round(hy - hx * t).astype(np.int64); c = np.round(vx + vy * t).astype(np.int64)
        return float((np.bincount(r - r.min()) ** 2).sum() + (np.bincount(c - c.min()) ** 2).sum())
    A = np.arange(lo, hi + 1e-9, 0.05); s = [score(a) for a in A]; a0 = A[int(np.argmax(s))]
    A2 = np.arange(a0 - 0.06, a0 + 0.0601, 0.01); s2 = [score(a) for a in A2]
    return float(A2[int(np.argmax(s2))])
