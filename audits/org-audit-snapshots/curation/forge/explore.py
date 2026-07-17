#!/usr/bin/env python3.11
"""Exploration script to understand forge chat corpus patterns."""
import sqlite3
import json
import re
import sys

DB = "/Users/kooshapari/forge/.forge.db"

TASK_RE = re.compile(r"<task>(.*?)</task>", re.DOTALL)
SYS_DATE_RE = re.compile(r"<system_date>.*", re.DOTALL)

# Genuine typos (not just contractions) - these are STRONG human signals
REAL_TYPOS = [
    "hte", "thier", "waht", "htis", "rsrch", "mkt", "otpios", "owrk",
    "palgeud", "paralel", "seperate", "teh", "recieve", "begining",
    "wirte", "fucntion", "definately", "occured", "untill", "alot",
    "nxt", "thru", "programing", "maintainance", "goverment",
    "acheive", "adress", "comitee", "embarass", "enviornment",
    "existance", "freqent", "goverance", "harrass", "independant",
    "liason", "millenium", "neccessary", "occassion", "parliment",
    "persistant", "preceed", "priviledge", "publicaly", "reccomend",
    "relevent", "repetition", "rythm", "sargeant", "speach",
    "supercede", "tommorow", "unecessary", "unfortunatly",
    "wensday", "withold",
]

TERSE_IMPERATIVES = {
    "proc", "tick", "go", "resume", "continue", "yes", "ok", "next", "more",
    "keep going", "do it", "do all", ".", ",", "yep", "nope", "k", "kk",
    "got it", "do it all", "do all nxt", "proceed", "done", "finished",
    "all done", "all good", "thx", "ty", "thanks", "ok go", "ok do it",
    "fix", "run", "test", "build", "nxt", "doit", "keepgoing", "continue.",
}

CASUAL_FILLER = {
    "anyway", "alright", "cmon", "gonna", "wanna", "lemme",
    "sorta", "kinda", "prolly", "cuz", "bc", "btw", "fwiw", "afaik",
    "imo", "imho", "tbh", "hmm", "huh", "nah", "yeah", "yep", "nope",
    "lol", "lmao", "idk", "dw", "fml", "omg", "fyi",
}


def get_inner(content: str) -> str:
    """Strip <task> wrapper and <system_date>, return inner text."""
    if not content:
        return ""
    m = TASK_RE.search(content)
    inner = m.group(1) if m else content
    inner = SYS_DATE_RE.sub("", inner)
    return inner.strip()


