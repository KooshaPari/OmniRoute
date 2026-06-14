# pheno-fastapi-base

Canonical FastAPI base for the pheno-* service fleet. One small package, one
small set of contracts, every HTTP service in the fleet is expected to use it.

## What you get

| Symbol | Where | Purpose |
|---|---|---|
| `create_app(title, version)` | `pheno_fastapi_base` | FastAPI factory that wires up `/healthz`, `/readyz`, the `app.started` lifespan event, a structlog-based JSON access-log middleware, and the `AppError` exception handler. |
| `AppError` | `pheno_fastapi_base.errors` | Single, framework-agnostic error type with a stable string `code` and a human `message`. Domain code never imports from `fastapi`. |
| `code_to_status` | `pheno_fastapi_base.errors` | The wire-vocabulary-to-HTTP-status map. Reviewable in one place: `NotFound -> 404`, `Validation -> 422`, `Conflict -> 409`, `Storage -> 500`, `Domain -> 500`. |
| `StructlogAccessLogMiddleware` | `pheno_fastapi_base.middleware` | Emits one JSON line per request via structlog (`event=app.access`, with `method`, `path`, `status_code`, `duration_ms`). |
| `AsyncTestClient` | `pheno_fastapi_base.testing` | Thin `httpx.AsyncClient` wrapper that drives a FastAPI app in-process via `httpx.ASGITransport`. Construct via `AsyncTestClient.with_app(app)`. |

## Install

```bash
pip install -e ".[dev]"
```

## Minimal usage

```python
from pheno_fastapi_base import create_app, AppError

app = create_app(title="pheno-thing-api", version="0.1.0")

@app.get("/widgets/{widget_id}")
async def get_widget(widget_id: str) -> dict[str, str]:
    if widget_id != "known":
        raise AppError("NotFound", f"widget {widget_id!r} not found",
                       details={"entity": "Widget", "id": widget_id})
    return {"id": widget_id, "name": "Sprocket"}
```

The `NotFound` raise is translated by the registered handler into:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{"error": {"code": "NotFound", "message": "widget 'unknown' not found",
           "details": {"entity": "Widget", "id": "unknown"}}}
```

## Test

```bash
pytest -q
```

## Run

```bash
uvicorn my_pkg.main:app --reload
```

## Why a separate package?

The pheno-* fleet has 6+ HTTP services that historically each had their own
copy of:

* a structlog setup block,
* a `/healthz` route,
* a JSON error handler,
* an httpx-based async test client.

`pheno-fastapi-base` is the single replacement. Adding a new code in
`code_to_status`, a new probe, or a new log field is now a one-PR change to
this package, not a six-PR change to the fleet.

## License

MIT.
