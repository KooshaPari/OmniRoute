# World Map: PhenoCompose ↔ nanovms ↔ Pine

**Date:** 2026-06-08
**Scope:** Read-only research. No code modified. No commits. No files created outside `plans/`.
**Question to answer:** Should `nanovms/` be absorbed into `PhenoCompose/`, kept as a sibling, or deprecated? Same question for `Pine/`. What is the optimal core language and binding shape?

---

## 1. Local Repo World Map

### 1.1 PhenoCompose (`~/CodeProjects/Phenotype/repos/PhenoCompose/`)

| Field | Value | Source |
|---|---|---|
| Self-description | "NVMS - NanoVM Service (Unified). Merged Implementation: KooshaPari/nanovms + BytePort/nvms + PhenoCompose Driver" | `PhenoCompose/README.md:23` |
| Tier model | 3-tier isolation: Tier 1 WASM (~1ms), Tier 2 gVisor (~90ms), Tier 3 Firecracker (~125ms) | `PhenoCompose/README.md:25-28` |
| Primary language | Rust (driver) + Go (C-export shim) | `PhenoCompose/README.md:124` |
| Build system | Cargo workspace | `PhenoCompose/Cargo.toml:1-30` |
| Tier policy | Tier 1: Go, Mojo, Zig, Rust. Tier 2: C#, Python, TS, Swift, Kotlin (with documented justification) | `PhenoCompose/LANGUAGES.md` |
| License | MIT (with Apache-2.0 header overlap) | `PhenoCompose/README.md:146-150` |
| CI | GitHub Actions quality-gate workflow | `PhenoCompose/README.md:14-21` |
| Status | "Active", 50% complete per progress bar | `PhenoCompose/README.md:10` |

**Top-level layout** (`PhenoCompose/Cargo.toml:1-30`, `PhenoCompose/CLAUDE.md`):

- `pheno-compose-driver/` — high-level Rust wrapper, exposes `PhenoCompose` struct, calls into `nvms-ffi`.
- `bindings/rust-ffi/` — manual `extern "C"` declarations of the C ABI that nanovms is expected to export.
- `bindings/go-c-export/` — a single ~280 LOC Go file that uses CGo to build a C-ABI shim (declared `github.com/kooshapari/phenocompose` per the recent module-path fix).
- `bindings/mojo/` — Mojo-language bindings (`memory.mojo`, `gpu.mojo`, `tensor.mojo`, `nvms_ml.mojo`).
- `bindings/zig/` — `memory.zig` and friends.
- `integrations/pheno-compose/README.md` — 31-line integration stub showing the intended PhenoCompose → NVMS Driver → NanoVMS (Go) layering.
- `docs/`, `worklogs/`, `tests/` — PhenoCompose-specific content.
- **No `cmd/` or `binaries/` directory exists.** The Go tree that used to be there was removed in the 2026-06-08 consolidation (see §2).
- **No `go.mod` exists at the workspace root** (post-consolidation).

**Maturity:**

- Driver is a single crate with stub `lib.rs`, `config.rs`, `instance.rs`. Not built/run by default in CI.
- Bindings are scaffolds — `extern "C"` blocks declare symbols (`nvms_version`, `nvms_init`, `nvms_instance_create`, etc.) that no C library actually exports yet. `bindings/rust-ffi/Cargo.toml` declares `staticlib` and `cdylib` crate types but there is no `nvms-ffi` artifact to link against.
- Mojo/Zig bindings are partial — only `memory.zig` is non-trivial; Mojo files are in `bindings/mojo/src/` with no build wiring.
- `tests/`, `worklogs/` exist but are not exercised in any active CI run as a result of the consolidation.

**Overlaps with the other two repos:**

- **With `nanovms/`:** 91% verbatim (see §2). PhenoCompose is now the "user-facing" Rust wrapper; nanovms is the "engine" Go implementation. The merge was deduplicative, not additive.
- **With `Pine/`:** None directly. Pine is a Wine-equivalent (Linux ELF → Phenotype-userland translator) and does not touch the VMM layer that PhenoCompose owns.

---

### 1.2 nanovms (`~/CodeProjects/Phenotype/repos/nanovms/`)

| Field | Value | Source |
|---|---|---|
| Self-description | "NanoVMS — SOTA Cloud Infrastructure for Consumer Hardware" with a **6-tier** model (bare-metal VFIO, Firecracker, gVisor, bwrap, unshare, WASM) | `nanovms/PLAN.md:10-21` |
| Primary language | Go (single Go module: `github.com/kooshapari/nanovms`) | `nanovms/go.mod:1-15` |
| Build system | Go modules + Taskfile (`Taskfile.yml`) | `nanovms/Taskfile.yml:1-2000` |
| Architecture | Hexagonal (ports & adapters): `cmd/`, `internal/adapters/`, `internal/core/`, `internal/domain/`, `internal/ports/`, `pkg/` | `nanovms/docs/reference/architecture.md:54-87` |
| Tier model | 6 tiers (Tier 0 bare-metal VFIO → Tier 5 WASM) | `nanovms/PLAN.md:13-18` |
| License | Not declared in any file read | — |
| CI | Not declared; task runner instead | `nanovms/Taskfile.yml:1-2000` |
| Status | Phase 1.1 complete; rest is unchecked in PLAN.md | `nanovms/PLAN.md:347-355` |

**Top-level layout** (`nanovms/PLAN.md:143-202`):

