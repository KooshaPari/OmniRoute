# ADR-005: JWT Authentication for API

**Status:** Proposed  
**Date:** 2026-02-23

## Context

PARPOUR exposes a REST API for workflow management and policy control. This API needs authentication to prevent unauthorized access.

## Decision

We will implement JWT-based authentication with the following characteristics:

```python
from fastapi.security import HTTPBearer
import jose.jwt as jwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", ...)
ALGORITHM = "HS256"

def verify_token(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    return payload
```

### Security Features
- Token expiration (30 minutes default)
- Dev mode fallback for local development
- Bearer token in Authorization header

## Consequences

### Positive
- Stateless authentication (no session storage)
- Works well with microservices
- Standard industry approach
- FastAPI has built-in support

### Negative
- Token must be stored client-side securely
- No built-in token revocation
- Need to handle token refresh

### Neutral
- Consider adding OAuth2 for third-party integrations later
- Rate limiting should complement auth

## Alternatives Considered

| Alternative | Pros | Cons |
|------------|------|------|
| Session cookies | Simple for browser | Not API-friendly |
| API keys | Simple | No expiration, less flexible |
| OAuth2/OIDC | Industry standard | More complex setup |
| mTLS | Very secure | Infrastructure overhead |
