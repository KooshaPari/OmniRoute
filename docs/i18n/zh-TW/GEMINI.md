# AI 助手的安全與整潔規則

> **適用範圍：** 基於 Gemini 的代理規則。若為 Claude Code，請見 `CLAUDE.md`。若為其他 AI 助手，請見 `AGENTS.md`。

## 1. 檔案放置與組織

- **測試檔案**：所有單元測試、整合測試、生態系測試或 Vitest 檔案，**必須**嚴格放置在 `tests/` 目錄內（例如 `tests/unit/`、`tests/integration/`）。**嚴禁**在專案根目錄（`/`）建立測試檔案。
- **腳本與工具**：所有維護、除錯、產生或實驗性腳本（`.cjs`、`.mjs`、`.js`、`.ts`）**必須**嚴格放置在 `scripts/` 子資料夾之一（`build/`、`dev/`、`check/`、`docs/`、`i18n/`、`ad-hoc/`）。一次性或實驗性程式碼請置於 `scripts/ad-hoc/` 下。**嚴禁**將腳本任意散落在專案根目錄（`/`）或 `scripts/` 頂層資料夾。

- Skills activate via the `activate_skill` tool (skill metadata is loaded at session start and
  the full content is activated on demand).
- There are no other Gemini-only rules today. Do not re-add project rules here — edit
  `AGENTS.md` instead, so every assistant sees the same instructions.