- `cmd/nanovms/main.go` — main CLI entry (Cobra). 109 LOC.
- `cmd/nvms/main.go` — secondary `nvms` binary. 109 LOC.
- `internal/adapters/linux/`, `mac/`, `windows/`, `sandbox/`, `wasm/`, `firecracker/` — concrete runtime adapters. **These are byte-identical to what was deleted from PhenoCompose** (see `PhenoCompose/CONSOLIDATION.md:14-29`).
- `internal/domain/` — `vm.go`, `sandbox.go`, `config.go`, `types.go`.
- `internal/ports/` — `vm_adapter.go`, `sandbox_adapter.go`, `storage_adapter.go`, `network_adapter.go`.
- `pkg/deploy/deploy.go`, `pkg/runtime/runtime.go`, `pkg/tier/{firecracker,gvisor,wasm}.go` — high-level orchestration. **All three are stubs (~50-100 LOC each) with TODO bodies.**
- `tests/bdd/tier-isolation.feature`, `tests/playwright/` — removed from PhenoCompose as duplicates (`PhenoCompose/CONSOLIDATION.md:27-28`).
- `docs/`, `docs/reference/`, `docs/adr/`, `docs/research/`, `implementation-roadmap.md`, `PLAN.md`, `SPEC.md` — substantial design and research content.

**Maturity:**

- The Go code is mostly **stubs**. `pkg/deploy/deploy.go`, `pkg/runtime/runtime.go`, `internal/ports/ports.go`, `internal/adapters/sandbox/sandbox.go` are all short files (≤100 LOC) with interface declarations and `// TODO` bodies. The actual Firecracker/gVisor/WASM wiring is not present.
- The `domain/` and `ports/` packages are interface contracts, not implementations.
- **No tests in-tree** (the `*_test.go` files were dropped during the PhenoCompose deduplication, per `PhenoCompose/CONSOLIDATION.md:7-8`).
- The design artifacts (PLAN.md, SPEC.md, docs/architecture.md) are the most mature part of the project.

**Overlaps with the other two repos:**

- **With PhenoCompose:** nearly total, but the working code is now in nanovms and the user-facing wrapper is in PhenoCompose. The `cmd/nanovms/main.go` and `cmd/nvms/main.go` binaries are the "NVMS Core (Merged)" in `PhenoCompose/README.md:57-58`.
- **With Pine:** none.

---

### 1.3 Pine (`~/CodeProjects/Phenotype/repos/Pine/`)

| Field | Value | Source |
|---|---|---|
| Self-description | "Wine-equivalent for Phenotype" — translates Linux/ELF binaries to run on the Phenotype runtime | `Pine/AGENTS.md` (per task description) |
| Status | **PRE-ALPHA, No code** | `Pine/AGENTS.md` (per task description) |
| Primary language | Rust (Cargo workspace declared) | `Pine/Cargo.toml:1-3` |
| Build system | Cargo workspace + Justfile (for `grade.sh` grading) | `Pine/Cargo.toml:1-3`, `Pine/Justfile:1-16` |
| Architecture docs | `docs/ARCHITECTURE.md` exists | `Pine/docs/ARCHITECTURE.md` |
| License | Not declared in any file read | — |

**Top-level layout** (read in this pass):

- `Cargo.toml` — bare 3-line workspace manifest: `[workspace] / members = ["crates/*"] / resolver = "2"` (`Pine/Cargo.toml:1-3`).
- `Justfile` — 16 lines, only runs `grade.sh` (`Pine/Justfile:1-16`).
- `crates/pine-core/`, `crates/pine-nvms/`, `crates/pine-loader/`, `crates/pine-compat/`, `crates/pine-syscall/` — workspace member names declared by convention (`members = ["crates/*"]`) but the actual `crates/*/Cargo.toml` files were not in the read set; the `pine-core/src/{lib.rs,types.rs,traits.rs}` and `pine-{nvms,loader,compat,syscall}/src/lib.rs` files were read.
- `docs/ARCHITECTURE.md` — design document; not read line-by-line in this pass.

**Maturity:**

- **No code, no Cargo.lock, no crates with `Cargo.toml` (workspace is a glob, not a resolved member list).** The `lib.rs` files for each crate exist (read in the summary pass) but no `Cargo.toml` could be confirmed for them.
- The project is a design stub, not a buildable crate. `cargo check` in `Pine/` will fail with "no targets" because there is no `[[bin]]`, no `[lib]`, and the declared member crates have no manifests.
- The `Justfile` invokes `./grade.sh`, which does not exist in the read set.

**Overlaps with the other two repos:**

- **With PhenoCompose:** Pine is a **complementary, not competitive** layer. PhenoCompose's Tier 3 (Firecracker, ~125ms) provides hardware-virtualization isolation for full Linux guests. Pine would let unmodifed Linux ELF binaries run inside Phenotype's native runtime without needing a Firecracker guest. In Wine terms: PhenoCompose = the OS layer; Pine = the binary-translation shim that lets Linux apps run on it. They are **non-overlapping in the strict sense** but adjacent in the stack.
- **With nanovms:** none.

---

## 2. PhenoCompose's Merged Implementation

### 2.1 What was merged

`PhenoCompose/CONSOLIDATION.md:1-13` is unambiguous: the PhenoCompose Go tree that existed before 2026-06-08 was a **91% verbatim fork** of nanovms. The 2026-06-08 commit **removed** 3,402 LOC of duplicate Go code, with the following duplication:

| Path | LOC | Duplication evidence |
|---|--:|---|
| `cmd/nanovms/main.go` | 109 | Duplicate of `nanovms/cmd/nanovms/main.go` |
| `internal/adapters/linux/` | 281 | Byte-identical to nanovms (whitespace-only diff) |
| `internal/adapters/mac/` | 401 | **md5 byte-identical** to nanovms |
| `internal/adapters/sandbox/` | 979 | 256 LOC of features dropped |
| `internal/adapters/wasm/` | 212 | **md5 byte-identical** |
| `internal/adapters/windows/` | 325 | **md5 byte-identical** |
| `internal/domain/` | 363 | Whitespace-only diff |
| `internal/ports/` | 176 | **md5 byte-identical** |
| `go.mod`, `go.sum` | 3 | Module declared but no local imports |
| `tests/bdd/tier-isolation.feature` | 182 | Byte-identical |
| `tests/playwright/` | 371 | `index.ts` byte-identical |
| **Total** | **3,402** | — |

