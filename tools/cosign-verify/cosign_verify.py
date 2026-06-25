#!/usr/bin/env python3
"""Cosign verification wrapper (v28 T4, L53 cosign verify, 2.0 -> 2.5).
Verifies one or more images against their Sigstore signatures.
Usage: python3 tools/cosign-verify/cosign_verify.py <image> [image...]
"""
import subprocess, sys

def verify(image: str) -> bool:
    try:
        r = subprocess.run(
            ["cosign", "verify", "--insecure-ignore-tlog=false", image],
            capture_output=True, text=True, timeout=60
        )
        return r.returncode == 0
    except Exception:
        return False

def main() -> int:
    images = sys.argv[1:]
    if not images:
        print("Usage: cosign_verify.py <image> [image...]")
        return 2
    fail = 0
    for img in images:
        ok = verify(img)
        status = "✅" if ok else "❌"
        print(f"{status} {img}")
        if not ok:
            fail += 1
    return 1 if fail > 0 else 0

if __name__ == "__main__":
    sys.exit(main())
