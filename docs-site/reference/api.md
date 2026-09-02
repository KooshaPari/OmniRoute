---
title: API Reference
---

# API Reference

OpenAI-compatible surface on port 20128.

## POST /v1/chat/completions

```http
POST /v1/chat/completions HTTP/1.1
Authorization: Bearer <your-key>
Content-Type: application/json

{
  "model": "demo-fast",
  "messages": [{"role": "user", "content": "hello"}]
}
```

## GET /v1/models

Returns the providers currently loaded by the manifest.

## GET /v1/providers

Returns the provider plugin manifest.

## GET /health

`{"status":"ok"}` — liveness only.

## GET /ready

Includes DB and provider manifest status.