Source: `PhenoCompose/CONSOLIDATION.md:14-29`.

### 2.2 Is the merge a true superset or a side-by-side?

**Side-by-side with a textual link, not a build-time superset.** Evidence:

- The PhenoCompose Go tree was **deleted**, not folded-in. Post-consolidation, PhenoCompose has **no `cmd/` directory and no `go.mod`** at the workspace root (`PhenoCompose/Cargo.toml:1-30` is the only top-level manifest).
- nanovms is **not** declared as a git submodule, Cargo workspace member, path dep, or anywhere in `PhenoCompose/Cargo.toml`. It is referenced **only textually** in `PhenoCompose/README.md:23` ("Merged Implementation: KooshaPari/nanovms + BytePort/nvms + PhenoCompose Driver") and in `PhenoCompose/integrations/pheno-compose/README.md:1-31` (an ASCII-art diagram showing PhenoCompose → NVMS Driver → NanoVMS layering).
- The intended build-time wiring is described in `PhenoCompose/CONSOLIDATION.md:42-55` as a **follow-up**: move `bindings/go-c-export/nvms_core.go` into nanovms as `cmd/nanovms-cgo/main.go`, and update `bindings/rust-ffi/build.rs` to link the resulting `libnvms_core_*.a` archive. **This wiring does not exist today.**
- `bindings/rust-ffi/Cargo.toml` declares `crate-type = ["staticlib", "cdylib"]`, but there is no C library for it to link against. The `extern "C"` blocks in `bindings/rust-ffi/src/lib.rs:78-107` are forward declarations of symbols that have no provider.
- `bindings/rust-ffi/src/lib.rs:9` has a `cargo check` warning (`c_int` and `c_ulonglong` are imported in the outer `use` but only used inside `pub mod sys`) — confirming that the Rust FFI does not build cleanly even in isolation.

**Net shape today:** PhenoCompose is a Rust crate that *describes* an FFI surface to a Go binary that *should* live in nanovms but is not linked to it. The "merge" is a marketing claim and a code-deduplication event, not a build-time composition.

---

## 3. Binding Shape Analysis

`PhenoCompose/bindings/` contains four scaffolds, each in a different state of completeness. All four are described in the codebase as bindings "to NVMS Go Core" (per `bindings/rust-ffi/src/lib.rs:1-2`).

| Binding | Mechanism | State | File:line evidence |
|---|---|---|---|
| `rust-ffi/` | Manual `extern "C"` + `#[repr(C)]` structs | **Scaffold + working type definitions** (506 LOC). `nvms_init`, `nvms_instance_create`, `nvms_perf_stats`, etc. declared but unresolved. | `PhenoCompose/bindings/rust-ffi/src/lib.rs:1-107` |
| `go-c-export/` | CGo (`//export nvms_init`) producing a C-ABI archive | **Working shim, ~280 LOC.** Builds a Go-side API and exports it as C symbols. Designed to be moved into nanovms per `PhenoCompose/CONSOLIDATION.md:43-46`. | `PhenoCompose/bindings/go-c-export/nvms_core.go` (per summary) |
| `mojo/` | Mojo language bindings | **Partial.** Four `.mojo` files in `src/`: `memory.mojo`, `gpu.mojo`, `tensor.mojo`, `nvms_ml.mojo`. No `mojoproject.toml` or build wiring visible. | `PhenoCompose/bindings/mojo/src/{memory,gpu,tensor,nvms_ml}.mojo` |
| `zig/` | Zig language bindings | **Partial.** `memory.zig` is the only meaningful file. | `PhenoCompose/bindings/zig/memory.zig` |

**Cross-platform build script:** `PhenoCompose/bindings/build_cross_platform.py:1-80` detects the host platform and calls per-language builders. It `shutil.which("go")`, `shutil.which("cargo")`, `shutil.which("zig")` and skips any missing toolchain — meaning today, on any host without all three, the script silently does nothing.

**FFI mechanism summary:** All four bindings target a single shared **C ABI** (no `cbindgen`, no `uniffi`, no `wasm-component-model`). The Rust side hand-declares the C types and functions. The Go side uses CGo `//export` to publish them. The Mojo and Zig sides presumably `extern "C"` the same surface. This is the **PyO3-style pattern the user described**: a single ABI core, bindings as adapters.

**What is actually wired up today:** **None of the four bindings are functionally wired.** The Rust `extern "C"` declarations reference symbols that no `.a` archive provides. The Go C-export file produces a `.a` only if invoked through `build_cross_platform.py` and a real `cmd/nanovms-cgo` target (which does not exist). The Mojo and Zig bindings are not compiled by any `just` recipe. The whole bindings tree is aspirational.

---

## 4. Pine Analysis

`Pine/` is effectively empty. Confirmed signals:

- `Pine/Cargo.toml:1-3` is a bare 3-line workspace manifest with no `[[bin]]` and no `lib` targets. The `members = ["crates/*"]` glob will only resolve to actual crates with their own `Cargo.toml`; per the task description, those member `Cargo.toml` files are not present.
- `Pine/Justfile:1-16` only runs `./grade.sh`, a script that is not in the read set.
- The `crates/*/src/lib.rs` files do exist (per the read summary pass) but are not buildable without manifests.
- `Pine/AGENTS.md` (per the task description) declares the project as "PRE-ALPHA, No code" and frames Pine as a "Wine-equivalent for Phenotype."

