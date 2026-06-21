#!/usr/bin/env python3
"""Python-based launcher — replaces fragile bash launcher.
Usage: launcher_py.sh next [batch_size]
       launcher_py.sh all [batch_size] [delay]
"""
import json, os, subprocess, sys, time

QUEUE_STATE = os.path.expanduser("~/.forge/autoqueue/state/queue.json")
LOG_DIR = os.path.expanduser("~/.forge/forge_resume_runs/logs")
REPO_DIR = os.path.expanduser("~/CodeProjects/Phenotype/repos")

def load_state():
    with open(QUEUE_STATE) as f:
        return json.load(f)

def save_state(state):
    with open(QUEUE_STATE, "w") as f:
        json.dump(state, f, indent=2)

def fetch_batch(size):
    state = load_state()
    pending = state.get("pending", [])
    if not pending:
        return []
    batch = pending[:size]
    state["pending"] = pending[size:]
    state["current_batch"] = batch
    save_state(state)
    return batch

def launch_one(cid, title):
    short = cid[:8]
    logfile = os.path.join(LOG_DIR, f"{short}.log")
    print(f"Launching: {title[:60]} ({short})", flush=True)
    proc = subprocess.Popen(
        ["nohup", "forge",
         "--conversation-id", cid,
         "-p", "Continue from where you left off. Complete the task autonomously without asking for user confirmation.",
         "-C", REPO_DIR],
        stdout=open(logfile, "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    print(f"  PID={proc.pid}  log={logfile}", flush=True)
    return proc.pid

def cmd_next(size):
    batch = fetch_batch(size)
    if not batch:
        print("QUEUE_EMPTY")
        return 0
    state = load_state()
    for cid in batch:
        entry = state.get("entries", {}).get(cid, {})
        title = entry.get("title", "Unknown")
        launch_one(cid, title)
        time.sleep(0.3)
    print(f"\n=== Launched {len(batch)} subagents ===")
    return len(batch)

def cmd_all(size, delay):
    while True:
        n = cmd_next(size)
        if n == 0:
            print("All subagents launched.")
            return
        print(f"Waiting {delay}s before next batch...")
        time.sleep(delay)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "next"
    if mode == "next":
        size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        cmd_next(size)
    elif mode == "all":
        size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        delay = int(sys.argv[3]) if len(sys.argv) > 3 else 60
        cmd_all(size, delay)
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)
