"""Port of Tessera's symmetryOf() (js/sheet.js): point group of an ornament measured on its pixels."""
import cv2, numpy as np, json, sys
SYM_T, SYM_CLEAR = 0.38, 0.5
def symmetry(rgba):
    M = 120; h0, w0 = rgba.shape[:2]; k = min(1, M / max(w0, h0)); w, h = max(4, round(w0 * k)), max(4, round(h0 * k))
    im = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32)
    a = im[..., 3] / 255.; A = (255 - im[..., :3]) * a[..., None]
    tot = A.sum()
    if tot < 1: return dict(label='C1')
    yy, xx = np.mgrid[0:h, 0:w]; s = A.sum(-1); cx = (s * xx).sum() / tot; cy = (s * yy).sum() / tot
    u, v = xx - cx, yy - cy
    def over(a_, b_, c_, d_):
        sx = np.round(cx + a_ * u + b_ * v).astype(int); sy = np.round(cy + c_ * u + d_ * v).astype(int)
        ok = (sx >= 0) & (sy >= 0) & (sx < w) & (sy < h)
        return np.minimum(A[ok], A[sy[ok], sx[ok]]).sum() / tot
    rot_ = lambda t: over(np.cos(t), -np.sin(t), np.sin(t), np.cos(t))
    offs = sorted(rot_(np.radians(t)) for t in [17, 33, 79, 139, 163, 199, 241, 283]); base = offs[len(offs) // 2]
    norm = lambda x: (x - base) / max(1e-6, 1 - base)
    rot = {r: norm(rot_(2 * np.pi / r)) for r in [2, 3, 4, 5, 6, 8]}; nmax = 1
    for r in [8, 6, 5, 4, 3, 2]:
        if rot[r] >= SYM_T and (r % 2 or rot[2] >= SYM_T * 0.8): nmax = r; break
    mir = [norm(over(np.cos(2 * np.radians(t)), np.sin(2 * np.radians(t)), np.sin(2 * np.radians(t)), -np.cos(2 * np.radians(t)))) for t in range(180)]
    axes = []
    for t in range(180):
        vv = mir[t]
        if vv >= SYM_T and vv >= mir[(t + 179) % 180] and vv >= mir[(t + 1) % 180] and not any(min(abs(a2 - t), 180 - abs(a2 - t)) < 12 for a2 in axes): axes.append(t)
    axes.sort(key=lambda t: -mir[t]); m = len(axes)
    if m >= 2: label = 'D%d' % max(m, nmax)
    elif m == 1: label = 'D%d' % nmax if nmax >= 2 else 'D1'
    else: label = 'C%d' % nmax
    score = max(rot[nmax] if nmax > 1 else 0, mir[axes[0]] if axes else 0)
    sp = [round(cx / w, 4), round(cy / h, 4), axes[0] if axes else None]
    return dict(label=label, sp=sp, approx=label != 'C1' and score < SYM_CLEAR, score=score)
if __name__ == '__main__':
    m = json.load(open('out/plants_manifest.json'))
    for e in m:
        r = symmetry(cv2.imread(f"out/plants/{e['id']}.webp", cv2.IMREAD_UNCHANGED))
        e['sym'] = '' if r['label'] == 'C1' else ('≈' if r['approx'] else '') + r['label']; e['sp'] = r.get('sp') if e['sym'] else None
    json.dump(m, open('out/plants_manifest.json', 'w'))
    from collections import Counter; print(Counter(e['sym'] for e in m))
    print([ (e['id'],e['sym']) for e in m if e['sym'] and not e['sym'].startswith('≈')][:40])
