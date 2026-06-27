# SOTA — SwiftUI vs Jetpack Compose for Android Deferred Work (side-30)

**Date:** 2026-06-20
**Task ID:** side-30
**Agent:** v11-sota-batch-1
**Verdict:** **Defer indefinitely.** No fleet consumer. Both frameworks are mature, SOTA-grade declarative UI substrates; the right time to pick is when the first mobile consumer surfaces, not now.

## What the two are (2026-06)

**SwiftUI** (Apple, 2019, current 6.x line): declarative, data-flow-driven, ties into Combine + Swift Concurrency + `@Observable` macro. Best in class for Apple-platform-only work; the only mature option for iOS/iPadOS/macOS/watchOS/tvOS/visionOS. Native rendering, no bridge layer, tight SwiftUI↔UIKit interop. Apple-private governance; roadmap is opaque outside WWDC.

**Jetpack Compose** (Google + Kotlinlang, 2021, current 1.7 line): Kotlin-first declarative UI, mature Material 3 + Wear OS + TV support, Compose Multiplatform (KMP) now stable for Android/iOS/desktop/web. Apache-2.0; backed by JetBrains + Google; multi-vendor governance. Compose Multiplatform is the realistic path if we ever need to share UI logic across Apple + Android without two codebases.

**The "deferred work" framing** in the task title most closely maps to structured concurrency primitives for off-main-thread UI work: SwiftUI uses Swift `Task` + `MainActor` + `.task` modifier; Compose uses Kotlin Coroutines + `LaunchedEffect` + `rememberCoroutineScope` + `ViewModelScope`. Both are first-class and equivalent in capability.

## Fleet relevance (today)

There is **no production mobile consumer** in the Phenotype fleet right now. `PhenoMCP` has no mobile shell; `PhenotypeHandoff` is web only; `Civis` is web/desktop; `Dino` is a Unity engine (paused per ADR-023). The iOS Swift in `phenotype-go-sdk/devhex-platformkit` is platform-binding glue, not product UI. So the choice is not load-bearing today.

The single plausible fleet consumer in the next 12 months would be a `PhenoMCP` companion app or a `phenotype-journeys` mobile step-capture client. Until that work is funded, evaluating these two is speculative.

## When each becomes attractive

**Pick SwiftUI when:** the first consumer is iOS-only or Apple-platforms-only, the team is Swift-fluent, and the project timeline is <6 months. Apple's tooling (Xcode Previews, Instruments, accessibility inspector) is best in class. No competitor.

**Pick Compose Multiplatform when:** the consumer needs to ship to both iOS and Android with shared business logic, or the team is Kotlin-fluent and willing to tolerate Compose-iOS being a tier-2 platform. KMP is real (1.7 has shipped to production at major apps), and JetBrains is investing in `compose-cocoa` desktop support as a side benefit.

**Pick neither when:** the work is better expressed as a web app (Tauri per side-29, React Native, Flutter). For internal tools and dogfood, web is the cheapest path.

## Concrete recommendations

1. **Do not adopt either as a fleet substrate right now.** No consumer. ADR-023 explicitly pauses app-level work; mobile falls under that.
2. **Add a `docs/mobile-strategy.md` one-pager** (deferred — not this turn) listing SwiftUI / Compose / RN / Flutter / Tauri as the five realistic options and the trigger conditions for each. This is the smallest artifact that makes a future decision a 1-day spike instead of a 2-week research project.
3. **If a mobile consumer appears**, run a 1-week spike with Compose Multiplatform first (Kotlin team is more likely to be on hand than Swift; KMP covers the iOS gap cheaply). Fall back to SwiftUI only if the KMP-iOS tier-2 story fails for the specific app shape.
4. **Track the Compose Multiplatform 2.0 line** (slated 2026 Q4) — once Compose Multiplatform reaches iOS tier-1, the SwiftUI case for a single-platform consumer weakens.

## Recommendation

**Defer.** Both frameworks are SOTA and the right call for their respective platforms; the absence of a mobile consumer makes the choice moot. Re-evaluate when the first mobile consumer is funded; expected decision artifact is a 1-week spike, not a research paper.

**Refs:** Apple SwiftUI docs (developer.apple.com/swiftui), Jetpack Compose roadmap (developer.android.com/jetpack/compose), Kotlinlang Compose Multiplatform 1.7 release notes, ADR-023 (app-level repo triage), side-29 (Tauri cross-platform UI), `findings/2026-06-19-L5-101-app-governance.md`.
