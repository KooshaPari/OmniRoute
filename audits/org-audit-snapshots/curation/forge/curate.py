#!/usr/bin/env python3.11
"""
Curation layer for agent-CLI chat corpora.

Two-pass curation:
  PASS 1 -- classify each User message HUMAN vs SUBAGENT-written (humanness score).
  PASS 2 -- rank CONVERSATIONS by substantive-human-richness (scan ALL human msgs,
            not just the first; keep convos with >=1 substantive human request).

Parameterized so it can run against forge / codex / cursor-agent / factory-droid
corpora by swapping the ADAPTER (corpus path + row iterator + message extractor).

Corpora likely live at:
  forge          : ~/forge/.forge.db        (sqlite; table `conversations`)
  codex          : ~/.codex/sessions/       (jsonl session files -- adapter TODO)
  cursor-agent   : ~/.cursor or ~/.config   (adapter TODO)
  factory-droid  : ~/.factory               (adapter TODO)

Usage:
  python3.11 curate.py --adapter forge --db ~/forge/.forge.db --out <dir>
"""
import argparse
import json
import os
import re
import sqlite3
import sys

try:
    import zstandard  # noqa: F401
    _HAS_ZSTD = True
except ImportError:
    _HAS_ZSTD = False

MAX_BLOB_BYTES = 50 * 1024 * 1024  # skip context blobs larger than this
TASK_RE = re.compile(r"<task>(.*?)</task>", re.DOTALL)
SYSTEM_TAG_RE = re.compile(r"<system_date>.*", re.DOTALL)


# ------------------------- humanness scoring -------------------------

# Owner's signature typos / patterns (strong human signal).
OWNER_TYPOS = [
    "teh", "seperate", "paralel", "otpios", "owrk", "htis", "rsrch", "mkt",
    "recieve", "palgeud", "w\\", "and\\or", "waht", "taht", "hte", "thier",
    "dont", "doesnt", "wont", "cant", "im ", "ill ", "ive ", "nxt", "thru",
    "alot", "definately", "occured", "untill", "begining", "wirte", "fucntion",
]
BACKSLASH_ACRONYM_RE = re.compile(r"\b\w+\\\w+")  # w\, and\or
TERSE_IMPERATIVES = {"proc", "tick", "do it all", "do all nxt", ".", "go", "continue",
                     "resume", "yes", "ok", "next", "more", "keep going"}

# Subagent / clean-text signals (negative for humanness).
SUBAGENT_MARKERS = [
    "i'll ", "let me ", "here's ", "here is ", "i will ", "i've ",
    "## ", "```", "shard ", "create `", "| ---", "|---",
    "█", "✓", "⏎", "─", "✅", "❌", "→", "•",
    "summary frames", "authoritative reference",
]


def strip_task_wrapper(content: str) -> str:
    """Strip forge's <task>...</task> wrapper but KEEP inner text. Drop trailing
    <system_date> noise. If no wrapper, return content unchanged."""
    if content is None:
        return ""
    m = TASK_RE.search(content)
    if m:
        inner = m.group(1)
    else:
        inner = content
    inner = SYSTEM_TAG_RE.sub("", inner)
    return inner.strip()


