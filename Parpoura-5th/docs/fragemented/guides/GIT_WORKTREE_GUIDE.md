# Git Worktree Strategy for Venture Parallel Development

This guide defines the git worktree workflow for parallel development on Venture. Worktrees allow multiple developers or L3 copilot agents to work on different features simultaneously without branch conflicts.

## Overview

**Git worktree** creates multiple working directories linked to the same repository. Each worktree can:
- Operate on a different branch
- Run independent tests
- Have isolated CI checks
- Be merged independently

This prevents:
- Merge conflicts when different agents work on different services
- Long-lived feature branches
- Blocked work waiting for unrelated PRs

## Architecture

### Sprint Milestone Tracking

Venture development is organized in milestones (M1-M8):

| Milestone | Service | Track | Description |
|-----------|---------|-------|-------------|
| M1 | control-plane-api | Track A | Core control plane and API |
| M2 | policy-engine | Track A | Policy engine and allowlist |
| M3 | treasury-api | Track B | Treasury ledger and payout |
| M4 | artifact-compiler | Track C | Artifact determinism and compilation |
| M5 | agent-runtime | Track A | Agent execution and task queue |
| M6 | compliance-engine | Track B | Compliance case management |
| M7 | venture-orchestrator | Track A | Workflow orchestration |
| M8 | integration-suite | All | Full system integration tests |

### Worktree Per Milestone

Create one worktree per sprint:

```bash
# Sprint 1: Control Plane
git worktree add ../venture-wt-m1-control \
  -b feat/venture-m1-control-plane origin/main

# Sprint 2: Policy Engine
git worktree add ../venture-wt-m2-policy \
  -b feat/venture-m2-policy-engine origin/main

# Sprint 3: Treasury
git worktree add ../venture-wt-m3-treasury \
  -b feat/venture-m3-treasury-api origin/main

# Sprint 4: Artifacts
git worktree add ../venture-wt-m4-artifacts \
  -b feat/venture-m4-artifact-compiler origin/main

# ... and so on
```

Directory structure:

```
/Users/kooshapari/temp-PRODVERCEL/485/kush/
├── parpour/                          # Main worktree (main branch)
├── venture-wt-m1-control/            # M1 control-plane-api
├── venture-wt-m2-policy/             # M2 policy-engine
├── venture-wt-m3-treasury/           # M3 treasury-api
├── venture-wt-m4-artifacts/          # M4 artifact-compiler
├── venture-wt-m5-agent/              # M5 agent-runtime
├── venture-wt-m6-compliance/         # M6 compliance-engine
├── venture-wt-m7-orch/               # M7 venture-orchestrator
└── venture-wt-m8-integration/        # M8 integration suite
```

## Branch Naming Convention

All branches follow the pattern:

```
feat/venture-m{N}-{service-name}
```

Examples:

```
feat/venture-m1-control-plane
feat/venture-m2-policy-engine
feat/venture-m3-treasury-api
feat/venture-m4-artifact-compiler
feat/venture-m5-agent-runtime
feat/venture-m6-compliance-engine
feat/venture-m7-venture-orchestrator
feat/venture-m8-integration-tests
```

**DO NOT** use:
- `feature/...`
- `develop`
- `feature-x` (too vague)
- `wip/...` (not production ready)

## Commit Message Convention

Every commit follows a strict format:

```
{type}({service}): {FR-ID} {description}

{optional body with rationale}

Fixes: #{issue_number}
Co-Authored-By: {agent_name} <{email}>
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature (implements FR) |
| `test` | New test or test fix |
| `fix` | Bug fix (implements bug fix FR) |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |
| `chore` | Build, deps, tooling |

### Services

Allowed service names (lowercase):

```
policy      # policy-engine
treasury    # treasury-api
agent       # agent-runtime
artifact    # artifact-compiler
compliance  # compliance-engine
orch        # venture-orchestrator
ctrl        # control-plane-api
```

### Examples

Good commits:

```
feat(treasury): FR-VNT-TREAS-003 spend authorization gate

Implements default-deny authorization check before any spend.
Validates amount_cents against prior authorization record.
Raises SpendNotAuthorized if no matching authorization.

Fixes: #42

test(treasury): FR-VNT-TREAS-003 failing test

Failing test for spend authorization enforcement.
Tests that unregistered spend raises SpendNotAuthorized.

