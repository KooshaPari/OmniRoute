# SOTA — GraalVM Native Image for CLI Startup (side-35)

**Date:** 2026-06-20
**Task ID:** side-35
**Agent:** v11-sota-batch-1
**Verdict:** **Defer.** GraalVM native-image is the SOTA path to fast-starting JVM CLIs, but the fleet's CLI surface is essentially 100% Rust (with one Python and one Go surface). Java is not a first-class language in any active substrate; adopting it for one CLI would create a new runtime in the fleet.

## What GraalVM native-image is (2026-06)

GraalVM is a high-performance JDK distribution from Oracle (with a community CE build). `native-image` is its AOT compiler that takes JVM bytecode + closed-world assumptions and produces a self-contained, ahead-of-time-compiled native executable:

- **Startup**: 10–100x faster than `java -jar` (typically 5–50ms vs 200–2000ms). No JVM warmup. No classpath scanning.
- **Footprint**: 10–50MB binaries vs 100–300MB for a typical JVM + heap. No JIT compiler in the binary.
- **Peak throughput**: ~10–30% lower than a warm C2 JIT for compute-heavy workloads, but ~equal or better for short-lived CLIs.
- **Constraints**: closed-world (no dynamic classloading at runtime without `--enable-https`), slower build (1–10 minutes for a non-trivial app), reflection requires explicit configuration (`reflect-config.json` or the new `runtime` API in 21+), no JVM TI / JVMTI in production builds.
- **License**: GraalVM CE is GPL-2.0-with-classpath-exception; GraalVM EE is paid Oracle.

Other options in the same space: `OpenJ9 AOT`, `Eclipse OpenJ9 + CRIU` (checkpoint/restore), `jaotc` (deprecated in JDK 17), `JLink + custom runtime image` (smaller JRE, but no AOT).

## Fleet relevance (today)

The fleet's CLI footprint is dominated by Rust, with one Python CLI and one Go CLI. Concretely:

- **Rust CLIs**: `helios-cli`, `heliosBench`, `thegent`, `thegent-dispatch`, `pheno-cli-base`, `pheno-flags`, `clap-ext`, `vibeproxy`, `nanovms` (multiple binaries), `slm`, `slm-server`, `DINOForge-UnityDoorstop`, `homebox-daemon`. These all start in <50ms via standard `cargo build --release` and pay no startup tax.
- **Python CLIs**: `sharecli`, `pheno-llms-txt` runner, various `pheno-*` Python lib entry points. Start in 100–500ms cold.
- **Go CLIs**: `phenotype-go-sdk` examples, `KlipDot` (paused), `KWatch` (paused). Start in <20ms.
- **Java/JVM**: no production Java in any active substrate. There is some JVM presence in upstream dependencies (e.g., elasticsearch clients, kafka-clients) but no JVM CLI the fleet ships.
- **Polyglot fleets** — there is one place where GraalVM would be attractive: the `phenotype-bus` substrate if a polyglot consumer (JVM-based downstream) needed to embed it. That consumer does not exist today.

The realistic conclusion: there is no CLI in the fleet that would benefit from `native-image` because there is no JVM CLI in the fleet. Adding Java + GraalVM to satisfy this SOTA scan would be a net-new runtime for one hypothetical consumer.

## When GraalVM native-image becomes attractive

- **A JVM-based downstream consumer appears** — if a fleet user wants to embed a fleet component from JVM, `native-image` lets that user ship a single static binary.
- **Polyglot interop is needed** — GraalVM's `truffle` framework lets you embed Ruby/JS/Python/R in the same JVM with shared objects. Useful for a multi-language plugin runtime, but wasmtime (per side-13) is a better substrate for that.
- **Serverless / edge deployment** — Lambda, Cloudflare Workers, fly.io machines all charge by the millisecond. A 5ms cold-start vs 500ms is the difference between viable and not. If a fleet service goes serverless, native-image is on the table for the JVM option.
- **A team is already JVM-fluent** — adoption cost is non-trivial (build pipeline, reflection config, native-image CI runners). The cost is justified only if the team doesn't pay it once and instead pays it every release.

## Concrete recommendations

1. **Do not adopt GraalVM native-image as a fleet CLI substrate.** No JVM CLI in the fleet; the cost-benefit is wrong.
2. **If a JVM consumer appears**, prefer "ship the JAR + Adoptium runtime image" first (cheap, no AOT complexity). Graduate to `native-image` only when cold-start latency is measured and a 100–500ms gap matters.
3. **If a polyglot runtime is needed**, prefer `wasmtime` (side-13) over GraalVM Truffle. Wasmtime is the right substrate for the fleet's "polyglot plugins in a Rust host" use case; Truffle is the right substrate for "Java host with multiple scripting languages."
4. **Track GraalVM CE for JDK 25+** — the community edition's feature parity with EE has been closing; if/when `native-image` becomes first-class in OpenJDK (proposed but not landed as of 2026-06), this decision flips.
5. **If/when adopted**, use the Micronaut or Quarkus framework (not Spring Boot) — both have first-class `native-image` integration. Spring Boot's native support is much weaker in 2026 and the build times are 2–3x longer.

## Recommendation

**Defer indefinitely.** No JVM CLI in the fleet; the right time to adopt `native-image` is the moment a fleet JVM CLI exists, not before. If JVM consumption appears later, start with the standard JVM + Adoptium and graduate to `native-image` only if cold-start latency is measured as a problem. Wasmtime (side-13) is the better polyglot-runtime substrate for any "embed multiple languages in a Rust host" question.

**Refs:** GraalVM native-image docs (graalvm.org/native-image), Micronaut Native docs, Quarkus native docs, OpenJDK Project CRaC (Checkpoint/Restore), `findings/2026-06-20-side-13-wasmtime-vs-wasmer.md` (wasmtime as polyglot substrate), ADR-023 (app-level repo triage).
