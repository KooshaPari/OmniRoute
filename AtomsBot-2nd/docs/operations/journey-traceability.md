# Journey Traceability

Implements the [phenotype-infra journey-traceability standard](https://github.com/kooshapari/phenotype-infra/blob/main/docs/governance/journey-traceability-standard.md).

## Traceability Model

Every user-facing or operator-facing flow should be traceable across:

1. **FR/NFR** — requirement ID and user story from `FUNCTIONAL_REQUIREMENTS.md` or `PRD.md`.
2. **Spec** — Discord/GitHub sync acceptance criteria and non-regression constraints.
3. **Docs** — operator/user documentation and rich media placeholders.
4. **Code** — Discord gateway, command handler, sync engine, thread manager, GitHub/Jira/Linear adapter, or web UI surface implementing the flow.
5. **Tests/Gates** — unit, integration, BDD, lint, and journey verification acting as autograders.
6. **Evidence** — journey manifest, recording/keyframes, and evaluation verdict.

## User-Facing Flows

| Flow | Requirement | Implementation surface | Autograder gates | Evidence status |
| --- | --- | --- | --- | --- |
| Discord command dispatch validates permissions | FR-ATOMSBOT-002, FR-ATOMSBOT-003 | command parser, command registry, permission checks | command fixture tests, permission matrix tests, BDD journey | Stubbed |
| Discord forum post creates GitHub issue | SPEC Discord Interface, Core Sync Engine | Discord event handler, thread manager, GitHub adapter | event fixture tests, GitHub contract tests, journey eval | Stubbed |
| Discord comments mirror to GitHub issue comments | README Comments shipped flow, sync engine | comment event handler, mapping store, GitHub comments adapter | comment fixture tests, idempotency tests, journey manifest | Stubbed |
| GitHub issue lock/close state syncs to Discord thread | README Lock/Open-Close shipped flow | GitHub webhook handler, Discord thread manager, mapping store | webhook fixture tests, Discord adapter contract, BDD journey | Stubbed |
| Operator audits sync failures and retries safely | PRD transparency/control goals | sync queue, retry/batch logic, observability UI/logs | retry tests, failure fixture tests, operator journey eval | Stubbed |

## Rich Media Stubs

<!-- RICH-MEDIA-STUB type="animated-gif" subject="Discord command dispatch with permission validation" journey="discord-command-permission-dispatch" status="TODO" -->
![Discord command dispatch — command, role/channel validation, handler result, and audit trace](../assets/rich-media/atomsbot/discord-command-permission-dispatch.gif)

*Expected capture: issue a Discord command from allowed and denied contexts, show permission decision, handler execution, and audit/log evidence without exposing secrets or tokens.*

<!-- RICH-MEDIA-STUB type="animated-gif" subject="Discord forum post creates GitHub issue" journey="discord-post-to-github-issue" status="TODO" -->
![Discord post to GitHub issue — forum post, mapped issue, labels, and backlink](../assets/rich-media/atomsbot/discord-post-to-github-issue.gif)

*Expected capture: create a Discord forum post, verify GitHub issue creation, labels/tags mapping, and bidirectional links between the post and issue.*

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Comment mirroring evidence" journey="discord-comment-to-github-comment" status="TODO" -->
![Comment mirroring — Discord reply, GitHub issue comment, author mapping, and idempotency marker](../assets/rich-media/atomsbot/discord-comment-to-github-comment.png)

*Expected capture: add a Discord reply, show the mirrored GitHub issue comment, and annotate idempotency/provenance fields used to prevent duplicate sync.*

<!-- RICH-MEDIA-STUB type="journey-eval" subject="GitHub issue state sync verdict" journey="github-state-to-discord-thread" status="TODO" -->
![GitHub state sync verdict — closed/locked issue, Discord thread state, and eval result](../assets/rich-media/atomsbot/github-state-to-discord-thread.png)

*Expected capture: close or lock a GitHub issue fixture, verify Discord thread state changes, and attach a pass/fail eval verdict for the bidirectional sync requirement.*

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Sync failure retry audit" journey="sync-failure-retry-audit" status="TODO" -->
![Sync failure retry audit — failed event, retry state, safe remediation, and final success](../assets/rich-media/atomsbot/sync-failure-retry-audit.png)

*Expected capture: inject a transient adapter failure, show retry/backoff state, operator-visible diagnostics, and successful replay without duplicate side effects.*

## Journey Manifests

Journey manifests should live in `docs/journeys/manifests/` and include:

- FR/NFR IDs covered by the journey;
- Discord event fixture, command, webhook, or GitHub fixture used to reproduce the flow;
- required test credentials or mocked adapter configuration;
- expected screenshots/GIFs/keyframes;
- tests and gates that must pass before the journey is accepted;
- eval verdict schema and pass/fail criteria.

## Autograder Gates

Minimum gates before marking a journey complete:

- command parser and registry unit tests;
- permission matrix tests for command execution;
- Discord and GitHub adapter contract tests with deterministic fixtures;
- idempotency tests for comment/status synchronization;
- BDD journey replay for user-visible sync flows;
- secret-scan and least-privilege workflow gates for bot credentials;
- doc link validation for every referenced rich media asset;
- journey manifest validation via `phenotype-journey verify` when available;
- eval verdict linked to the FR/NFR IDs in the manifest.

## Status

- [x] Identify initial Discord/GitHub user-facing flows
- [x] Stub rich media embeds for expected screenshots/GIFs/evals
- [ ] Author manifests in `docs/journeys/manifests/`
- [ ] Record journey captures for each flow
- [ ] Run `phenotype-journey verify` in CI
