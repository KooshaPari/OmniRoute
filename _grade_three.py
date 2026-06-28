import json, subprocess, sys
audits = ["pheno-harness-2026-06-25", "Civis-2026-06-25", "smart-mcp-go-2026-06-23"]
grader = "registry/audit-absorption-justification/grade.sh"
prefix = "audits/absorption-justifications/"

for name in audits:
    p = name + ".md"
    r = subprocess.run(
        ["C:\\Windows\\System32\\bash.exe", "-c", f"bash {grader} {prefix}{p}"],
        capture_output=True, text=True
    )
    try:
        d = json.loads(r.stdout)
        print(f"{name}: score={d['score']}/14 grade={d['grade']} pct={d.get('percentage','?')}")
        for pillar in d.get('pillars', []):
            detail = pillar.get('detail', '')[:200]
            print(f"  P{pillar['id']}: {pillar['score']}/{pillar['max']} {pillar['stat'] if 'stat' in pillar else pillar.get('status','?')}: {detail}")
    except (json.JSONDecodeError, KeyError) as e:
        print(f"{name}: parse error: {e}")
        print(f"  stdout starts: {r.stdout[:300]}")
