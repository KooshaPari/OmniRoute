# Functional Requirements — phenotype-colab-extensions

**Version:** 1.0.0
**Status:** ACTIVE
**Owner:** Phenotype Engineering
**Last Updated:** 2026-03-27
**Total FRs:** 38

Requirements trace to PRD epics using the format `Traces to: E{n}.{m}`.
Source references point to files in this repo or the upstream `KooshaPari/colab` fork.

---

## FR-SYNC: Upstream Fork Synchronization

### FR-SYNC-001: Sync Documentation
**SHALL** provide `UPSTREAM_SYNC.md` at the repo root documenting the full sync process: fetch upstream changes, merge into main, apply phenotype extensions, test, and push to origin.
**Traces to:** E1.1
**Source:** `UPSTREAM_SYNC.md`

### FR-SYNC-002: Extension Directory Isolation
**SHALL** place all Phenotype-specific source code exclusively under `src/` and never modify upstream files in `app/`, `src/main/`, `src/renderers/`, or `src/pty/` of the `KooshaPari/colab` fork.
**Traces to:** E1.2
**Source:** `src/` directory structure

### FR-SYNC-003: Extension Entry Point Registry
**SHALL** list all extension entry points in `UPSTREAM_SYNC.md` under an "Extension Points" section so that each can be reapplied after an upstream merge without omission.
**Traces to:** E1.1, E1.2
**Source:** `UPSTREAM_SYNC.md` Extension Points section

### FR-SYNC-004: Upstream Conflict Check Task
**SHALL** provide a `sync:check` task in `src/Taskfile.yml` that exits non-zero if any file in `src/` shadows a file under the upstream paths `src/main/`, `src/renderers/`, or `src/pty/`.
**Traces to:** E4.2
**Source:** `src/Taskfile.yml`

### FR-SYNC-005: Upstream Sync Task
**SHALL** provide a `sync:upstream` task in `src/Taskfile.yml` that executes the documented sync process (fetch + merge + extension reapply).
**Traces to:** E1.1
**Source:** `src/Taskfile.yml`

---

## FR-WFP: Webflow Plugin — Manifest and Activation

### FR-WFP-001: Plugin Manifest Format
**SHALL** include a `colab-plugin` key in `src/webflow-plugin/package.json` with `displayName`, `description`, `main`, `contributes.commands`, `contributes.webviewHooks`, `entitlements`, and `activationEvents` fields.
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin`

### FR-WFP-002: Plugin Activation on Startup
**SHALL** set `activationEvents: ["*"]` so the Webflow plugin loads on every co(lab) application start.
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.activationEvents`

### FR-WFP-003: Command Manifest Registration
**SHALL** register exactly five commands in `colab-plugin.contributes.commands`:
- `webflow.init` — "Initialize Webflow Project"
- `webflow.sync` — "Sync DevLink Components"
- `webflow.share` — "Share Code Components Library"
- `webflow.deploy` — "Deploy to Webflow Cloud"
- `webflow.uploadAssets` — "Upload Assets to Webflow"
**Traces to:** E2.1, E2.2, E2.3, E2.4, E2.5
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.contributes.commands`

### FR-WFP-004: Webview Hook Registration
**SHALL** register `onLoad` in `colab-plugin.contributes.webviewHooks` to initialize the plugin when the co(lab) webview loads.
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.contributes.webviewHooks`

### FR-WFP-005: Filesystem Entitlement
**SHALL** declare `entitlements.filesystem.read: true` and `entitlements.filesystem.write: true` with the reason "Reads and writes DevLink components, Cloud project files, and asset configurations".
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.filesystem`

### FR-WFP-006: Network Entitlement
**SHALL** declare `entitlements.network.internet: true` with `domains: ["api.webflow.com", "webflow.com", "*.webflow.io"]` and no additional domains.
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.network`

### FR-WFP-007: Process Entitlement
**SHALL** declare `entitlements.process.spawn: true` with the reason "Runs Webflow CLI commands for DevLink sync and library sharing".
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.process`

### FR-WFP-008: Terminal Entitlement
**SHALL** declare `entitlements.terminal.commands: true` with the reason "Registers 'wf' terminal command for Webflow operations".
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.terminal`

