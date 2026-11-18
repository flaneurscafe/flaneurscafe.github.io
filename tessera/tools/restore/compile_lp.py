"""La Plante et ses applications ornementales (1896), first series: complete restored edition.
Front matter and plates 1-72 (53 from the Smithsonian copy via Internet Archive, 19 from the BnF copy via Gallica),
each plate straightened (lp/rotate.py), laid out on one page template (frame at the same place on every page),
paper flattened to a neutral warm white, BnF stamps and dust removed. Writes pages/*.jpg; build_pdf.py assembles."""
import cv2, numpy as np, json, os, sys, glob
sys.path.insert(0, '/home/claude/lp'); sys.path.insert(0, '/home/claude/book')
os.chdir('/home/claude/lp')
from seg import PLATE, LEAF, frame_lines
from restore import flatten, remove_stamp, remove_stamp_on_paper, despeckle, TARGET
W, H = 1850, 2556                          # 150 dpi on the 31.3 x 43.3 cm page
FW = int(0.7592 * W); FX = (W - FW) // 2; FY = int(0.0935 * H)
S_ALL = 0.3677                             # median of FW / frame width over the 72 plates
OUT = '/home/claude/book/lp_pages'; os.makedirs(OUT, exist_ok=True)
GAL = {5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63, 64, 65, 66, 67, 68, 70, 71, 72}
def clean_margins(img, box):
    """Outside the frame keep only the printed lettering (plate number, captions, signature): everything else -> paper."""
    x0, y0, x1, y1 = box; g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ink = ((cv2.medianBlur(g, 31).astype(int) - g) > 28).astype(np.uint8)
    n, lb, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(ink, np.ones((9, 9), np.uint8)), 8)
    keep = np.zeros_like(ink)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32); chroma = np.hypot(lab[..., 1] - 128, lab[..., 2] - 128)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        above = y + h < y0 and x > x1 - 0.16 * W and y > y0 - 0.06 * H          # plate number, top right
        below = y > y1 and y + h < y1 + 0.075 * H                                # captions under the frame
        if not ((above or below or (y < y1 and y + h > y0)) and x > x0 - 40 and x + w < x1 + 40 and a > 60): continue
        keep[(lb == i) & (chroma < 16)] = 1          # printed lettering is grey-black ink: stains are coloured
    keep = cv2.dilate(keep & ink, np.ones((5, 5), np.uint8))
    # the BnF ownership stamp (red ink under the frame) is kept as in the copy
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); band = np.zeros_like(ink); band[y1:min(H, y1 + int(.06 * H)), int(.3 * W):int(.7 * W)] = 1
    red = (((hsv[..., 0] < 14) | (hsv[..., 0] > 150)) & (hsv[..., 1] > 22)).astype(np.uint8) & band
    if red.sum() > 150: keep |= cv2.dilate(red, np.ones((9, 9), np.uint8))
    inside = np.zeros_like(ink); cv2.rectangle(inside, (x0 - 14, y0 - 14), (x1 + 14, y1 + 14), 1, -1)
    soft = cv2.GaussianBlur((keep | inside).astype(np.float32), (0, 0), 1.5)[..., None]
    pix = img.reshape(-1, 3).astype(np.float32); lb_ = lab.reshape(-1, 3)
    sel = (lb_[:, 0] > 215) & (np.hypot(lb_[:, 1] - 128, lb_[:, 2] - 128) < 8)   # bare paper only (bright, neutral)
    fill = np.median(pix[sel], 0) if sel.sum() > 1000 else TARGET            # the restored paper tone
    return (img * soft + fill[None, None, :] * (1 - soft)).astype(np.uint8)
def plate_page(pl):
    leaf = LEAF[pl]; full = cv2.imread('rect/n%03d.jpg' % leaf); half = cv2.imread('half/n%03d.png' % leaf)
    F = full.shape[0] / half.shape[0]; x0, y0, x1, y1 = [v * F for v in frame_lines(half)]
    # one scale for every plate (the printed frames differ in size from plate to plate: scaling each frame to the same
    # width enlarged the narrow ones and pushed their captions off the page); frame centred, top edge at FY
    s = S_ALL; fx = (W - s * (x1 - x0)) / 2; M = np.float32([[s, 0, fx - s * x0], [0, s, FY - s * y0]])
    small = cv2.resize(full, None, fx=s * 1.5, fy=s * 1.5, interpolation=cv2.INTER_AREA)  # pre-shrink, then exact warp
    M2 = np.float32([[1 / 1.5, 0, M[0, 2]], [0, 1 / 1.5, M[1, 2]]])
    page = cv2.warpAffine(small, M2, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    box = (int(fx), FY, int(fx + s * (x1 - x0)), int(FY + s * (y1 - y0)))
    page = flatten(page)
    nst = 0
    if pl in GAL:
        # BnF stamps sit just under the frame (removed with the margins) except on plate 46, where it lies on the print
        pass                                         # BnF ownership stamps are kept, as in the copy
    page, nsp = despeckle(page)
    page = clean_margins(page, box)
    cv2.imwrite(f'{OUT}/p_plate{pl:02d}.jpg', page, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return dict(plate=pl, scale=round(s, 4), stamp_px=nst, specks=nsp)
if __name__ == '__main__':
    pls = [int(x) for x in sys.argv[1].split(',')]
    log = [plate_page(p) for p in pls]
    for l in log: print(l, flush=True)
