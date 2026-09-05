#!/usr/bin/env python3
"""Read Gemini session cookies straight from Chrome, decrypting with the Keychain key.

Why this exists: cookies copied by hand die within ~20 minutes because Chrome
rotates __Secure-1PSIDTS on its own. Reading the live profile each time removes
the expiry problem entirely.

Requires a ONE-TIME approval:
    security find-generic-password -w -s "Chrome Safe Storage"
and clicking "Always Allow". After that this runs unattended.
"""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

if sys.platform != "darwin":
    sys.exit("chrome_cookies.py는 macOS 전용입니다 (Keychain + Chrome Safe Storage). "
             "Windows/Linux는 gemini_cli.py --backend api 또는 쿠키 수동 저장을 사용하세요.")

CHROME = Path.home() / "Library/Application Support/Google/Chrome"
_home = Path(os.environ["NEREUS_HOME"]) if os.environ.get("NEREUS_HOME") else Path.home() / ".config" / "nereus"
OUT = Path(os.environ.get("GEMINI_WEB_COOKIES", _home / "secrets" / "gemini-web-cookies.json"))
WANTED = ("__Secure-1PSID", "__Secure-1PSIDTS")


def safe_storage_key() -> bytes:
    out = subprocess.run(
        ["security", "find-generic-password", "-w", "-s", "Chrome Safe Storage"],
        capture_output=True, text=True, timeout=20,
    )
    if out.returncode != 0 or not out.stdout.strip():
        sys.exit("Keychain denied. Run once interactively and click Always Allow:\n"
                 '  security find-generic-password -w -s "Chrome Safe Storage"')
    return out.stdout.strip().encode()


def derive(password: bytes):
    from cryptography.hazmat.primitives.hashes import SHA1
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    # Chrome on macOS: PBKDF2-HMAC-SHA1, salt "saltysalt", 1003 iters, 16 bytes.
    return PBKDF2HMAC(algorithm=SHA1(), length=16, salt=b"saltysalt", iterations=1003).derive(password)


def decrypt(blob: bytes, key: bytes, name: str = "") -> str:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    if not blob or blob[:3] not in (b"v10", b"v11"):
        return blob.decode("utf-8", "ignore")
    dec = Cipher(algorithms.AES(key), modes.CBC(b" " * 16)).decryptor()
    plain = dec.update(blob[3:]) + dec.finalize()
    plain = plain[: -plain[-1]] if plain and 0 < plain[-1] <= 16 else plain

    # Chrome >= 130 prepends 32 bytes of SHA256(domain). Do NOT sniff for it:
    # those bytes are often printable, so a "looks like text?" test silently
    # keeps them and yields a cookie the server rejects. Try both slices and
    # keep the one that is a valid cookie value.
    import re
    ok = re.compile(r"^[A-Za-z0-9_\-./+=~|:%]+$")
    for cand in (plain[32:], plain):
        text = cand.decode("utf-8", "ignore")
        if not text or not ok.match(text):
            continue
        if name == "__Secure-1PSID" and not text.startswith("g."):
            continue
        if name == "__Secure-1PSIDTS" and not text.startswith("sidts-"):
            continue
        return text
    return plain.decode("utf-8", "ignore")


def newest_profile() -> Path:
    cands = [p for p in CHROME.glob("*/Cookies") if p.is_file()]
    if not cands:
        sys.exit(f"no Chrome cookie database under {CHROME}")
    # The profile the user actually browses in is the most recently written one,
    # which is often "Profile 1", not "Default".
    return max(cands, key=lambda p: p.stat().st_mtime)


def main() -> int:
    db = newest_profile()
    key = derive(safe_storage_key())
    tmp = Path(tempfile.mkdtemp()) / "Cookies"
    shutil.copy2(db, tmp)          # Chrome holds a lock; work on a copy.
    con = sqlite3.connect(f"file:{tmp}?immutable=1", uri=True)
    rows = con.execute(
        "select name, encrypted_value from cookies "
        "where host_key like '%.google.com' and name in (?,?)", WANTED,
    ).fetchall()
    con.close()

    found = {n: decrypt(v, key, n) for n, v in rows}
    missing = [n for n in WANTED if not found.get(n)]
    if "__Secure-1PSID" in missing:
        sys.exit(f"__Secure-1PSID not in {db.parent.name}. Log in to gemini.google.com in that Chrome profile.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({n: found.get(n, "") for n in WANTED}, indent=2) + "\n", "utf-8")
    OUT.chmod(0o600)
    print(json.dumps({"profile": db.parent.name, "wrote": str(OUT),
                      "missing": missing, "psidLen": len(found.get("__Secure-1PSID", ""))}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
