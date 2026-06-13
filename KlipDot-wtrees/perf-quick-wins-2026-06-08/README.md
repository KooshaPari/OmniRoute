# KlipDot — Terminal Image Interception Framework (Archived)

[![License](https://img.shields.io/github/license/KooshaPari/KlipDot)](LICENSE)

**ARCHIVED PROJECT - DO NOT DELETE OR UNARCHIVE**  
*Historical Reference: Universal Terminal Image Capture & Interception Research*

KlipDot was a Rust-based research project exploring AI-driven desktop integration through universal image capture and real-time clipboard interception for CLI/TUI applications. Preserved for historical reference and architectural research purposes only.

## Status

**Status**: ARCHIVED (2024-Q1)  
**Reason**: Superseded by browser automation (bare-cua) and modern sandbox approaches  
**Maintenance**: Historical reference only — no active development

## Original Purpose & Design

KlipDot investigated daemon-based terminal image interception as a foundation for AI agent integration with legacy CLI/TUI tools. It provided:
- Universal image capture for any terminal application
- Real-time clipboard monitoring and event streaming
- Terminal image preview rendering (chafa/timg)
- HTTP API for AI service integration
- Cross-platform shell integration (ZSH, Bash, Fish)

**Architecture**: Lightweight daemon running in background, listening on socket for capture requests, streaming to HTTP listeners.

## Technology Stack (Historical)

- **Language**: Rust (edition 2018)
- **Design Pattern**: Daemon-based interceptor
- **Integration**: Shell hooks, HTTP event streaming
- **Cross-platform**: macOS, Linux, Windows support

## Successor Projects & Migration Path

If you need terminal automation or device integration, use these active alternatives:
- **[bare-cua](../bare-cua)** — Headless browser automation with screenshot/interaction (recommended)
- **[KDesktopVirt](../KDesktopVirt)** — Desktop virtualization for end-to-end automation
- **[KVirtualStage](../KVirtualStage)** — Virtual display sandboxing

## Documentation & Reference

- **CLAUDE.md** — Historical development contract (archived)
- **Source Code**: Preserved as-is for research reference
- **No active PRs or issues** — read-only reference

## Governance & License

- **License**: MIT (Historical)
- **Related**: See `phenotype-shared` and `bare-cua` for modern automation primitives
- **Reuse Policy**: Code patterns may be referenced for research; do not fork or reactivate without explicit approval

---

**Archived**: 2024-Q1 | **Last Reviewed**: 2026-04-24 | **For Research Only**

## License

MIT — see [LICENSE](./LICENSE).
