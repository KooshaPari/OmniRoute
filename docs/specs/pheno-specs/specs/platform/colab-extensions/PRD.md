# Product Requirements Document — phenotype-colab-extensions

**Version:** 1.0.0
**Status:** ACTIVE
**Owner:** Phenotype Engineering
**Last Updated:** 2026-03-27

---

## Overview

`phenotype-colab-extensions` is the Phenotype-specific extension layer on top of the `KooshaPari/colab` fork of `blackboardsh/colab`. The upstream `colab` is a hybrid browser + local code editor built with [Electrobun](https://github.com/blackboardsh/electrobun), providing Monaco-powered editing, Chromium/WebKit browser tabs, a PTY terminal, Git integration, and a plugin architecture. This extensions repo serves two purposes:

1. **Specs and governance** — AgilePlus-aligned product specs, functional requirements, and architecture decision records for the Phenotype fork.
2. **Extension code** — Phenotype-specific plugins (webflow-plugin), CI workflows, and integration tooling that are maintained separately to keep the fork close to upstream.

The extension model uses `colab`'s native plugin architecture: each extension is a TypeScript module with a `colab-plugin` manifest declaring commands, webview hooks, and entitlements (filesystem, network, process, terminal, sensitive, ui).

---

## E1: Fork Governance and Upstream Sync

### E1.1: Upstream Tracking

**As** a Phenotype engineer,
**I want** the `KooshaPari/colab` fork to stay synchronized with `blackboardsh/colab`,
**So that** Phenotype benefits from upstream improvements without losing local customizations.

**Acceptance Criteria:**
- `UPSTREAM_SYNC.md` documents the sync process: fetch, merge, apply extensions, test, push.
- Extension code lives exclusively in `src/` and is not commingled with upstream `src/`.
- Upstream-only files are never modified; all Phenotype additions use distinct namespaces.
- The Taskfile (`src/Taskfile.yml`) provides a `sync:upstream` task that executes the documented sync process.

### E1.2: Extension Isolation

**As** a Phenotype engineer,
**I want** all Phenotype-specific code to be isolated in designated directories,
**So that** future upstream merges can proceed without conflict.

**Acceptance Criteria:**
- `src/specs/` contains all AgilePlus-aligned spec documents (PRD, FR, ADRs).
- `src/webflow-plugin/` contains the Webflow integration plugin.
- `src/workflows/` contains Phenotype CI/CD workflow definitions.
- No modifications to upstream files in `app/`, `src/main/`, `src/renderers/`, or `src/pty/`.
- `UPSTREAM_SYNC.md` lists all extension entry points so they can be reapplied after merge.

---

## E2: Webflow Plugin

### E2.1: DevLink Component Sync

**As** a Webflow developer using co(lab),
**I want** to sync DevLink components from a Webflow project into my local repo,
**So that** design-to-code components stay current without manual copy-paste.

**Acceptance Criteria:**
- `webflow.sync` command syncs DevLink components from the connected Webflow project.
- Sync reads the Webflow OAuth token from secure credential storage.
- Sync targets are written to the configured `devlink.outputDir` in the project root.
- File decorations appear on Webflow config files in the co(lab) file tree.
- A status bar item shows the last sync timestamp and current connection state.
- Sync errors surface as user-visible notifications (not silent failures).

### E2.2: Project Initialization

**As** a Webflow developer,
**I want** to initialize a Webflow project configuration in my co(lab) workspace,
**So that** the plugin knows which Webflow site to target.

**Acceptance Criteria:**
- `webflow.init` command creates a `.webflow/config.json` in the project root.
- Initialization prompts for site ID and OAuth token (stored via co(lab) sensitive credentials entitlement).
- Init validates the token against `api.webflow.com` before writing config.
- Init fails loudly with the API error if authentication fails; no partial config written.

### E2.3: Code Component Sharing

**As** a design system maintainer,
**I want** to publish custom code components to a shared Webflow library,
**So that** all designers on the project can consume them in Webflow Designer.

**Acceptance Criteria:**
- `webflow.share` command publishes code components from the local workspace to the Webflow Code Components library.
- Components are discovered via the configured `components.sourceDir` path.
- A confirmation prompt lists components before publishing.
- Published component IDs are written to `.webflow/published-components.json` for auditability.

### E2.4: Cloud Deployment

**As** a developer,
**I want** to deploy my Webflow project to Webflow Cloud from within co(lab),
**So that** I can preview and publish without leaving the editor.

**Acceptance Criteria:**
- `webflow.deploy` command triggers a Webflow Cloud deployment via the Webflow API.
- Deployment progress is shown as a notification with a progress indicator.
- Completion notification includes a direct link to the deployed site.
- Deployment errors surface the full API error message.

### E2.5: Asset Upload

**As** a developer,
**I want** to upload static assets (images, fonts) directly to Webflow from co(lab),
**So that** I can manage asset hosting without opening the Webflow dashboard.

**Acceptance Criteria:**
- `webflow.uploadAssets` command uploads selected files to the Webflow asset library.
- Asset selection uses the co(lab) file tree context menu (`webflow.uploadAssets` command in `contextMenu`).
- Uploaded asset URLs are written to `.webflow/asset-map.json`.
- Upload respects `api.webflow.com` domain entitlement; no other network access.

### E2.6: Plugin Activation and Entitlements

**As** the co(lab) plugin host,
**I want** the Webflow plugin to declare minimal, precise entitlements,
**So that** the plugin runtime can sandbox it appropriately.

**Acceptance Criteria:**
- Plugin manifest (`colab-plugin`) declares `filesystem.read: true`, `filesystem.write: true` for DevLink output directories.
- Plugin manifest declares `network.internet: true` with domains `api.webflow.com`, `webflow.com`, `*.webflow.io`.
- Plugin manifest declares `process.spawn: true` for Webflow CLI subprocess invocations.
- Plugin manifest declares `terminal.commands: true` for registering the `wf` terminal command.
- Plugin manifest declares `sensitive.credentials: true` for OAuth token storage.
- Plugin manifest declares `ui.statusBar`, `ui.contextMenu`, `ui.fileDecorations`, `ui.notifications` for all UI contribution points.
- `activationEvents: ["*"]` ensures the plugin loads on startup.

---

## E3: AgilePlus Spec Integration

### E3.1: Spec Document Structure

**As** a Phenotype product manager,
**I want** `phenotype-colab-extensions` to maintain AgilePlus-aligned specs for the colab fork,
**So that** all development work is tracked and traceable.

**Acceptance Criteria:**
- `src/specs/PRD.md` contains product requirements with E{n}.{m} epic numbering.
- `src/specs/FUNCTIONAL_REQUIREMENTS.md` contains FR-{CAT}-NNN requirements tracing to PRD epics.
- All spec documents use the Phenotype standard format (version, status, owner, last updated header).
- Specs reference actual upstream plugin API surface (`colab-plugin` manifest schema).

### E3.2: AgilePlus Work Tracking

**As** a Phenotype engineer,
**I want** all colab extension development to be tracked in AgilePlus before implementation,
**So that** the project has full spec-to-code traceability.

**Acceptance Criteria:**
- `src/specs/` directory includes AgilePlus spec artifacts (spec JSON files or markdown) linked to the main AgilePlus instance.
- Every implemented feature traces to a specific FR ID in `FUNCTIONAL_REQUIREMENTS.md`.
- The `Taskfile.yml` includes a `specs:validate` task that checks FR coverage.

---

## E4: CI/CD and Quality

### E4.1: Build Verification

**As** a Phenotype engineer,
**I want** CI to verify that the extension code compiles and passes type checks,
**So that** PRs are blocked if the Webflow plugin is broken.

**Acceptance Criteria:**
- `src/Taskfile.yml` provides a `build` task that compiles the webflow-plugin TypeScript.
- `src/Taskfile.yml` provides a `typecheck` task that runs `tsc --noEmit` on the plugin.
- `src/Taskfile.yml` provides a `lint` task that runs biome on extension source files.
- CI workflow in `src/workflows/ci.yml` runs `typecheck` and `lint` on every PR.

### E4.2: Upstream Sync Verification

**As** a Phenotype engineer,
**I want** automated checks to verify that extensions do not conflict with upstream files,
**So that** sync merges do not break extension functionality.

**Acceptance Criteria:**
- The `src/Taskfile.yml` `sync:check` task verifies that no extension files overlap with upstream paths.
- The check exits non-zero if any extension file shadows a file in upstream `src/main/`, `src/renderers/`, or `src/pty/`.

---

## E5: Developer Documentation

### E5.1: Extension Author Guide

**As** a Phenotype developer adding a new extension,
**I want** clear documentation on how to scaffold and register a new colab plugin,
**So that** I can follow the pattern established by the webflow-plugin.

**Acceptance Criteria:**
- `README.md` describes the extension layout with a path-to-purpose table.
- `README.md` links to the upstream `blackboardsh/colab` plugin documentation.
- `UPSTREAM_SYNC.md` describes all extension entry points that must be preserved during upstream merges.
- A new plugin can be scaffolded following the `src/webflow-plugin/` directory structure and manifest pattern.

### E5.2: Webflow Plugin Usage Guide

**As** a developer using co(lab) with the Webflow plugin,
**I want** documentation describing setup, authentication, and each command,
**So that** I can use the plugin without reading the source code.

**Acceptance Criteria:**
- `src/webflow-plugin/README.md` documents all five commands: `webflow.init`, `webflow.sync`, `webflow.share`, `webflow.deploy`, `webflow.uploadAssets`.
- Documentation includes prerequisites (Webflow API token, co(lab) version requirements).
- Documentation lists all file paths written or modified by the plugin.
