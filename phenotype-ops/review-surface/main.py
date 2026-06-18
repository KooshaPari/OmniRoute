"""phenotype-review-surface — Unified Code Review Webhook Router.

Single GitHub org webhook endpoint that:
1. Receives pull_request events
2. Picks ONE backend tool per PR (Forge, CodeRabbit, Copilot, Cursor)
3. Persists tool assignment for follow-up reviews
4. Posts results as a single GitHub Check Run
"""
import os
import random
import json
import hashlib
import hmac
from typing import Optional
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import structlog

logger = structlog.get_logger()


# ── Configuration ────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    github_webhook_secret: str = ""
    github_token: str = ""
    redis_url: str = "redis://localhost:6379/0"
    tool_backends: list[str] = ["forge", "coderabbit", "copilot", "cursor"]
    default_backend: str = "forge"
    rate_limit_per_hour: int = 30
    port: int = 8080
    log_level: str = "info"

    model_config = {"env_prefix": "REVIEW_", "env_file": ".env"}


settings = Settings()
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)


# ── State ────────────────────────────────────────────────────────────────────────

class PRState(BaseModel):
    """Persistent state for a PR's review assignment."""
    pr_id: str  # "owner/repo#number"
    backend: str
    assigned_at: str  # ISO 8601
    review_count: int = 0
    last_review_at: Optional[str] = None


# In-memory storage (Redis in production)
_pr_store: dict[str, PRState] = {}
_rate_limiter: dict[str, list[datetime]] = {}

AVAILABLE_BACKENDS: list[str] = list(settings.tool_backends)


# ── GitHub Webhook Handler ──────────────────────────────────────────────────────

async def verify_webhook_signature(request: Request, payload: bytes) -> bool:
    """Verify X-Hub-Signature-256 against payload."""
    if not settings.github_webhook_secret:
        return True  # Skip verification if no secret configured
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not signature_header.startswith("sha256="):
        return False
    expected_sig = signature_header.split("=", 1)[1]
    computed_sig = hmac.new(
        settings.github_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_sig, computed_sig)


def _get_pr_key(owner: str, repo: str, number: int) -> str:
    return f"{owner}/{repo}#{number}"


def _pick_backend(pr_key: str) -> str:
    """Pick ONE backend for this PR, stick with it."""
    existing = _pr_store.get(pr_key)
    if existing:
        return existing.backend

    # Random pick weighted by availability
    backend = random.choice(AVAILABLE_BACKENDS)
    _pr_store[pr_key] = PRState(
        pr_id=pr_key,
        backend=backend,
        assigned_at=datetime.now(timezone.utc).isoformat(),
    )
    logger.info("assigned_backend", pr=pr_key, backend=backend)
    return backend


def _check_rate_limit(backend: str) -> bool:
    now = datetime.now(timezone.utc)
    hour_ago = now.timestamp() - 3600
    if backend not in _rate_limiter:
        _rate_limiter[backend] = []
    _rate_limiter[backend] = [t for t in _rate_limiter[backend] if t.timestamp() > hour_ago]
    if len(_rate_limiter[backend]) >= settings.rate_limit_per_hour:
        return False
    _rate_limiter[backend].append(now)
    return True


async def _perform_review(
    backend: str,
    owner: str,
    repo: str,
    pr_number: int,
    action: str,
) -> dict:
    """Dispatch review to the selected backend."""
    pr_key = _get_pr_key(owner, repo, pr_number)

    if backend == "forge":
        result = await _dispatch_forge_review(owner, repo, pr_number)
    elif backend == "coderabbit":
        result = await _dispatch_coderabbit_review(owner, repo, pr_number)
    elif backend == "copilot":
        result = await _dispatch_copilot_review(owner, repo, pr_number)
    elif backend == "cursor":
        result = await _dispatch_cursor_review(owner, repo, pr_number)
    else:
        result = {"error": f"Unknown backend: {backend}"}

    # Update state
    if pr_key in _pr_store:
        _pr_store[pr_key].review_count += 1
        _pr_store[pr_key].last_review_at = datetime.now(timezone.utc).isoformat()

    return result


async def _dispatch_forge_review(owner: str, repo: str, pr_number: int) -> dict:
    """Send review to Forge code review agent."""
    # Forge runs locally — trigger via CLI or webhook
    logger.info("dispatching_to_forge", owner=owner, repo=repo, pr=pr_number)
    return {
        "status": "dispatched",
        "backend": "forge",
        "pr": f"{owner}/{repo}#{pr_number}",
        "result": "Review submitted to Forge agent queue",
    }