feat(policy): FR-VNT-POLICY-002 tool allowlist validation

Adds validation to check tool against agent's allowlist.
Default-deny: if tool not in allowlist, reject.
Role-specific allowlist lookups from policy bundle.

fix(orch): FR-VNT-BUG-001 handle nil workflow_id in events

Event processing crashed on nil workflow_id.
Add guard clause to skip events without workflow linkage.

refactor(agent): consolidate task envelope parsing

Extract duplicate envelope parsing into shared utility.
No behavior change; improves code reuse.

docs(treasury): update ledger invariant documentation

Clarify double-entry balance requirement.
Add example ledger entry sequences.

chore: upgrade nats dependency to 0.13.1

Pins NATS version to address performance issue.
Verified with integration tests.
```

Bad commits:

```
update code              # Too vague
fix everything          # Too broad
WIP                     # Not production ready
fr-003                  # No type, too short
feat: added new thing    # No FR, no service
```

## Worktree Workflow

### Creating a New Worktree

```bash
# Create worktree for M3 Treasury milestone
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

git worktree add ../venture-wt-m3-treasury \
  -b feat/venture-m3-treasury-api \
  origin/main

cd ../venture-wt-m3-treasury

# Verify you're on the right branch
git branch

# Install dependencies (if not shared)
uv sync

# Start development
```

### Updating from main

While developing in a worktree, keep it synced with main for dependency updates:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Fetch latest
git fetch origin

# Rebase on main (preferred for features)
git rebase origin/main

# If conflicts, resolve and continue
git rebase --continue
```

**DO NOT** merge main into feature branches. Always rebase.

### Switching Between Worktrees

```bash
# List all worktrees
git worktree list

# Switch to treasury worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Switch to policy worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy

# Back to main
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour
```

### Running Tests in Worktree

Each worktree is isolated. Tests run in that worktree's environment:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Run unit tests for this milestone
pytest tests/unit/test_treasury.py -v

# Run integration tests
pytest tests/integration/test_treasury_api.py -v

# Run all tests with coverage
pytest tests/ --cov=app --cov-report=html
```

## L3 Copilot Per-Worktree Pattern

Each copilot agent works within its worktree context:

```bash
# Agent 1: Work on M1 control plane
copilot -p "Implement FR-VNT-CTRL-001 in control-plane-api.
Failing test at: tests/unit/test_control_plane.py::test_workflow_creation
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(ctrl): FR-VNT-CTRL-001 workflow creation endpoint'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control &

# Agent 2: Work on M3 treasury (simultaneously)
copilot -p "Implement FR-VNT-TREAS-003 in treasury-api.
Failing test at: tests/unit/test_treasury.py::test_spend_requires_authorization
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(treasury): FR-VNT-TREAS-003 spend authorization gate'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury &

# Agent 3: Work on M2 policy engine
copilot -p "Implement FR-VNT-POLICY-002 in policy-engine.
Failing test at: tests/unit/test_policy.py::test_allowlist_validation
Must pass test without adding fallbacks or legacy compatibility.
Commit message: 'feat(policy): FR-VNT-POLICY-002 tool allowlist validation'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy &
```

Each agent operates independently:
- No branch conflicts
- Parallel test execution
- Isolated CI checks
- Independent merge timelines

### Passing Context to Copilot

When invoking copilot in a worktree, include the absolute path:

```bash
copilot -p "Your task description" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury \
  &
```

The `--add-dir` parameter tells copilot to:
- Read all project files from that directory
- Understand the local git state
- Make commits to that worktree
- Reference local imports and dependencies

## Merge Strategy

### Per-FR Squash Merge

Each FR merges as a single commit via squash merge:

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

# Ensure main is up to date
git fetch origin
git pull origin main

# Switch to feature branch (in separate worktree or local)
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Ensure feature is rebased on latest main
git rebase origin/main

# Create pull request (via GitHub UI or gh CLI)
gh pr create --title "feat(treasury): FR-VNT-TREAS-003 spend authorization" \
  --body "Implements spend authorization gate with default-deny policy.

## Changes
- Add AuthorizationEngine.validate_spend()
- Add SpendNotAuthorized exception
- Add unit tests for authorization logic

## Test Coverage
- tests/unit/test_treasury.py::test_spend_requires_authorization (GREEN)
- tests/unit/test_treasury.py::test_amount_ceiling_enforcement (GREEN)

Closes #42"

# After PR approval, squash merge
git checkout main
git pull origin main
gh pr merge --squash --subject "feat(treasury): FR-VNT-TREAS-003 spend authorization gate"

# Clean up worktree
git worktree remove ../venture-wt-m3-treasury
```

