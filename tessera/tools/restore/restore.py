"""Digital restoration of a scanned page (BGR uint8):
1. paper field: a smooth estimate of the paper colour under the print (bright, low-chroma pixels, filled by normalised
   convolution) -> divide it out and multiply by a neutral warm-white target: removes yellowing, foxing haze, gutter
   shadow and uneven lighting, and white-balances the inks with the paper;
2. BnF ownership stamps (red ink circles) removed by inpainting (only where asked: Gallica pages);
3. dust and small foxing specks on bare paper removed by inpainting: small, isolated dark blobs (letters and dots of
   the print always have neighbours or sit on colour, so they are kept)."""
import cv2, numpy as np
TARGET = np.array([236, 242, 245], np.float32)       # BGR: a warm off-white, not pure white
def paper_field(img, k=8):
    s = cv2.resize(img, (img.shape[1] // k, img.shape[0] // k), interpolation=cv2.INTER_AREA).astype(np.float32)
    lab = cv2.cvtColor(s.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
    Lr = np.percentile(L, 85); top = L > Lr - 10
    ch = np.hypot(a - np.median(a[top]), b - np.median(b[top]))
    m = cv2.erode(((L > Lr - 22) & (ch < 9)).astype(np.float32), np.ones((3, 3), np.uint8))
    f = None
    for sig in (12, 40, 140):                       # fine where paper is near, coarser across printed panels
        den = cv2.GaussianBlur(m, (0, 0), sig)
        est = cv2.GaussianBlur(s * m[..., None], (0, 0), sig) / np.maximum(den, 1e-6)[..., None]
        ok = den > 0.03
        f = np.where(ok[..., None], est, 0) if f is None else np.where((f == 0).all(-1, keepdims=True) & ok[..., None], est, f)
    miss = (f == 0).all(-1); f[miss] = np.median(s[m > 0], 0)
    f = cv2.GaussianBlur(f, (0, 0), 3)
    return cv2.resize(f, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC), m
def flatten(img):
    f, m = paper_field(img)
    out = img.astype(np.float32) * (TARGET / np.maximum(f, 40))
    return np.clip(out, 0, 255).astype(np.uint8)
def remove_stamp(img, region=None):
    """Red ink of a library stamp: saturated red/pink, in a given region (x0,y0,x1,y1); inpaint it."""
    x0, y0, x1, y1 = region if region else (0, 0, img.shape[1], img.shape[0])
    roi = img[y0:y1, x0:x1]; hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    red = (((hsv[..., 0] < 12) | (hsv[..., 0] > 155)) & (hsv[..., 1] > 30) & (hsv[..., 2] > 80)).astype(np.uint8)
    # a stamp is a ring of thin strokes: keep red components inside the densest red disc
    if red.sum() < 50: return img, 0
    d = cv2.GaussianBlur(red.astype(np.float32), (0, 0), 25); cy, cx = np.unravel_index(d.argmax(), d.shape)
    R = int(0.0105 * img.shape[1]) + 10                                # stamp radius ~ 1 % of page width
    disc = np.zeros_like(red); cv2.circle(disc, (cx, cy), R, 1, -1)
    m = cv2.dilate(red & disc, np.ones((9, 9), np.uint8))
    roi[:] = cv2.inpaint(roi, m, 5, cv2.INPAINT_TELEA); return img, int(m.sum())
def despeckle(img, max_area_frac=2.5e-6, iso_frac=0.006):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H, W = g.shape
    s = 4; gs = cv2.resize(g, (W // s, H // s), interpolation=cv2.INTER_AREA)
    bg = cv2.medianBlur(gs, 21); dark = ((bg.astype(int) - gs) > 22).astype(np.uint8)
    lab = cv2.cvtColor(cv2.resize(img, (W // s, H // s), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB)
    paper = (np.hypot(lab[..., 1].astype(int) - 128, lab[..., 2].astype(int) - 128) < 12) & (bg > 200)
    n, lb, st, cen = cv2.connectedComponentsWithStats(dark, 8)
    amax = max_area_frac * W * H / s / s; R = iso_frac * W / s
    small = [i for i in range(1, n) if st[i, 4] <= amax]
    big = np.array([cen[i] for i in range(1, n) if st[i, 4] > 0])
    from scipy.spatial import cKDTree
    tree = cKDTree(big) if len(big) else None
    mask = np.zeros((H, W), np.uint8); k = 0
    for i in small:
        x, y, w, h, a = st[i]
        ring = paper[max(0, y - 3):y + h + 3, max(0, x - 3):x + w + 3]
        if ring.mean() < 0.9: continue                                   # not on bare paper
        if len(tree.query_ball_point(cen[i], R)) > 1: continue           # has neighbours: part of the print
        cv2.rectangle(mask, ((x - 1) * s, (y - 1) * s), ((x + w + 1) * s, (y + h + 1) * s), 1, -1); k += 1
    if k:
        m2 = mask & (cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) < cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 31) - 12).astype(np.uint8)
        m2 = cv2.dilate(m2, np.ones((5, 5), np.uint8))
        ys, xs = np.nonzero(m2)
        if len(ys):
            img = cv2.inpaint(img, m2, 4, cv2.INPAINT_TELEA)
    return img, k
def remove_stamp_on_paper(img, region, R):
    """Find a red library stamp (ring of thin red strokes, radius ~R) in region, only where the surroundings are mostly
    bare paper (so red print is never touched), and inpaint its strokes."""
    x0, y0, x1, y1 = [int(v) for v in region]; roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV); lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)
    red = (((hsv[..., 0] < 14) | (hsv[..., 0] > 150)) & (hsv[..., 1] > 22) & (hsv[..., 2] > 120)).astype(np.float32)
    paper = ((lab[..., 0] > 200) & (np.hypot(lab[..., 1] - 128, lab[..., 2] - 128) < 10)).astype(np.float32)
    dens = cv2.GaussianBlur(red, (0, 0), R * 0.6); pap = cv2.GaussianBlur(paper, (0, 0), R * 1.2)
    score = dens * (pap > 0.55)
    if score.max() < 0.02: return img, 0
    cy, cx = np.unravel_index(score.argmax(), score.shape)
    disc = np.zeros(red.shape, np.uint8); cv2.circle(disc, (cx, cy), int(R * 1.35), 1, -1)
    m = cv2.dilate((red > 0).astype(np.uint8) & disc, np.ones((7, 7), np.uint8))
    roi[:] = cv2.inpaint(roi, m, 6, cv2.INPAINT_TELEA); return img, int(m.sum())
