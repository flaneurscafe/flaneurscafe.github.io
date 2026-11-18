"""Flatten the bow of a page that lifted off the scanner, using the printed frame as a ruler. Each of the four outer frame
rules is traced and fitted with a quadratic; its bow (quadratic minus its straight chord) is spread over the page by
linear blending between opposite sides, giving a displacement field d(u, v) (destination -> source). Applied to the
straightened page (lp/rect, lp/half). Field coefficients saved to dewarp.json so the cut-outs can follow the same map."""
import cv2, numpy as np, json, sys, os
sys.path.insert(0, '/home/claude/lp'); sys.path.insert(0, '/home/claude/dw')
from trace import trace
def fit(pts, deg=2):
    t, v = pts[:, 0].astype(float), pts[:, 1].astype(float)
    for _ in range(4):
        c = np.polyfit(t, v, deg); r = v - np.polyval(c, t); k = np.abs(r) < max(1.5, 3 * np.median(np.abs(r))); t, v = t[k], v[k]
    return np.polyfit(t, v, deg).tolist(), np.polyfit(t, v, 1).tolist()
def model(half):
    o, box = trace(half); m = {k: fit(v) for k, v in o.items()}; return dict(box=[float(b) for b in box], sides=m)
def field(M, W, H, scale=1.0):
    """displacement (dx, dy) on a W x H grid in units of half px * scale coordinates"""
    x0, y0, x1, y1 = M['box']; S = M['sides']
    u = np.arange(W, dtype=np.float32) / scale; v = np.arange(H, dtype=np.float32) / scale
    bow = lambda k, t: np.polyval(S[k][0], t) - np.polyval(S[k][1], t)
    s = np.clip((u - x0) / (x1 - x0), 0, 1); t = np.clip((v - y0) / (y1 - y0), 0, 1)
    dy = (1 - t)[:, None] * bow('top', u)[None, :] + t[:, None] * bow('bottom', u)[None, :]
    dx = (1 - s)[None, :] * bow('left', v)[:, None] + s[None, :] * bow('right', v)[:, None]
    return (dx * scale).astype(np.float32), (dy * scale).astype(np.float32)
def apply(img, M, scale):
    H, W = img.shape[:2]; dx, dy = field(M, W, H, scale)
    mx, my = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    return cv2.remap(img, mx + dx, my + dy, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
if __name__ == '__main__':
    from seg import PLATE
    leaves = [int(x) for x in sys.argv[1].split(',')]
    js = json.load(open('dewarp.json')) if os.path.exists('dewarp.json') else {}
    os.makedirs('rot_full', exist_ok=True); os.makedirs('rot_half', exist_ok=True)
    for leaf in leaves:
        hp = f'/home/claude/lp/half/n{leaf:03d}.png'; fp = f'/home/claude/lp/rect/n{leaf:03d}.jpg'
        keep_h, keep_f = f'rot_half/n{leaf:03d}.png', f'rot_full/n{leaf:03d}.jpg'
        if not os.path.exists(keep_h): os.replace(hp, keep_h); os.replace(fp, keep_f)    # rotated-only originals
        half = cv2.imread(keep_h); M = model(half)
        full = cv2.imread(keep_f); F = full.shape[0] / half.shape[0]
        out = apply(full, M, F); cv2.imwrite(fp, out, [cv2.IMWRITE_JPEG_QUALITY, 93])
        cv2.imwrite(hp, cv2.resize(out, (half.shape[1], half.shape[0]), interpolation=cv2.INTER_AREA))
        js[str(PLATE[leaf])] = dict(leaf=leaf, **M); json.dump(js, open('dewarp.json', 'w'))
        print(PLATE[leaf], leaf, flush=True)
