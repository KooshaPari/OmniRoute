# ADR-002: Pydantic v2 for Data Validation and Modeling

## Status

**Accepted** - 2026-04-04

## Context

PhenoSDK requires robust data validation across multiple domains:
- OAuth token responses (varying provider schemas)
- Credential data (sensitive, structured)
- MCP protocol messages (JSON-RPC with specific schema)
- Configuration objects (hierarchical, typed)

Data validation options in Python:
1. **Dataclasses**: Standard library, no validation
2. **Pydantic v1**: Mature, well-known, slower performance
3. **Pydantic v2**: Rewritten in Rust, 5-50x faster, new API
4. **attrs + validators**: Flexible, requires more boilerplate
5. **Marshmallow**: Serialization-focused, slower
6. **Cerberus**: Schema validation, not type-focused

## Decision

We will use **Pydantic v2** for all data modeling and validation in PhenoSDK, requiring Python 3.11+ for optimal performance.

### Rationale

1. **Performance**: Pydantic v2 is 5-50x faster than v1 due to Rust core
2. **Type Safety**: Native integration with Python type hints
3. **Serialization**: Built-in JSON serialization/deserialization
4. **Ecosystem**: FastAPI, FastMCP, and modern tools use Pydantic v2
5. **Validation**: Rich validation with custom validators

### Implementation Details

#### Core Model Pattern

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
from enum import Enum

class ScopeLevel(str, Enum):
    """Hierarchical scope levels."""
    GLOBAL = "global"
    GROUP = "group"
    ORG = "org"
    PROGRAM = "program"
    PORTFOLIO = "portfolio"
    PROJECT = "project"