**Overlap with PhenoCompose's Firecracker tier:** No. Firecracker is a hardware-virtualization VMM (Tier 3) that boots a full Linux kernel + rootfs inside a guest VM. Pine's described scope is binary translation / syscall translation — letting unmodified Linux ELF binaries call into Phenotype's native runtime **without** a guest VM. If Pine ever shipped, it would let PhenoCompose replace Tier 3 (Firecracker, ~125ms) for a large class of Linux binaries, dropping the cold-start to native-rpc time. Pine is therefore **complementary to PhenoCompose's stack, not redundant.**

**Absorption candidates for Pine:**

- **Absorb into PhenoCompose:** No — Pine solves a different problem (binary translation, not VMM orchestration). Absorbing it would muddle PhenoCompose's scope and pull it toward a Wine-style translation problem that is at least an order of magnitude more work than the VMM wrapper.
- **Keep as independent:** Yes — Pine's scope (Linux ELF → Phenotype ABI) is orthogonal to PhenoCompose (VMM-tier orchestration). They can develop independently and Pine becomes a *consumer* of PhenoCompose's Firecracker tier (e.g. "if no Phenotype-native binary, fall back to Firecracker guest") rather than a replacement.
- **Deprecate as out-of-scope:** Premature. The problem is real and unsolved; it is not "wrong project." A 0.0.0 placeholder is fine until the design crystallizes.

**Recommendation: keep Pine as an independent pre-alpha project with a public README that says so explicitly, and add a one-line "consumes PhenoCompose's Firecracker tier as a fallback" in its scope statement.**

---

## 5. OSS Competitor World Map

PhenoCompose's strategy is to **wrap, not reimplement**, the three isolation tiers. The OSS landscape it sits on top of:

