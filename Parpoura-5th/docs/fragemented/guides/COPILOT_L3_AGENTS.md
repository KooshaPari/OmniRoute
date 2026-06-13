# L3 Copilot Agents: Complete Guide

**Date:** 2026-02-21
**Status:** ACTIVE
**Purpose:** Comprehensive guide to dispatching, monitoring, and managing L3 copilot agents for Venture platform

---

## Quick Start

### Standard Dispatch Pattern

```bash
copilot -p "$(cat <<'PROMPT'
Task: FR-XXX-YYY — Brief description

Test first: tests/test_module.py
- Acceptance criterion 1
- Acceptance criterion 2
- Acceptance criterion 3

Implement: src/module/file.py

Must pass:
  uv run pytest tests/test_module.py -v
  uv run ruff check src/module/file.py

Commit: "feat(module): FR-XXX-YYY short description"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

**Key Points:**
- Task must be **specific** and **measurable**
- Always write **test first**
- Include **acceptance criteria**
- Specify **files to implement**
- Include **validation commands**
- Commit message format: `feat(module): FR-XXX description`
- Always deny `git push`
- Run in **background** with `&` for parallel dispatch

---

## Task Structure (Template)

```
Task: {FR-ID} — {Short title}

Test first: {test_file_path}
- {Acceptance criterion 1}
- {Acceptance criterion 2}
- {Acceptance criterion 3}

Implement: {source_file_paths}

Must pass:
  {validation_command_1}
  {validation_command_2}

Commit: "{commit_message}"

Do not: {forbidden_actions}
```

### Example: Policy Engine
```
Task: FR-CP-001 — Policy engine with bundle versioning

Test first: tests/test_policy_engine.py
- Policy bundle CRUD works (create, read, update, delete)
- Schema snapshot stored on creation
- Every decision includes policy_bundle_id and reason_code
- Policy replay: evaluate old decision with old bundle produces same result

Implement: src/control_plane/policy_engine.py

Must pass:
  uv run pytest tests/test_policy_engine.py -v
  uv run ruff check src/control_plane/policy_engine.py

Commit: "feat(control-plane): FR-CP-001 Policy engine and bundle versioning"

Do not: push, modify other modules, add new suppressions
```

---

## Full Dispatch Command Examples

### 1. Simple Single Task

```bash
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema

Test first: tests/test_db_migrations.py
- Artifact IR table created with correct columns
- Ledger table created with correct columns
- Migrations run idempotently (twice = same state)
- Rollback works: upgrade → downgrade → upgrade = same state

Implement: alembic/versions/ and src/infra/db.py

Must pass:
  uv run pytest tests/test_db_migrations.py -v
  uv run alembic upgrade head
  uv run alembic downgrade base
  uv run alembic upgrade head
  uv run ruff check src/infra/db.py

Commit: "feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### 2. Batch Dispatch (3 Parallel Agents)

```bash
#!/bin/bash
# sprint-m0-agents.sh

REPO="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"

# Agent 1
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — PostgreSQL schema...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 2
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — NATS JetStream...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

# Agent 3
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 — Schema registry...
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &

wait
echo "All agents dispatched. Review commits:"
echo "  git log --oneline -10"
```

### 3. Research Task (Read-Only)

```bash
copilot -p "$(cat <<'PROMPT'
Task: Research — Understand TRACK_A_ARTIFACT_DETERMINISM_SPEC

Read: /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour/TRACK_A_ARTIFACT_DETERMINISM_SPEC.md

Summarize:
1. What are the 5 IR types?
2. What is the deterministic build/replay contract?
3. What is the idempotency key?

Output: Plain text summary (no code)
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

---

## Monitoring L3 Agents

### Real-Time Commit Watching

```bash
# Watch for commits every 5 seconds
watch -n 5 'git log --oneline | head -20'

# Or use a loop in background:
while true; do
  clear
  date
  git log --oneline | head -10
  sleep 10
done
```

### Check Agent Status

```bash
# List copilot sessions
ls -la ~/.copilot/sessions/

# Check most recent session
cat ~/.copilot/sessions/$(ls -t ~/.copilot/sessions | head -1)/status.json

# Or use copilot CLI (if available)
copilot status
```

### Verify Commits

```bash
# See all new commits
git log --oneline origin/main..HEAD

# Review specific commit
git show <commit-hash>

# See changes in a module
git diff origin/main..HEAD -- src/control_plane/
```

### Test Progress

```bash
# Run tests for a specific module
uv run pytest tests/test_policy_engine.py -v

