# Anti-Pattern Detection Hooks

Six hooks that detect and prevent common code anti-patterns. Each runs on `PreToolUse:Write/Edit` events and provides actionable fix suggestions.

## Hook Summary

| Hook | Pattern Detected | Severity | Languages |
|------|-----------------|----------|-----------|
| suppress-custom-retry.sh | Custom retry loops when tenacity available | WARNING | Python |
| suppress-v2-files.sh | `_v2`, `_new`, `_old` file naming | ERROR | All |
| suppress-hardcoded-strings.sh | Hardcoded provider/model/URL strings | WARNING | Python, TS, Go |
| suppress-print-statements.sh | print()/console.log when structured logger available | WARNING | Python, TS, Go |
| suppress-isolated-classes.sh | God classes (>15 methods or >300 lines) | WARNING | Python, TS |
| suppress-direct-http.sh | Direct HTTP calls without client abstraction | WARNING | Python, TS, Go |

## Parpour-Specific Anti-Patterns

### Don't add specs to venture/ subdirectory — specs live at parpour root

**Pattern**: Adding specification files inside `venture/` or other subdirectories.

**Why blocked**: Specs are canonical at the parpour root level. Subdirectories like `venture/` are for implementation, not specification.

**Fix**:
```bash
# Wrong
venture/TECHNICAL_SPEC.md
venture/TRACK_A.md

# Correct
TECHNICAL_SPEC.md
TRACK_A.md
TRACK_B.md
```

---

### Don't create SaaS-dependent artifact flows — use headless compiler IR

**Pattern**: Building artifact generation flows that depend on external SaaS services (e.g., OpenAI API, hosted databases).

**Why blocked**: Parpour must be runnable standalone. All artifact generation should use the headless compiler IR and local processing.

**Fix**:
```python
# Wrong — depends on external API
def generate_civ_spec():
    response = openai.ChatCompletion.create(model="gpt-4", messages=...)
    return response.choices[0].text

# Correct — uses headless IR
from parpour.compiler import HeadlessCompiler
def generate_civ_spec():
    compiler = HeadlessCompiler()
    ir = compiler.parse_config(config)
    return compiler.generate_artifact(ir, 'spec')
```

---

### Don't add fallbacks or silent failure paths

**Pattern**: Adding `try/except` blocks that hide errors, or feature flags that silently degrade functionality.

**Why blocked**: Following global CLAUDE instructions — code should fail fast and fail loudly.

**Fix**:
```python
# Wrong — silent fallback
try:
    spec = load_spec(path)
except Exception:
    spec = default_spec  # Hidden failure

# Correct — fail loudly
spec = load_spec(path)  # Raises if not found
```

---

## Hook Details

### suppress-custom-retry.sh

**What it detects**: Hand-rolled retry/backoff loops in Python when `tenacity` is declared in project dependencies.

**Patterns caught**:
- `for attempt in range(N)` with `sleep` + `try/except`
- `while True` retry loops with attempt counters
- Manual exponential backoff (`2 ** attempt`)

**Fix**:
```python
# Before (anti-pattern)
for attempt in range(5):
    try:
        result = httpx.get(url)
        break
    except Exception:
        time.sleep(2 ** attempt)

# After (correct)
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(5), wait=wait_exponential())
def fetch(url: str) -> httpx.Response:
    return httpx.get(url, timeout=10)
```

---

### suppress-v2-files.sh

**What it detects**: Files with `_v2`, `_new`, `_old`, `_backup`, `_copy`, `_temp` suffixes.

**Why blocked (ERROR)**: v2 files lead to:
- Import confusion (which version to use?)
- Stale code copies that diverge
- No clear migration path

**Fix options**:
1. Modify the original file directly
2. Use feature flags for behavioral changes
3. Use interface versioning (APIv2 endpoint, not handler_v2.py)
4. If migrating, rename the original and update all imports in one commit

---

