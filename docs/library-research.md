# Library Research

The library research registry records dependency evidence for wrap-vs-handroll
decisions across the Phenotype ecosystem.

## Current Scope

- 150+ libraries observed across the repo set.
- 40+ research papers and technical references.
- Language groupings for Rust, Python, Go, and TypeScript.
- Decision labels for wrap, extend, or handroll cases.

## Decision Use

Before introducing a new core dependency:

1. Check whether the dependency or category already appears in
   [`LIBRARY_RESEARCH_REGISTRY.md`](https://github.com/KooshaPari/phenotype-registry/blob/main/LIBRARY_RESEARCH_REGISTRY.md).
2. Prefer wrapping existing mature libraries when the registry already has a
   vetted choice.
3. Handroll only when the registry captures a concrete gap in available tools.
4. Update the registry when new evidence changes a dependency decision.

## Canonical File

The full evidence ledger remains in
[`LIBRARY_RESEARCH_REGISTRY.md`](https://github.com/KooshaPari/phenotype-registry/blob/main/LIBRARY_RESEARCH_REGISTRY.md).
This page is the published guide for how to use it.
