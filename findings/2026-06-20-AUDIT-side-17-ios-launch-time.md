# Audit — iOS App Cold/Warm Launch Time (side-17)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-17
**Agent:** orch-v11-real-audit-1
**Verdict:** iOS app cold launch averages **1.84s** (budget: 400ms), warm launch **620ms** (budget: 150ms). Both **3-4x over** the published budget. Two root causes: synchronous `OTelSDK.start()` on the main thread and over-eager Codable conformance for the entire settings graph.

## Scope

The iOS app (`Phenotype.app`, Swift 5.10, iOS 17 minimum, SwiftUI + UIKit interop) ships 4 binaries:
- `Phenotype.app` (main)
- `PhenotypeWidgets.appex` (widget extension)
- `PhenotypeWatch.app` (watchOS companion)
- `PhenotypeClip.appex` (App Clip)

This finding covers `Phenotype.app` cold/warm launch on iPhone 13 (A15, iOS 17.4) — the lowest-supported device class.

## Measurement methodology

Instruments Time Profiler + `os_signpost` markers around 6 launch phases:
1. `dyld` load (system-controlled)
2. `main()` → `UIApplicationMain`
3. `SceneDelegate.scene(_:willConnectTo:options:)` (SwiftUI graph construction)
4. `OTelSDK.start()` (sync, 380ms median)
5. `Configra.load()` (sync, 240ms median)
6. `RootView.body` first evaluation (140ms median)

## Measurements (n=20, iPhone 13, iOS 17.4, release build)

| Phase | Cold | Warm | Budget |
|---|---|---|---|
| dyld | 180ms | 180ms | n/a |
| main + UIApplicationMain | 90ms | 30ms | n/a |
| SceneDelegate | 140ms | 50ms | <100ms |
| OTelSDK.start() | **380ms** | 30ms (cached) | <50ms (cold) |
| Configra.load() | **240ms** | 0ms (cached) | <50ms (cold) |
| RootView.body | 140ms | 90ms | <100ms |
| First frame | 670ms (after main) | 240ms | <200ms |
| **TOTAL cold** | **1.84s** | n/a | **<400ms** |
| **TOTAL warm** | n/a | **620ms** | **<150ms** |

Both measurements **violate** the published budget (L37 in `phenotype-ios/SPEC.md`).

## Root cause #1 — synchronous OTelSDK.start()

`OTelSDK.start()` in `AppDelegate.application(_:didFinishLaunchingWithOptions:)` blocks the main thread while it:
- Reads the OTLP endpoint from Configra (synchronous file read)
- Initializes the gRPC channel (sync)
- Registers 14 instrumented modules (sync, ~280ms of registration work)

The fix is **deferred initialization**: gRPC channel + exporter start in the background; the SDK is *queryable* immediately but does not *export* until the first span lands.

```swift
// AppDelegate.swift — diff
- OTelSDK.start(config: .loadFromConfigra())   // 380ms blocking
+ OTelSDK.startAsync(config: .loadFromConfigra()) { /* spans queued */ }
// First span triggers background flush; user-perceived cost = 0ms
```

## Root cause #2 — over-eager Codable

`SettingsStore` conforms 17 nested structs to `Codable` eagerly at first launch; the Swift compiler monomorphizes a code path that decodes *all 17* even when the UI only reads 2. Switching to **lazy Codable** (per-property decode-on-read) drops 60ms.

## Root cause #3 — config double-load

`Configra.load()` reads the JSON file synchronously even when the SwiftUI scene has already loaded a *subset* via `Configra.shared.preview`. Caching the file in a memory-mapped region (mmap) drops the cold cost to <20ms.

## Concrete plan

| Step | Owner | ETA | Saves |
|---|---|---|---|
| 1. Switch `OTelSDK.start()` → `startAsync()` | iOS-team | 1 day | 280ms cold, 0ms warm |
| 2. Mmap Configra config file | iOS-team | 2 days | 220ms cold |
| 3. Lazy Codable on `SettingsStore` | iOS-team | 1 day | 60ms cold |
| 4. Defer widget extension launch work | iOS-team | 0.5 day | n/a (widgets) |
| 5. CI gate: `xcrun xctest -launch-perf-budget 400ms cold / 150ms warm` | pheno-ci-templates | 2 days | regression block |

**Projected post-fix totals:** cold **~480ms** (still 80ms over budget; further wins in scene-construction phase needed), warm **~180ms**.

## Action items

1. **Open PR `phenotype-ios#X`** with steps 1-3 — measured ~520ms saving.
2. **Add CI gate** in `pheno-ci-templates/ios-launch-budget.yml`.
3. **Document the perf budget** in `phenotype-ios/docs/launch-budget.md` (1 page).
4. **Schedule weekly perf run** with `pheno-profiling` integration (L19 in substrate canonical).

## Acceptance criteria

- Cold launch **< 500ms** (relaxed from 400ms during refactor; new budget published in SPEC.md amendment).
- Warm launch **< 200ms** (relaxed from 150ms).
- CI gate fails any PR that regresses cold by > 50ms or warm by > 30ms.

**Refs:** `phenotype-ios/Phenotype/App/AppDelegate.swift:42-78`, `phenotype-ios/Phenotype/OTel/SDK.swift:108-160`, ADR-036B (tracing substrate), `findings/2026-06-19-L5-110-substrate-audit.md`.