### suppress-hardcoded-strings.sh

**What it detects**: Hardcoded provider names, model identifiers, and API URLs in source code.

**Patterns caught**:
- LLM model names: `"gpt-4"`, `"claude-3"`, `"gemini-1.5"`
- API URLs: `"https://api.openai.com/..."`
- Provider identifiers: `"aws"`, `"openai"`, `"anthropic"` as string literals

**Excludes**: Test files, imports, comments.

**Fix**:
```python
# Before
response = client.chat("gpt-4", messages)

# After
from config import settings
response = client.chat(settings.default_model, messages)
```

---

### suppress-print-statements.sh

**What it detects**: Unstructured logging (print, console.log, fmt.Println) when a structured logging library is in project dependencies.

**Dependency triggers**:
- Python: `structlog` in deps -> blocks `print()` and `logging.getLogger()`
- TypeScript: `pino`/`winston` in deps -> blocks `console.log()`
- Go: `zerolog`/`zap` in deps -> blocks `fmt.Println()`

**Fix**:
```python
# Before
print(f"Processing user {user_id}")

# After
import structlog
log = structlog.get_logger()
log.info("processing_user", user_id=user_id)
```

---

### suppress-isolated-classes.sh

**What it detects**: Classes that are too large ("God classes").

**Thresholds**:
- More than 15 methods
- More than 300 lines

**Fix**:
1. **SRP decomposition**: Extract cohesive method groups into separate classes
2. **Composition**: Break into composed components instead of one monolith
3. **Strategy pattern**: Extract behavioral variations into strategy classes
4. **DTO extraction**: Move data-only methods into separate dataclasses

---

### suppress-direct-http.sh

**What it detects**: Direct HTTP client calls (requests.get, fetch(), http.Get) in business logic.

**Why**: Direct calls scatter URL construction, authentication, retry logic, timeout handling, and error mapping across the codebase.

**Excludes**: Files in `clients/`, `adapters/`, `infrastructure/`, `transport/` directories. Files named `*client*`, `*http*`, `*fetcher*`.

**Fix**:
```python
# Before (scattered in business logic)
response = requests.get(f"{BASE_URL}/users/{user_id}", headers=auth_headers)

# After (centralized client)
class UserClient:
    def __init__(self, base_url: str, auth: Auth):
        self.client = httpx.AsyncClient(base_url=base_url, auth=auth)

    async def get_user(self, user_id: str) -> User:
        response = await self.client.get(f"/users/{user_id}")
        response.raise_for_status()
        return User.model_validate(response.json())
```

## Integration

### Claude Code Hooks (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          "hooks/suppress-custom-retry.sh $FILE_PATH",
          "hooks/suppress-v2-files.sh $FILE_PATH",
          "hooks/suppress-hardcoded-strings.sh $FILE_PATH",
          "hooks/suppress-print-statements.sh $FILE_PATH",
          "hooks/suppress-isolated-classes.sh $FILE_PATH",
          "hooks/suppress-direct-http.sh $FILE_PATH"
        ]
      }
    ]
  }
}
```

### Pre-commit (local hooks)

```yaml
- repo: local
  hooks:
    - id: no-v2-files
      name: Block v2/new/old file creation
      entry: hooks/suppress-v2-files.sh
      language: script
      stages: [pre-commit]
```

## Testing Hooks

Each hook can be tested standalone:

```bash
# Test v2 file detection (should print error and exit 1)
echo "test" > /tmp/handler_v2.py
./hooks/suppress-v2-files.sh /tmp/handler_v2.py
echo "Exit code: $?"

# Test custom retry detection (should print warning)
cat > /tmp/retry_test.py << 'EOF'
for attempt in range(5):
    try:
        result = httpx.get(url)
        break
    except Exception:
        time.sleep(2 ** attempt)
EOF
./hooks/suppress-custom-retry.sh /tmp/retry_test.py
```
