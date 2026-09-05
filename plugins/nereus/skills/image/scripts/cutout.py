"""배경 제거. Gemini는 알파 채널을 내지 못하므로 생성 후 로컬에서 투명 PNG를 만든다.

- rembg : U²-Net 세그멘테이션. 머리카락·부드러운 가장자리에 강함. 첫 실행 시 u2net 모델(~170MB) 다운로드.
  onnxruntime이 macOS에서 인터프리터 종료 시 mutex 오류를 낼 수 있다. 파일은 그 전에 저장되므로 무해하다.
- chroma: 단색 배경 크로마키(OpenCV). 의존성 추가 없음. 단순 도형·로고에 적합.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BG_PROMPT = (
    " Render the single subject isolated and centered on a flat, uniform, pure {color} background "
    "(#{hex}), with no shadow, no reflection, no gradient, no texture, and crisp clean edges. "
    "The subject must not touch the image borders."
)
BACKGROUNDS = {"white": ("white", "FFFFFF", (255, 255, 255)), "magenta": ("magenta", "FF00FF", (255, 0, 255)), "green": ("green", "00FF00", (0, 255, 0))}


def background_prompt(bg: str) -> str:
    color, hx, _ = BACKGROUNDS[bg]
    return BG_PROMPT.format(color=color, hex=hx)


def _ensure(pkgs: list[str]) -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", *pkgs], check=True)


def chroma_cut(src: Path, dst: Path, bg: str = "white", tolerance: int = 40, feather: int = 2) -> Path:
    try:
        import cv2, numpy as np
    except ImportError:
        _ensure(["opencv-python-headless", "numpy"])
        import cv2, numpy as np
    img = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"cannot read {src}")
    b, g, r = BACKGROUNDS[bg][2][2], BACKGROUNDS[bg][2][1], BACKGROUNDS[bg][2][0]
    dist = np.linalg.norm(img.astype(np.int32) - np.array([b, g, r], dtype=np.int32), axis=2)
    # tolerance 이내는 완전 투명, 2*tolerance 이상은 완전 불투명, 사이는 선형 → 가장자리 부드럽게
    alpha = np.clip((dist - tolerance) / max(tolerance, 1), 0, 1)
    if feather > 0:
        alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), feather)
    # 배경색이 반투명 가장자리에 번지는 것을 줄인다(색 번짐 제거)
    a3 = alpha[..., None]
    fg = np.clip((img.astype(np.float32) - (1 - a3) * np.array([b, g, r], dtype=np.float32)) / np.maximum(a3, 1e-3), 0, 255)
    out = np.dstack([np.where(a3 > 0, fg, 0).astype(np.uint8), (alpha * 255).astype(np.uint8)])
    cv2.imwrite(str(dst), out)
    return dst


REMBG_MODEL = "u2net"  # ~170MB. 기본값(birefnet, ~1GB)보다 가볍고 아이콘·제품 컷에 충분하다.


def rembg_cut(src: Path, dst: Path, model: str = REMBG_MODEL) -> Path:
    try:
        from rembg import new_session, remove
    except ImportError:
        print(f"[cutout] installing rembg (first run downloads the {model} model, ~170MB)", file=sys.stderr)
        _ensure(["rembg[cpu]", "onnxruntime"])
        from rembg import new_session, remove
    dst.write_bytes(remove(src.read_bytes(), session=new_session(model)))
    return dst


def cut(src: Path, method: str = "chroma", bg: str = "white") -> Path:
    dst = src.with_name(src.stem + "_alpha.png")
    return rembg_cut(src, dst) if method == "rembg" else chroma_cut(src, dst, bg=bg)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="배경 제거 → *_alpha.png")
    p.add_argument("src")
    p.add_argument("--method", choices=["chroma", "rembg"], default="chroma")
    p.add_argument("--bg", choices=list(BACKGROUNDS), default="white", help="chroma일 때 배경색")
    a = p.parse_args()
    print(cut(Path(a.src), a.method, a.bg))
