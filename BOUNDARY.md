# Boundary Lock: ShareCLI process orchestration

**Status:** ACTIVE — shared CLI process manager for multi-project agent orchestration.

## Owns
- Cross-project CLI process lifecycle (spawn, supervise, teardown)
- Shared orchestration hooks consumed by agent tooling

## Does NOT own
- Agent runtime / tool registry (`thegent` — absorb later when stable)
- Code review CLI (`tehgent`)

## Duplicate
`thegent-sharecli` is a fork-line duplicate — canonical repo is **sharecli**. Absorb into `thegent` only after runtime boundary stabilizes.