# Rename Plan: EnhancedBugReportForm -> BugReportForm

- Class name: EnhancedBugReportForm -> BugReportForm
- Instance export: enhancedBugReportForm -> bugReportForm
- File rename: EnhancedBugReportForm.ts -> BugReportForm.ts
- Imports updated in:
  - src/discord/components/ForumSelectionUI.ts
  - src/discord/commands/forumReport.ts
  - src/discord/components/tests/forumSelectionUI.test.ts
  - src/discord/commands/__tests__/forumReport.test.ts

Notes:
- Kept the public method showTemplateSelection as the entrypoint, but it now directly opens the general-bug template without selection UI.
- All ephemeral replies use flags: MessageFlags.Ephemeral
- Modal submissions are routed via ModalFormManager

