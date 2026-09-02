---
title: Cost
---

# Cost

Per-request cost is attributed to model + tier.

```sh
omniroute cost rollup --since 1h
```

Returns:

```
demo-fast   1234 req  $0.06  0.05 ms/req avg
smart        567 req  $5.67  0.80 ms/req avg
embeddings   890 req  $0.04  0.06 ms/req avg
```

## Tracera handoff

Cost rollups are emitted to Tracera every 5 min via the org-intel endpoint:

```
POST /org-intel/metrics
```