### Per-Milestone Rebase Before Final Merge

Before merging a milestone's final PR to main:

1. Rebase all commits to ensure clean history
2. Run full test suite
3. Verify no conflicts with other milestones

```bash
# In milestone worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury

# Fetch latest
git fetch origin

# Rebase on main
git rebase origin/main

# If conflicts, resolve
git rebase --continue

# Push to branch
git push origin feat/venture-m3-treasury-api --force-with-lease

# Create or update PR
```

## Conflict Resolution

### Schema and Event Definitions

Schema and event definitions are the most conflict-prone. Resolve with this rule:

**All schema changes go through main first.**

Example:

1. M3 (treasury) needs to add a field to EventEnvelope
2. M1 (control-plane) also needs to modify EventEnvelope

Resolution:

1. M3 submits PR with schema change (without treasury-specific fields yet)
2. Schema change merges to main
3. All other milestones (including M1) rebase and get the updated schema
4. M1 and M3 then add their respective fields

```bash
# M3 worktree: Add shared field
# File: app/events/models.py - EventEnvelope
# Add: trace_id field

git commit -m "feat(events): FR-VNT-EVENT-001 add trace_id to EventEnvelope"
git push origin feat/venture-m3-treasury-api

# Merge to main via PR

# M1 worktree: Rebase to get trace_id
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control
git fetch origin
git rebase origin/main

# Now M1 can use trace_id in control-plane logic
```

### Resolving Three-Way Conflicts

If a conflict occurs during rebase:

```bash
# Rebase stops at conflicted commit
git status  # Shows conflicted files

# Option 1: Abort rebase (if not sure)
git rebase --abort

# Option 2: Resolve and continue
# Edit conflicted files
# Remove conflict markers
# Stage resolved files
git add .
git rebase --continue

# Option 3: Take ours or theirs
git checkout --ours app/treasury/models.py
git add app/treasury/models.py
git rebase --continue
```

## Cleanup

### Removing Finished Worktrees

After a milestone merges to main:

```bash
# In main worktree
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

# List worktrees
git worktree list

# Remove completed worktree
git worktree remove ../venture-wt-m3-treasury

# Verify
git worktree list
```

### Listing All Worktrees

```bash
git worktree list

# Output:
# /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour                       e1c2d45 [main]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control         7f8a9e2 [feat/venture-m1-control-plane]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m2-policy          b4c5d6e [feat/venture-m2-policy-engine]
# /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury        2a3b4c5 [feat/venture-m3-treasury-api]
```

### Pruning Invalid Worktrees

If a worktree directory is deleted manually:

```bash
git worktree prune

# Or verbose
git worktree prune -v
```

## Continuous Integration

Each worktree's branch runs its own CI:

```yaml
# .github/workflows/test-milestone.yml
name: Test Milestone

on:
  push:
    branches:
      - feat/venture-m*

jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
      - name: Install uv
        run: pip install uv
      - name: Run tests
        run: pytest tests/unit/ -v

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      nats:
        image: nats:latest-alpine
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: pytest tests/integration/ -v

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Run E2E tests
        run: pytest tests/e2e/ -v
```

## Summary

Worktree workflow enables:
- **Parallel development**: Multiple agents work simultaneously
- **No conflicts**: Each worktree is independent
- **Clean history**: Squash merge keeps main tidy
- **Easy rollback**: Remove problematic worktree and recreate
- **Isolated CI**: Each branch runs independent tests
- **Fast feedback**: No blocked work waiting for unrelated PRs

Key commands:

```bash
# Create
git worktree add ../venture-wt-{service} -b feat/venture-m{N}-{service} origin/main

# List
git worktree list

# Update
cd ../venture-wt-{service} && git rebase origin/main

# Merge
gh pr merge --squash

# Cleanup
git worktree remove ../venture-wt-{service}
```

Follow the commit message convention strictly. Always rebase before merging. Keep schema changes in main. Use L3 copilot agents per worktree. Deploy with confidence.
