"""Vertical offset between the two ends of a repeat: the shift dy that best matches column x0 with column x0 + d."""
import cv2, numpy as np
def col_profile(a, x, w=4):
    al = a[..., 3:4] / 255.; rgb = a[..., :3] * al + 255 * (1 - al)
    g = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
    x = int(np.clip(x, 0, a.shape[1] - w)); return g[:, x:x + w].mean(1)
def dy_between(a, x0, x1, R=12):
    p, q = col_profile(a, x0), col_profile(a, x1); H = len(p); best = (-2, 0)
    for s in range(-R, R + 1):
        A = p[max(0, -s):H - max(0, s)]; B = q[max(0, s):H - max(0, -s)]
        if len(A) < H * 0.6: continue
        A = A - A.mean(); B = B - B.mean(); c = float((A * B).sum() / (np.sqrt((A * A).sum() * (B * B).sum()) + 1e-6))
        if c > best[0]: best = (c, s)
    return best[1], best[0]
def dy_sub(a, x0, x1, R=12):
    """as dy_between, to a tenth of a pixel (rows resampled 10x)"""
    b = cv2.resize(a, (a.shape[1], a.shape[0] * 10), interpolation=cv2.INTER_CUBIC)
    s, c = dy_between(b, x0, x1, R * 10); return s / 10, c
def shear(a, k, x0=0):
    """dst(x, y) = src(x, y + k (x - x0)): rows tilted by k px per px are made level"""
    M = np.float32([[1, 0, 0], [k, 1, -k * x0]])
    return cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
