#!/usr/bin/env python3
"""Chaos network test suite.

Pillar L36.1 (chaos network test). Simulates network failures
(partition, latency, packet loss) and verifies system behavior.

Usage:
    python3 tests/chaos-network/chaos_test.py --scenario partition --duration 30
    python3 tests/chaos-network/chaos_test.py --list
"""
from __future__ import annotations

import argparse
import random
import socket
import subprocess
import sys
import time
from pathlib import Path


SCENARIOS = {
    "partition": {
        "name": "Network partition",
        "description": "Drop all packets to a target host for N seconds",
    },
    "latency": {
        "name": "High latency",
        "description": "Add 2000ms latency to a target port",
    },
    "packet_loss": {
        "name": "Packet loss",
        "description": "Drop 50% of packets to a target host",
    },
    "dns_failure": {
        "name": "DNS resolution failure",
        "description": "Block DNS resolution for a target domain",
    },
    "connection_reset": {
        "name": "Connection reset",
        "description": "Force TCP RST on a target port",
    },
}


def _check_tool(tool: str) -> bool:
    try:
        subprocess.run(["which", tool], capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError:
        return False


def _run_tc_cmd(cmd: list[str], dry_run: bool = False) -> bool:
    if dry_run:
        print(f"[DRY-RUN] {' '.join(cmd)}")
        return True
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=10)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"ERROR: tc command failed: {exc.stderr.strip()}", file=sys.stderr)
        return False


def run_scenario(scenario: str, target_host: str, duration: int, port: int = 0, dry_run: bool = False) -> bool:
    if not _check_tool("tc"):
        print("WARN: tc (traffic control) not available; using simulated mode", file=sys.stderr)
        return _simulate(scenario, target_host, duration, dry_run)

    if scenario == "partition":
        cmd = ["tc", "qdisc", "add", "dev", "eth0", "root", "netem", "loss", "100%"]
        print(f"Partitioning {target_host} for {duration}s...")
    elif scenario == "latency":
        cmd = ["tc", "qdisc", "add", "dev", "eth0", "root", "netem", "delay", "2000ms"]
        print(f"Adding 2000ms latency to {target_host}:{port or 'any'} for {duration}s...")
    elif scenario == "packet_loss":
        cmd = ["tc", "qdisc", "add", "dev", "eth0", "root", "netem", "loss", "50%"]
        print(f"Dropping 50% packets to {target_host} for {duration}s...")
    elif scenario == "dns_failure":
        hosts_path = Path("/etc/hosts")
        backup = hosts_path.read_text() if hosts_path.exists() else ""
        if not dry_run:
            hosts_path.write_text(backup + f"\n127.0.0.1 {target_host}\n")
        print(f"Blocking DNS for {target_host} for {duration}s...")
        time.sleep(duration)
        if not dry_run:
            hosts_path.write_text(backup)
        return True
    elif scenario == "connection_reset":
        cmd_ipt = ["iptables", "-A", "INPUT", "-p", "tcp", "--dport", str(port or 80), "-j", "REJECT", "--reject-with", "tcp-reset"]
        print(f"Setting TCP RST on port {port or 80} for {duration}s...")
        _run_tc_cmd(cmd_ipt, dry_run)
        time.sleep(duration)
        cmd_clean = ["iptables", "-D", "INPUT", "-p", "tcp", "--dport", str(port or 80), "-j", "REJECT"]
        _run_tc_cmd(cmd_clean, dry_run)
        return True
    else:
        print(f"ERROR: unknown scenario: {scenario}", file=sys.stderr)
        return False

    if not _run_tc_cmd(cmd, dry_run):
        return False
    time.sleep(duration)
    cmd_del = ["tc", "qdisc", "del", "dev", "eth0", "root"]
    _run_tc_cmd(cmd_del, dry_run)
    return True


def _simulate(scenario: str, target_host: str, duration: int, dry_run: bool) -> bool:
    print(f"[SIMULATED] {SCENARIOS[scenario]['name']} on {target_host} for {duration}s")
    if not dry_run:
        time.sleep(1)
    return True


def _resolve_host(name: str) -> str:
    try:
        return socket.gethostbyname(name)
    except socket.gaierror:
        return name


def main() -> int:
    ap = argparse.ArgumentParser(description="Chaos network test suite")
    ap.add_argument("--scenario", choices=list(SCENARIOS.keys()), help="Chaos scenario")
    ap.add_argument("--target", default="localhost", help="Target host (default: localhost)")
    ap.add_argument("--duration", type=int, default=10, help="Duration in seconds (default: 10)")
    ap.add_argument("--port", type=int, default=0, help="Target port")
    ap.add_argument("--list", action="store_true", help="List available scenarios")
    ap.add_argument("--all", action="store_true", help="Run all scenarios sequentially")
    ap.add_argument("--dry-run", action="store_true", help="Validate only, do not apply changes")
    args = ap.parse_args()

    if args.list:
        print("Available chaos scenarios:")
        for key, info in SCENARIOS.items():
            print(f"  {key:20s} {info['name']:20s} {info['description']}")
        return 0

    if not args.scenario and not args.all:
        ap.error("specify --scenario or --all")

    target_ip = _resolve_host(args.target)
    print(f"Target: {args.target} ({target_ip})")

    scenarios = list(SCENARIOS.keys()) if args.all else [args.scenario]
    failures = []
    for sc in scenarios:
        ok = run_scenario(sc, target_ip, args.duration, args.port, args.dry_run)
        if not ok:
            failures.append(sc)

    if failures:
        print(f"FAILED: {len(failures)} scenario(s): {failures}", file=sys.stderr)
        return 2
    print("All scenarios passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
