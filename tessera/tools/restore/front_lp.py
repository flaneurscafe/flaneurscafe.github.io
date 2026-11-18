"""Front and back matter of La Plante from the Internet Archive scan (150 dpi): straightened, paper flattened (inside
pages) and fitted to the 1850 x 2556 page of the plates. Covers keep their own colour, only straightened and cleaned."""
import cv2, numpy as np, sys
sys.path.insert(0, '/home/claude/book'); sys.path.insert(0, '/home/claude/lp')
from restore import flatten, despeckle
from skew4 import page_angle
W, H = 1850, 2556
def fit(img, fill):
    k = min(W / img.shape[1], H / img.shape[0]); r = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    out = np.empty((H, W, 3), np.uint8); out[:] = fill; y = (H - r.shape[0]) // 2; x = (W - r.shape[1]) // 2
    out[y:y + r.shape[0], x:x + r.shape[1]] = r; return out
def straighten(img):
    a = page_angle(cv2.resize(img, None, fx=.5, fy=.5)); M = cv2.getRotationMatrix2D((img.shape[1] / 2, img.shape[0] / 2), a, 1)
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE), a
for name, cover in [('001', True), ('003', False), ('005', False), ('007', False), ('008', False), ('009', False)]:
    img = cv2.imread(f'front/ia-{name}.jpg'); img, a = straighten(img)
    if cover:
        out = fit(img, np.median(img.reshape(-1, 3), 0))
    else:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); h, w = g.shape
        img = img[int(.012 * h):int(.988 * h), int(.025 * w):int(.975 * w)]          # trim the scanner's page edge
        img = flatten(img); img, k = despeckle(img)
        inn = img.reshape(-1, 3).astype(np.float32); lum = inn.mean(1); fill = np.median(inn[lum > np.percentile(lum, 60)], 0)
        # anything that is not dark ink -> paper tone (removes residual foxing / stains on the text pages)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB); L = lab[..., 0].astype(np.float32)
        t = np.clip((L - 185) / 30, 0, 1)[..., None]
        red = (np.hypot(lab[..., 1].astype(int) - 128, lab[..., 2].astype(int) - 128) > 18)[..., None]     # keep the red title
        img = np.where(red, img, (img * (1 - t) + fill * t)).astype(np.uint8)
        out = fit(img, fill)
    cv2.imwrite(f'lp_pages/f_{name}.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 95]); print(name, round(a, 2), flush=True)