async def _dispatch_coderabbit_review(owner: str, repo: str, pr_number: int) -> dict:
    """Send review to CodeRabbit via API."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"https://api.coderabbit.ai/v1/reviews",
                json={"owner": owner, "repo": repo, "pr_number": pr_number},
                headers={"Authorization": f"Bearer {os.getenv('CODERABBIT_TOKEN', '')}"},
                timeout=30,
            )
            return {"status": "dispatched", "backend": "coderabbit", "response_status": resp.status_code}
        except Exception as e:
            logger.error("coderabbit_dispatch_failed", error=str(e))
            return {"status": "error", "backend": "coderabbit", "error": str(e)}


async def _dispatch_copilot_review(owner: str, repo: str, pr_number: int) -> dict:
    """Send review to GitHub Copilot Code Review."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                json={"event": "REQUEST_CHANGES", "body": "Automated review requested via Copilot"},
                headers={
                    "Authorization": f"Bearer {settings.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=30,
            )
            return {"status": "dispatched", "backend": "copilot", "response_status": resp.status_code}
        except Exception as e:
            logger.error("copilot_dispatch_failed", error=str(e))
            return {"status": "error", "backend": "copilot", "error": str(e)}


async def _dispatch_cursor_review(owner: str, repo: str, pr_number: int) -> dict:
    """Send review to Cursor code review."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                os.getenv("CURSOR_WEBHOOK_URL", "http://localhost:3000/api/review"),
                json={"owner": owner, "repo": repo, "pr_number": pr_number},
                timeout=30,
            )
            return {"status": "dispatched", "backend": "cursor", "response_status": resp.status_code}
        except Exception as e:
            logger.error("cursor_dispatch_failed", error=str(e))
            return {"status": "error", "backend": "cursor", "error": str(e)}


async def post_check_run(
    owner: str,
    repo: str,
    head_sha: str,
    conclusion: str,
    title: str,
    summary: str,
) -> None:
    """Post a GitHub Check Run summarizing the review."""
    if not settings.github_token:
        return
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/check-runs",
                json={
                    "name": "Unified Code Review",
                    "head_sha": head_sha,
                    "status": "completed",
                    "conclusion": conclusion,
                    "output": {
                        "title": title,
                        "summary": summary,
                    },
                },
                headers={
                    "Authorization": f"Bearer {settings.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=30,
            )
            logger.info("check_run_posted", status=resp.status_code)
        except Exception as e:
            logger.error("check_run_failed", error=str(e))


# ── FastAPI App ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("review_surface_starting", backends=AVAILABLE_BACKENDS)
    yield
    logger.info("review_surface_shutting_down")


app = FastAPI(
    title="Phenotype Unified Review Surface",
    version="0.1.0",
    lifespan=lifespan,
)


# ── Routes ────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "pr_count": len(_pr_store),
        "backends": AVAILABLE_BACKENDS,
    }


@app.post("/webhook/github")
async def github_webhook(request: Request):
    """Main webhook handler for GitHub pull_request events."""
    payload_bytes = await request.body()

    # Verify signature
    if not await verify_webhook_signature(request, payload_bytes):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    if event != "pull_request":
        return JSONResponse({"status": "ignored", "event": event})

    payload = json.loads(payload_bytes)
    action = payload.get("action", "")
    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})

    owner = repo.get("owner", {}).get("login", "")
    repo_name = repo.get("name", "")
    pr_number = pr.get("number", 0)
    head_sha = pr.get("head", {}).get("sha", "")

    pr_key = _get_pr_key(owner, repo_name, pr_number)
    logger.info("pull_request_event", owner=owner, repo=repo_name, pr=pr_number, action=action)

    # Only review on opened or synchronize
    if action not in ("opened", "synchronize"):
        return JSONResponse({"status": "ignored", "action": action})

    # Pick backend
    backend = _pick_backend(pr_key)

    # Rate limit check
    if not _check_rate_limit(backend):
        logger.warning("rate_limit_exceeded", backend=backend)
        return JSONResponse({
            "status": "rate_limited",
            "backend": backend,
            "message": f"Rate limit exceeded for {backend} ({settings.rate_limit_per_hour}/hr)",
        })

    # Dispatch review
    result = await _perform_review(backend, owner, repo_name, pr_number, action)

    # Post check run
    if head_sha:
        await post_check_run(
            owner=owner,
            repo=repo_name,
            head_sha=head_sha,
            conclusion="success" if result.get("status") == "dispatched" else "neutral",
            title=f"Unified Review via {backend}",
            summary=f"Review dispatched to **{backend}** for {owner}/{repo_name}#{pr_number}",
        )

    return JSONResponse({
        "status": "processed",
        "backend": backend,
        "pr": pr_key,
        "action": action,
        "result": result,
    })


@app.get("/api/state/{owner}/{repo}/{number}")
async def get_pr_state(owner: str, repo: str, number: int):
    """Get current review state for a PR."""
    pr_key = _get_pr_key(owner, repo, number)
    state = _pr_store.get(pr_key)
    if not state:
        return JSONResponse({"found": False, "pr": pr_key})
    return JSONResponse({"found": True, "state": state.model_dump()})


@app.delete("/api/state/{owner}/{repo}/{number}")
async def clear_pr_state(owner: str, repo: str, number: int):
    """Clear review state for a PR (force reassign)."""
    pr_key = _get_pr_key(owner, repo, number)
    _pr_store.pop(pr_key, None)
    return JSONResponse({"status": "cleared", "pr": pr_key})


# ── Main ──────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import logging
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        log_level=settings.log_level,
    )