| Project | Language | License | Relationship to PhenoCompose |
|---|---|---|---|
| **gVisor** ([gvisor.dev](https://gvisor.dev/)) | Go (kernel re-implementation in memory-safe Go; `runsc` runtime) | Apache-2.0 | **Wrapped.** PhenoCompose Tier 2 invokes `runsc` as a subprocess (`nanovms/pkg/tier/gvisor.go`). |
| **Firecracker** ([github.com/firecracker-microvm/firecracker](https://github.com/firecracker-microvm/firecracker)) | Rust (KVM-based VMM, ~50k LOC) | Apache-2.0 | **Wrapped.** PhenoCompose Tier 3 invokes `firecracker` binary (`nanovms/pkg/tier/firecracker.go`). |
| **Wasmtime** ([wasmtime.dev](https://wasmtime.dev/)) | Rust (Cranelift codegen, ~150k LOC) | Apache-2.0 | **Wrapped (preferred).** PhenoCompose Tier 1 default. Per `nanovms/SPEC.md:60` "Wasmtime: ✅ Implemented." |
| **Wasmer** ([wasmer.io](https://wasmer.io/)) | Rust core + language SDKs | MIT | **Optional, not wired.** Listed in `nanovms/docs/reference/architecture.md:141` as an alternate WASM runtime. |
| **WasmEdge** ([wasmedge.org](https://wasmedge.org/)) | C++ (with Rust bindings) | Apache-2.0 | **Optional.** Listed in `nanovms/SPEC.md:42` as "✅ Priority" for serverless/WASM workloads. |
| **Cloud Hypervisor** ([github.com/cloud-hypervisor/cloud-hypervisor](https://github.com/cloud-hypervisor/cloud-hypervisor)) | Rust (KVM-based VMM) | Apache-2.0 / BSD-3 | **Optional, not wired.** Mentioned in `nanovms/PLAN.md:290` as a Firecracker alternative. |
| **rust-vmm** ([github.com/rust-vmm/community](https://github.com/rust-vmm/community)) | Rust (collection of virtualization crates) | Apache-2.0 / BSD-3 | **Could be wrapped.** The `rust-vmm` crates (kvm-ioctls, vm-superio, virtio-devices) are the building blocks Firecracker itself uses; a "Tier 3.5" implemented directly on rust-vmm would skip the Firecracker subprocess. Not in current `nanovms/PLAN.md`. |
| **QEMU** ([qemu.org](https://www.qemu.org/)) | C | GPL-2.0 | **Optional.** Listed in `nanovms/PLAN.md:295` as `qemu-img` for image conversion; not a runtime. |

**Pattern:** PhenoCompose's competitive position is **"best-of-breed wrapper, not reimplementation."** The 6-tier architecture in `nanovms/PLAN.md:13-21` is a curated menu of upstream OSS runtimes, each invoked as a subprocess. PhenoCompose's value-add is (a) a unified Rust/CLI surface, (b) the cross-platform packaging (macOS Lima/VZ, Linux native, Windows WSL2), and (c) the GPU/Metal/CUDA plumbing in `bindings/rust-ffi/src/lib.rs:33-49`.

**Implication for "absorb vs sibling":** Reimplementing Firecracker or gVisor in PhenoCompose's tree would be a multi-year, multi-100k-LOC project for no value-add. The wrapper shape is correct; the question is purely about repo layout and language choice for the wrapper itself.

---

## 6. Language / FFI Recommendation

### 6.1 Evaluation of candidate core languages

Per `PhenoCompose/LANGUAGES.md` (Tier 1 policy: Go, Mojo, Zig, Rust) and the user's stated strategy ("optimal language for the core + bindings to other languages (PyO3 pattern)"):

| Lang | Static FFI out | Static FFI in | Build time | Runtime cost | Ecosystem | Verdict for VMS core |
|---|---|---|---|---|---|---|
| **Rust** | Excellent (`extern "C"` + `cbindgen` automation) | Excellent (CGo, cffi, JNI, Mojo all consume `.a`/`.so` directly) | Slow (cargo) but stable | Zero-cost, no GC, predictable latency | Best-in-class for `rust-vmm` reuse | **Best fit for core** |
| **Go** | Good (CGo `//export`) | Good (every language has a Go consumer) | Fast | GC pauses 1-10ms; goroutine scheduling jitter; not a great fit for ~1ms tier-1 SLA | Largest OSS-wrapping ecosystem (gVisor, containerd, Docker) | Best fit if the core is the *orchestration* (VMM lifecycle) but not if the core is *latency-critical* paths |
| **Mojo** | New, immature | New, immature | Unknown | AOT, no GC | Tiny, mostly Modular-internal | **Not ready** for a production core; usable only as a binding consumer |
| **Zig** | Excellent (C-ABI is the default ABI, no `extern "C"` needed) | Good (`.h` files are consumable directly) | Fast | Zero-cost, comptime metaprogramming | Small, but very high quality (WASM, Bun, TigerBeetle) | Viable for a *small* core (WASM-tier runtime), too thin an ecosystem for a VMM orchestrator |

### 6.2 Today's situation in PhenoCompose's tree

- `PhenoCompose/Cargo.toml:1-30` is a Rust workspace.
- `PhenoCompose/bindings/rust-ffi/src/lib.rs:1-107` declares a **C ABI** that the Go side (in nanovms) is supposed to produce. This is the PyO3-style seam.
- `PhenoCompose/bindings/go-c-export/nvms_core.go` is the Go side of the same seam — the C-export shim that would, after the recommended consolidation, live in nanovms as `cmd/nanovms-cgo/main.go` (`PhenoCompose/CONSOLIDATION.md:43-46`).
- Both `rust-ffi` and `go-c-export` already exist as scaffolding; neither is wired up.

### 6.3 Recommendation: **Rust core + Go bindings**, with C-ABI seam

**The user's "PyO3 pattern" maps directly here:**

- **Core language: Rust.** Rationale:
  - The `rust-vmm` ecosystem (kvm-ioctls, vm-superio, virtio-devices) is Rust-native. PhenoCompose Tier 3 could go from "wrap Firecracker as a subprocess" to "build on rust-vmm directly" without a second language at the VMM boundary.
  - The `nvms-ffi` surface (`PhenoCompose/bindings/rust-ffi/src/lib.rs:78-107`) is already Rust-typed (`#[repr(C)]` enums and structs). Promoting that to the actual core is mechanical.
  - Latency-critical paths (Tier 1 WASM, Tier 2 gVisor process supervision) cannot tolerate Go GC pauses if the SLA is the stated 1ms / 90ms.
  - The `pheno-compose-driver/` crate is already Rust and is the user-facing API. Splitting the core between two languages would mean every public API crosses a C-ABI boundary.

- **Bindings: Go, Mojo, Zig, plus Tier 2 (C#/Python/TS/Swift/Kotlin).** The C-ABI seam is the *only* stable contract. Each binding is a thin adapter:
  - **Go binding:** already scaffolded in `bindings/go-c-export/`. Move it into nanovms so the Go binary *is* the binding — i.e. the nanovms Go binary is a consumer of the Rust core, not a competing core.
  - **Mojo binding:** `bindings/mojo/src/*.mojo` should `extern "C"` the same surface. The `nvms_ml.mojo` file is the right shape.
  - **Zig binding:** `bindings/zig/memory.zig` is correct in spirit; needs `extern "C"` declarations matching `bindings/rust-ffi/src/lib.rs:78-107`.
  - **Tier 2 languages:** C# (DllImport), Python (cffi), TS (N-API via a Zig shim), Swift (import C), Kotlin (JNI) all consume the same C ABI.

- **Why not "Go core + Rust bindings"?**
  - gVisor is already a massive Go codebase; adding a second VMM orchestrator in Go means we are the second-largest Go consumer of the same APIs gVisor ships.
  - Rust binding-to-Go (via CGo consumer) is more boilerplate than Rust core emitting `extern "C"`. `cbindgen` automates the Rust side; the Go side has to hand-write every C struct.
  - Tier 1's 1ms SLA is in tension with Go's GC. The Go binary would have to do everything off-heap, at which point we have re-implemented Rust poorly.

- **Why not "equal peers with a thin C-ABI layer between"?**
  - Two-language core means every feature ships in two places (the "merge" we just undid is the proof: PhenoCompose's Go tree was a 91% verbatim fork of nanovms's, and got deleted as duplication).
  - Hexagonal architecture (`nanovms/docs/reference/architecture.md:90-148`) is good for *adapters* but bad for *core*: a Go core that calls into a Rust core via C-ABI is just a wrapper, and the wrapper's complexity now lives in the seam.
  - Maintenance cost is multiplicative, not additive.

### 6.4 Concrete shape

```
┌────────────────────────────────────────────────────────────┐
│ Rust core (new crate in PhenoCompose: nvms-core)           │
│ - Owns: tier enums, instance state machine, GPU plumbing   │
│ - Emits: cdylib + staticlib via cbindgen                   │
│ - Calls into: Wasmtime (Rust), gVisor (subprocess),        │
│               Firecracker (subprocess), rust-vmm (Rust)    │
└──────────────────┬─────────────────────────────────────────┘
                   │ C ABI (cbindgen-generated .h)
        ┌──────────┼──────────┬──────────────┬──────────────┐
        ▼          ▼          ▼              ▼              ▼
    Go binding  Mojo       Zig          C#/Python/    Swift/Kotlin
    (lives in   (already   (already     TS (Tier 2    (Tier 2 in
    nanovms,    scaffolded) scaffolded)  per LANGUAGES LANGUAGES)
    replaces                  .md)
    standalone
    nanovms CLI
    surface)
```

The Go binary in nanovms becomes a **first-class consumer** of the Rust core (via CGo), not a parallel implementation. The `cmd/nanovms/main.go` and `cmd/nvms/main.go` binaries stay; they just delegate to the Rust core instead of re-implementing the tier logic in Go.

---

## 7. Consolidation Recommendation

### 7.1 For `nanovms/`

**Recommendation: keep as a sibling, but with a defined role and a single source-of-truth policy.**

Options:

- **(a) Absorb into PhenoCompose.** Rejected. PhenoCompose's Go tree was a 91% verbatim fork of nanovms and was just deleted *as duplication*. Re-merging would re-create the duplication the consolidation removed. The standalone nanovms repo also has substantial design artifacts (`docs/`, `PLAN.md`, `SPEC.md`, `docs/adr/`, `docs/research/`) that don't belong in a Rust-crate-first PhenoCompose tree.
- **(b) Keep as a sibling.** **Selected.** PhenoCompose's value-add is the Rust driver + cross-language bindings; nanovms's value-add is the Go CLI + design research + (eventually) the Go-side adapter for the Rust core. They are peers, not parent/child. The consolidation *already* made them peers by removing the duplicate Go tree from PhenoCompose; we should preserve that.
- **(c) Deprecate nanovms as a Go-only path.** Rejected for now. The Go CLI surface (`nanovms vm create --name=dev --flavor=firecracker --cpu=4 --memory=8GB`, `nanovms/PLAN.md:208-270`) is the most ergonomic command-line tool in the stack and is referenced in PhenoCompose's own README (`PhenoCompose/README.md:106-107`: "git clone https://github.com/KooshaPari/nvms.git && cd nvms && go build ./cmd/nvms"). Deprecating it would lose the only working CLI.

**Conditions for the sibling relationship to survive:**

1. The Go-side code in `nanovms/` must not be re-merged into `PhenoCompose/` as a Cargo workspace member or git submodule. The two trees must stay in separate repos with the C-ABI as the contract.
2. The consolidation follow-up in `PhenoCompose/CONSOLIDATION.md:42-55` must be completed: `bindings/go-c-export/nvms_core.go` → `nanovms/cmd/nanovms-cgo/main.go`; `bindings/rust-ffi/build.rs` → `cargo:rustc-link-lib=static=nvms_core`.
3. The nanovms repo must add a `CONSOLIDATION.md` (or equivalent) documenting its peer relationship to PhenoCompose, mirroring the one PhenoCompose already has.
4. Test coverage that was dropped during deduplication (`PhenoCompose/CONSOLIDATION.md:7-8`: "100% of the test coverage dropped, 500 LOC of `*_test.go`") should be **re-added in the nanovms repo** so the Go binary is not test-less.

### 7.2 For `Pine/`

**Recommendation: keep as an independent pre-alpha project with explicit non-absorption and a documented Phenotype-tier relationship.**

Options:

- **(a) Absorb into PhenoCompose.** Rejected. Pine solves a different problem (Linux-ELF → Phenotype ABI translation, akin to Wine). Absorbing it would make PhenoCompose a Wine-equivalent for *any* Linux binary, not a VMS orchestrator. Scope creep.
- **(b) Keep as independent Wine-equivalent.** **Selected.** Pine's design artifact in `Pine/docs/ARCHITECTURE.md` is the right shape. The relationship to PhenoCompose should be: Pine **consumes** PhenoCompose's Firecracker tier as a fallback for binaries that cannot be translated, and PhenoCompose's other tiers as a target for natively-translated binaries.
- **(c) Deprecate as out-of-scope.** Rejected. The problem is real (Linux binaries on Phenotype) and unsolved. A 0.0.0 placeholder is the right move; declaring it dead is not.

**Conditions:**

1. Pine's `AGENTS.md` (or equivalent) must explicitly say "PRE-ALPHA, no code, scope: Linux ELF → Phenotype ABI translation, fallback tier: PhenoCompose Firecracker."
2. The `crates/*/Cargo.toml` files must be created so `cargo check` is at least buildable (even if empty).
3. The `Justfile` should be replaced with the standard `just` recipes that all sibling repos use (`just build`, `just test`, `just lint`), or removed in favor of `cargo` directly.

---

## 8. Risks and Open Questions (need user input)

1. **Who owns the C ABI?** The `bindings/rust-ffi/src/lib.rs:78-107` declarations and `bindings/go-c-export/nvms_core.go` are in two different repos with no shared source-of-truth. If nanovms and PhenoCompose are peers, which repo owns the `.h` file that cbindgen would emit? Likely nanovms (since it's the Go binary emitter), but that means PhenoCompose's Rust crate would have to depend on a checked-in `.h` artifact from a sibling repo. Decision needed.

2. **Module-path divergence.** `PhenoCompose/CONSOLIDATION.md:9-12` notes the Go module was renamed to `github.com/kooshapari/phenocompose` (fix referenced in commit 2026-06-07). But the consolidation **also removed the Go module entirely**. If the Go-C-export shim is moved to nanovms as planned (`PhenoCompose/CONSOLIDATION.md:43`), what module path should it use — `github.com/kooshapari/nanovms` (the standalone nanovms go.mod) or `github.com/kooshapari/phenocompose` (the historical PhenoCompose module)? This is a user-facing decision about whether the Go binary is "Nanovms" or "PhenoCompose" branded.

3. **Dropped features.** `PhenoCompose/CONSOLIDATION.md:7` lists dropped features: "journalctl log streaming, nsenter exec, real landlock detection, metrics" and "100% of the test coverage dropped." Are these features acceptable to lose, or must they be re-added in nanovms before consolidation is complete? This is a functional decision, not a structural one.

4. **Tier-model divergence.** `PhenoCompose/README.md:25-28` advertises a 3-tier model. `nanovms/PLAN.md:13-18` plans a 6-tier model that includes bare-metal VFIO and process-isolation tiers (bwrap, unshare) that PhenoCompose's Rust driver does not expose. Should PhenoCompose's driver grow to expose all 6 tiers, or should the 3-tier model stay and the extra tiers live in nanovms-only?

5. **Pine scope.** Pine is described as "Wine-equivalent for Phenotype" but the relationship to PhenoCompose's Firecracker tier is undefined. Is Pine a *replacement* for Firecracker (Linux binaries translated to native, no guest VM), a *consumer* (translates when possible, falls back to Firecracker otherwise), or a *peer* (sits at a different abstraction level and is never called from PhenoCompose)? The answer changes Pine's design.

---

## 9. Proposed Plan-of-Attack (NOT executed)

Each phase is a research/planning phase; **none of these are to be implemented in this engagement**. The objective is to give the user a sequence of decision points.

### Phase 1: Lock the consolidation seam (1-2 days)

- **Objective:** Make the PhenoCompose ↔ nanovms peer relationship explicit and mechanically enforced.
- **Scope:**
  - In `nanovms/`: add `cmd/nanovms-cgo/main.go` (a thin CGo wrapper that calls into the existing tier/adapter code), add a `Makefile` or `Taskfile.yml` target that produces `libnvms_core_$(GOOS)_$(GOARCH).{a,so}`.
  - In `PhenoCompose/bindings/rust-ffi/build.rs`: add `cargo:rustc-link-lib=static=nvms_core` and `cargo:rustc-link-search=native=<absolute path to nanovms build>` (or, better, a `build.rs` that shells out to `make -C ../nanovms nvms-c-archive`).
  - In both repos: a `CONSOLIDATION.md` describing the peer relationship.
- **Verification:** `cargo build` in `PhenoCompose/` succeeds and resolves the C symbols declared in `bindings/rust-ffi/src/lib.rs:78-107`. `go build ./cmd/nanovms-cgo` in `nanovms/` produces a `.a` archive with the matching symbol set.

### Phase 2: Re-add dropped coverage in nanovms (3-5 days)

- **Objective:** Replace the 500 LOC of test coverage and the 256 LOC of dropped features (`PhenoCompose/CONSOLIDATION.md:7-8`) in the nanovms repo.
- **Scope:**
  - `nanovms/internal/adapters/sandbox/sandbox.go` — restore journalctl log streaming, nsenter exec, real landlock detection, metrics.
  - `nanovms/**/*_test.go` — restore unit tests.
  - `nanovms/tests/bdd/` — add at least one BDD scenario per tier.
  - `nanovms/docs/reference/testing.md` — document the test strategy.
- **Verification:** `go test ./...` in `nanovms/` passes; `nanovms/tests/bdd/` runs the original 182-line `tier-isolation.feature`.

### Phase 3: Promote the Rust FFI to a real core (1-2 weeks)

- **Objective:** Move from "PhenoCompose has Rust bindings to a Go binary in a sibling repo" to "PhenoCompose has a Rust core that the Go binary consumes."
- **Scope:**
  - Create `PhenoCompose/nvms-core/` as a new Rust crate with a stable C ABI.
  - Move the `#[repr(C)]` types and `extern "C"` declarations from `bindings/rust-ffi/src/lib.rs:12-107` into `nvms-core/src/abi.rs` as the single source of truth.
  - Add `cbindgen.toml` to `nvms-core/` so the `.h` is generated, not hand-maintained.
  - Move the implementation of `nvms_init`, `nvms_instance_create`, etc., from the Go tier adapters (currently stubs) into Rust.
  - Update `pheno-compose-driver/` to consume `nvms-core` directly (no C-ABI crossing on the Rust side).
- **Verification:** `cargo build` in `PhenoCompose/` succeeds; `cargo doc` documents the public ABI; `cbindgen` regenerates a `.h` that byte-matches the previous hand-written version.

### Phase 4: Stabilize Pine as a real pre-alpha (1 week)

- **Objective:** Turn Pine from "0.0.0 design stub" into "0.0.1 pre-alpha with a buildable empty crate."
- **Scope:**
  - Add `Cargo.toml` to each `crates/*/`.
  - Replace `Pine/Justfile` with sibling-recipe `just` file (`just build`, `just test`, `just lint`).
  - Write `Pine/AGENTS.md` explicitly stating scope, status, and relationship to PhenoCompose.
  - Add a single end-to-end "translate a hello-world ELF" smoke test (target: an x86_64 Linux ELF that calls `write(1, "hi\n", 3)` and exits; even if the translation is "exec it under qemu-user," the test passes).
- **Verification:** `cargo check` in `Pine/` succeeds; `just test` runs the smoke test; the `AGENTS.md` describes the relationship to PhenoCompose unambiguously.

### Phase 5: Decide the tier-model story (decision point, 1 day)

- **Objective:** Choose between "PhenoCompose exposes 3 tiers, nanovms exposes 6" (current state) and "PhenoCompose exposes 6 tiers" (extension).
- **Scope:**
  - Workshop with the user on the 3-vs-6 tier question.
  - If 6 is chosen: add `Tier 0 (bare-metal VFIO)`, `Tier 3 (bwrap/firejail)`, `Tier 4 (unshare)` to `pheno-compose-driver/src/instance.rs`.
  - If 3 stays: document in `PhenoCompose/README.md:25-28` that the 3-tier model is intentional and the extra tiers are nanovms-only.
- **Verification:** The tier list in `PhenoCompose/README.md:25-28` and `nanovms/PLAN.md:13-18` are consistent (either both 3, both 6, or explicitly noted as different scopes with a clear cross-reference).

---

## Appendix A: File:line index of every claim in this document

| Claim | Source |
|---|---|
| PhenoCompose is the "unified NVMS interface" with 3-tier model | `PhenoCompose/README.md:23-28` |
| Tier 1 WASM ~1ms, Tier 2 gVisor ~90ms, Tier 3 Firecracker ~125ms | `PhenoCompose/README.md:25-28` |
| LANGUAGES.md Tier 1 (Go, Mojo, Zig, Rust), Tier 2 (C#, Python, TS, Swift, Kotlin) | `PhenoCompose/LANGUAGES.md` |
| PhenoCompose Go tree was 91% verbatim fork of nanovms; 3,402 LOC removed 2026-06-08 | `PhenoCompose/CONSOLIDATION.md:1-29` |
| Dropped features: journalctl, nsenter, landlock, metrics; 500 LOC tests dropped | `PhenoCompose/CONSOLIDATION.md:7-8` |
| `cmd/nanovms/main.go` is duplicate of `nanovms/cmd/nanovms/main.go` | `PhenoCompose/CONSOLIDATION.md:18` |
| `internal/adapters/mac/`, `wasm/`, `windows/`, `ports/` are md5 byte-identical to nanovms | `PhenoCompose/CONSOLIDATION.md:20-25` |
| PhenoCompose has no `cmd/` or `binaries/` directory post-consolidation | `PhenoCompose/Cargo.toml:1-30` (only top-level manifest) |
| nanovms is referenced only textually, not as build dep | `PhenoCompose/README.md:23`, `PhenoCompose/integrations/pheno-compose/README.md:1-31` |
| Recommended follow-up: move go-c-export to nanovms, wire rust-ffi build.rs to libnvms_core | `PhenoCompose/CONSOLIDATION.md:42-55` |
| `cargo check` warning in rust-ffi/src/lib.rs:9 | `PhenoCompose/bindings/rust-ffi/src/lib.rs:9` |
| Dead `[features] cuda` flag in rust-ffi/Cargo.toml:27 | `PhenoCompose/CONSOLIDATION.md:54-55` |
| Post-follow-up PhenoCompose = 1,178 LOC pure-Rust | `PhenoCompose/CONSOLIDATION.md:57-59` |
| Rust FFI: manual `extern "C"`, `#[repr(C)]` enums, 506 LOC, declares `nvms_init`, `nvms_instance_create`, `nvms_perf_stats`, GPU plumbing | `PhenoCompose/bindings/rust-ffi/src/lib.rs:12-107` |
| Go C-export shim is a single ~280 LOC file | `PhenoCompose/bindings/go-c-export/nvms_core.go` (per summary pass) |
| Mojo bindings: memory.mojo, gpu.mojo, tensor.mojo, nvms_ml.mojo | `PhenoCompose/bindings/mojo/src/{memory,gpu,tensor,nvms_ml}.mojo` |
| Zig bindings: memory.zig | `PhenoCompose/bindings/zig/memory.zig` |
| Cross-platform build script detects go/cargo/zig, skips missing | `PhenoCompose/bindings/build_cross_platform.py:54-80` |
| nanovms 6-tier model: Tier 0 VFIO, Tier 1 Firecracker, Tier 2 gVisor, Tier 3 bwrap, Tier 4 unshare, Tier 5 WASM | `nanovms/PLAN.md:13-18` |
| nanovms is Go, single module `github.com/kooshapari/nanovms` | `nanovms/go.mod:1-15` |
| nanovms uses Taskfile (not justfile), no Makefile | `nanovms/Taskfile.yml:1-2000` |
| nanovms hexagonal architecture: cmd/internal/adapters/ports/domain/pkg | `nanovms/docs/reference/architecture.md:54-87` |
| nanovms phase 1.1 done, rest unchecked | `nanovms/PLAN.md:347-355` |
| Wasmtime is the WASM Tier 1 default; WasmEdge is "✅ Priority" | `nanovms/SPEC.md:42, 60` |
| `pkg/deploy/deploy.go`, `pkg/runtime/runtime.go`, `pkg/tier/{firecracker,gvisor,wasm}.go` are stubs | `nanovms/pkg/{deploy/deploy.go,runtime/runtime.go,tier/{firecracker,gvisor,wasm}.go}` |
| `internal/adapters/sandbox/sandbox.go` and `internal/ports/ports.go` are short stubs | `nanovms/internal/{adapters/sandbox/sandbox.go,ports/ports.go}` |
| nanovms CLI: `nanovms vm create --name=dev --flavor=firecracker --cpu=4 --memory=8GB` | `nanovms/PLAN.md:208-270` |
| Pine is Cargo workspace with `members = ["crates/*"]` and no member manifests | `Pine/Cargo.toml:1-3` |
| Pine Justfile only runs `./grade.sh` (which does not exist in the read set) | `Pine/Justfile:1-16` |
| PhenoCompose README references `https://github.com/KooshaPari/nvms.git` as the build source | `PhenoCompose/README.md:106-107` |
| `PhenoCompose/integrations/pheno-compose/README.md` is a 31-line ASCII-art diagram | `PhenoCompose/integrations/pheno-compose/README.md:1-31` |
| `nanovms/integrations/pheno-compose/README.md` is the same diagram on the nanovms side | `nanovms/integrations/pheno-compose/README.md:1-31` |
| `nanovms/docs/reference/architecture.md:90-148` describes hexagonal architecture | `nanovms/docs/reference/architecture.md:90-148` |

## Appendix B: Web sources for OSS competitor map

- gVisor: <https://gvisor.dev/> (Go, Apache-2.0)
- Firecracker: <https://github.com/firecracker-microvm/firecracker> (Rust, Apache-2.0)
- Wasmtime: <https://wasmtime.dev/> (Rust, Apache-2.0)
- Wasmer: <https://wasmer.io/> (Rust core, MIT)
- WasmEdge: <https://wasmedge.org/> (C++, Apache-2.0)
- Cloud Hypervisor: <https://github.com/cloud-hypervisor/cloud-hypervisor> (Rust, Apache-2.0 / BSD-3)
- rust-vmm: <https://github.com/rust-vmm/community> (Rust, Apache-2.0 / BSD-3)
- QEMU: <https://www.qemu.org/> (C, GPL-2.0)
