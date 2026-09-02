---
title: GUI Walkthrough
---

# GUI Walkthrough

The `demo/gui-walkthrough.ts` program emits an SVG decision tree for each request, showing the provider chosen, the failover decision, and the latency breakdown.

```sh
bun run demo/gui-walkthrough.ts --requests 5 --out ./demo/out
```

Output: `./demo/out/walkthrough.svg`

## Sample output

```svg
<svg width="640" height="320">
  <rect x="0" y="0" width="640" height="40" fill="#1f2937" />
  <text x="20" y="26" fill="white">req #1 → provider=demo-fast → 42ms</text>
  <line x1="20" y1="60" x2="100" y2="120" stroke="#22c55e" stroke-width="2" />
  <text x="120" y="100">demo-fast (200)</text>
</svg>
```

Each request becomes one row. Color encodes result: green = 2xx, amber = 4xx, red = 5xx.
