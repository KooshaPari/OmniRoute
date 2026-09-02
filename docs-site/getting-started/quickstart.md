---
title: Quickstart
---

# Quickstart

Start OmniRoute with the bundled demo provider:

```sh
omniroute start --provider demo --port 20128
```

In another shell:

```sh
curl http://127.0.0.1:20128/v1/chat/completions \
  -H 'Authorization: Bearer demo' \
  -H 'Content-Type: application/json' \
  -d '{"model":"demo-fast","messages":[{"role":"user","content":"hello"}]}'
```

Expected: HTTP 200 with a `choices[0].message.content` reply.

Next: try the [provider plugin manifest](/reference/provider-manifest) to add your own provider.
