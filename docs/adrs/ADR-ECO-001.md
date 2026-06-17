# ADR-ECO-001: stashly → ResilienceKit

## Status
Accepted

## Context
DISPOSITION §7 open question: dedicated `phenotype-cache` vs absorb into ResilienceKit.

## Decision
Absorb `stashly` into **ResilienceKit** (not a new `phenotype-cache` repo).

## Rationale
Cache is adjacent to rate-limit/resilience per charter decomposition map. Avoids another repo for governance overhead.

## Consequences
Wave D includes stashly (#46) with http-client-core and phenotype-mcp relocations.
