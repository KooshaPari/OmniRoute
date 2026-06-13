# Agents and Integrations

This repository primarily ships a Discord-centric automation that coordinates GitHub (and optionally Jira). While it does not ship multiple distinct AI agent binaries, it is designed to be agent-friendly:

- Clear command boundaries suitable for agent invocation (/assign, /label, /status, /link, /issue)
- Webhook-driven state updates suitable for event-driven agent workflows
- Separation between handlers and API access (githubActions, jiraClient) enables simulation and planning layers

## Extending with Agents
- Cursor / Claude / Code LLMs can manipulate commands and handlers safely through tests:
  - Add a command or extend behavior → write tests first
  - Ensure mocks cover new API calls
- A CLI wrapper can call commands programmatically via a thin adapter to Discord interaction objects

## Patterns for Agent Builders
- Stable function signatures and return shapes in commands
- getRepoCredentialsForThread provides single-source-of-truth for repo context resolution
- Auto-linker exposes a deterministic resolution pipeline that agents can invoke before higher-level actions

## Suggested Contribs
- CLI runner for commands (simulate ChatInputCommandInteraction)
- Agent policies: map intents to commands with guardrails
- Additional webhook handlers for PRs, reviews, workflows

