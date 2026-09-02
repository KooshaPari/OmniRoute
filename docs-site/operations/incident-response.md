---
title: Incident Response
---

# Incident Response

## Severity ladder

| Sev | Definition | Comms |
|-----|------------|-------|
| SEV-1 | Production down | Page on-call within 5 min; status page within 15 min |
| SEV-2 | Major degradation | Page on-call within 30 min; status page within 60 min |
| SEV-3 | Minor | Slack thread within 4 hours |

## Escalation

1. On-call engineer
2. Owner of the failing module
3. ADR-001 owner (canonical routing)
4. Fork governance hard-stop (HALT all traffic)

## Comms template

```
[SEV-X] <one-line summary>
Started: <UTC>
Affected: <scope>
Current action: <one line>
Next update: <UTC + 15 min>
```
