# ADR-001: Async-First Architecture for PhenoSDK

## Status

**Accepted** - 2026-04-04

## Context

PhenoSDK requires high-performance I/O operations across multiple domains:
- Credential storage/retrieval from OS keyring and encrypted files
- OAuth token exchanges with external providers
- MCP protocol communication with AI tools
- Concurrent access patterns from multiple scopes

Python offers multiple concurrency models:
1. **Synchronous with threading**: Simple but GIL-limited, prone to blocking
2. **Synchronous with multiprocessing**: High overhead, complex state sharing
3. **Async/await**: Cooperative multitasking, efficient I/O handling
4. **Hybrid sync/async**: Supports both patterns with complexity tradeoffs

## Decision

We will implement PhenoSDK with an **async-first architecture** using Python's `asyncio` and `async`/`await` syntax throughout the entire SDK.

### Rationale

1. **I/O Efficiency**: The SDK is I/O-bound (network requests, file operations, keyring access), making async the optimal choice
2. **Concurrent Operations**: MCP testing requires managing hundreds of concurrent connections efficiently
3. **Modern Python Ecosystem**: FastAPI, httpx, and other modern libraries are async-native
4. **Scalability**: Async enables handling 1000+ concurrent MCP clients without thread overhead

### Implementation Details

#### Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PhenoSDK Client API                        │
│                 (Async Context Managers)                     │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                              │
│              (Async Methods, Structured Concurrency)          │
├─────────────────────────────────────────────────────────────┤
│                    Adapter Layer                              │
│           (Async HTTP, Async Keyring, Async I/O)            │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure                             │
│              (httpx, aiofiles, async keyring)               │
└─────────────────────────────────────────────────────────────┘
```

#### Code Pattern

```python
import asyncio
from typing import Optional
import httpx
from contextlib import asynccontextmanager

class PhenoSDKClient:
    """Async-first SDK client."""
    
    def __init__(self):
        self._http_client: Optional[httpx.AsyncClient] = None
        self._credential_manager: Optional[CredentialManager] = None
    
    async def __aenter__(self):
        self._http_client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=100)
        )
        self._credential_manager = CredentialManager()
        await self._credential_manager.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc, tb):
        if self._http_client:
            await self._http_client.aclose()
        if self._credential_manager:
            await self._credential_manager.close()
    
    async def get_credentials(self, scope: str) -> dict:
        """Async credential retrieval."""
        return await self._credential_manager.get(scope)
    
    async def exchange_oauth_token(
        self, 
        provider: str, 
        code: str
    ) -> OAuthToken:
        """Async OAuth token exchange."""
        response = await self._http_client.post(
            f"https://{provider}.com/oauth/token",
            data={"code": code, "grant_type": "authorization_code"}
        )
        return OAuthToken.model_validate(response.json())
```

#### Structured Concurrency

Using `asyncio.TaskGroup` (Python 3.11+) for structured concurrency:

```python
async def test_multiple_clients():
    """Structured concurrent client testing."""
    async with asyncio.TaskGroup() as tg:
        tasks = [
            tg.create_task(run_client_test(i))
            for i in range(100)
        ]
    # All tasks complete here (success or exception)
    results = [t.result() for t in tasks]
```

### Consequences

#### Positive

- **High Concurrency**: Can handle 1000+ concurrent MCP connections
- **Resource Efficiency**: Minimal memory overhead per connection
- **Performance**: Non-blocking I/O throughout the stack
- **Modern Ecosystem**: Native integration with FastAPI, FastMCP, httpx
- **Cancelability**: Operations can be cancelled cleanly

#### Negative

- **Learning Curve**: Developers must understand async/await patterns
- **Debugging Complexity**: Async stack traces can be harder to read
- **Library Constraints**: Must use async-compatible libraries
- **Sync Bridge Overhead**: Calling from sync code requires `asyncio.run()`

### Mitigations

1. **Documentation**: Comprehensive async programming guide
2. **Sync Wrapper**: Optional sync API layer for simple use cases
3. **Debugging Tools**: Integration with aiomonitor for runtime inspection
4. **Testing**: Async-native test fixtures with pytest-asyncio

## Alternatives Considered

### Alternative 1: Synchronous with Threading

**Pros:**
- Simpler mental model
- Works with any library

**Cons:**
- GIL limits true parallelism
- Thread overhead for I/O operations
- Complex synchronization for shared state
- Poor scalability for MCP testing

**Verdict:** Rejected due to scalability limitations

### Alternative 2: Hybrid Sync/Async

**Pros:**
- Supports both patterns
- Flexibility for different use cases

**Cons:**
- Code duplication or complexity
- Harder to maintain
- API surface confusion

**Verdict:** Rejected to maintain API clarity

### Alternative 3: Multiprocessing

**Pros:**
- True parallelism for CPU-bound work
- Process isolation

**Cons:**
- High memory overhead
- Complex IPC
- Not suitable for I/O-bound SDK

**Verdict:** Rejected for I/O-bound use case

## Related Decisions

- ADR-002: Pydantic v2 for Data Modeling
- ADR-003: Hierarchical Credential Scoping

## References

- [Python asyncio documentation](https://docs.python.org/3/library/asyncio.html)
- [AnyIO - Async compatibility layer](https://anyio.readthedocs.io/)
- [Structured concurrency with asyncio](https://textual.textualize.io/blog/2023/03/15/structured-concurrency/)
- [Async Python at Anthropic](https://www.anthropic.com/research/async-python)
