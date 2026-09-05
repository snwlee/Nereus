#!/usr/bin/env python3
"""Gemini web-session CLI — free text/image generation via a logged-in account.

Self-bootstrapping: creates its own venv on first run. Never installs
browser_cookie3 — it blocks init() on a macOS Keychain prompt (see SKILL.md).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

def _nereus_home() -> Path:
    if os.environ.get("NEREUS_HOME"):
        return Path(os.environ["NEREUS_HOME"])
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData/Roaming")) / "nereus"
    return Path.home() / ".config" / "nereus"

SECRETS = _nereus_home() / "secrets"
VENV = Path(os.environ.get("GEMINI_WEB_VENV", _nereus_home() / "cache" / "gemini-venv"))
COOKIES = Path(os.environ.get("GEMINI_WEB_COOKIES", SECRETS / "gemini-web-cookies.json"))
CACHE = Path(os.environ.get("GEMINI_COOKIE_PATH", SECRETS / "gemini-web-cache"))
IS_WIN = sys.platform == "win32"


def bootstrap() -> None:
    """Re-exec inside a venv that has gemini_webapi and NOT browser_cookie3."""
    py = VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")
    if not py.is_file():
        print(f"[setup] creating venv at {VENV}", file=sys.stderr)
        VENV.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
        subprocess.run([str(py), "-m", "pip", "install", "-q", "-U", "gemini_webapi", "google-genai"], check=True)
    # browser_cookie3 blocks init() on a macOS Keychain prompt — keep it out.
    subprocess.run([str(py), "-m", "pip", "uninstall", "-y", "-q", "browser_cookie3"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.execv(str(py), [str(py), os.path.abspath(__file__), *sys.argv[1:]])


def load_cookies() -> tuple[str, str]:
    if not COOKIES.is_file():
        sys.exit(f"cookie file missing: {COOKIES}")
    d = json.loads(COOKIES.read_text("utf-8"))
    psid, psidts = d.get("__Secure-1PSID", ""), d.get("__Secure-1PSIDTS", "")
    if not psid:
        sys.exit("__Secure-1PSID missing from cookie file")
    return psid, psidts


def check_session(psid: str, psidts: str) -> bool:
    """Cheap independent probe: is the session alive at all?

    Run this before blaming the library — it separates dead cookies from a
    client-side hang.
    """
    import urllib.request
    cookie = f"__Secure-1PSID={psid}; __Secure-1PSIDTS={psidts}"
    req = urllib.request.Request("https://gemini.google.com/app", headers={
        "Cookie": cookie,
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) " if IS_WIN else "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ")
                      + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36",
    })
    try:
        body = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except Exception:
        return False
    return "SNlM0e" in body


def choose_backend(requested: str) -> str:
    """auto: darwin이면 web(Chrome 쿠키 자동), 그 외는 GEMINI_API_KEY 있으면 api, 없으면 쿠키 파일이 있을 때만 web."""
    if requested in ("web", "api"):
        return requested
    if sys.platform == "darwin":
        return "web"
    if os.environ.get("GEMINI_API_KEY"):
        return "api"
    if COOKIES.is_file():
        return "web"
    print("[backend] Windows/Linux에서는 Chrome 쿠키를 자동으로 읽을 수 없습니다 (App-Bound Encryption).\n"
          "  1) GEMINI_API_KEY 를 설정하면 API 백엔드를 씁니다 (소액 과금)\n"
          f"  2) 또는 브라우저 개발자도구에서 __Secure-1PSID, __Secure-1PSIDTS 값을 복사해\n     {COOKIES} 에 {{\"__Secure-1PSID\": \"...\", \"__Secure-1PSIDTS\": \"...\"}} 형식으로 저장하세요",
          file=sys.stderr)
    sys.exit(2)


async def run_api(args) -> int:
    """google-genai API 백엔드. 텍스트는 gemini-2.5-flash, 이미지는 gemini-2.5-flash-image."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    prompt = Path(args.prompt_file).read_text("utf-8") if args.prompt_file else args.prompt
    parts = [prompt]
    for f in args.file:
        data = Path(f).read_bytes()
        mime = "image/png" if f.lower().endswith(".png") else "image/jpeg"
        parts.append(types.Part.from_bytes(data=data, mime_type=mime))
    if args.cmd == "models":
        for m in client.models.list():
            print(m.name)
        return 0
    if args.cmd == "ask":
        r = client.models.generate_content(model=args.model or "gemini-2.5-flash", contents=parts)
        print(r.text)
        return 0
    out = Path(args.out or ".").resolve(); out.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, args.retries + 1):
        r = client.models.generate_content(model=args.model or "gemini-2.5-flash-image", contents=parts,
                                           config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]))
        imgs = [p for c in (r.candidates or []) for p in (c.content.parts or []) if getattr(p, "inline_data", None)]
        if not imgs:
            print(f"[attempt {attempt}] no images returned", file=sys.stderr); continue
        for i, part in enumerate(imgs):
            fn = f"{args.name}_{i}.png" if len(imgs) > 1 else f"{args.name}.png"
            (out / fn).write_bytes(part.inline_data.data)
            print(json.dumps({"saved": str(out / fn), "type": "ApiImage"}), flush=True)
        return 0
    return 1


