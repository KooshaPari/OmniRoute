## Work State

| Field | Value |
|---|---|
| Last commit | 2026-06-08 16:53:09 -0700 |
| Open issues | 0 |
| Open PRs | 1 |
| Focus | discord-issue-bridge |

Progress: ████████░░ 80%

# Managing GitHub Issues via Discord Threads

[![AI Slop Inside](https://sladge.net/badge.svg)](https://sladge.net)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://github.com/KooshaPari/AtomsBot/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/KooshaPari/AtomsBot/actions/workflows/build-and-release.yml)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6.svg?logo=typescript&logoColor=white)](package.json)

**Status:** stable

This Discord bot serves as a seamless bridge between Discord thread channel and GitHub repository issues, enabling efficient issue management and synchronization between the two platforms. This integration allows for efficient project management, ensuring that actions performed on either Discord or GitHub are reflected in both platforms, facilitating smoother collaboration and issue tracking across teams.

## Functionality Overview

#### Issues

- \[x] Discord Post Creation -> Automatically generates a corresponding GitHub issue.
- \[ ] GitHub Issue Creation -> Pending feature: Creation of Discord posts from GitHub issues.

#### Comments

- \[x] Discord Post Comments -> Mirrored as comments on associated GitHub issues.
- \[ ] GitHub Issue Comments -> Pending feature: Synchronization with Discord post comments.

#### Tags & Labels

- \[x] Discord Post Tags -> Translated into GitHub issue labels for better categorization.
- \[ ] Discord Post Tag Changes -> Future implementation: Update GitHub issue labels from Discord.
- \[ ] GitHub Issue Label Changes -> Future implementation: Reflect changes in Discord post tags from GitHub.

#### Locking & Unlocking

- \[x] Discord Post Lock/Unlock -> Corresponding action on GitHub issues for security or access control.
- \[x] GitHub Issue Lock/Unlock -> Syncing locking status with Discord posts.

#### Open/Close Management

- \[x] Discord Post Open/Close -> Triggers opening or closing of related GitHub issues.
- \[x] GitHub Issue Open/Close -> Update Discord post status based on GitHub issue status.

#### Deletion Actions

- \[x] Discord Post Deletion -> Initiates the removal of the associated GitHub issue.
- \[x] GitHub Issue Deletion -> Sync deletion actions from GitHub to Discord posts.

#### Attachment Support

- \[x] Supported File Types: png, jpeg
- \[ ] Planned Support: gif, text, video

#### Slash Commands

- \[x] `/bug-report` - Create detailed bug reports via modal form
- \[x] `/feature-request` - Submit feature requests with priority levels
- \[x] `/assign @user` - Assign GitHub issues to team members
- \[x] `/priority <level>` - Set issue priority (Critical/High/Medium/Low/None)
- \[x] `/status <state>` - Update issue status (Open/Closed/Lock/Unlock)
- \[x] `/label add/remove` - Manage GitHub issue labels
- \[x] `/help` - Show available commands and usage information

## Local development

This repo uses [Bun](https://bun.sh) (`bun.lock`). CI runs `bun install --frozen-lockfile`, `bun run build`, and `bun run test:unit`.

```bash
bun install
bun run build
bun run test:unit
```

`npm run …` remains supported if you prefer Node’s npm CLI with the same scripts.

## Installation Steps

#### Creating bot

Create bot https://discord.com/developers/applications?new_application=true

Bot settings:

- \[x] PRESENCE INTENT
- \[x] MESSAGE CONTENT INTENT

Invite url: https://discord.com/api/oauth2/authorize?client_id=APPLICATION_ID&permissions=0&scope=bot

#### env

- DISCORD_TOKEN - Discord developer bot page "Settings->bot->reset token" (https://discord.com/developers/applications/APPLICATION_ID/bot)
- DISCORD_CHANNEL_ID - In the Discord server, create a forum channel and right-click (RMB) to copy the channel ID (developer settings must be turned on for this). Alternatively, you can copy the ID from the link. Example:
  https://discord.com/channels/<GUILD_ID>/<DISCORD_CHANNEL_ID>
- GITHUB_ACCESS_TOKEN
  1. [New Fine-grained Personal Access Token](https://github.com/settings/personal-access-tokens/new) or follow these steps: Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token.
  2. In the "Repository access" section, select "Only select repositories" and choose the specific repositories you need access to.
  3. In the "Permissions" section, click on "Repository permissions" and set "Issues" to "Read & Write".
  4. Generate and copy the personal access token.
- GITHUB_USERNAME - example: https://github.com/<GITHUB_USERNAME>/<GITHUB_REPOSITORY>
- GITHUB_REPOSITORY

> **_NOTE:_** For detailed information about personal access tokens, visit the [Managing your personal access tokens - GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

#### PM Provider (Jira, Linear, GitHub Projects)

- `PM_PROVIDER` selects the project management backend used by the bot for creating/updating/transitioning issues:
  - `jira` (default): uses Jira Cloud
  - `linear`: uses Linear GraphQL API
  - `github_projects`: uses GitHub Projects (v2) GraphQL API

Provider-specific variables:
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` (optional: `JIRA_SPRINT_FIELD`)
- Linear: `LINEAR_API_KEY` (optional: `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID`)
- GitHub Projects: `GITHUB_PROJECTS_ORG` and either `GITHUB_PROJECTS_NUMBER` or `GITHUB_PROJECTS_ID` (reuses `GITHUB_ACCESS_TOKEN`)

No code changes are required: existing flows import `jiraService`, which transparently proxies to the selected provider with full functional parity (create/get/update, comment, assign/unassign, delete, transitions: resolve/close/reopen).

#### Deploy slash commands

Before starting the bot, deploy the slash commands globally:

```bash
npm run deploy-commands
```

#### Start bot

```bash
npm run dev
```

or

```bash
npm run build && npm run start
```

Forward for github webhooks:

```bash
ssh -R 80:localhost:5000 serveo.net

## Smart Embed Auto-Refresh (Optional)

You can enable periodic background refresh of all Smart Embeds to keep dynamic fields up to date (e.g., external status links, calculated stats).

- Env var: `SMART_EMBED_REFRESH_INTERVAL`
- Type: integer (seconds)
- Recommended ranges:
  - `30–60` for active development and demos
  - `120–300` for typical production usage
  - `0` or unset to disable

When set to a value > 0, the Smart Embed Framework automatically schedules `smartEmbedManager.refreshAll()` on that interval. The scheduler starts when the framework initializes and stops on shutdown.
```

## Setup Command (Forums/Teams/Secrets)

Use `/setup` to configure without editing env vars (preferred):

- `/setup forums set forum_id:<id> channel:<#forum>`: map logical forum IDs (e.g., `backend-ai-features`) to Discord Forum channels (DB-backed)
- `/setup forums list`: view current forum→channel mappings
- `/setup secrets set ...`: set GitHub/Jira credentials; stored in DB and override env when supported
- `/setup google set|test ...`: set Google OAuth + Calendar (client id/secret/redirect, primary calendar id, webhook, etc.)
- `/setup vercel set|test|group|map ...`: configure Vercel token, team/project, groups, and repo mappings
- `/setup provider set|show|import-projects-status …`: configure PM provider + secrets; import GitHub Projects status options mapping
  - `/setup provider discover-projects-fields` lists GitHub Projects v2 fields and IDs for your project.
- `/setup team list|add|remove`: manage per-team settings (name, emoji/color, forum ids, GH/Jira targets)

Tip: If you see “Forum channel ID not configured”, map it with `/setup forums set`.

## DB-First Setup (Recommended)

- Map forums to channels using `/setup forums set` (persisted in DB).
- Create or link teams with `/setup team add` or `/setup team role-set` (roles are created/linked automatically; stored in DB).
- Optional: set GitHub/Jira secrets via `/setup secrets set` (DB overrides env).
- Legacy env variables for forum channels and team role IDs are no longer required.

## Deployments Forum (Draft)

- Map a deployments forum channel:
  - `/deployments set-forum channel:#deployments`
  - Or via setup: `/setup forums set forum_id:deployments channel:#deployments`
- Start a deployment post:
  - `/deployments start [env]` → fills a modal with:
    - Repo path (defaults to `/Users/kooshapari/temp-PRODVERCEL/485/clean/atoms.tech`)
    - Branch (optional; default `production`)
    - Deployment notes (optional)

What it does:
- Creates a forum thread named like `Production abc123 7/28/25`.
- Auto-detects the last deployed commit via Vercel CLI (fallback: previous deployment thread title, then `.deployments/last_prod`). Computes commits between last deployed and current `HEAD`, listing lines as `Name: commit description`.
- Parses the Vercel deployment URL automatically, sends rich embeds, updates status from Preparing → Deploying → Up, and posts a final message with an “Open Site” button. A button to “Add Notes” lets developers append follow-up notes after deploy.

Requirements:
- Vercel CLI installed and authenticated (`vercel` must be available on PATH) if using CLI provider. For API provider, configure token via `/setup vercel set`.

PM Providers and Mirroring
- Select provider via `/setup provider set pm_provider:<jira|linear|github_projects|multi>`.
- Defaults (overridable) per provider:
  - jira → PM_SYNC_CODA=true, PM_SYNC_ATOMS=true, others=false
  - linear → PM_SYNC_CODA=true, PM_SYNC_ATOMS=true, Jira/Projects=false
  - github_projects → PM_SYNC_CODA=true, PM_SYNC_ATOMS=true, Jira/Linear=false
  - multi → PM_SYNC_JIRA=true, PM_SYNC_CODA=true, PM_SYNC_ATOMS=true, Linear/Projects=false
- GitHub Projects status mapping:
  - Set `gh_projects_project_id` and `gh_projects_status_field_id`, then run `/setup provider import-projects-status`.
  - This populates `gh_projects_status_options_json` (name→optionId) used for transitions.
  - Optionally configure a text field for comments: `gh_projects_notes_field_id`. Comments will be written to this field when using Projects as provider.

Register commands after pulling changes:

```
npm run build && node update-commands.js
```

## License

MIT — see [LICENSE](./LICENSE).