def humanness_score(text: str) -> float:
    """Higher => more likely owner-written. Heuristic, range ~[-5, +12]."""
    if not text:
        return -5.0
    low = text.lower()
    n = len(text)
    score = 0.0

    # Terse imperative whole-message (owner barks short commands).
    if low.strip() in TERSE_IMPERATIVES or len(low.strip()) <= 4:
        score += 3.0

    # Typos / owner vocabulary.
    typo_hits = sum(low.count(t) for t in OWNER_TYPOS)
    score += min(typo_hits, 8) * 1.2

    # Backslash acronyms (w\, and\or) -- very strong owner tell.
    score += min(len(BACKSLASH_ACRONYM_RE.findall(text)), 4) * 2.0

    # Lowercase-heavy: ratio of lowercase letters to total letters.
    letters = [c for c in text if c.isalpha()]
    if letters:
        lc_ratio = sum(c.islower() for c in letters) / len(letters)
        if lc_ratio > 0.97:
            score += 2.0
        elif lc_ratio > 0.93:
            score += 1.0

    # Sentence-start capitalization: clean text capitalizes; owner rarely does.
    sentences = re.split(r"[.!?]\s+", text.strip())
    if len(sentences) >= 2:
        capped = sum(1 for s in sentences if s[:1].isupper())
        if capped / len(sentences) < 0.3:
            score += 1.5
        elif capped / len(sentences) > 0.85:
            score -= 1.5

    # Run-on: long text with very few periods.
    periods = text.count(".")
    if n > 300 and periods <= max(1, n // 400):
        score += 1.5

    # Subagent / markdown / dashboard markers => penalize.
    sub_hits = sum(low.count(mk) for mk in SUBAGENT_MARKERS)
    score -= min(sub_hits, 10) * 1.5

    # Proper "I'll/Let me/Here's" opener => strong subagent tell.
    if re.match(r"^\s*(i'll|let me|here's|here is|i will|i've|sure|certainly)\b", low):
        score -= 4.0

    return score


def substantive_score(text: str, hscore: float) -> float:
    """Richness of a HUMAN request: rewards real task/research/architecture asks,
    penalizes pure 'proc'/'.' filler. Used to rank conversations."""
    if hscore < 0.5:
        return 0.0  # not human enough to count
    low = text.lower()
    stripped = low.strip()
    n = len(text.strip())

    if stripped in TERSE_IMPERATIVES or n <= 6:
        return 0.2  # human but pure filler

    score = 0.0
    # Length bands (substantive requests are longer).
    if n > 600:
        score += 4.0
    elif n > 250:
        score += 2.5
    elif n > 90:
        score += 1.0

    # Topical richness keywords (research / architecture / build).
    rich_kw = [
        "research", "architect", "design", "build", "implement", "audit",
        "analyze", "strategy", "system", "pipeline", "refactor", "migrate",
        "spec", "plan", "compare", "evaluate", "benchmark", "integrate",
        "framework", "protocol", "schema", "dataset", "model", "orchestrat",
        "market", "competitor", "investor", "pitch", "monetiz", "roadmap",
        "deploy", "scrape", "corpus", "fleet", "swarm", "governance",
    ]
    score += min(sum(low.count(k) for k in rich_kw), 8) * 0.6

    # Multi-clause / enumerated requests.
    score += min(low.count(" and "), 6) * 0.2
    score += min(text.count("\n"), 8) * 0.2

    # Weight by humanness (owner-authored substance is the gem).
    score += min(hscore, 8) * 0.3
    return score


# ------------------------- adapters -------------------------

def forge_decompress(zstd_blob):
    if not _HAS_ZSTD:
        raise RuntimeError("zstandard not installed; run with python3.11")
    import zstandard
    return zstandard.ZstdDecompressor().decompress(zstd_blob)


def forge_iter(db_path, progress_every=2000):
    """Yield (conversation_id, created_at, title, [user_texts]) for forge corpus."""
    con = sqlite3.connect(f"file:{os.path.expanduser(db_path)}?mode=ro", uri=True)
    cur = con.execute(
        "SELECT conversation_id, created_at, title, context, context_zstd, "
        "is_compressed, message_count FROM conversations"
    )
    scanned = skipped_null = skipped_big = skipped_err = 0
    while True:
        rows = cur.fetchmany(50)
        if not rows:
            break
        for cid, created, title, ctx, ctx_z, is_comp, mc in rows:
            scanned += 1
            if scanned % progress_every == 0:
                print(f"  ...scanned {scanned} rows", file=sys.stderr)
            try:
                if is_comp and ctx_z is not None:
                    if len(ctx_z) > MAX_BLOB_BYTES:
                        skipped_big += 1
                        continue
                    raw = forge_decompress(ctx_z)
                elif ctx is not None:
                    if len(ctx) > MAX_BLOB_BYTES:
                        skipped_big += 1
                        continue
                    raw = ctx
                else:
                    skipped_null += 1
                    continue
                data = json.loads(raw)
            except Exception:
                skipped_err += 1
                continue
            user_texts = []
            for m in data.get("messages", []):
                mm = m.get("message", {})
                t = mm.get("text")
                if t and t.get("role") == "User":
                    user_texts.append(strip_task_wrapper(t.get("content", "")))
            yield cid, created, title, user_texts
    con.close()
    print(f"  [forge] scanned={scanned} null={skipped_null} big={skipped_big} "
          f"err={skipped_err}", file=sys.stderr)


ADAPTERS = {"forge": forge_iter}


# ------------------------- main curation -------------------------

def snippet(text, n=200):
    s = " ".join(text.split())
    return s[:n]


def curate(adapter_name, db_path, out_dir, progress_every=2000):
    it = ADAPTERS[adapter_name](db_path, progress_every)
    candidates = []
    total = 0
    for cid, created, title, user_texts in it:
        total += 1
        if not user_texts:
            continue
        scored = []
        for ut in user_texts:
            h = humanness_score(ut)
            s = substantive_score(ut, h)
            scored.append((s, h, ut))
        human_msgs = [x for x in scored if x[1] >= 0.5]
        substantive = [x for x in scored if x[0] > 0]
        if not substantive:
            continue
        substantive.sort(key=lambda x: x[0], reverse=True)
        conv_score = sum(x[0] for x in substantive[:5])  # top-5 sum
        best = substantive[0][2]
        candidates.append({
            "conv_score": round(conv_score, 2),
            "n_human_msgs": len(human_msgs),
            "msg_count": len(user_texts),
            "conversation_id": cid,
            "created_date": str(created)[:10],
            "title": (title or "").replace("\t", " ").replace("\n", " ")[:120],
            "best_snippet": snippet(best),
            "_top_msgs": [x[2] for x in substantive[:3]],
        })

    candidates.sort(key=lambda c: c["conv_score"], reverse=True)
    os.makedirs(out_dir, exist_ok=True)

    tsv = os.path.join(out_dir, "candidates.tsv")
    with open(tsv, "w") as f:
        f.write("conv_score\tn_human_msgs\tmsg_count\tconversation_id\t"
                "created_date\ttitle\tbest_human_msg_snippet\n")
        for c in candidates:
            f.write(f"{c['conv_score']}\t{c['n_human_msgs']}\t{c['msg_count']}\t"
                    f"{c['conversation_id']}\t{c['created_date']}\t{c['title']}\t"
                    f"{c['best_snippet']}\n")

    top = candidates[:100]
    md = os.path.join(out_dir, "curated-top.md")
    with open(md, "w") as f:
        f.write(f"# Curated top conversations -- {adapter_name}\n\n")
        f.write(f"Total scanned: {total} | candidates: {len(candidates)} | "
                f"showing top {len(top)}\n\n")
        for i, c in enumerate(top, 1):
            f.write(f"## {i}. score={c['conv_score']} "
                    f"[{c['created_date']}] {c['title'] or '(untitled)'}\n")
            f.write(f"- id: `{c['conversation_id']}` "
                    f"(human_msgs={c['n_human_msgs']}, total_user={c['msg_count']})\n")
            for j, msg in enumerate(c["_top_msgs"], 1):
                clean = " ".join(msg.split())[:1200]
                f.write(f"- **req {j}:** {clean}\n")
            f.write("\n")

    return total, candidates, top


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", default="forge", choices=list(ADAPTERS))
    ap.add_argument("--db", default="~/forge/.forge.db")
    ap.add_argument("--out", required=True)
    ap.add_argument("--progress-every", type=int, default=2000)
    args = ap.parse_args()
    total, cands, top = curate(args.adapter, args.db, args.out, args.progress_every)
    print(f"DONE: scanned={total} candidates={len(cands)} out={args.out}")
    print("\nTOP 10 human requests:")
    for c in top[:10]:
        print(f"  [{c['conv_score']}] {c['best_snippet'][:140]}")


if __name__ == "__main__":
    main()