class CredentialScope(BaseModel):
    """Validated credential scope model."""
    
    level: ScopeLevel
    id: Optional[str] = Field(None, pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    parent: Optional["CredentialScope"] = None
    
    @field_validator("id")
    @classmethod
    def validate_id_for_level(cls, v: Optional[str], info) -> Optional[str]:
        """Validate ID requirements based on scope level."""
        level = info.data.get("level")
        if level != ScopeLevel.GLOBAL and not v:
            raise ValueError(f"ID required for {level} scope")
        return v
    
    @property
    def path(self) -> str:
        """Generate scoped path string."""
        if self.parent:
            return f"{self.parent.path}/{self.level.value}/{self.id}"
        return f"/{self.level.value}/{self.id or ''}"

class OAuthToken(BaseModel):
    """OAuth token response model."""
    
    access_token: str = Field(..., min_length=32)
    token_type: Literal["Bearer"] = "Bearer"
    expires_in: int = Field(..., gt=0, le=86400 * 365)
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        from datetime import timedelta
        expiry = self.created_at + timedelta(seconds=self.expires_in)
        return datetime.utcnow() > expiry

class MCPToolCall(BaseModel):
    """MCP tool invocation model."""
    
    jsonrpc: Literal["2.0"] = "2.0"
    id: int = Field(..., gt=0)
    method: str = Field(..., pattern=r"^[a-zA-Z_][a-zA-Z0-9_/]*$")
    params: dict = Field(default_factory=dict)
```

#### Strict Mode Configuration

```python
from pydantic import ConfigDict

class StrictBaseModel(BaseModel):
    """Base model with strict validation."""
    
    model_config = ConfigDict(
        # Reject extra fields
        extra="forbid",
        # Require all fields
        populate_by_name=True,
        # Validate assignments
        validate_assignment=True,
        # Strict type checking
        strict=True,
        # Frozen for immutability (when needed)
        frozen=False,
    )

class ImmutableCredential(StrictBaseModel):
    """Immutable credential data."""
    
    model_config = ConfigDict(frozen=True)
    
    key: str
    value: bytes
    created_at: datetime
```

#### Validation Patterns

```python
from pydantic import validator, ValidationError
import re

class GitHubOAuthConfig(BaseModel):
    """GitHub OAuth configuration."""
    
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: list[str] = Field(default_factory=list)
    
    @field_validator("client_id")
    @classmethod
    def validate_github_client_id(cls, v: str) -> str:
        """GitHub client IDs are 20-char hex strings."""
        if not re.match(r"^[a-f0-9]{20}$", v):
            raise ValueError("Invalid GitHub client ID format")
        return v
    
    @field_validator("redirect_uri")
    @classmethod
    def validate_redirect_uri(cls, v: str) -> str:
        """Validate OAuth redirect URI."""
        if not v.startswith(("https://", "http://localhost")):
            raise ValueError("Redirect URI must use HTTPS or localhost")
        return v
    
    @field_validator("scopes")
    @classmethod
    def validate_scopes(cls, v: list[str]) -> list[str]:
        """Validate GitHub OAuth scopes."""
        valid_scopes = {
            "repo", "repo:status", "repo_deployment", "public_repo",
            "repo:invite", "security_events", "admin:repo_hook",
            "write:repo_hook", "read:repo_hook", "admin:org",
            "write:org", "read:org", "admin:public_key",
            "write:public_key", "read:public_key", "admin:org_hook",
            "gist", "notifications", "user", "read:user",
            "user:email", "user:follow", "delete_repo",
            "write:discussion", "read:discussion", "admin:enterprise",
            "manage_runners:enterprise", "billing:read", "audit_log:read"
        }
        invalid = set(v) - valid_scopes
        if invalid:
            raise ValueError(f"Invalid scopes: {invalid}")
        return v
```

### Serialization Patterns

```python
from pydantic import BaseModel
from typing import Any

class CredentialData(BaseModel):
    """Credential with encrypted serialization."""
    
    key: str
    value: str  # Encrypted at rest
    metadata: dict[str, Any]
    
    def model_dump_encrypted(self) -> dict:
        """Serialize with encryption."""
        return {
            "key": self.key,
            "value": encrypt(self.value),
            "metadata": self.metadata,
        }
    
    @classmethod
    def model_validate_encrypted(cls, data: dict) -> "CredentialData":
        """Deserialize with decryption."""
        return cls(
            key=data["key"],
            value=decrypt(data["value"]),
            metadata=data["metadata"],
        )
```

### Consequences

#### Positive

- **Performance**: 5-50x faster validation than Pydantic v1
- **Type Safety**: Full mypy/pyright compatibility
- **Developer Experience**: Excellent error messages
- **Ecosystem**: Native FastAPI/FastMCP integration
- **Validation**: Rich built-in and custom validators
- **Serialization**: Fast JSON encoding/decoding

#### Negative

- **Python Version**: Requires Python 3.11+ for best performance
- **Migration**: Breaking changes from Pydantic v1
- **Binary Dependencies**: Rust core requires platform wheels
- **Learning Curve**: New validation API differs from v1

### Mitigations

1. **Version Pinning**: Pin `pydantic>=2.0,<3.0` in dependencies
2. **Migration Guide**: Document v1 to v2 patterns
3. **CI Testing**: Test on all target platforms for wheel compatibility
4. **Documentation**: Comprehensive model examples

## Alternatives Considered

### Alternative 1: Pydantic v1

**Pros:**
- Mature, widely used
- Python 3.8+ support
- Familiar API

**Cons:**
- 5-50x slower than v2
- Slower JSON serialization
- Legacy maintenance mode

**Verdict:** Rejected due to performance requirements

### Alternative 2: Dataclasses + Manual Validation

**Pros:**
- Standard library only
- No dependencies
- Full control

**Cons:**
- Boilerplate-heavy
- Inconsistent validation patterns
- No serialization helpers
- Manual type checking

**Verdict:** Rejected due to maintenance burden

### Alternative 3: attrs

**Pros:**
- Flexible
- Good performance
- Mature ecosystem

**Cons:**
- Requires additional validation libraries
- More verbose than Pydantic
- Less ecosystem integration

**Verdict:** Rejected for ecosystem and brevity reasons

## Related Decisions

- ADR-001: Async-First Architecture
- ADR-003: Hierarchical Credential Scoping

## References

- [Pydantic v2 Documentation](https://docs.pydantic.dev/latest/)
- [Pydantic v2 Migration Guide](https://docs.pydantic.dev/latest/migration/)
- [Pydantic Performance](https://docs.pydantic.dev/latest/concepts/performance/)
- [FastAPI with Pydantic v2](https://fastapi.tiangolo.com/release-notes/)