### FR-WFP-009: Sensitive Credentials Entitlement
**SHALL** declare `entitlements.sensitive.credentials: true` with the reason "Stores and manages Webflow OAuth tokens securely".
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.sensitive`

### FR-WFP-010: UI Contribution Entitlements
**SHALL** declare `entitlements.ui.statusBar: true`, `entitlements.ui.contextMenu: true`, `entitlements.ui.fileDecorations: true`, and `entitlements.ui.notifications: true`.
**Traces to:** E2.6
**Source:** `src/webflow-plugin/package.json` — `colab-plugin.entitlements.ui`

---

## FR-INIT: Webflow Plugin — Project Initialization

### FR-INIT-001: Init Command Entry Point
**SHALL** expose a `webflow.init` command handler in `src/webflow-plugin/src/index.ts` that creates a `.webflow/config.json` in the active co(lab) project root.
**Traces to:** E2.2
**Source:** `src/webflow-plugin/src/index.ts`

### FR-INIT-002: OAuth Token Validation Before Write
**SHALL** validate the provided OAuth token against `https://api.webflow.com` before writing any config files; on validation failure the command SHALL exit with a user-visible notification containing the API error message and SHALL NOT write any partial config.
**Traces to:** E2.2
**Source:** `src/webflow-plugin/src/index.ts` — `initProject()`

### FR-INIT-003: Config File Structure
**SHALL** write `.webflow/config.json` with at minimum `siteId`, `devlink.outputDir`, and `components.sourceDir` fields.
**Traces to:** E2.2
**Source:** `src/webflow-plugin/src/index.ts`

### FR-INIT-004: Credential Storage
**SHALL** store the OAuth token via co(lab)'s `sensitive.credentials` API, not in plaintext in `.webflow/config.json` or any other file on disk.
**Traces to:** E2.2
**Source:** `src/webflow-plugin/src/index.ts`

---

## FR-SYNC2: Webflow Plugin — DevLink Sync

### FR-SYNC2-001: Sync Command Entry Point
**SHALL** expose a `webflow.sync` command handler that invokes the Webflow DevLink API to pull components into the configured `devlink.outputDir`.
**Traces to:** E2.1
**Source:** `src/webflow-plugin/src/index.ts`

### FR-SYNC2-002: Sync Status Bar Update
**SHALL** update the co(lab) status bar item with the last sync timestamp upon successful completion of `webflow.sync`.
**Traces to:** E2.1
**Source:** `src/webflow-plugin/src/index.ts`

### FR-SYNC2-003: Sync File Decoration
**SHALL** apply file decorations to `.webflow/config.json` and all files in `devlink.outputDir` after sync to visually mark them as Webflow-managed.
**Traces to:** E2.1
**Source:** `src/webflow-plugin/src/index.ts`

### FR-SYNC2-004: Sync Error Notification
**SHALL** surface sync errors as co(lab) notifications containing the full error message; sync errors SHALL NOT fail silently.
**Traces to:** E2.1
**Source:** `src/webflow-plugin/src/index.ts`

---

## FR-SHARE: Webflow Plugin — Code Component Sharing

### FR-SHARE-001: Share Command Entry Point
**SHALL** expose a `webflow.share` command handler that publishes TypeScript code components from `components.sourceDir` to the Webflow Code Components library.
**Traces to:** E2.3
**Source:** `src/webflow-plugin/src/index.ts`

### FR-SHARE-002: Pre-Publish Confirmation
**SHALL** display a confirmation prompt listing all components to be published before executing any API call; publishing SHALL be aborted if the user declines.
**Traces to:** E2.3
**Source:** `src/webflow-plugin/src/index.ts`

### FR-SHARE-003: Published Component Audit Log
**SHALL** write published component IDs and timestamps to `.webflow/published-components.json` after each successful `webflow.share` invocation.
**Traces to:** E2.3
**Source:** `src/webflow-plugin/src/index.ts`

