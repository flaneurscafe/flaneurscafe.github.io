"""Rotation-only deskew: the page angle comes from skew4.page_angle (projection profiles of all strong
horizontal and vertical edges on the original half page); the full-size page is rotated about its centre. Writes rect/nNNN.jpg, half/nNNN.png and
rot.json {plate: {leaf, angle, M (3x3, original half px -> straightened half px)}}."""
import cv2, numpy as np, json, os, sys
from seg import PLATE
from skew4 import page_angle
from seg import src_orig
def rot_matrix(W, H, ang):
    M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1.0); return np.vstack([M, [0, 0, 1]])
if __name__ == '__main__':
    leaves = [int(x) for x in sys.argv[1].split(',')]; out = {}
    for leaf in leaves:
        ho = cv2.imread('half_orig/n%03d.png' % leaf); ang = page_angle(ho)
        # measure() angle > 0 means content rotated clockwise; cv2 positive angle rotates counter-clockwise
        Hh, Wh = ho.shape[:2]; Mh = rot_matrix(Wh, Hh, ang)
        full = cv2.imread(src_orig(leaf)); H, W = full.shape[:2]; Mf = rot_matrix(W, H, ang)
        r = cv2.warpAffine(full, Mf[:2], (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        cv2.imwrite('rect/n%03d.jpg' % leaf, r, [cv2.IMWRITE_JPEG_QUALITY, 93])
        cv2.imwrite('half/n%03d.png' % leaf, cv2.resize(r, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
        out[PLATE[leaf]] = dict(leaf=leaf, angle=ang, M=Mh.tolist())
        print(PLATE[leaf], leaf, f'{ang:+.2f}', flush=True)
    json.dump(out, open(f'rot_{sys.argv[2]}.json', 'w'))
