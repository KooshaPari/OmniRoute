#!/usr/bin/env python3
"""mtls-fleet: mTLS certificate generator + verifier (L52.1 P2)

Generates a fleet-wide internal mTLS PKI (CA + per-service certs) and
verifies peer certs against the CA bundle. Intended for use as a CI
gate and a one-time bootstrap for new fleet services.

Usage:
    python3 tools/mtls-fleet/issue.py \
        --ca-dir mtls/ca \
        --service pheno-port-adapter \
        --out mtls/services/pheno-port-adapter
    python3 tools/mtls-fleet/verify.py \
        --ca-dir mtls/ca \
        --cert mtls/services/pheno-port-adapter/cert.pem
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional


def ensure_ca(ca_dir: Path, days: int = 3650) -> dict:
    """Bootstrap the fleet CA (idempotent). Returns CA metadata."""
    ca_dir.mkdir(parents=True, exist_ok=True)
    cert = ca_dir / "ca.crt"
    key = ca_dir / "ca.key"
    if cert.exists() and key.exists():
        return {"ca_dir": str(ca_dir), "already_issued": True}
    cn = "Phenotype Fleet Internal CA"
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:4096", "-nodes",
         "-keyout", str(key), "-out", str(cert), "-days", str(days),
         "-subj", f"/CN={cn}", "-addext",
         "basicConstraints=critical,CA:TRUE"],
        check=True, capture_output=True,
    )
    return {"ca_dir": str(ca_dir), "already_issued": False,
            "issued_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}


def issue_cert(ca_dir: Path, service: str, out_dir: Path, days: int = 365) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    cert = out_dir / "cert.pem"
    key = out_dir / "key.pem"
    csr = out_dir / "csr.pem"
    cn = service
    # generate key + csr
    subprocess.run(
        ["openssl", "req", "-newkey", "rsa:2048", "-nodes",
         "-keyout", str(key), "-out", str(csr),
         "-subj", f"/CN={cn}"],
        check=True, capture_output=True,
    )
    # sign with CA, add SAN
    san = f"subjectAltName=DNS:{service},DNS:localhost,IP:127.0.0.1"
    subprocess.run(
        ["openssl", "x509", "-req", "-in", str(csr),
         "-CA", str(ca_dir / "ca.crt"), "-CAkey", str(ca_dir / "ca.key"),
         "-CAcreateserial", "-out", str(cert),
         "-days", str(days), "-sha256",
         "-extfile", "<(printf '%s' \"" + san + "\")"],
        check=True, capture_output=True,
    )
    return {"service": service, "out_dir": str(out_dir),
            "cert": str(cert), "key": str(key),
            "issued_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}


def verify_cert(ca_dir: Path, cert: Path) -> dict:
    """Verify a cert against the CA bundle."""
    started = _dt.datetime.now(_dt.timezone.utc).isoformat()
    try:
        proc = subprocess.run(
            ["openssl", "verify", "-CAfile", str(ca_dir / "ca.crt"), str(cert)],
            capture_output=True, text=True, timeout=10,
        )
        ok = proc.returncode == 0
        return {"cert": str(cert), "verified_at": started,
                "valid": ok, "output": proc.stdout.strip()}
    except Exception as exc:
        return {"cert": str(cert), "verified_at": started,
                "valid": False, "error": str(exc)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Fleet mTLS issuer + verifier")
    sub = ap.add_subparsers(dest="cmd", required=True)
    # issue
    p_issue = sub.add_parser("issue", help="issue a new service cert")
    p_issue.add_argument("--ca-dir", required=True)
    p_issue.add_argument("--service", required=True)
    p_issue.add_argument("--out", required=True)
    p_issue.add_argument("--days", type=int, default=365)
    # verify
    p_verify = sub.add_parser("verify", help="verify a cert against the CA")
    p_verify.add_argument("--ca-dir", required=True)
    p_verify.add_argument("--cert", required=True)
    args = ap.parse_args()
    if args.cmd == "issue":
        ca = ensure_ca(Path(args.ca_dir))
        out = issue_cert(Path(args.ca_dir), args.service, Path(args.out), args.days)
        print(json.dumps({"ca": ca, "cert": out}, indent=2))
        return 0
    if args.cmd == "verify":
        result = verify_cert(Path(args.ca_dir), Path(args.cert))
        print(json.dumps(result, indent=2))
        return 0 if result.get("valid") else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())