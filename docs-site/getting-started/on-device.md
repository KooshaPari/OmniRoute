---
title: On-device Demo
---

# On-device demo (60 seconds)

The fastest possible smoke test on your local machine. Works on macOS, Linux, and Raspberry Pi 4+.

## 1. Get the binary

```sh
curl -L https://github.com/KooshaPari/OmniRoute/releases/latest/download/omniroute-$(uname -s)-$(uname -m) \
  -o /tmp/omniroute && chmod +x /tmp/omniroute
```

## 2. Run the embedded demo

```sh
/tmp/omniroute demo
```

Expected stdout:

```
[ok] started on http://127.0.0.1:20128
[ok] hit /v1/chat/completions with prompt 'hello'
[ok] reply: 'echo: hello'
[ok] hit /v1/chat/completions with prompt 'again'
[ok] reply: 'echo: again'
[ok] shutdown
```

If you see all six lines: the binary is healthy. Move on to [Install](/getting-started/install).

## 3. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `permission denied` | binary not executable | `chmod +x /tmp/omniroute` |
| `address in use` | another process on 20128 | `--port 20129` |
| `unsupported platform` | wrong arch | download matching arch: `uname -m` |