# Check coverage
uv run pytest tests/test_policy_engine.py --cov=src/control_plane/policy_engine

# Run all tests
uv run pytest tests/ -v --tb=short
```

---

## Task Success Scenarios

### Scenario 1: Agent Completes Successfully
```
1. Commit arrives in git log
2. User reviews: git show <hash>
3. User checks tests: uv run pytest tests/test_module.py -v
4. All green → ready to merge
```

### Scenario 2: Agent Gets Stuck (Infinite Loop)
```
1. Agent makes no progress for 15+ minutes
2. Check session: cat ~/.copilot/sessions/*/status.json
3. Kill agent: pkill copilot (or equivalent)
4. Re-dispatch with --resume flag:
   copilot -p "Task: FR-XXX..." --yolo --resume
```

### Scenario 3: Test Failure
```
1. Commit arrives but tests fail
2. User reviews test output: git show <hash>
3. User can:
   a. Re-dispatch agent with error context:
      copilot -p "$(cat <<'PROMPT'
      Task: FR-XXX — description
      Previous attempt failed with: [error message]
      ...
      PROMPT
      )" --yolo --model gpt-5-mini ...
   b. Or fix manually and commit
```

### Scenario 4: Dependency Not Met
```
1. Agent tries to implement FR-CP-002 (tool allowlist)
2. But FR-CP-001 (policy engine) not yet merged
3. Agent should detect and note in commit message or ask
4. User can:
   a. Merge dependency first, re-dispatch agent
   b. Or ask agent to implement with interface stub
```

---

## Permission Sets by Task Type

### Type 1: Test-First Implementation
**Permission Set:**
```bash
--allow-tool 'write'           # Create/edit files
--allow-tool 'shell(uv:*)'     # Run pytest, ruff, etc.
--allow-tool 'shell(git:*)'    # Commit, check status
--deny-tool 'shell(git push)'  # Never push
```

**Used For:** All FRs that require code implementation

**Example:**
```bash
copilot -p "Task: FR-CP-001 — Policy engine..." --yolo \
  --add-dir $REPO \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### Type 2: Database/Schema Tasks
**Permission Set:**
```bash
--allow-tool 'write'              # Edit migration files
--allow-tool 'shell(uv:*)'        # Run pytest, alembic
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(psql:*)'      # Query database (optional)
--deny-tool 'shell(git push)'
```

**Used For:** Database migrations, schema changes

### Type 3: Infrastructure Setup
**Permission Set:**
```bash
--allow-tool 'write'              # Edit config files
--allow-tool 'shell(uv:*)'        # Run pytest, checks
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(docker:*)'    # If Docker needed
--deny-tool 'shell(git push)'
```

**Used For:** process-compose setup, containerization

### Type 4: Research (Read-Only)
**Permission Set:**
```bash
--allow-tool 'shell(git:*)'       # Read git history
--allow-tool 'shell(find:*)'      # Search files
--deny-tool 'write'
--deny-tool 'shell(curl:*)'       # No external requests
```

**Used For:** Understanding specs, analyzing code

### Type 5: Load Testing
**Permission Set:**
```bash
--allow-tool 'write'              # Create test harness
--allow-tool 'shell(uv:*)'        # Run tests
--allow-tool 'shell(git:*)'       # Commit
--allow-tool 'shell(ps:*)'        # Monitor processes
--deny-tool 'shell(kill:*)'       # Never kill processes
--deny-tool 'shell(git push)'
```

**Used For:** Performance testing, stress testing

---

## Troubleshooting L3 Agents

### Problem: Agent Produces Code with Suppressions

**Symptom:** Commit includes `# noqa` or `# pragma: no cover`

**Fix:**
1. Reject commit (don't merge)
2. Re-dispatch with instruction:
   ```
   Previous code had suppressions. Do not add suppression comments.
   Instead, fix the underlying issue so code passes linting.
   If suppression necessary, include inline justification:
   # noqa: E501 -- long line is unavoidable for this SQL query
   ```

### Problem: Agent Modifies Wrong Module

**Symptom:** Commit touches `src/treasury/` when task was for `src/control_plane/`

**Fix:**
1. Check if change is justified (e.g., necessary cross-module integration)
2. If not: revert commit; re-dispatch with stricter constraints
   ```
   --add-dir $REPO
   --allow-tool 'write'  # but will implicitly block files outside task scope
   ```

### Problem: Agent Doesn't Write Tests

**Symptom:** Commit has implementation but no test file

**Fix:**
1. Re-dispatch:
   ```
   Task: FR-XXX — [same task]

   Previous attempt missing tests. You must:
   1. First write failing test in tests/test_module.py
   2. Then implement in src/module.py
   3. Ensure test passes

   Must pass:
     pytest tests/test_module.py -v
   ```

### Problem: Agent Commit Message Malformed

**Symptom:** Commit message is `wip`, `fix`, or doesn't follow `feat(module): FR-XXX`

**Fix:**
1. Amend locally (or ask agent to re-commit):
   ```bash
   git commit --amend -m "feat(module): FR-XXX-YYY short description"
   ```
2. Or re-dispatch with clearer instruction:
   ```
   Commit message format MUST be:
   feat(module): FR-XXX-YYY short description

   Where:
   - module = the folder under src/ (e.g., "control-plane", "treasury")
   - FR-XXX-YYY = the FR ID (e.g., "FR-CP-001")
   - Short description = 1-line summary
   ```

### Problem: Agent Runs Out of Time

**Symptom:** Copilot process times out; incomplete work

**Fix:**
1. Check if intermediate commits exist: `git log --oneline | head -10`
2. If partial work: re-dispatch with `--resume` flag
3. Or simplify task scope:
   ```
   Task: FR-XXX — [PART 2] Continue from previous attempt

   Previous attempt timed out. Please complete:
   - [List remaining work items]

   You may skip: [Items already done]
   ```

---

## Batch Dispatch Scripts

### M0 Foundation Sprint Script

```bash
#!/bin/bash
# scripts/dispatch-m0.sh

set -e

REPO="/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour"
WTV="venture-wt-m0-foundation"

# Ensure worktree exists
if [ ! -d "../$WTV" ]; then
  cd ..
  git worktree add "$WTV" main
  cd "$WTV"
else
  cd "../$WTV"
fi

echo "Dispatching M0 agents to worktree: $WTV"

# Agent 1: PostgreSQL
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-001 — Initialize PostgreSQL schema via Alembic

Test first: tests/test_db_migrations.py
- Table artifact_ir exists with all required columns
- Table ledger exists with all required columns
- Table audit_log exists with all required columns
- Table policy_bundles exists with all required columns
- Migrations run idempotently
- Rollback and upgrade both work

Implement: alembic/versions/ and src/infra/db.py

Must pass:
  uv run pytest tests/test_db_migrations.py -v
  uv run alembic upgrade head
  uv run alembic downgrade base
  uv run alembic upgrade head
  uv run ruff check src/infra/db.py

Commit: "feat(infra): FR-INFRA-001 PostgreSQL schema via Alembic"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID1=$!

# Agent 2: NATS
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-002 — Stand up NATS JetStream streams

Test first: tests/test_nats_streams.py
- events.* stream created with replication 3
- tasks.* stream created with replication 3
- Publish-subscribe round-trip works
- Durable subscriptions persist across restart
- Stream configuration persisted

Implement: src/infra/nats_setup.py

Must pass:
  uv run pytest tests/test_nats_streams.py -v
  uv run ruff check src/infra/nats_setup.py

Commit: "feat(infra): FR-INFRA-002 NATS JetStream setup"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID2=$!

# Agent 3: Schema Registry
copilot -p "$(cat <<'PROMPT'
Task: FR-INFRA-003 + FR-INFRA-005 — Redis cache and schema registry

Test first: tests/test_redis.py tests/test_schema_registry.py
- Redis SET/GET round-trip works
- Token bucket rate limiter works
- EventEnvelopeV1 schema validates correctly
- Invalid events rejected
- Schema versioning works
- Schema caching works

Implement: src/infra/redis.py and src/infra/schema_registry.py

Must pass:
  uv run pytest tests/test_redis.py tests/test_schema_registry.py -v
  uv run ruff check src/infra/redis.py src/infra/schema_registry.py

Commit: "feat(infra): FR-INFRA-003 FR-INFRA-005 Redis and schema registry"

Do not: push, modify other modules, add new suppressions
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
PID3=$!

echo "Waiting for agents to complete..."
wait $PID1 $PID2 $PID3

echo ""
echo "All agents completed. Review commits:"
git log --oneline | head -10
echo ""
echo "To merge: git switch main && git merge $WTV"
```

### Sprint Completion Checklist

```bash
#!/bin/bash
# scripts/sprint-checklist.sh

SPRINT=$1  # e.g., m0, m1, m2

if [ -z "$SPRINT" ]; then
  echo "Usage: sprint-checklist.sh {sprint_name}"
  exit 1
fi

echo "=== Sprint $SPRINT Checklist ==="

# Check tests
echo ""
echo "1. Running tests..."
if uv run pytest tests/ -v --tb=short 2>&1 | grep -q "FAILED"; then
  echo "   ❌ Some tests failed"
else
  echo "   ✓ All tests pass"
fi

# Check coverage
echo ""
echo "2. Checking coverage..."
COVERAGE=$(uv run pytest --cov=src --cov-report=term-missing | grep "TOTAL" | awk '{print $NF}')
echo "   Coverage: $COVERAGE"
if [[ ${COVERAGE%\%} -ge 80 ]]; then
  echo "   ✓ Coverage ≥80%"
else
  echo "   ❌ Coverage <80%"
fi

# Check linting
echo ""
echo "3. Running linter..."
if uv run ruff check src/ 2>&1 | grep -q "error"; then
  echo "   ❌ Linting errors"
else
  echo "   ✓ Linting passes"
fi

# Check suppressions
echo ""
echo "4. Checking for suppressions..."
SUPPR=$(grep -r "# noqa\|# pragma\|# type: ignore" src/ | wc -l)
if [ "$SUPPR" -eq 0 ]; then
  echo "   ✓ No suppressions"
else
  echo "   ❌ Found $SUPPR suppressions"
fi

# Check commits
echo ""
echo "5. Verifying commit format..."
git log --oneline -20 | while read line; do
  if [[ $line =~ ^[a-f0-9]\ (feat|fix|test|docs)\([a-z-]+\):\ (FR-|fix|test) ]]; then
    echo "   ✓ $line"
  else
    echo "   ❌ $line (format issue)"
  fi
done

echo ""
echo "=== Checklist Complete ==="
```

---

## Session Continuation (--resume)

If an agent gets stuck or times out:

```bash
# Re-dispatch with continuation context
copilot -p "$(cat <<'PROMPT'
Task: FR-XXX — [CONTINUED] Description

You were working on this task before but did not complete.

Progress so far:
- [Describe what was done]

Still needs:
- [Describe what remains]

You may skip: [What doesn't need to be done again]

Test first: tests/test_module.py
- [Remaining acceptance criteria]

Implement: src/module.py

Must pass:
  [validation commands]

Commit: "feat(module): FR-XXX description"
PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir "$REPO" \
  --resume \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

---

## Best Practices

### 1. Clarity in Task Definition
- **Good:** "Implement policy engine with bundle versioning; policy bundles stored with schema snapshots; every decision includes policy_bundle_id"
- **Bad:** "Implement policy stuff"

### 2. Explicit Acceptance Tests
- **Good:** Include concrete criteria (table exists, field present, comparison passes)
- **Bad:** "Make sure it works"

### 3. Validate Commands
- **Good:** `uv run pytest tests/test_module.py -v && uv run ruff check src/module.py`
- **Bad:** `uv run pytest`

### 4. Parallel Dispatch
- **Good:** Dispatch 3 agents simultaneously with `&` and `wait`
- **Bad:** Sequential dispatch (wastes wall-clock time)

### 5. No Suppressions
- **Good:** Fix code so it passes linting cleanly
- **Bad:** Add `# noqa` to silence warnings

### 6. Atomic Commits
- **Good:** One commit per task; all tests pass; single module modified
- **Bad:** Multiple unrelated changes in one commit

---

## Appendix: Command Reference

### Create Worktree
```bash
git worktree add ../venture-wt-m{N}-{name} main
cd ../venture-wt-m{N}-{name}
```

### Dispatch Agent
```bash
copilot -p "$(cat <<'PROMPT' ... PROMPT
)" --yolo --model gpt-5-mini \
  --add-dir {repo_path} \
  --allow-tool 'write' \
  --allow-tool 'shell(uv:*)' \
  --allow-tool 'shell(git:*)' \
  --deny-tool 'shell(git push)' &
```

### Monitor Progress
```bash
watch -n 5 'git log --oneline | head -20'
```

### Review Commit
```bash
git show {commit-hash}
```

### Run Tests
```bash
uv run pytest tests/test_{module}.py -v
```

### Check Coverage
```bash
uv run pytest --cov=src --cov-report=term-missing
```

### Merge Worktree
```bash
git switch main
git merge venture-wt-m{N}-{name}
git worktree remove ../venture-wt-m{N}-{name}
```

---

**L3 Agent Guide Status:** ACTIVE
**Last Updated:** 2026-02-21
**Next Review:** Post-M0 Sprint Completion
