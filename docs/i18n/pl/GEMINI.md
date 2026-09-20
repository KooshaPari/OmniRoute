# Zasady bezpieczeństwa i porządku dla asystentów AI

> **Zakres:** reguły dla agentów opartych na Gemini. Dla Claude Code zobacz `CLAUDE.md`. Dla innych asystentów AI zobacz `AGENTS.md`.

## 1. Umieszczanie plików i organizacja

- **Pliki testowe**: WSZYSTKIE testy jednostkowe, integracyjne, ekosystemowe lub pliki Vitest MUSZĄ być umieszczane wyłącznie w katalogu `tests/` (np. `tests/unit/`, `tests/integration/`). NIGDY nie twórz plików testowych w katalogu głównym projektu (`/`).
- **Skrypty i narzędzia pomocnicze**: WSZYSTKIE skrypty konserwacyjne, debugujące, generujące lub eksperymentalne (`.cjs`, `.mjs`, `.js`, `.ts`) MUSZĄ być umieszczane wyłącznie w jednym z podkatalogów `scripts/` (`build/`, `dev/`, `check/`, `docs/`, `i18n/`, `ad-hoc/`). Kod jednorazowy lub eksperymentalny trafia do `scripts/ad-hoc/`. NIGDY nie wrzucaj luźnych skryptów do katalogu głównego projektu (`/`) ani do katalogu najwyższego poziomu `scripts/`.

- Skills activate via the `activate_skill` tool (skill metadata is loaded at session start and
  the full content is activated on demand).
- There are no other Gemini-only rules today. Do not re-add project rules here — edit
  `AGENTS.md` instead, so every assistant sees the same instructions.
