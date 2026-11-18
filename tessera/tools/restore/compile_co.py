"""Combinaisons ornementales (c. 1901): restored edition. Cover, French preface: NYPL copy of the original edition
(760 px, upscaled); title and plates 3-60: Internet Archive high-resolution scan. Straightened, paper flattened,
stains and specks removed, every page fitted to one landscape page."""
import cv2, numpy as np, sys, glob, os
sys.path.insert(0, '/home/claude/book'); sys.path.insert(0, '/home/claude/lp')
from restore import flatten, despeckle
from skew4 import page_angle
W, H = 2400, 2076
os.makedirs('pages', exist_ok=True)
IA = sorted(glob.glob('ia/*')); NY = sorted(glob.glob('ny/*'))
def straighten(img):
    k = 1000 / img.shape[1]; a = page_angle(cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA), -1.5, 1.5)
    M = cv2.getRotationMatrix2D((img.shape[1] / 2, img.shape[0] / 2), a, 1)
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE), a
def paper_tone(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    sel = (lab[:, 0] > np.percentile(lab[:, 0], 70)) & (np.hypot(lab[:, 1] - 128, lab[:, 2] - 128) < 10)
    return np.median(img.reshape(-1, 3)[sel], 0) if sel.sum() > 500 else np.array([236, 242, 245], np.float32)
def fit(img, fill, margin=0.03):
    k = min(W * (1 - 2 * margin) / img.shape[1], H * (1 - 2 * margin) / img.shape[0])
    r = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LANCZOS4)
    out = np.empty((H, W, 3), np.uint8); out[:] = fill; y, x = (H - r.shape[0]) // 2, (W - r.shape[1]) // 2
    out[y:y + r.shape[0], x:x + r.shape[1]] = r; return out
def trim_scan_edge(img):
    """Cut the scanner background / page edge: keep the largest bright region (the paper)."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); t = np.percentile(g, 60) - 35
    m = (cv2.GaussianBlur(g, (0, 0), 3) > t).astype(np.uint8)
    rows = np.nonzero(m.mean(1) > 0.6)[0]; cols = np.nonzero(m.mean(0) > 0.6)[0]
    if len(rows) < 10 or len(cols) < 10: return img
    y0, y1, x0, x1 = rows[0], rows[-1], cols[0], cols[-1]; p = int(0.012 * img.shape[1])
    return img[y0 + p:y1 - p, x0 + p:x1 - p]
def clean_outside_print(img, pad=0.012):
    """Outside the printed area (the box round all ink: frame, plate number, signature) the scan shows only paper, and
    near the edges the shadow of the page lifting off the scanner. Replace that margin with the page's paper tone."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32); tone = paper_tone(img)
    t = cv2.cvtColor(np.uint8([[tone]]), cv2.COLOR_BGR2LAB)[0, 0].astype(np.float32)
    ink = (np.linalg.norm(lab - t, axis=2) > 28).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lb, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(ink, np.ones((7, 7), np.uint8)), 8)
    H, W = ink.shape; keep = [i for i in range(1, n) if st[i, 4] > 4e-5 * H * W]
    if not keep: return img
    x0 = min(st[i, 0] for i in keep); y0 = min(st[i, 1] for i in keep)
    x1 = max(st[i, 0] + st[i, 2] for i in keep); y1 = max(st[i, 1] + st[i, 3] for i in keep)
    p = int(pad * W); x0, y0, x1, y1 = max(0, x0 - p), max(0, y0 - p), min(W, x1 + p), min(H, y1 + p)
    ring = np.zeros((H, W), bool); ring[y0:y1, x0:x1] = True; q = 3 * p; ring[y0 + q:y1 - q, x0 + q:x1 - q] = False
    near = ring & (np.linalg.norm(lab - t, axis=2) < 14) & (ink == 0)
    if near.sum() > 500: tone = np.median(img[near].astype(np.float32), 0)     # the paper right next to the print
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1; m = cv2.GaussianBlur(m, (0, 0), p / 3 + 1)[..., None]
    return (img * m + tone[None, None, :] * (1 - m)).astype(np.uint8)
def page(src, name, cover=False, up=1.0):
    img = cv2.imread(src)
    if up != 1: img = cv2.resize(img, None, fx=up, fy=up, interpolation=cv2.INTER_LANCZOS4)
    img, a = straighten(img)
    if not cover:
        img = trim_scan_edge(img); img = flatten(img); img, k = despeckle(img)
        img = clean_outside_print(img)
    # the cover is kept as scanned (only straightened): its stains defeat an automatic clean-up
    out = fit(img, img[2, 2].astype(np.float32) if not cover else np.median(img.reshape(-1, 3), 0), 0.0 if cover else 0.025)
    cv2.imwrite(f'pages/{name}.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 95]); return f'{name} {a:+.2f}'
if __name__ == '__main__':
    which = sys.argv[1]
    if which == 'front':
        print(page(NY[0], 'a_cover', cover=True, up=3.0)); print(page(IA[0], 'b_title'))
        print(page(NY[2], 'c_preface1', up=3.0)); print(page(NY[3], 'c_preface2', up=3.0))
    else:
        for i in [int(x) for x in which.split(',')]:      # plate numbers 3..60 = IA index i-1
            print(page(IA[i - 1], f'p_{i:02d}'), flush=True)