---

## FR-DEPLOY: Webflow Plugin — Cloud Deployment

### FR-DEPLOY-001: Deploy Command Entry Point
**SHALL** expose a `webflow.deploy` command handler that triggers a Webflow Cloud deployment via the Webflow API.
**Traces to:** E2.4
**Source:** `src/webflow-plugin/src/index.ts`

### FR-DEPLOY-002: Deployment Progress Notification
**SHALL** show a co(lab) notification with a progress indicator for the duration of the deployment; the notification SHALL update to show success or failure on completion.
**Traces to:** E2.4
**Source:** `src/webflow-plugin/src/index.ts`

### FR-DEPLOY-003: Deployment Completion Link
**SHALL** include a direct link to the deployed site URL in the success notification.
**Traces to:** E2.4
**Source:** `src/webflow-plugin/src/index.ts`

### FR-DEPLOY-004: Deployment Error Surfacing
**SHALL** surface the full Webflow API error message in the failure notification; deployment errors SHALL NOT fail silently.
**Traces to:** E2.4
**Source:** `src/webflow-plugin/src/index.ts`

---

## FR-ASSET: Webflow Plugin — Asset Upload

### FR-ASSET-001: Asset Upload Command Entry Point
**SHALL** expose a `webflow.uploadAssets` command available in the co(lab) file tree context menu for selected files.
**Traces to:** E2.5
**Source:** `src/webflow-plugin/src/index.ts`

### FR-ASSET-002: Asset Map Write
**SHALL** write uploaded asset URLs and local paths to `.webflow/asset-map.json` after each successful upload.
**Traces to:** E2.5
**Source:** `src/webflow-plugin/src/index.ts`

### FR-ASSET-003: Network Scope Enforcement
**SHALL** restrict all network calls in `webflow.uploadAssets` to `api.webflow.com` only; no other domains SHALL be contacted during upload.
**Traces to:** E2.5
**Source:** `src/webflow-plugin/package.json` — `entitlements.network.domains`

---

## FR-SPEC: Spec Structure and AgilePlus Alignment

### FR-SPEC-001: Spec Directory Location
**SHALL** place all spec documents (`PRD.md`, `FUNCTIONAL_REQUIREMENTS.md`) at `src/specs/` within this repository.
**Traces to:** E3.1
**Source:** `src/specs/`

### FR-SPEC-002: PRD Epic Numbering
**SHALL** use `E{n}.{m}` numbering for all PRD epics and stories so that FUNCTIONAL_REQUIREMENTS can trace to them.
**Traces to:** E3.1
**Source:** `src/specs/PRD.md`

### FR-SPEC-003: FR Traceability Format
**SHALL** include a `Traces to: E{n}.{m}` field on every functional requirement.
**Traces to:** E3.1, E3.2
**Source:** `src/specs/FUNCTIONAL_REQUIREMENTS.md`

---

## FR-CI: Build and Quality

### FR-CI-001: Typecheck Task
**SHALL** provide a `typecheck` task in `src/Taskfile.yml` that runs `tsc --noEmit` on the webflow-plugin source with zero errors.
**Traces to:** E4.1
**Source:** `src/Taskfile.yml`

### FR-CI-002: Lint Task
**SHALL** provide a `lint` task in `src/Taskfile.yml` that runs biome check on all TypeScript files under `src/webflow-plugin/src/`.
**Traces to:** E4.1
**Source:** `src/Taskfile.yml`

### FR-CI-003: Build Task
**SHALL** provide a `build` task in `src/Taskfile.yml` that compiles the webflow-plugin to a distributable JavaScript bundle.
**Traces to:** E4.1
**Source:** `src/Taskfile.yml`

### FR-CI-004: webflow-api Dependency Version
**SHALL** declare `webflow-api >= 3.1.2` as a production dependency in `src/webflow-plugin/package.json`; versions below 3.1.2 SHALL NOT be used.
**Traces to:** E2.1, E2.2, E2.3, E2.4, E2.5
**Source:** `src/webflow-plugin/package.json` — `dependencies.webflow-api`