async def run(args) -> int:
    if choose_backend(args.backend) == "api":
        if not os.environ.get("GEMINI_API_KEY"):
            sys.exit("GEMINI_API_KEY 가 없습니다.")
        return await run_api(args)
    from gemini_webapi import GeminiClient

    psid, psidts = load_cookies()
    if not check_session(psid, psidts):
        # Copied cookies die within ~20 min because Chrome rotates 1PSIDTS.
        # Re-read the live profile instead of asking the user again.
        helper = Path(__file__).with_name("chrome_cookies.py")
        if helper.is_file():
            print("[auth] session stale; re-reading Chrome profile", file=sys.stderr)
            subprocess.run([sys.executable, str(helper)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            psid, psidts = load_cookies()
        if not check_session(psid, psidts):
            print("SESSION DEAD — log in to gemini.google.com in Chrome, or approve the "
                  "Keychain prompt once (see SKILL.md). 다른 플랫폼은 --backend api 를 쓰세요.", file=sys.stderr)
            return 2

    CACHE.mkdir(parents=True, exist_ok=True)
    os.environ["GEMINI_COOKIE_PATH"] = str(CACHE)

    client = GeminiClient(psid, psidts)
    await client.init(timeout=90, auto_close=False, auto_refresh=True)

    if args.cmd == "models":
        for m in client.list_models():
            print(getattr(m, "name", m))
        print("--- quotas ---")
        for name, q in (client.quotas or {}).items():
            print(f"{name}: {q}")
        return 0

    prompt = Path(args.prompt_file).read_text("utf-8") if args.prompt_file else args.prompt
    if not prompt:
        sys.exit("need --prompt or --prompt-file")

    out = Path(args.out or ".")
    out.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []

    for attempt in range(1, args.retries + 1):
        kw = {"files": args.file} if args.file else {}
        if args.model:
            kw["model"] = args.model
        r = await client.generate_content(prompt, **kw)

        if args.cmd == "ask":
            print(r.text)
            return 0

        if not r.images:
            # The public-figure safety filter fires intermittently on the SAME
            # prompt+files; retrying is the documented cure, not rewording.
            print(f"[attempt {attempt}] no images returned; text={r.text[:120]!r}", file=sys.stderr)
            continue
        for i, im in enumerate(r.images):
            kind = type(im).__name__          # GeneratedImage vs WebImage
            fn = f"{args.name}_{i}.png" if len(r.images) > 1 else f"{args.name}.png"
            await im.save(path=str(out) + os.sep, filename=fn, verbose=False)
            saved.append(str(out / fn))
            print(json.dumps({"saved": str(out / fn), "type": kind}), flush=True)
        break

    if args.cmd == "image" and not saved:
        print("FAILED: no image after retries", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Gemini web-session CLI (free, no API key)")
    p.add_argument("cmd", choices=["ask", "image", "models"])
    p.add_argument("--prompt", default="")
    p.add_argument("--prompt-file", default="")
    p.add_argument("--file", action="append", default=[], help="attachment path; repeatable")
    p.add_argument("--out", default="", help="output directory (image)")
    p.add_argument("--name", default="out", help="output basename (image)")
    p.add_argument("--model", default="", help="e.g. gemini-pro; omit for account default")
    p.add_argument("--retries", type=int, default=5)
    p.add_argument("--backend", choices=["auto", "web", "api"], default=os.environ.get("NEREUS_IMAGE_BACKEND", "auto"))
    args = p.parse_args()

    import asyncio
    return asyncio.run(run(args))


if __name__ == "__main__":
    try:
        import gemini_webapi  # noqa: F401
    except ImportError:
        bootstrap()
    raise SystemExit(main())
