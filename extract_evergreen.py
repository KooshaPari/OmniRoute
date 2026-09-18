import json

p = "/Users/kooshapari/.jcode/sessions/session_evergreen_1789698398300_6f575ac605d9b412.journal.jsonl"
reports = []
for l in open(p):
    try:
        d = json.loads(l)
    except Exception:
        continue
    for m in d.get("append_messages", []):
        content = m.get("content", [])
        if not isinstance(content, list):
            continue
        for c in content:
            if isinstance(c, dict) and c.get("type") == "tool_use" and c.get("name") == "swarm":
                inp = c.get("input", {})
                if inp.get("action") == "report":
                    reports.append((inp.get("tldr", ""), inp.get("message", "")))

print("reports:", len(reports))
for t, msg in reports[-2:]:
    print("==== tldr:", t)
    print(msg[:6500])
