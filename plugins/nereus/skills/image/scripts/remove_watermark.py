#!/usr/bin/env python3
"""Remove Gemini's four-point sparkle from the bottom-right of a generated image.

Detection is by SHAPE, not a fixed offset: the inset differs by aspect ratio
(measured 136/117 on a 1024 square, 108/140 on a 1488x720 banner), so hardcoded
coordinates silently miss or gouge the artwork.

Note: this removes the visible mark only. Google also embeds SynthID, an
invisible watermark that survives editing.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def star_template(size: int) -> np.ndarray:
    """A four-point sparkle: |x|^p + |y|^p = 1 with p < 1 gives concave sides."""
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx - (size - 1) / 2) / ((size - 1) / 2)
    v = (yy - (size - 1) / 2) / ((size - 1) / 2)
    p = 0.55
    d = np.abs(u) ** p + np.abs(v) ** p
    return (d <= 1.0).astype(np.uint8) * 255


def find_sparkle(img: np.ndarray) -> tuple[int, int, int] | None:
    h, w = img.shape[:2]
    # Measured mark centres sit at 0.85-0.90w, 0.79-0.85h. A wider window lets a
    # bright phone edge win the match instead.
    y0, x0 = int(h * 0.74), int(w * 0.80)
    roi = cv2.cvtColor(img[y0:, x0:], cv2.COLOR_BGR2GRAY).astype(np.float32)

    # The mark is a soft light overlay: it reads as a local brightness bump
    # regardless of whether it sits on flat colour or on artwork.
    bg = cv2.GaussianBlur(roi, (0, 0), max(h, w) * 0.02)
    bump = cv2.normalize(roi - bg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    best = None
    for size in range(int(min(h, w) * 0.035), int(min(h, w) * 0.085), 2):
        tpl = star_template(size).astype(np.float32)
        tpl = cv2.normalize(tpl, None, 0, 255, cv2.NORM_MINMAX)
        if tpl.shape[0] >= bump.shape[0] or tpl.shape[1] >= bump.shape[1]:
            break
        res = cv2.matchTemplate(bump.astype(np.float32), tpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        if best is None or score > best[0]:
            best = (score, loc[0] + x0, loc[1] + y0, size)
    if not best or best[0] < 0.25:
        return None
    return best[1], best[2], best[3]


def main() -> int:
    ap = argparse.ArgumentParser(description="Erase the Gemini sparkle watermark")
    ap.add_argument("src")
    ap.add_argument("--out", default="")
    ap.add_argument("--pad", type=float, default=0.55, help="mask padding, fraction of mark size")
    ap.add_argument("--box", default="", help="x0,y0,x1,y1 — skip detection when it misses")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    img = cv2.imread(a.src)
    if img is None:
        sys.exit(f"cannot read {a.src}")
    if a.box:
        x0, y0, x1, y1 = (int(v) for v in a.box.split(","))
    else:
        hit = find_sparkle(img)
        if not hit:
            sys.exit("no sparkle found — check the image, do not assume it is clean")
        x, y, s = hit
        pad = int(s * a.pad)
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(img.shape[1], x + s + pad), min(img.shape[0], y + s + pad)
    print(f"mask ({x0},{y0})-({x1},{y1})" + ("" if a.box else " [detected]"))
    if a.dry_run:
        box = img.copy()
        cv2.rectangle(box, (x0, y0), (x1, y1), (0, 0, 255), 3)
        out = a.out or str(Path(a.src).with_name(Path(a.src).stem + "_wmbox.png"))
        cv2.imwrite(out, box)
        print("wrote", out)
        return 0

    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.ellipse(mask, ((x0 + x1) // 2, (y0 + y1) // 2),
                ((x1 - x0) // 2, (y1 - y0) // 2), 0, 0, 360, 255, -1)
    fixed = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
    # Feather the seam so the patch does not read as a smudge on flat gradients.
    soft = cv2.GaussianBlur(mask, (0, 0), max(3, (x1 - x0) * 0.08))[..., None] / 255.0
    fixed = (fixed * soft + cv2.inpaint(img, mask, 3, cv2.INPAINT_NS) * (1 - soft)).astype(np.uint8)
    out = a.out or str(Path(a.src).with_name(Path(a.src).stem + "_clean.png"))
    cv2.imwrite(out, fixed)
    print("wrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