def explore():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    total = con.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
    print(f"Total conversations: {total}")

    rows = con.execute("""
        SELECT conversation_id, context FROM conversations
        WHERE context IS NOT NULL AND is_compressed=0
        LIMIT 500
    """).fetchall()

    all_msgs = []
    for cid, ctx in rows:
        data = json.loads(ctx)
        msgs = data.get("messages", [])
        for i, m in enumerate(msgs):
            mm = m.get("message", {})
            t = mm.get("text", {})
            if t.get("role") == "User" and t.get("content"):
                inner = get_inner(t["content"])
                if inner:
                    all_msgs.append((cid, i, inner, len(msgs)))

    print(f"Total user messages sampled: {len(all_msgs)}")

    results = []
    for cid, idx, text, n_msgs in all_msgs:
        low = text.lower().strip()
        n = len(text)
        words = low.split()
        n_words = len(words)
        letters = [c for c in text if c.isalpha()]
        lc_ratio = sum(c.islower() for c in letters) / len(letters) if letters else 1.0

        score = 0.0
        reasons = []

        # Terse message (0-5 words)
        if n_words <= 5 and n <= 40:
            score += 5.0
            reasons.append(f"terse({n_words}w)")

        # Terse imperative match
        stripped = low.rstrip(".,!? ").strip()
        if stripped in TERSE_IMPERATIVES:
            score += 8.0
            reasons.append("imperative")

        # Genuine typos
        typo_hits = 0
        for tp in REAL_TYPOS:
            if tp in low:
                typo_hits += 1
                score += 3.0
        if typo_hits:
            reasons.append(f"typo({typo_hits})")

        # Backslash patterns
        bs_hits = len(re.findall(r"\w+\\(?!\w)", text))
        if bs_hits > 0:
            score += min(bs_hits, 5) * 3.0
            reasons.append(f"bs({bs_hits})")

        # Casual filler
        for f in CASUAL_FILLER:
            if f in words:
                score += 2.0
                reasons.append(f"casual:{f}")
                break

        # Low capitalization
        if lc_ratio > 0.95 and n > 20:
            score += 1.5
            reasons.append("lowcap")

        # Run-on sentences
        periods = text.count(".")
        if n > 200 and periods <= max(1, n // 300):
            score += 2.0
            reasons.append("runon")

        # Low sentence-start capitalization
        sentences = re.split(r"[.!?]\s+", text.strip())
        if len(sentences) >= 3:
            capped = sum(1 for s in sentences if s and s[0].isupper())
            cap_ratio = capped / len(sentences)
            if cap_ratio < 0.25:
                score += 2.0
                reasons.append("nocap")

        # Short follow-up
        if n_words <= 3 and idx > 0:
            score += 3.0
            reasons.append("short_followup")

        # Bare file paths
        if re.search(r"/[\w/.-]+", text) and n < 100:
            score += 1.0
            reasons.append("bare_path")

        # Numbered task structure
        if re.search(r"^\s*\d+\.\s+", low):
            score -= 6.0
            reasons.append("numlist")

        # Markdown headers
        if "##" in text or "###" in text:
            score -= 5.0
            reasons.append("mdheader")

        # Bold markers
        bold_count = text.count("**")
        if bold_count >= 2:
            score -= min(bold_count, 8) * 1.5
            reasons.append(f"bold({bold_count})")

        # Formal instruction words
        formal_words = ["deliverables", "methodology", "prerequisites",
                        "overview", "background", "instructions", "objectives",
                        "steps:", "procedure", "workflow", "checklist"]
        fw_hits = sum(1 for fw in formal_words if fw in low.split())
        if fw_hits:
            score -= fw_hits * 3.0
            reasons.append(f"formal({fw_hits})")

        # Subagent boilerplate
        if "you are a" in low and ("subagent" in low or "agent" in low or "assistant" in low):
            score -= 8.0
            reasons.append("subagent_role")
        if "authoritative reference" in low or "summary frames" in low:
            score -= 8.0
            reasons.append("summary_frames")
        if "pending todo items" in low:
            score -= 5.0
            reasons.append("sys_reminder")

        # Code blocks
        if "```" in text:
            score -= 4.0
            reasons.append("codeblock")

        # Tables
        if "|---" in text or "| ---" in text:
            score -= 4.0
            reasons.append("table")

        # Formal opener
        if re.match(r"^\s*(i'?ll|let me|here'?s|here is|i will|i've|we'll|we will)\b", low):
            score -= 5.0
            reasons.append("formal_opener")

        # "Return everything in"
        if "return everything" in low:
            score -= 4.0
            reasons.append("return_all")

        # "Be exhaustive"
        if "be exhaustive" in low or "read all" in low:
            score -= 3.0
            reasons.append("exhaustive")

        # Perfect sentences
        if re.match(r"^[A-Z]", text.strip()) and n > 40 and text.strip().endswith("."):
            score -= 2.0
            reasons.append("perf_sent")

        # System tags
        if "<system_reminder>" in text:
            score -= 5.0
            reasons.append("sys_reminder_tag")
        if "<feedback>" in text:
            score -= 3.0
            reasons.append("feedback_tag")

        results.append((cid, idx, n_msgs, score, reasons, text[:200]))

    results.sort(key=lambda x: x[3], reverse=True)

    print(f"\n=== TOP SCORING (human-like) MESSAGES ===")
    for cid, idx, n_msgs, score, reasons, snippet in results[:40]:
        short = " ".join(snippet.split())[:120]
        print(f"\n  [{score:+.1f}] {cid[:8]} msg[{idx}] ({n_msgs} total msgs)")
        if reasons:
            print(f"  sigs: {', '.join(reasons)}")
        print(f"  text: {short}")

    results_rev = sorted(results, key=lambda x: x[3])
    print(f"\n\n=== LOWEST SCORING (subagent-like) MESSAGES ===")
    for cid, idx, n_msgs, score, reasons, snippet in results_rev[:20]:
        short = " ".join(snippet.split())[:120]
        print(f"\n  [{score:+.1f}] {cid[:8]} msg[{idx}] ({n_msgs} total msgs)")
        if reasons:
            print(f"  sigs: {', '.join(reasons)}")
        print(f"  text: {short}")

    con.close()


if __name__ == "__main__":
    explore()
