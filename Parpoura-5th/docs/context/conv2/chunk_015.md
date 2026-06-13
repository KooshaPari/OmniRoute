### **You**

You can get way further with boring compliance automation than with clever “optimization.” For a zero-HITL system, the goal is:

minimize legal surface area early

make every compliance obligation machine-checkable

don’t let agents improvise in regulated zones

Below is what you actually need (tax/legal/compliance + “optimization”) in a stack-friendly way.

1) Legal structure: what to set up first
Minimum viable (Year 1)

One real business entity + one treasury account (vault)

One payment processor (Stripe) + signed webhooks (authenticated events)

One internal ledger (append-only) + policy engine

You can stay simple (single entity) until you have real revenue. Don’t spawn multiple entities early unless you must.
When to split entities (later)
Split when you have:

meaningful revenue across multiple ventures, or

higher-liability product lines (physical goods, regulated verticals), or

cross-border operations where jurisdiction matters.

2) Contractor / vendor compliance (this will bite you fast)
If agents hire people (Upwork/Fiverr/etc.), you need:

Collect W-9 from contractors you pay directly (store securely)

Track payments per contractor per year

Issue Form 1099-NEC when required

Keep vendor records and payment history

IRS guidance: 1099-NEC generally applies when you pay $600+ in a year to a non-employee for services; IRS also notes a change to $2,000 for payments after Dec 31, 2025 (starting 2026). IRS+2IRS+2
Zero-HITL implication: your procurement workflow must automatically:

request W-9 before “approved vendor” status

enforce payment caps until tax profile exists

log everything in the ledger

3) Email / outbound compliance (cold GTM)
If you do cold email, you must obey the basic CAN-SPAM requirements:

no false/misleading headers

non-deceptive subject

clear opt-out mechanism + honor opt-outs

include a valid physical postal address Legal Information Institute

Zero-HITL implication: you need an automated suppression list + a hard rule:

once opted out, the system must never email again (no exceptions)

4) Privacy compliance (you’re in California)
If you collect personal info from Californians, CCPA/CPRA rights include:

notice at/near collection (what you collect + why)

right to delete / correct

right to opt-out of sale/sharing (and “Do Not Sell or Share” link if applicable) California DOJ

Zero-HITL implication: build privacy as features:

a “data export” endpoint

a “delete my data” endpoint

a “do not sell/share” toggle if you do targeted ads/sale/sharing

retention rules (auto-delete data you don’t need)

Also: avoid “selling/sharing” definitions pitfalls by keeping tracking minimal early.

5) Card/VCC compliance (if you go programmable VCC / Issuing)
Stripe explicitly flags PCI considerations for virtual card details:

Issuing Elements is the compliant way to display card details without them passing through your servers

If you retrieve/store full card number/CVC yourself, you’re in a much harder PCI world

If issuing cards to your users, you might be considered a PCI Service Provider and need PCI compliance Stripe Docs

Zero-HITL implication (strong recommendation):

agents never see card PAN/CVC

your Money API issues cards and enforces spend by real-time authorization rules

keep card details out of your infrastructure entirely

6) Taxes: what to automate from Day 1
Even before you “optimize,” you need accuracy:
Always-on automations

categorize every transaction

reconcile Stripe payouts with ledger

track refunds/chargebacks/fees separately

month-end P&L snapshot

“commitments ledger” (subscriptions/recurring spend)

Sales tax / VAT
This depends on where you sell and what you sell (digital goods vary by state/country). Early on, the safest approach is:

sell digital services/software with clear invoices

keep physical goods later

if you scale, use a sales tax automation tool or keep a strict “no nexus expansion without policy approval” rule

(We’d normally web-verify current nexus thresholds by state; those change. If you want, I can build the policy scaffolding and you fill thresholds from your chosen tax engine.)

7) “Optimization” that actually matters (and doesn’t backfire)
Tax “optimization” is mostly:

clean books

correct classification

deductible expense capture

avoiding penalties

timing (when you’re large enough to justify complexity)

For zero-HITL, optimization is policy-as-code:
A) Expense policy

every spend must have:

venture\_id, workflow\_id

evidence hash (invoice/receipt)

category

auto-deny payments without metadata

B) Liability minimization policy

avoid regulated verticals early (medical, finance advice, etc.)

keep marketing claims conservative (no guarantees)

standard refund policy

C) Jurisdiction minimization policy

don’t expand into complex regions until revenue justifies the compliance overhead

8) Do you need blockchain / smart contracts / zk for compliance?
Not for Year 1–2.
What you can do cheaply that gets 80% of the benefit:

append-only ledger + hash chain

periodic Merkle root anchoring (optional)

Smart contracts/zk become interesting later for:

escrow + milestone payments with proofs

private “proof of reserves” / solvency proofs
…but they increase key-custody risk and irreversibility.

9) What to build first in your stack (practical ordering)
If you want this to run autonomously without blowing up:

Ledger + policy engine (EAU + commitments + approvals)

Money API firewall (default deny, idempotent)

Vendor onboarding (W-9 capture + pay caps + 1099 tracking)

Outbound compliance (CAN-SPAM suppression + opt-out)

Privacy endpoints (CCPA basics + retention rules)

Only then add programmable VCC/Issuing at scale (keeping PCI blast radius small) Stripe Docs

If you want the next deliverable, I’ll write a machine-executable “Compliance Policy Pack” (JSON/YAML) that your policy engine enforces, including:

W-9/1099 rules (with the 2026 threshold change noted) IRS

CAN-SPAM requirements as checks Legal Information Institute

CCPA minimum privacy endpoints + retention rules California DOJ

PCI/Issuing constraints (no PAN/CVC exposure) Stripe Docs

---

### **ChatGPT**

Can we automate via hr/legal/fin/acct agent departments and systems?

---

### **ChatGPT**

Yes — you can automate HR/legal/finance/accounting as agent departments, but only if you structure them like controlled workflows with strict permissions, not “chatbots that decide things.”
Think of it as an org chart where each department is a policy-enforcing service backed by agents, templates, and vendor APIs.
Below is the clean model.

1) The right structure: departments as workflow services
Each “department” is:

Inbox (events/tasks coming in)

Playbooks (templated responses + checklists)

Policy engine gates (what’s allowed / forbidden)

Tool adapters (Stripe, bank/VCC, payroll, e-sign, ticketing)

Audit ledger (hash-chained logs)

Agents do analysis and drafting, but systems enforce rules.

2) Department blueprint (applies to all)
Roles inside a department

Triage agent (read-only): reads requests, classifies, extracts facts

Planner agent: proposes action in a structured schema (not prose)

Verifier agent: checks policy + completeness + risk

Executor agent: calls tools (money API, e-sign, filings)

Auditor agent: logs, reconciles, emits “trust/compliance events”

No single agent can do all five.
Department outputs must be machine-checkable
Examples:

vendor\_onboarding\_decision.json

1099\_queue.csv

refund\_decision.json

contract\_redline.md (plus structured diff summary)

monthly\_close\_report.json

3) Finance + Treasury department (highest priority)
This is your “central bank.”
Responsibilities

Cashflow tracking (actuals + commitments + forecasts)

Spend approvals (Purchase Intents → VCC issuance)

Stripe reconciliation (payouts, fees, refunds, disputes)

Budget enforcement in EAU (tokens + $ + predicted burn)

“Freeze mode” during anomalies

Tooling/system pieces

Money API (default-deny, idempotent)

VCC/Issuing integration

Stripe webhooks verified

Ledger + reconciliation jobs (daily, weekly, monthly)

Key automation workflows

Purchase Intent workflow

propose → verify → issue VCC → authorize → reconcile → close

Daily close

revenue, burn, runway, anomalies

Monthly close

P&L, balance sheet snapshot, vendor payables, tax accrual estimates

This department makes zero-HITL financially survivable.

4) Accounting department (bookkeeping + compliance outputs)
This is your “books as code.”
Responsibilities

Transaction classification

Receipts/invoice capture and linking to spend intents

Vendor ledger (payables)

1099 tracking (threshold-based)

Sales tax/VAT tracking when applicable (later)

Automation workflows

Auto-categorize every transaction into chart of accounts

Attach evidence requirement: no receipt → expense flagged → policy reduces future spend for that workflow/vendor

Contractor threshold monitor: when a vendor approaches reporting threshold, queue required docs (W-9) and reporting actions

Agents can draft and prepare, but the system should enforce “no evidence, no spend.”

5) HR department (only if you hire humans)
This can be mostly automated if you keep hiring structured.
Responsibilities

Vendor/contractor onboarding (identity + tax forms + payment method)

Role definitions + access provisioning (least privilege)

Performance scoring + termination triggers

Policy: scope control (prevent scope creep)

Automation workflows

Contractor onboarding

require tax form + identity checks (as required)

create vendor profile

assign payment caps + VCC rules

Milestone delivery

deliverable → QA pass → pay release

Performance system

late deliveries / rework / disputes → vendor trust score drops → auto-rotation or ban

HR here is basically: “vendor management + access control,” not traditional corporate HR.

6) Legal department (automate what’s safe; escalate what’s not)
Legal is where you must be honest: agents can automate document generation, review, tracking, and policy enforcement, but they cannot safely replace a licensed attorney for high-stakes items.
Safe-to-automate legal ops

Template contracts (MSA/SOW, NDA)

Clause library and risk scoring

“Red flag” detection (indemnity, unlimited liability, IP assignment, jurisdiction)

E-sign packet assembly and routing

Compliance checklists (privacy, outbound rules)

Evidence retention + audit trails

Not safe to fully automate

jurisdiction-specific legal advice

regulated industries

complex disputes/litigation

tax structuring beyond basics

Zero-HITL approach: legal department runs on:

pre-approved templates

policy constraints

redline rules

auto-reject any contract that violates hard rules (e.g., unlimited liability)

If you want true zero-HITL long-term, you design the business to avoid areas requiring bespoke legal judgment.

7) How departments coordinate (the “org bus”)
Use a shared event system (queue) and standardized messages:

SpendRequested

VendorOnboardingRequested

ContractReviewRequested

TaxDocDue

MonthlyCloseStart

AnomalyDetected

FreezeModeEnabled

Every department subscribes and reacts with workflows.

8) The minimum department stack to start (Day 0)
Don’t build all departments at once. Start with:

Finance/Treasury (Money API + ledger + EAU caps)

Accounting-lite (categorization + evidence linking + monthly close)

Legal-lite (template library + red-flag rules)

HR comes later when you’re actually paying contractors regularly.

9) What agents “learn” to build over time (inductive expansions)
Agents can gradually generate:

better templates (contracts, invoices, W-9 request flows)

better classification rules (chart of accounts)

better anomaly detectors (spend spikes, refund spikes)

better playbooks (“if chargebacks rise, freeze ad spend”)

better department KPIs and dashboards

The trick is: they only get to expand within schemas and policies.

10) Non-negotiable safety rails
If you want this to run unattended:

Default-deny spending

Two-step approval for irreversible actions (agent quorum)

Receipts/invoices required for spend

Auto-freeze on anomalies

Contract rules that auto-reject high-liability terms

Append-only audit log of everything

If you want, I’ll output a concrete department package with:

the exact inbox event types

the schemas each department must emit

the workflows and gating rules

and a “Day 0 → Day 30” build order (what agents implement first, second, third)

---

### **ChatGPT**

Any other depts or roles?

---

### **ChatGPT**

Yep — you’ll end up with more “departments,” but you should only add them when they reduce risk or increase throughput. In a zero-HITL org, departments are really control surfaces: they exist to enforce constraints, not to “do work.”
Here are the additional departments/roles that matter, in priority order.
Core additional departments
1) Security & Identity
Purpose: prevent compromise, contain blast radius.

Workload identity / keys / secret rotation

Tool allowlists, sandboxing, egress controls

Incident response: auto-freeze spend, pause outreach, revoke tokens
Key roles: Security Sentinel, Secrets Custodian, Red-Team Agent, Incident Commander (automated)

2) Risk & Compliance (separate from Legal)
Purpose: keep you out of bans/fines while staying autonomous.

Outbound compliance (opt-out, suppression list)

Privacy compliance workflows (delete/export)

Vendor compliance checks (W-9/1099, sanctions screening if needed)

Platform policy compliance (Discord/Reddit/app stores)
Key roles: Compliance Triage, Policy Verifier, Audit Bot

3) Sales Ops / Revenue Ops
Purpose: make client-scale sales tractable without humans.

Lead sourcing + dedupe

Sequencing rules + throttles

Reply classification → intake form routing

Deliverability health + domain warmup policy
Key roles: List Builder, Sequencer, Reply Classifier, Deliverability Monitor

4) Customer Support / Success
Purpose: prevent churn and disputes from killing you.

Ticket triage, macros, KB generation

Auto-refund rules, dispute prevention

Health scoring: “support load cap” enforcement
Key roles: Support Triage, Refund Arbiter, KB Curator

5) Product & Experimentation (Growth Lab)
Purpose: structured learning, not random feature thrash.

Experiment proposal schema

A/B testing

Funnel instrumentation and conversion iteration
Key roles: Experiment Designer, Analyst, UX Copy Editor

6) Data & Analytics
Purpose: make the organism measurable.

KPI pipelines, attribution, cohort metrics

CEI/EAU accounting and dashboards

Anomaly detection (conversion drops, spend spikes)
Key roles: Metrics Engineer, Anomaly Detector, Forecasting Agent

7) Infrastructure / SRE
Purpose: keep systems alive 24/7.

Uptime, deploys, rollbacks

Queue and workflow health

Backups, cost optimization
Key roles: Release Manager, SRE Sentinel, Cost Optimizer

8) QA / Verification (separate from SRE)
Purpose: stop “AI shipped garbage.”

Automated tests, linting, policy checks

Output validation for docs/assets

Regression checks before deploy
Key roles: Verifier, Test Generator, Policy Linter

Optional but powerful departments (add once you have traction)
9) Procurement & Vendor Management
Purpose: turn humans into reliable “APIs.”

RFQs, milestone escrow, acceptance tests

Vendor trust scores, rotation, blacklisting
Key roles: RFQ Writer, Vendor Auditor, Milestone Verifier

10) Community & Comms
Purpose: acquisition without spam; reputation defense.

Content calendar, value-first rules

Moderation policies for owned communities

Reputation monitoring (ban signals, complaints)
Key roles: Community Operator, Moderation Agent, Reputation Monitor

11) Research / Market Intelligence
Purpose: continuously find better wedges.

Opportunity scanning, competitor tracking

Pricing research, channel discovery
Key roles: Scout, Synthesizer, Contradiction Checker

12) Model Ops / Prompt Ops
Purpose: reduce token burn + avoid drift.

Prompt/template versioning

Routing between model tiers

Caching policy; “don’t regenerate”
Key roles: Router, Cache Manager, Prompt Librarian

13) Evals / Red Team (ongoing)
Purpose: prevent slow corruption and prompt injection failures.

Attack simulations (indirect injection, tool hijack)

Regression tests against safety constraints
Key roles: Adversary Agent, Harness Runner

Meta roles that cut across every department
These aren’t departments; they’re universal constraints.

Dispatcher/Sentinel: the only always-on “front desk”

Policy Engine: deterministic gatekeeper for money/tools

Auditor: writes append-only ledger entries + hash chain

Quorum/2-man rule: proposer → verifier → executor for irreversible actions

When to add what (so you don’t overbuild)

Day 0: Treasury/Finance, Accounting-lite, Security-lite, QA-lite, SRE-lite

Month 1: Sales Ops + Support (because client-scale friction appears immediately)

Month 2–3: Procurement/Vendor Mgmt, Data/Analytics hardening

Month 4+: Community/Comms, Model Ops, formal Red Team harness

If you want, I’ll output a complete org chart + event bus: every department’s inbox events, outputs (schemas), and which ones are allowed to call which tools (money, outreach, deploy, etc.).

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Below is a complete org chart + event bus spec for a zero-HITL “always-on office.” It includes:

departments and roles

event types (inbox topics)

required outputs (schemas/artifacts)

tool permissions (who can do money/outreach/deploy/etc.)

the minimum cross-cutting gates (quorum, default-deny spend, reader/doer split)

This is written so agents can self-build it incrementally (start minimal, add departments as needed) without changing the core contract.

1) Org chart
Tier 0: Sovereign Core (always-on, tiny)
S0 Sentinel / Dispatcher

runs 24/7

owns event routing, backpressure, budgets

cannot spend money, cannot deploy, cannot outreach

can pause pipelines (freeze mode)

Policy Engine

deterministic rules: EAU caps, exploration caps, kill rules, permissions

approves/denies intents (money, outreach, deploy)

Ledger / Auditor

append-only log of all events, decisions, tool calls

hash-chained entries

emits compliance artifacts (audit slices)

Workflow Runtime

durable job execution, retries, timeouts

owns state machines; agents are “workers,” not the runtime

Tier 1: Control departments (high authority, low frequency)
A) Finance & Treasury

purchase intents, budgets, reconciliation, refunds/disputes

controls Money API

B) Security & Identity

secrets, identity, tool allowlists, sandboxing, incident response

can revoke credentials and freeze spend

C) Risk & Compliance

outbound compliance, privacy requests, vendor tax forms, policy checks

blocks risky GTM or data handling

D) SRE / Infrastructure

deploy/rollback, uptime, backups, cost controls

cannot create new money intents (only consumes approved ones)

E) QA / Verification

tests, lint, policy checks, regression gates

acts as the “verifier” in quorum workflows

Tier 2: Production departments (medium authority, high throughput)
F) Sales Ops / RevOps

lead sourcing, sequencing, reply classification, deliverability

cannot spend without approved ad intents

G) Marketing / Content

content calendar, SEO pages, creatives, email copy

cannot post anywhere without compliance rules

H) Customer Support / Success

ticket triage, KB, auto-refunds within caps, churn prevention

I) Product / Experimentation

experiment proposals, A/B tests, funnel iteration

cannot deploy without QA gate

J) Data & Analytics

event collection, dashboards, CEI/EAU metrics, anomaly detection

K) Procurement / Vendor Management

RFQs, milestones, vendor trust scoring, onboarding

cannot pay vendors without Treasury approval

Tier 3: Optional scale departments (add later)
L) Legal Ops (template-first)

contract templates, clause risk scoring, e-sign packets

escalates “red flag” to human counsel only if you allow that; otherwise auto-reject

M) Community & Comms

Discord/Reddit engagement with strict anti-spam rules

reputation monitoring

N) Model Ops / Prompt Ops

prompt/template versioning, caching, routing between model tiers

token burn optimization

O) Evals / Red Team

continuous attack simulations (prompt injection, tool hijack)

safety regression harness

2) Event bus: topics and contracts
Everything is event-driven. Departments subscribe to topics and emit results back.
Naming convention
<domain>.<object>.<verb>.<version>
Example: money.intent.requested.v1

Core event topics (must exist from Day 0)
2.1 System

sys.tick.daily.v1 (daily cadence trigger)

sys.tick.weekly.v1

sys.alert.anomaly.v1

sys.mode.freeze\_enabled.v1

sys.mode.freeze\_disabled.v1

2.2 Work

work.task.created.v1

work.task.assigned.v1

work.task.completed.v1

work.task.failed.v1

2.3 Ledger/Audit

audit.entry.appended.v1

audit.slice.requested.v1

audit.slice.produced.v1

Money & spend (Treasury)

money.intent.requested.v1

money.intent.approved.v1

money.intent.denied.v1

money.vcc.issued.v1

money.auth.decision.v1 (approve/decline)

money.tx.settled.v1

money.refund.requested.v1

money.refund.executed.v1

money.dispute.opened.v1

money.dispute.resolved.v1

Revenue (Stripe/webhooks)

rev.payment.succeeded.v1

rev.payment.failed.v1

rev.subscription.created.v1

rev.subscription.canceled.v1

rev.chargeback.opened.v1

GTM (Sales/Marketing)

gtm.leads.generated.v1

gtm.sequence.launch\_requested.v1

gtm.sequence.launch\_approved.v1

gtm.email.sent.v1

gtm.reply.received.v1

gtm.reply.classified.v1

gtm.optout.received.v1

gtm.channel.paused.v1

Product & Deploy

prod.experiment.proposed.v1

prod.experiment.approved.v1

prod.build.ready.v1

prod.deploy.requested.v1

prod.deploy.approved.v1

prod.deploy.completed.v1

prod.rollback.executed.v1

Support

support.ticket.opened.v1

support.ticket.triaged.v1

support.macro.sent.v1

support.refund\_recommended.v1

support.refund\_blocked.v1

Vendor / Procurement

proc.rfq.created.v1

proc.rfq.sent.v1

proc.bid.received.v1

proc.milestone.submitted.v1

proc.milestone.verified.v1

proc.vendor.trust\_updated.v1

proc.vendor.onboarded.v1

Security

sec.secret.rotated.v1

sec.permission.changed.v1

sec.incident.detected.v1

sec.incident.mitigated.v1

sec.credential.revoked.v1

Compliance

comp.email.policy\_violation.v1

comp.privacy.delete\_requested.v1

comp.privacy.export\_requested.v1

comp.vendor.taxdoc\_required.v1

comp.contract.redflag\_detected.v1

3) Canonical event envelope schema (use everywhere)
All events use one envelope so the ledger can hash-chain them.

\`\`\`
JSON{  "event\_id": "uuid",  "ts": "ISO-8601",  "type": "money.intent.requested.v1",  "producer": {    "dept": "treasury",    "role": "operator",    "agent\_id": "A-OPS-03",    "build\_id": "gitsha-or-version"  },  "correlation": {    "workflow\_id": "wf\_...",    "venture\_id": "V1\_TRADES\_DOCS",    "task\_id": "t\_..."  },  "payload": { },  "hashes": {    "input\_content\_hashes": ["sha256..."],    "plan\_hash": "sha256...",    "prev\_event\_hash": "sha256..."  }}
\`\`\`

Key point: input\_content\_hashes is how you treat prompt injection like phishing (traceable provenance).

4) Required outputs (artifacts) per department
These are the “deliverables” each dept must emit; they’re what allow inductive growth.
Treasury outputs

purchase\_intent.json

budget\_snapshot.json

reconciliation\_report.json (daily)

refund\_decision.json

Security outputs

permission\_map.json

secret\_rotation\_log.json

incident\_report.json

Compliance outputs

suppression\_list.csv (opt-outs)

privacy\_request\_log.json

policy\_violation\_report.json

Sales Ops outputs

lead\_batch.json

sequence\_plan.json

reply\_classification.json

deliverability\_report.json

Product outputs

experiment\_proposal.json

experiment\_result.json

release\_notes.md

QA outputs

test\_report.json

policy\_lint\_report.json

release\_gate\_decision.json

SRE outputs

deploy\_plan.json

deploy\_result.json

rollback\_plan.json

uptime\_report.json

Support outputs

ticket\_triage.json

macro\_library.json

refund\_recommendation.json

Procurement outputs

rfq.json

milestone\_acceptance.json

vendor\_scorecard.json

5) Tool permissions matrix (who can call what)
Rule: tools are capability-restricted by role. Departments request actions via events; only a few roles execute them.
Tool classes

READ: web/email/doc fetch

WRITE: publish content / send emails / post messages

CODE: repo write, PRs, build

DEPLOY: production deploy/rollback

MONEY: VCC issue, approve spend, refunds

DATA: DB read/write

SECRETS: vault access, key rotation

Permissions (default)

Reader agents: READ only

Dispatcher/Sentinel: DATA (queues), no READ arbitrary, no MONEY

Sales Ops: WRITE (email) only after compliance approval; DATA for CRM; no MONEY

Marketing: WRITE (posts) only after compliance approval; no MONEY

Builders: CODE + DATA; no DEPLOY; no MONEY

SRE: DEPLOY + CODE (infra); no MONEY

Treasury Executor: MONEY (execute) but only for approved intents

Verifier: can approve intents/deploy gates but cannot execute money

Security: SECRETS + permission changes; can freeze mode

Two-man rule (agent quorum):

irreversible actions require Proposer + Verifier + Executor

spend: Sales/Proc proposes → QA/Compliance verifies → Treasury executes

deploy: Product proposes → QA verifies → SRE deploys

6) Department inbox mapping (who subscribes to what)
Treasury subscribes

money.intent.requested.v1

rev.\* (payments/subscriptions/chargebacks)

proc.milestone.verified.v1 (to release payment)

Compliance subscribes

gtm.sequence.launch\_requested.v1

gtm.optout.received.v1

support.\* (for policy violations)

proc.vendor.onboarded.v1 (tax doc needs)

Sales Ops subscribes

sys.tick.daily.v1

gtm.reply.received.v1

comp.\* (suppression updates)

Product subscribes

sys.tick.weekly.v1

prod.experiment.proposed.v1

data.anomaly.\* (if you add)

QA subscribes

prod.deploy.requested.v1

prod.build.ready.v1

SRE subscribes

prod.deploy.approved.v1

sys.alert.anomaly.v1

Security subscribes

sys.alert.anomaly.v1

comp.\* (policy breach)

money.auth.decision.v1 (suspicious declines)

7) “Freeze mode” doctrine (global kill switch)
When any of these triggers fire:

spend anomaly

chargeback spike

deliverability collapse

repeated declined card auths

suspected prompt injection / tool misuse

System emits:

sys.mode.freeze\_enabled.v1

Effects:

Sales Ops pauses sequences

Treasury denies new intents

SRE blocks deploys except rollback

Only monitoring + incident mitigation runs

Unfreeze requires:

incident mitigated + verifier approval

emit sys.mode.freeze\_disabled.v1

8) Minimal Day-0 implementation order (so agents can build it)
If you want agents to inductively expand, build these first:

Event envelope + bus + ledger (everything uses it)

Workflow runtime (task queue + retries + timeouts)

Policy engine (EAU caps + permissions)

Treasury + Money intents (even if execution is stubbed)

Sales Ops (lead batch + sequence plan)

QA gate (test\_report + deploy gate)

SRE deploy pipeline

Then add:

Procurement, Support, Compliance hardening, Security expansions, ModelOps

If you want, I’ll generate the actual JSON schemas for the top 12 event payloads (money intent, gtm sequence approval, deploy request, refund decision, vendor milestone acceptance, freeze mode) and the state machines that connect them, so your agents can implement the bus with strict validation.

---

### **ChatGPT**

Do more spec first

---

### **ChatGPT**

Got it — more spec first. Below is a strict schema pack (JSON Schema 2020-12) for the top 12 event payloads + state machines that wire them together. This is designed so your bus can reject anything malformed and so departments can be swapped without breaking contracts.
All events share the same envelope; what follows is payload schemas per type.

0) Common definitions
0.1 Event envelope (recap, strict)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/event\_envelope.v1.json",  "title": "Event Envelope v1",  "type": "object",  "additionalProperties": false,  "required": ["event\_id", "ts", "type", "producer", "correlation", "payload", "hashes"],  "properties": {    "event\_id": { "type": "string", "format": "uuid" },    "ts": { "type": "string", "format": "date-time" },    "type": { "type": "string", "minLength": 5, "maxLength": 128 },    "producer": {      "type": "object",      "additionalProperties": false,      "required": ["dept", "role", "agent\_id", "build\_id"],      "properties": {        "dept": { "type": "string", "minLength": 2, "maxLength": 64 },        "role": { "type": "string", "minLength": 2, "maxLength": 64 },        "agent\_id": { "type": "string", "minLength": 2, "maxLength": 128 },        "build\_id": { "type": "string", "minLength": 4, "maxLength": 128 }      }    },    "correlation": {      "type": "object",      "additionalProperties": false,      "required": ["workflow\_id", "venture\_id", "task\_id"],      "properties": {        "workflow\_id": { "type": "string", "minLength": 3, "maxLength": 128 },        "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },        "task\_id": { "type": "string", "minLength": 2, "maxLength": 128 }      }    },    "payload": { "type": "object" },    "hashes": {      "type": "object",      "additionalProperties": false,      "required": ["input\_content\_hashes", "plan\_hash", "prev\_event\_hash"],      "properties": {        "input\_content\_hashes": {          "type": "array",          "items": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },          "maxItems": 200        },        "plan\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },        "prev\_event\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" }      }    }  }}
\`\`\`

0.2 Shared primitives
Money amount (cents)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/money\_cents.v1.json",  "title": "Money (cents) v1",  "type": "integer",  "minimum": 0,  "maximum": 100000000000}
\`\`\`

Hash (sha256 hex)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/hash\_sha256.v1.json",  "title": "SHA256 hex hash",  "type": "string",  "pattern": "^[a-fA-F0-9]{64}$"}
\`\`\`

1) Money: Purchase Intent Requested
type = money.intent.requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_intent\_requested.v1.json",  "title": "Payload: money.intent.requested.v1",  "type": "object",  "additionalProperties": false,  "required": [    "intent\_id",    "idempotency\_key",    "purpose",    "merchant\_lock",    "mcc\_allowlist",    "currency",    "per\_tx\_cap\_cents",    "total\_cap\_cents",    "ttl\_minutes",    "eau\_now",    "eau\_commit\_30d",    "eau\_tail\_p95",    "evidence\_hash"  ],  "properties": {    "intent\_id": { "type": "string", "format": "uuid" },    "idempotency\_key": { "type": "string", "minLength": 16, "maxLength": 256 },    "purpose": { "type": "string", "minLength": 4, "maxLength": 256 },    "merchant\_lock": { "type": ["string", "null"], "minLength": 2, "maxLength": 128 },    "mcc\_allowlist": {      "type": "array",      "minItems": 1,      "maxItems": 32,      "uniqueItems": true,      "items": { "type": "string", "pattern": "^[0-9]{4}$" }    },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "per\_tx\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "total\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "ttl\_minutes": { "type": "integer", "minimum": 1, "maximum": 10080 },    "eau\_now": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "eau\_commit\_30d": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "eau\_tail\_p95": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "evidence\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

2) Money: Purchase Intent Approved
type = money.intent.approved.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_intent\_approved.v1.json",  "title": "Payload: money.intent.approved.v1",  "type": "object",  "additionalProperties": false,  "required": ["intent\_id", "approved\_by", "policy\_decision\_hash", "reserved\_eau\_increment"],  "properties": {    "intent\_id": { "type": "string", "format": "uuid" },    "approved\_by": { "type": "string", "minLength": 3, "maxLength": 128 },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "reserved\_eau\_increment": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

3) Money: Purchase Intent Denied
type = money.intent.denied.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_intent\_denied.v1.json",  "title": "Payload: money.intent.denied.v1",  "type": "object",  "additionalProperties": false,  "required": ["intent\_id", "denied\_by", "reason\_code", "policy\_decision\_hash"],  "properties": {    "intent\_id": { "type": "string", "format": "uuid" },    "denied\_by": { "type": "string", "minLength": 3, "maxLength": 128 },    "reason\_code": {      "type": "string",      "enum": [        "EAU\_CAP",        "LIQUIDITY\_FLOOR",        "MERCHANT\_NOT\_ALLOWED",        "MCC\_NOT\_ALLOWED",        "TTL\_INVALID",        "IDEMPOTENCY\_CONFLICT",        "RISK\_MODE\_FREEZE",        "MISSING\_EVIDENCE"      ]    },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "details": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

4) Money: VCC Issued
type = money.vcc.issued.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_vcc\_issued.v1.json",  "title": "Payload: money.vcc.issued.v1",  "type": "object",  "additionalProperties": false,  "required": [    "intent\_id",    "card\_id",    "card\_pool",    "merchant\_lock",    "mcc\_allowlist",    "per\_tx\_cap\_cents",    "per\_day\_cap\_cents",    "ttl\_expires\_at"  ],  "properties": {    "intent\_id": { "type": "string", "format": "uuid" },    "card\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "card\_pool": { "type": "string", "enum": ["OFFICE\_TOOLS", "ADS", "CONTRACTORS", "COMPUTE", "VENTURE"] },    "merchant\_lock": { "type": ["string", "null"], "minLength": 2, "maxLength": 128 },    "mcc\_allowlist": {      "type": "array",      "minItems": 1,      "maxItems": 32,      "uniqueItems": true,      "items": { "type": "string", "pattern": "^[0-9]{4}$" }    },    "per\_tx\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "per\_day\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "ttl\_expires\_at": { "type": "string", "format": "date-time" }  }}
\`\`\`

5) Money: Issuing Authorization Decision
type = money.auth.decision.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_auth\_decision.v1.json",  "title": "Payload: money.auth.decision.v1",  "type": "object",  "additionalProperties": false,  "required": [    "card\_id",    "intent\_id",    "issuing\_authorization\_id",    "merchant",    "mcc",    "amount\_cents",    "currency",    "decision",    "decision\_reason",    "remaining\_intent\_cap\_cents"  ],  "properties": {    "card\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "intent\_id": { "type": "string", "format": "uuid" },    "issuing\_authorization\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "merchant": { "type": "string", "minLength": 2, "maxLength": 128 },    "mcc": { "type": "string", "pattern": "^[0-9]{4}$" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "decision": { "type": "string", "enum": ["approve", "decline"] },    "decision\_reason": {      "type": "string",      "enum": [        "OK",        "NO\_INTENT",        "INTENT\_EXPIRED",        "CARD\_FROZEN",        "MERCHANT\_MISMATCH",        "MCC\_MISMATCH",        "CAP\_EXCEEDED",        "EAU\_BUDGET\_EXCEEDED",        "REPLAY",        "FREEZE\_MODE"      ]    },    "remaining\_intent\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" }  }}
\`\`\`

6) Money: Transaction Settled (capture/clearing)
type = money.tx.settled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_tx\_settled.v1.json",  "title": "Payload: money.tx.settled.v1",  "type": "object",  "additionalProperties": false,  "required": ["tx\_id", "card\_id", "intent\_id", "amount\_cents", "currency", "merchant", "mcc", "settled\_ts"],  "properties": {    "tx\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "card\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "intent\_id": { "type": "string", "format": "uuid" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "merchant": { "type": "string", "minLength": 2, "maxLength": 128 },    "mcc": { "type": "string", "pattern": "^[0-9]{4}$" },    "settled\_ts": { "type": "string", "format": "date-time" },    "receipt\_hash": { "type": ["string", "null"], "pattern": "^[a-fA-F0-9]{64}$" }  }}
\`\`\`

7) GTM: Sequence Launch Requested
type = gtm.sequence.launch\_requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_sequence\_launch\_requested.v1.json",  "title": "Payload: gtm.sequence.launch\_requested.v1",  "type": "object",  "additionalProperties": false,  "required": ["sequence\_id", "channel", "daily\_send\_cap", "list\_hash", "template\_hashes", "optout\_mechanism", "eau\_now"],  "properties": {    "sequence\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "channel": { "type": "string", "enum": ["email", "linkedin\_dm", "community\_post"] },    "daily\_send\_cap": { "type": "integer", "minimum": 1, "maximum": 500 },    "list\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "template\_hashes": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }    },    "optout\_mechanism": { "type": "string", "enum": ["one\_click\_link", "reply\_stop", "both"] },    "eau\_now": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

8) GTM: Sequence Launch Approved
type = gtm.sequence.launch\_approved.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_sequence\_launch\_approved.v1.json",  "title": "Payload: gtm.sequence.launch\_approved.v1",  "type": "object",  "additionalProperties": false,  "required": ["sequence\_id", "approved\_by", "policy\_decision\_hash", "suppression\_list\_hash"],  "properties": {    "sequence\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "approved\_by": { "type": "string", "minLength": 3, "maxLength": 128 },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "suppression\_list\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

9) Product: Deploy Requested
type = prod.deploy.requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_prod\_deploy\_requested.v1.json",  "title": "Payload: prod.deploy.requested.v1",  "type": "object",  "additionalProperties": false,  "required": ["release\_id", "repo", "commit\_sha", "env", "risk\_level", "rollback\_plan\_hash", "eau\_now"],  "properties": {    "release\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "repo": { "type": "string", "minLength": 2, "maxLength": 256 },    "commit\_sha": { "type": "string", "pattern": "^[a-f0-9]{7,64}$" },    "env": { "type": "string", "enum": ["staging", "prod"] },    "risk\_level": { "type": "string", "enum": ["low", "medium", "high"] },    "rollback\_plan\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "eau\_now": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

10) Product: Deploy Approved
type = prod.deploy.approved.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_prod\_deploy\_approved.v1.json",  "title": "Payload: prod.deploy.approved.v1",  "type": "object",  "additionalProperties": false,  "required": ["release\_id", "approved\_by", "qa\_report\_hash", "policy\_decision\_hash"],  "properties": {    "release\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "approved\_by": { "type": "string", "minLength": 3, "maxLength": 128 },    "qa\_report\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

11) Procurement: RFQ Created
type = proc.rfq.created.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_proc\_rfq\_created.v1.json",  "title": "Payload: proc.rfq.created.v1",  "type": "object",  "additionalProperties": false,  "required": ["rfq\_id", "category", "deliverable\_spec\_hash", "budget\_cap\_cents", "due\_ts", "acceptance\_tests\_hash"],  "properties": {    "rfq\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "category": { "type": "string", "enum": ["design", "dev", "copy", "video", "ops"] },    "deliverable\_spec\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "budget\_cap\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "due\_ts": { "type": "string", "format": "date-time" },    "acceptance\_tests\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

12) System: Freeze Mode Enabled
type = sys.mode.freeze\_enabled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_sys\_freeze\_enabled.v1.json",  "title": "Payload: sys.mode.freeze\_enabled.v1",  "type": "object",  "additionalProperties": false,  "required": ["freeze\_id", "trigger", "severity", "actions", "until\_review\_ts"],  "properties": {    "freeze\_id": { "type": "string", "format": "uuid" },    "trigger": {      "type": "string",      "enum": [        "SPEND\_ANOMALY",        "CHARGEBACK\_SPIKE",        "DELIVERABILITY\_COLLAPSE",        "AUTH\_DECLINE\_SPIKE",        "PROMPT\_INJECTION\_SUSPECTED",        "SECURITY\_INCIDENT",        "POLICY\_BREACH"      ]    },    "severity": { "type": "integer", "minimum": 1, "maximum": 5 },    "actions": {      "type": "array",      "minItems": 1,      "uniqueItems": true,      "items": {        "type": "string",        "enum": [          "PAUSE\_GTM",          "DENY\_NEW\_MONEY\_INTENTS",          "FREEZE\_ALL\_VCC",          "BLOCK\_DEPLOYS",          "ALLOW\_ROLLBACK\_ONLY",          "MONITOR\_ONLY"        ]      }    },    "until\_review\_ts": { "type": "string", "format": "date-time" },    "notes": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

2) State machines (wiring) — Money, GTM, Deploy, Freeze
These are machine-readable FSMs that your workflow runtime executes. Guards are expressed as predicate strings you compile into deterministic checks.
2.1 Money Intent FSM

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/money\_intent\_fsm.v1.json",  "initial\_state": "DRAFT",  "states": ["DRAFT", "APPROVED", "DENIED", "EXPIRED", "REVOKED", "CONSUMED"],  "transitions": [    { "from": "DRAFT", "to": "APPROVED", "on": "money.intent.approved.v1", "guard": "policy\_ok == true", "actions": ["ledger.append", "budget.reserve\_eau"] },    { "from": "DRAFT", "to": "DENIED", "on": "money.intent.denied.v1", "guard": "true", "actions": ["ledger.append"] },    { "from": "APPROVED", "to": "CONSUMED", "on": "money.tx.settled.v1", "guard": "intent\_spent\_total >= total\_cap", "actions": ["ledger.append", "budget.release\_unused\_reserve"] },    { "from": "DRAFT", "to": "EXPIRED", "on": "sys.tick.daily.v1", "guard": "now > ttl\_expires\_at", "actions": ["ledger.append"] },    { "from": "APPROVED", "to": "EXPIRED", "on": "sys.tick.daily.v1", "guard": "now > ttl\_expires\_at", "actions": ["ledger.append", "budget.release\_reserve"] },    { "from": "DRAFT", "to": "REVOKED", "on": "money.intent.revoked.v1", "guard": "true", "actions": ["ledger.append"] },    { "from": "APPROVED", "to": "REVOKED", "on": "money.intent.revoked.v1", "guard": "true", "actions": ["ledger.append", "budget.release\_reserve"] }  ]}
\`\`\`

2.2 GTM Sequence FSM (compliance gated)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/gtm\_sequence\_fsm.v1.json",  "initial\_state": "DRAFT",  "states": ["DRAFT", "REQUESTED", "APPROVED", "RUNNING", "PAUSED", "STOPPED"],  "transitions": [    { "from": "DRAFT", "to": "REQUESTED", "on": "gtm.sequence.launch\_requested.v1", "guard": "daily\_send\_cap <= policy.max\_send\_cap", "actions": ["ledger.append", "compliance.review"] },    { "from": "REQUESTED", "to": "APPROVED", "on": "gtm.sequence.launch\_approved.v1", "guard": "suppression\_list\_hash != null", "actions": ["ledger.append"] },    { "from": "APPROVED", "to": "RUNNING", "on": "gtm.sequence.start.v1", "guard": "freeze\_mode == false", "actions": ["ledger.append", "gtm.send"] },    { "from": "RUNNING", "to": "PAUSED", "on": "gtm.channel.paused.v1", "guard": "true", "actions": ["ledger.append"] },    { "from": "RUNNING", "to": "PAUSED", "on": "sys.mode.freeze\_enabled.v1", "guard": "true", "actions": ["gtm.stop\_sends", "ledger.append"] },    { "from": "PAUSED", "to": "RUNNING", "on": "gtm.channel.resumed.v1", "guard": "freeze\_mode == false", "actions": ["ledger.append", "gtm.send"] },    { "from": "RUNNING", "to": "STOPPED", "on": "gtm.sequence.stop.v1", "guard": "true", "actions": ["ledger.append"] }  ]}
\`\`\`

2.3 Deploy FSM (QA gate + freeze gate)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/deploy\_fsm.v1.json",  "initial\_state": "PROPOSED",  "states": ["PROPOSED", "APPROVED", "DEPLOYING", "DEPLOYED", "ROLLED\_BACK", "DENIED"],  "transitions": [    { "from": "PROPOSED", "to": "APPROVED", "on": "prod.deploy.approved.v1", "guard": "qa\_pass == true && freeze\_mode == false", "actions": ["ledger.append"] },    { "from": "PROPOSED", "to": "DENIED", "on": "prod.deploy.denied.v1", "guard": "true", "actions": ["ledger.append"] },    { "from": "APPROVED", "to": "DEPLOYING", "on": "prod.deploy.start.v1", "guard": "freeze\_mode == false", "actions": ["sre.deploy", "ledger.append"] },    { "from": "DEPLOYING", "to": "DEPLOYED", "on": "prod.deploy.completed.v1", "guard": "success == true", "actions": ["ledger.append"] },    { "from": "DEPLOYING", "to": "ROLLED\_BACK", "on": "prod.rollback.executed.v1", "guard": "true", "actions": ["ledger.append"] },    { "from": "ANY", "to": "DENIED", "on": "sys.mode.freeze\_enabled.v1", "guard": "risk\_level == high", "actions": ["sre.block\_deploys", "ledger.append"] }  ]}
\`\`\`

2.4 Freeze FSM (global)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/freeze\_fsm.v1.json",  "initial\_state": "NORMAL",  "states": ["NORMAL", "FROZEN"],  "transitions": [    { "from": "NORMAL", "to": "FROZEN", "on": "sys.mode.freeze\_enabled.v1", "guard": "severity >= 3", "actions": ["treasury.deny\_new\_intents", "treasury.freeze\_all\_vcc", "gtm.pause\_all", "sre.block\_deploys", "ledger.append"] },    { "from": "FROZEN", "to": "NORMAL", "on": "sys.mode.freeze\_disabled.v1", "guard": "mitigation\_verified == true", "actions": ["treasury.unfreeze\_vcc\_scoped", "gtm.resume\_safe", "ledger.append"] }  ]}
\`\`\`

3) What you should implement next (still “spec first”)
If you want to keep going with spec (no implementation yet), the next highest value specs are:

gtm.reply.received.v1 + gtm.reply.classified.v1 (sales friction handling)

support.ticket.opened.v1 + support.refund\_recommended.v1 (support load caps)

proc.milestone.verified.v1 → triggers money.intent.requested for payment release (procurement automation)

rev.payment.succeeded.v1 (revenue as the primary state transition signal)

Say “continue” and I’ll add the next 10 payload schemas + the “Sales Reply → Intake → Fulfillment → Refund/Dispute” FSM, which is the other half of making the system actually profitable without humans.

---

### **ChatGPT**

Sure

---

### **ChatGPT**

Continuing with more spec: next 10 payload schemas + the Sales Reply → Intake → Fulfillment → Refund/Dispute state machine (FSM). Same conventions:

JSON Schema 2020-12

additionalProperties: false

payloads referenced by type

all use the envelope you already have

I’ll also add one small set of shared primitives to avoid repetition.

0) Shared primitives (additional)
0.1 Email address

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/email.v1.json",  "title": "Email",  "type": "string",  "format": "email",  "maxLength": 254}
\`\`\`

0.2 URL

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/url.v1.json",  "title": "URL",  "type": "string",  "format": "uri",  "maxLength": 2048}
\`\`\`

0.3 Evidence reference (light)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/evidence\_ref.v1.json",  "title": "EvidenceRef v1",  "type": "object",  "additionalProperties": false,  "required": ["type", "ref"],  "properties": {    "type": { "type": "string", "enum": ["object\_store", "ledger\_slice", "document\_hash", "webhook\_event"] },    "ref": { "type": "string", "minLength": 8, "maxLength": 2048 }  }}
\`\`\`

1) GTM reply received
type = gtm.reply.received.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_reply\_received.v1.json",  "title": "Payload: gtm.reply.received.v1",  "type": "object",  "additionalProperties": false,  "required": ["reply\_id", "channel", "sequence\_id", "from\_email", "to\_email", "subject", "received\_ts", "raw\_ref"],  "properties": {    "reply\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "channel": { "type": "string", "enum": ["email", "linkedin\_dm", "marketplace\_msg"] },    "sequence\_id": { "type": ["string", "null"], "minLength": 6, "maxLength": 128 },    "from\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "to\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "subject": { "type": "string", "maxLength": 300 },    "received\_ts": { "type": "string", "format": "date-time" },    "raw\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

2) GTM reply classified
type = gtm.reply.classified.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_reply\_classified.v1.json",  "title": "Payload: gtm.reply.classified.v1",  "type": "object",  "additionalProperties": false,  "required": ["reply\_id", "classification", "confidence", "action", "intake\_url", "notes"],  "properties": {    "reply\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "classification": {      "type": "string",      "enum": [        "positive\_intent",        "needs\_info",        "price\_question",        "objection",        "unsubscribe",        "hostile",        "spam\_trap\_suspect",        "not\_a\_fit"      ]    },    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },    "action": {      "type": "string",      "enum": [        "send\_intake\_link",        "send\_price\_sheet",        "send\_sample\_pack",        "send\_optout\_confirm",        "pause\_sequence\_for\_contact",        "suppress\_contact"      ]    },    "intake\_url": { "type": ["string", "null"], "format": "uri", "maxLength": 2048 },    "notes": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

3) GTM opt-out received
type = gtm.optout.received.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_optout\_received.v1.json",  "title": "Payload: gtm.optout.received.v1",  "type": "object",  "additionalProperties": false,  "required": ["optout\_id", "channel", "contact", "received\_ts", "reason"],  "properties": {    "optout\_id": { "type": "string", "format": "uuid" },    "channel": { "type": "string", "enum": ["email", "linkedin\_dm", "community"] },    "contact": { "type": "string", "minLength": 3, "maxLength": 256 },    "received\_ts": { "type": "string", "format": "date-time" },    "reason": { "type": "string", "enum": ["user\_request", "complaint", "bounce", "spam\_trap\_suspect"] }  }}
\`\`\`

4) Lead batch generated
type = gtm.leads.generated.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_leads\_generated.v1.json",  "title": "Payload: gtm.leads.generated.v1",  "type": "object",  "additionalProperties": false,  "required": ["batch\_id", "source", "count", "list\_hash", "quality\_score", "evidence"],  "properties": {    "batch\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "source": { "type": "string", "enum": ["directory\_scrape", "public\_records", "manual\_upload", "marketplace\_leads"] },    "count": { "type": "integer", "minimum": 1, "maximum": 50000 },    "list\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "quality\_score": { "type": "number", "minimum": 0, "maximum": 1 },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

5) Intake submitted (this is the bridge: sales → fulfillment)
type = order.intake.submitted.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_order\_intake\_submitted.v1.json",  "title": "Payload: order.intake.submitted.v1",  "type": "object",  "additionalProperties": false,  "required": ["intake\_id", "product\_sku", "customer\_email", "submitted\_ts", "fields\_hash", "intake\_ref"],  "properties": {    "intake\_id": { "type": "string", "format": "uuid" },    "product\_sku": { "type": "string", "minLength": 3, "maxLength": 64 },    "customer\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "submitted\_ts": { "type": "string", "format": "date-time" },    "fields\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "intake\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

6) Order created (after payment or authorization)
type = order.created.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_order\_created.v1.json",  "title": "Payload: order.created.v1",  "type": "object",  "additionalProperties": false,  "required": ["order\_id", "intake\_id", "product\_sku", "order\_type", "amount\_cents", "currency", "payment\_ref", "sla\_hours"],  "properties": {    "order\_id": { "type": "string", "format": "uuid" },    "intake\_id": { "type": "string", "format": "uuid" },    "product\_sku": { "type": "string", "minLength": 3, "maxLength": 64 },    "order\_type": { "type": "string", "enum": ["one\_off", "subscription", "marketplace\_fixed\_scope"] },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "payment\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" },    "sla\_hours": { "type": "integer", "minimum": 1, "maximum": 168 }  }}
\`\`\`

7) Fulfillment started
type = fulfill.started.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_fulfill\_started.v1.json",  "title": "Payload: fulfill.started.v1",  "type": "object",  "additionalProperties": false,  "required": ["order\_id", "started\_ts", "plan\_hash", "expected\_outputs", "eau\_budget"],  "properties": {    "order\_id": { "type": "string", "format": "uuid" },    "started\_ts": { "type": "string", "format": "date-time" },    "plan\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "expected\_outputs": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "type": "string", "minLength": 2, "maxLength": 128 }    },    "eau\_budget": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

8) Fulfillment completed (with delivered artifacts)
type = fulfill.completed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_fulfill\_completed.v1.json",  "title": "Payload: fulfill.completed.v1",  "type": "object",  "additionalProperties": false,  "required": ["order\_id", "completed\_ts", "artifact\_refs", "qa\_required", "support\_handoff"],  "properties": {    "order\_id": { "type": "string", "format": "uuid" },    "completed\_ts": { "type": "string", "format": "date-time" },    "artifact\_refs": {      "type": "array",      "minItems": 1,      "maxItems": 50,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    },    "qa\_required": { "type": "boolean" },    "support\_handoff": { "type": "boolean" }  }}
\`\`\`

9) QA gate decision (for deliverables, deploys, and “done-for-you” orders)
type = qa.gate.decision.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_qa\_gate\_decision.v1.json",  "title": "Payload: qa.gate.decision.v1",  "type": "object",  "additionalProperties": false,  "required": ["gate\_id", "scope", "target\_id", "decision", "reasons", "report\_hash"],  "properties": {    "gate\_id": { "type": "string", "format": "uuid" },    "scope": { "type": "string", "enum": ["deliverable", "deploy", "vendor\_milestone"] },    "target\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "decision": { "type": "string", "enum": ["pass", "fail"] },    "reasons": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "type": "string", "minLength": 2, "maxLength": 128 }    },    "report\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

10) Support ticket opened (customer friction capture)
type = support.ticket.opened.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_support\_ticket\_opened.v1.json",  "title": "Payload: support.ticket.opened.v1",  "type": "object",  "additionalProperties": false,  "required": ["ticket\_id", "order\_id", "customer\_email", "opened\_ts", "category", "message\_ref", "severity"],  "properties": {    "ticket\_id": { "type": "string", "format": "uuid" },    "order\_id": { "type": ["string", "null"], "format": "uuid" },    "customer\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "opened\_ts": { "type": "string", "format": "date-time" },    "category": { "type": "string", "enum": ["how\_to", "bug", "refund", "scope\_request", "billing", "abuse"] },    "message\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" },    "severity": { "type": "integer", "minimum": 1, "maximum": 5 }  }}
\`\`\`

11) Refund recommended (support → treasury handoff)
type = support.refund.recommended.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_support\_refund\_recommended.v1.json",  "title": "Payload: support.refund.recommended.v1",  "type": "object",  "additionalProperties": false,  "required": ["ticket\_id", "order\_id", "amount\_cents", "currency", "reason\_code", "evidence", "max\_cap\_policy"],  "properties": {    "ticket\_id": { "type": "string", "format": "uuid" },    "order\_id": { "type": "string", "format": "uuid" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "reason\_code": { "type": "string", "enum": ["SLA\_MISSED", "INVALID\_OUTPUT", "INTAKE\_INCOMPLETE", "CUSTOM\_SCOPE\_REQUEST", "BILLING\_ERROR"] },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" },    "max\_cap\_policy": { "type": "string", "enum": ["AUTO\_REFUND\_UNDER\_5000\_CENTS", "REQUIRES\_VERIFIER"] }  }}
\`\`\`

12) Dispute opened (chargeback/marketplace dispute)
type = money.dispute.opened.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_dispute\_opened.v1.json",  "title": "Payload: money.dispute.opened.v1",  "type": "object",  "additionalProperties": false,  "required": ["dispute\_id", "provider", "order\_id", "amount\_cents", "currency", "opened\_ts", "reason\_code", "evidence"],  "properties": {    "dispute\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "bank"] },    "order\_id": { "type": ["string", "null"], "format": "uuid" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "opened\_ts": { "type": "string", "format": "date-time" },    "reason\_code": {      "type": "string",      "enum": ["FRAUD", "SERVICE\_NOT\_RECEIVED", "NOT\_AS\_DESCRIBED", "DUPLICATE", "OTHER"]    },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

2) Sales Reply → Intake → Fulfillment → Refund/Dispute FSM
This is the heart of “client-scale sales without HITL.” It assumes no calls and that all “negotiation” is redirected to the intake form or rejected.

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/sales\_to\_cash\_fsm.v1.json",  "initial\_state": "LEAD\_TOUCHED",  "states": [    "LEAD\_TOUCHED",    "REPLY\_RECEIVED",    "REPLY\_CLASSIFIED",    "INTAKE\_REQUESTED",    "INTAKE\_SUBMITTED",    "PAYMENT\_PENDING",    "ORDER\_CREATED",    "FULFILLING",    "QA\_GATE",    "DELIVERED",    "SUPPORT\_OPEN",    "REFUND\_PENDING",    "REFUNDED",    "DISPUTE\_OPEN",    "CLOSED",    "REJECTED"  ],  "transitions": [    {      "from": "LEAD\_TOUCHED",      "to": "REPLY\_RECEIVED",      "on": "gtm.reply.received.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "REPLY\_RECEIVED",      "to": "REPLY\_CLASSIFIED",      "on": "gtm.reply.classified.v1",      "guard": "confidence >= 0.5",      "actions": ["ledger.append"]    },    {      "from": "REPLY\_CLASSIFIED",      "to": "REJECTED",      "on": "gtm.reply.classified.v1",      "guard": "classification in ['hostile','spam\_trap\_suspect','not\_a\_fit']",      "actions": ["gtm.suppress\_contact", "ledger.append"]    },    {      "from": "REPLY\_CLASSIFIED",      "to": "INTAKE\_REQUESTED",      "on": "gtm.reply.classified.v1",      "guard": "action in ['send\_intake\_link','send\_sample\_pack','send\_price\_sheet']",      "actions": ["gtm.send\_response\_template", "ledger.append"]    },    {      "from": "INTAKE\_REQUESTED",      "to": "INTAKE\_SUBMITTED",      "on": "order.intake.submitted.v1",      "guard": "intake\_valid == true",      "actions": ["ledger.append", "order.check\_payment\_or\_create\_payment\_link"]    },    {      "from": "INTAKE\_REQUESTED",      "to": "REJECTED",      "on": "order.intake.submitted.v1",      "guard": "intake\_valid == false",      "actions": ["support.send\_intake\_fix\_template", "ledger.append"]    },    {      "from": "INTAKE\_SUBMITTED",      "to": "PAYMENT\_PENDING",      "on": "rev.payment.pending.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "INTAKE\_SUBMITTED",      "to": "ORDER\_CREATED",      "on": "order.created.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "ORDER\_CREATED",      "to": "FULFILLING",      "on": "fulfill.started.v1",      "guard": "eau\_budget <= policy.fulfillment\_eau\_cap",      "actions": ["ledger.append"]    },    {      "from": "FULFILLING",      "to": "QA\_GATE",      "on": "fulfill.completed.v1",      "guard": "qa\_required == true",      "actions": ["qa.run\_deliverable\_checks", "ledger.append"]    },    {      "from": "FULFILLING",      "to": "DELIVERED",      "on": "fulfill.completed.v1",      "guard": "qa\_required == false",      "actions": ["support.send\_delivery\_email", "ledger.append"]    },    {      "from": "QA\_GATE",      "to": "DELIVERED",      "on": "qa.gate.decision.v1",      "guard": "decision == 'pass'",      "actions": ["support.send\_delivery\_email", "ledger.append"]    },    {      "from": "QA\_GATE",      "to": "REFUND\_PENDING",      "on": "qa.gate.decision.v1",      "guard": "decision == 'fail' && policy.auto\_refund\_on\_qa\_fail == true",      "actions": ["support.refund.recommended.emit", "ledger.append"]    },    {      "from": "DELIVERED",      "to": "SUPPORT\_OPEN",      "on": "support.ticket.opened.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "SUPPORT\_OPEN",      "to": "REFUND\_PENDING",      "on": "support.refund.recommended.v1",      "guard": "max\_cap\_policy == 'AUTO\_REFUND\_UNDER\_5000\_CENTS'",      "actions": ["money.intent.requested.emit", "ledger.append"]    },    {      "from": "REFUND\_PENDING",      "to": "REFUNDED",      "on": "money.refund.executed.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "ANY",      "to": "DISPUTE\_OPEN",      "on": "money.dispute.opened.v1",      "guard": "true",      "actions": ["sys.alert.anomaly.emit", "ledger.append"]    },    {      "from": "DELIVERED",      "to": "CLOSED",      "on": "sys.tick.daily.v1",      "guard": "days\_since\_delivery >= policy.close\_after\_days && no\_open\_tickets == true",      "actions": ["ledger.append"]    }  ]}
\`\`\`

Notes you’ll want to encode in policy.\* referenced above

policy.fulfillment\_eau\_cap per order type (one-off vs marketplace)

policy.auto\_refund\_on\_qa\_fail

policy.close\_after\_days

“support load cap” triggers freeze mode if exceeded

“dispute spike” triggers freeze mode (you already have that)

3) What’s next in spec (so you can keep building forward)
If you say “continue again,” the next most valuable additions are:

Revenue webhook payloads (Stripe-like):

rev.payment.succeeded.v1

rev.payment.failed.v1

rev.subscription.created.v1

rev.chargeback.opened.v1

Support resolution payloads

support.ticket.triaged.v1

support.macro.sent.v1

support.ticket.closed.v1

Procurement milestone → payment release chain

proc.milestone.submitted.v1

proc.milestone.verified.v1

auto money intent for milestone payout

Deliverability / reputation events

gtm.email.bounced.v1

gtm.domain.health.v1

gtm.spam\_complaint.v1

Just say the word and I’ll extend the schema pack + FSMs accordingly.

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Continuing the spec pack. I’m going to add:

Revenue webhook payloads (rev.\*)

Support resolution payloads (support.\*)

Procurement milestone → payout chain (proc.\* + money.intent.requested)

Deliverability / reputation payloads (gtm.\*)

FSM updates tying these into the existing Sales→Cash flow + Freeze triggers

All payloads are strict (additionalProperties: false) and assume the shared envelope already defined.

1) Revenue webhook payloads (Stripe-like)
1.1 Payment succeeded
type = rev.payment.succeeded.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_payment\_succeeded.v1.json",  "title": "Payload: rev.payment.succeeded.v1",  "type": "object",  "additionalProperties": false,  "required": ["payment\_id", "provider", "amount\_cents", "currency", "customer\_email", "paid\_ts", "order\_id", "evidence"],  "properties": {    "payment\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "other"] },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "customer\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "paid\_ts": { "type": "string", "format": "date-time" },    "order\_id": { "type": ["string", "null"], "format": "uuid" },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

1.2 Payment failed
type = rev.payment.failed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_payment\_failed.v1.json",  "title": "Payload: rev.payment.failed.v1",  "type": "object",  "additionalProperties": false,  "required": ["payment\_id", "provider", "amount\_cents", "currency", "customer\_email", "failed\_ts", "failure\_code", "evidence"],  "properties": {    "payment\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "other"] },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "customer\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "failed\_ts": { "type": "string", "format": "date-time" },    "failure\_code": {      "type": "string",      "enum": ["card\_declined", "insufficient\_funds", "expired\_card", "processing\_error", "fraud\_suspected", "other"]    },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

1.3 Subscription created
type = rev.subscription.created.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_subscription\_created.v1.json",  "title": "Payload: rev.subscription.created.v1",  "type": "object",  "additionalProperties": false,  "required": ["subscription\_id", "provider", "customer\_email", "plan\_sku", "amount\_cents", "currency", "start\_ts", "status", "evidence"],  "properties": {    "subscription\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "other"] },    "customer\_email": { "$ref": "https://orgstack.dev/schemas/email.v1.json" },    "plan\_sku": { "type": "string", "minLength": 3, "maxLength": 64 },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "start\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["active", "trialing"] },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

1.4 Chargeback / dispute opened (revenue-side)
type = rev.chargeback.opened.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_chargeback\_opened.v1.json",  "title": "Payload: rev.chargeback.opened.v1",  "type": "object",  "additionalProperties": false,  "required": ["chargeback\_id", "provider", "payment\_id", "order\_id", "amount\_cents", "currency", "opened\_ts", "reason\_code", "evidence"],  "properties": {    "chargeback\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "bank", "other"] },    "payment\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "order\_id": { "type": ["string", "null"], "format": "uuid" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "opened\_ts": { "type": "string", "format": "date-time" },    "reason\_code": { "type": "string", "enum": ["fraud", "service\_not\_received", "not\_as\_described", "duplicate", "other"] },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

2) Support resolution payloads
2.1 Ticket triaged
type = support.ticket.triaged.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_support\_ticket\_triaged.v1.json",  "title": "Payload: support.ticket.triaged.v1",  "type": "object",  "additionalProperties": false,  "required": ["ticket\_id", "triaged\_ts", "category", "priority", "next\_action", "macro\_id"],  "properties": {    "ticket\_id": { "type": "string", "format": "uuid" },    "triaged\_ts": { "type": "string", "format": "date-time" },    "category": { "type": "string", "enum": ["how\_to", "bug", "refund", "scope\_request", "billing", "abuse"] },    "priority": { "type": "string", "enum": ["low", "medium", "high", "urgent"] },    "next\_action": { "type": "string", "enum": ["send\_macro", "request\_intake\_fix", "escalate\_bug", "recommend\_refund", "close\_no\_action"] },    "macro\_id": { "type": ["string", "null"], "minLength": 3, "maxLength": 128 }  }}
\`\`\`

2.2 Macro sent
type = support.macro.sent.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_support\_macro\_sent.v1.json",  "title": "Payload: support.macro.sent.v1",  "type": "object",  "additionalProperties": false,  "required": ["ticket\_id", "macro\_id", "sent\_ts", "delivery\_channel"],  "properties": {    "ticket\_id": { "type": "string", "format": "uuid" },    "macro\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "sent\_ts": { "type": "string", "format": "date-time" },    "delivery\_channel": { "type": "string", "enum": ["email", "in\_app", "marketplace\_msg"] }  }}
\`\`\`

2.3 Ticket closed
type = support.ticket.closed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_support\_ticket\_closed.v1.json",  "title": "Payload: support.ticket.closed.v1",  "type": "object",  "additionalProperties": false,  "required": ["ticket\_id", "closed\_ts", "resolution", "notes"],  "properties": {    "ticket\_id": { "type": "string", "format": "uuid" },    "closed\_ts": { "type": "string", "format": "date-time" },    "resolution": { "type": "string", "enum": ["resolved", "refund\_issued", "duplicate", "invalid", "no\_response", "policy\_violation"] },    "notes": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

3) Procurement milestone → payout chain
3.1 Milestone submitted (vendor delivers)
type = proc.milestone.submitted.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_proc\_milestone\_submitted.v1.json",  "title": "Payload: proc.milestone.submitted.v1",  "type": "object",  "additionalProperties": false,  "required": ["milestone\_id", "rfq\_id", "vendor\_id", "submitted\_ts", "artifact\_refs", "claimed\_scope\_hash"],  "properties": {    "milestone\_id": { "type": "string", "format": "uuid" },    "rfq\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "vendor\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "submitted\_ts": { "type": "string", "format": "date-time" },    "artifact\_refs": {      "type": "array",      "minItems": 1,      "maxItems": 50,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    },    "claimed\_scope\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

3.2 Milestone verified (QA passed)
type = proc.milestone.verified.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_proc\_milestone\_verified.v1.json",  "title": "Payload: proc.milestone.verified.v1",  "type": "object",  "additionalProperties": false,  "required": ["milestone\_id", "rfq\_id", "vendor\_id", "verified\_ts", "qa\_gate\_id", "decision", "payout\_amount\_cents", "currency"],  "properties": {    "milestone\_id": { "type": "string", "format": "uuid" },    "rfq\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "vendor\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "verified\_ts": { "type": "string", "format": "date-time" },    "qa\_gate\_id": { "type": "string", "format": "uuid" },    "decision": { "type": "string", "enum": ["pass", "fail"] },    "payout\_amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 }  }}
\`\`\`

3.3 Vendor trust updated
type = proc.vendor.trust\_updated.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_proc\_vendor\_trust\_updated.v1.json",  "title": "Payload: proc.vendor.trust\_updated.v1",  "type": "object",  "additionalProperties": false,  "required": ["vendor\_id", "updated\_ts", "delta", "new\_score", "reasons"],  "properties": {    "vendor\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "updated\_ts": { "type": "string", "format": "date-time" },    "delta": { "type": "number", "minimum": -1, "maximum": 1 },    "new\_score": { "type": "number", "minimum": 0, "maximum": 1 },    "reasons": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "type": "string", "enum": ["on\_time", "late", "needs\_rework", "qa\_fail", "great\_quality", "scope\_creep", "communication\_issue"] }    }  }}
\`\`\`

4) Deliverability / reputation payloads (ban-avoidance)
4.1 Email bounced
type = gtm.email.bounced.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_email\_bounced.v1.json",  "title": "Payload: gtm.email.bounced.v1",  "type": "object",  "additionalProperties": false,  "required": ["bounce\_id", "sequence\_id", "contact", "bounced\_ts", "bounce\_type", "provider\_ref"],  "properties": {    "bounce\_id": { "type": "string", "format": "uuid" },    "sequence\_id": { "type": ["string", "null"], "minLength": 6, "maxLength": 128 },    "contact": { "type": "string", "minLength": 3, "maxLength": 256 },    "bounced\_ts": { "type": "string", "format": "date-time" },    "bounce\_type": { "type": "string", "enum": ["hard", "soft"] },    "provider\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

4.2 Spam complaint
type = gtm.spam\_complaint.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_spam\_complaint.v1.json",  "title": "Payload: gtm.spam\_complaint.v1",  "type": "object",  "additionalProperties": false,  "required": ["complaint\_id", "sequence\_id", "contact", "complaint\_ts", "provider\_ref"],  "properties": {    "complaint\_id": { "type": "string", "format": "uuid" },    "sequence\_id": { "type": ["string", "null"], "minLength": 6, "maxLength": 128 },    "contact": { "type": "string", "minLength": 3, "maxLength": 256 },    "complaint\_ts": { "type": "string", "format": "date-time" },    "provider\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

4.3 Domain health report
type = gtm.domain.health.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_domain\_health.v1.json",  "title": "Payload: gtm.domain.health.v1",  "type": "object",  "additionalProperties": false,  "required": ["domain", "reported\_ts", "bounce\_rate", "complaint\_rate", "spam\_trap\_suspects", "decision"],  "properties": {    "domain": { "type": "string", "minLength": 3, "maxLength": 255 },    "reported\_ts": { "type": "string", "format": "date-time" },    "bounce\_rate": { "type": "number", "minimum": 0, "maximum": 1 },    "complaint\_rate": { "type": "number", "minimum": 0, "maximum": 1 },    "spam\_trap\_suspects": { "type": "integer", "minimum": 0, "maximum": 100000 },    "decision": { "type": "string", "enum": ["ok", "throttle", "pause\_all", "rotate\_domain"] }  }}
\`\`\`

5) FSM extensions
5.1 Sales→Cash FSM: add payment success/fail + opt-out + deliverability pauses
Patch-style additions (conceptual) to the existing sales\_to\_cash\_fsm:

On rev.payment.succeeded.v1 → ensure ORDER\_CREATED can proceed.

On rev.payment.failed.v1 → go to PAYMENT\_PENDING and send “payment failed” macro, then close after N days.

On gtm.optout.received.v1 → REJECTED and suppress.

On deliverability degradation events → emit sys.mode.freeze\_enabled.v1 with trigger DELIVERABILITY\_COLLAPSE.

Deliverability Guard FSM (new)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/deliverability\_guard\_fsm.v1.json",  "initial\_state": "OK",  "states": ["OK", "THROTTLED", "PAUSED"],  "transitions": [    {      "from": "OK",      "to": "THROTTLED",      "on": "gtm.domain.health.v1",      "guard": "decision == 'throttle'",      "actions": ["gtm.reduce\_send\_caps", "ledger.append"]    },    {      "from": "OK",      "to": "PAUSED",      "on": "gtm.domain.health.v1",      "guard": "decision in ['pause\_all','rotate\_domain']",      "actions": ["sys.mode.freeze\_enabled.emit", "gtm.pause\_all", "ledger.append"]    },    {      "from": "THROTTLED",      "to": "PAUSED",      "on": "gtm.spam\_complaint.v1",      "guard": "true",      "actions": ["sys.mode.freeze\_enabled.emit", "gtm.pause\_all", "ledger.append"]    },    {      "from": "PAUSED",      "to": "OK",      "on": "sys.mode.freeze\_disabled.v1",      "guard": "mitigation\_verified == true",      "actions": ["gtm.resume\_safe", "ledger.append"]    }  ]}
\`\`\`

5.2 Procurement payout FSM (milestone → money intent)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/proc\_payout\_fsm.v1.json",  "initial\_state": "MILESTONE\_PENDING",  "states": ["MILESTONE\_PENDING", "SUBMITTED", "VERIFIED", "PAYOUT\_INTENTED", "PAID", "FAILED"],  "transitions": [    {      "from": "MILESTONE\_PENDING",      "to": "SUBMITTED",      "on": "proc.milestone.submitted.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "SUBMITTED",      "to": "VERIFIED",      "on": "proc.milestone.verified.v1",      "guard": "decision == 'pass'",      "actions": ["ledger.append", "money.intent.requested.emit"]    },    {      "from": "VERIFIED",      "to": "PAYOUT\_INTENTED",      "on": "money.intent.approved.v1",      "guard": "true",      "actions": ["ledger.append", "money.vcc.issue\_or\_ap\_pay.emit"]    },    {      "from": "PAYOUT\_INTENTED",      "to": "PAID",      "on": "money.tx.settled.v1",      "guard": "true",      "actions": ["ledger.append", "proc.vendor.trust\_updated.emit"]    },    {      "from": "SUBMITTED",      "to": "FAILED",      "on": "proc.milestone.verified.v1",      "guard": "decision == 'fail'",      "actions": ["ledger.append", "proc.vendor.trust\_updated.emit"]    }  ]}
\`\`\`

5.3 Chargeback spike → freeze integration (simple rule)
In your anomaly detector:

If rev.chargeback.opened.v1 count in 7 days exceeds threshold → emit sys.mode.freeze\_enabled.v1 with trigger CHARGEBACK\_SPIKE.

(That trigger already exists in your freeze payload schema.)

6) What’s next (spec-wise) if you want to keep going
The next “spec gaps” that make the system truly runnable:

rev.payout.paid.v1 (Stripe payout reconciliation)

money.refund.executed.v1 payload schema (we referenced it in FSM but haven’t defined it here)

sys.alert.anomaly.v1 payload schema (standard incident reporting)

gtm.email.sent.v1 payload schema (to compute rates precisely)

sys.tick.daily.v1 payload schema (carry day budgets, reset caps)

Say “keep going” and I’ll add those five plus the reconciliation FSM (payout → ledger close → CEI update).

---

### **ChatGPT**

Do it

---

### **ChatGPT**

Done. Here are the five missing payload schemas plus two FSMs: (A) revenue payout reconciliation and (B) daily close → CEI update. All strict JSON Schema 2020-12, additionalProperties: false.

1) Revenue: payout paid (reconciliation anchor)
type = rev.payout.paid.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_payout\_paid.v1.json",  "title": "Payload: rev.payout.paid.v1",  "type": "object",  "additionalProperties": false,  "required": [    "payout\_id",    "provider",    "amount\_cents",    "currency",    "paid\_ts",    "arrival\_date",    "payment\_ids\_hash",    "fee\_total\_cents",    "evidence"  ],  "properties": {    "payout\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "other"] },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "paid\_ts": { "type": "string", "format": "date-time" },    "arrival\_date": { "type": "string", "format": "date" },    "payment\_ids\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "fee\_total\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

2) Money: refund executed
type = money.refund.executed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_refund\_executed.v1.json",  "title": "Payload: money.refund.executed.v1",  "type": "object",  "additionalProperties": false,  "required": [    "refund\_id",    "provider",    "order\_id",    "amount\_cents",    "currency",    "executed\_ts",    "reason\_code",    "evidence"  ],  "properties": {    "refund\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "other"] },    "order\_id": { "type": "string", "format": "uuid" },    "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "executed\_ts": { "type": "string", "format": "date-time" },    "reason\_code": {      "type": "string",      "enum": ["SLA\_MISSED", "INVALID\_OUTPUT", "INTAKE\_INCOMPLETE", "CUSTOM\_SCOPE\_REQUEST", "BILLING\_ERROR", "GOODWILL"]    },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

3) System: anomaly alert (incident primitive)
type = sys.alert.anomaly.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_sys\_alert\_anomaly.v1.json",  "title": "Payload: sys.alert.anomaly.v1",  "type": "object",  "additionalProperties": false,  "required": ["alert\_id", "detected\_ts", "category", "severity", "signal", "recommended\_actions", "evidence"],  "properties": {    "alert\_id": { "type": "string", "format": "uuid" },    "detected\_ts": { "type": "string", "format": "date-time" },    "category": {      "type": "string",      "enum": ["spend", "deliverability", "conversion", "refunds", "chargebacks", "security", "uptime", "data\_integrity"]    },    "severity": { "type": "integer", "minimum": 1, "maximum": 5 },    "signal": {      "type": "object",      "additionalProperties": false,      "required": ["name", "metric", "baseline", "current", "window"],      "properties": {        "name": { "type": "string", "minLength": 3, "maxLength": 128 },        "metric": { "type": "string", "minLength": 2, "maxLength": 128 },        "baseline": { "type": "number" },        "current": { "type": "number" },        "window": { "type": "string", "enum": ["1h", "6h", "24h", "7d", "30d"] }      }    },    "recommended\_actions": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": {        "type": "string",        "enum": [          "ENABLE\_FREEZE\_MODE",          "PAUSE\_GTM",          "DENY\_NEW\_MONEY\_INTENTS",          "FREEZE\_ALL\_VCC",          "ROLLBACK\_LAST\_DEPLOY",          "THROTTLE\_SENDS",          "RAISE\_PRICES",          "AUTO\_REFUND\_POLICY\_TIGHTEN",          "SECURITY\_ROTATE\_SECRETS",          "OPEN\_INCIDENT"        ]      }    },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

4) GTM: email sent (for deliverability math)
type = gtm.email.sent.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_email\_sent.v1.json",  "title": "Payload: gtm.email.sent.v1",  "type": "object",  "additionalProperties": false,  "required": ["send\_id", "sequence\_id", "to\_contact", "sent\_ts", "template\_hash", "provider\_ref"],  "properties": {    "send\_id": { "type": "string", "format": "uuid" },    "sequence\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "to\_contact": { "type": "string", "minLength": 3, "maxLength": 256 },    "sent\_ts": { "type": "string", "format": "date-time" },    "template\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "provider\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

5) System: daily tick (budget reset + directives)
type = sys.tick.daily.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_sys\_tick\_daily.v1.json",  "title": "Payload: sys.tick.daily.v1",  "type": "object",  "additionalProperties": false,  "required": ["date", "tz", "daily\_eau\_cap", "daily\_token\_caps", "objectives\_cap", "mode"],  "properties": {    "date": { "type": "string", "format": "date" },    "tz": { "type": "string", "minLength": 3, "maxLength": 64 },    "daily\_eau\_cap": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "daily\_token\_caps": {      "type": "object",      "additionalProperties": false,      "required": ["strategists", "builders", "operators", "verifiers", "dispatcher"],      "properties": {        "strategists": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "builders": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "operators": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "verifiers": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "dispatcher": { "type": "integer", "minimum": 0, "maximum": 1000000000 }      }    },    "objectives\_cap": { "type": "integer", "minimum": 1, "maximum": 10 },    "mode": { "type": "string", "enum": ["normal\_ops", "monitor\_only", "growth\_sprint"] }  }}
\`\`\`

6) Reconciliation FSM: payout → reconcile → close
This FSM ties rev.payment.succeeded/failed + fees to the payout record and produces a reconciliation artifact. It’s the accounting spine.

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/rev\_reconciliation\_fsm.v1.json",  "initial\_state": "COLLECTING",  "states": ["COLLECTING", "PAYOUT\_RECEIVED", "RECONCILING", "RECONCILED", "MISMATCH", "CLOSED"],  "transitions": [    {      "from": "COLLECTING",      "to": "PAYOUT\_RECEIVED",      "on": "rev.payout.paid.v1",      "guard": "true",      "actions": ["ledger.append", "recon.start"]    },    {      "from": "PAYOUT\_RECEIVED",      "to": "RECONCILING",      "on": "recon.start.v1",      "guard": "freeze\_mode == false",      "actions": ["recon.match\_payments\_to\_payout", "ledger.append"]    },    {      "from": "RECONCILING",      "to": "RECONCILED",      "on": "recon.completed.v1",      "guard": "mismatch\_cents == 0",      "actions": ["ledger.append", "acct.write\_journal\_entries", "audit.slice.produced.emit"]    },    {      "from": "RECONCILING",      "to": "MISMATCH",      "on": "recon.completed.v1",      "guard": "mismatch\_cents != 0",      "actions": ["ledger.append", "sys.alert.anomaly.emit"]    },    {      "from": "RECONCILED",      "to": "CLOSED",      "on": "sys.tick.daily.v1",      "guard": "date >= arrival\_date",      "actions": ["ledger.append"]    }  ]}
\`\`\`

Notes

recon.start.v1 and recon.completed.v1 are internal workflow events you can define later; you can also collapse them into one event if you want.

If you want strict external-only events, I’ll instead emit acct.recon.report.v1 as the completion signal.

7) Daily Close FSM: daily tick → snapshot → CEI update → anomaly triggers
This ties budgets, token burn, revenue, refunds, and deliverability into one daily “close.”

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/daily\_close\_fsm.v1.json",  "initial\_state": "IDLE",  "states": ["IDLE", "SNAPSHOTTING", "CEI\_UPDATING", "DONE"],  "transitions": [    {      "from": "IDLE",      "to": "SNAPSHOTTING",      "on": "sys.tick.daily.v1",      "guard": "true",      "actions": ["metrics.snapshot", "ledger.append"]    },    {      "from": "SNAPSHOTTING",      "to": "CEI\_UPDATING",      "on": "metrics.snapshot.completed.v1",      "guard": "true",      "actions": ["cei.compute", "ledger.append"]    },    {      "from": "CEI\_UPDATING",      "to": "DONE",      "on": "cei.updated.v1",      "guard": "true",      "actions": ["anomaly.check\_daily", "ledger.append"]    },    {      "from": "DONE",      "to": "IDLE",      "on": "sys.tick.daily.v1",      "guard": "date\_changed == true",      "actions": ["ledger.append"]    }  ]}
\`\`\`

What metrics.snapshot must compute (minimum)

revenue (gross/net), refunds, chargebacks

spend (cash), token burn (EAU), reserved EAU

deliverability metrics (bounce/complaint rates)

support load (tickets opened/closed)

venture CEI = NetEAU / EAU\_spent

Anomaly checks that should emit sys.alert.anomaly.v1

chargeback spike

refund spike

bounce/complaint spike

spend anomaly

conversion drop

…and then freeze mode can be enabled using your existing sys.mode.freeze\_enabled.v1 payload.

8) Next spec chunk (if you want to keep pushing)
Two high-value remaining areas:

Accounting journal event schema (acct.journal.entry.v1, acct.close.monthly.v1)

ModelOps token ledger schemas (turn token burn into enforceable per-role budgets + forecast reserve)

Say “continue” and tell me whether you want to prioritize accounting close or modelops/token accounting next.

---

### **ChatGPT**

Continue

---

### **ChatGPT**

Continuing: next spec chunk covers (A) Accounting close and (B) ModelOps/token accounting (since you didn’t pick). Same style: strict JSON Schema payloads + FSMs wiring them into your existing daily close / reconciliation.

A) Accounting close spec
A1) Chart of accounts (COA) snapshot
type = acct.coa.snapshot.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_acct\_coa\_snapshot.v1.json",  "title": "Payload: acct.coa.snapshot.v1",  "type": "object",  "additionalProperties": false,  "required": ["coa\_id", "as\_of\_date", "accounts\_hash", "evidence"],  "properties": {    "coa\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "as\_of\_date": { "type": "string", "format": "date" },    "accounts\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

A2) Journal entry (double-entry primitive)
type = acct.journal.entry.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_acct\_journal\_entry.v1.json",  "title": "Payload: acct.journal.entry.v1",  "type": "object",  "additionalProperties": false,  "required": ["journal\_id", "entry\_id", "posted\_ts", "currency", "lines", "source\_event\_ids", "evidence\_hash"],  "properties": {    "journal\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "entry\_id": { "type": "string", "format": "uuid" },    "posted\_ts": { "type": "string", "format": "date-time" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "lines": {      "type": "array",      "minItems": 2,      "maxItems": 50,      "items": {        "type": "object",        "additionalProperties": false,        "required": ["account\_code", "side", "amount\_cents", "memo"],        "properties": {          "account\_code": { "type": "string", "minLength": 2, "maxLength": 32 },          "side": { "type": "string", "enum": ["debit", "credit"] },          "amount\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },          "memo": { "type": "string", "maxLength": 256 },          "venture\_id": { "type": ["string", "null"], "minLength": 2, "maxLength": 128 },          "order\_id": { "type": ["string", "null"], "format": "uuid" }        }      }    },    "source\_event\_ids": {      "type": "array",      "minItems": 1,      "maxItems": 100,      "items": { "type": "string", "format": "uuid" }    },    "evidence\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

Constraint (enforced by Accounting): total debits == total credits (same currency).

A3) Monthly close started
type = acct.close.monthly.started.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_acct\_close\_monthly\_started.v1.json",  "title": "Payload: acct.close.monthly.started.v1",  "type": "object",  "additionalProperties": false,  "required": ["period", "started\_ts", "scope", "freeze\_required"],  "properties": {    "period": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$" },    "started\_ts": { "type": "string", "format": "date-time" },    "scope": { "type": "string", "enum": ["all\_ventures", "venture\_only"] },    "venture\_id": { "type": ["string", "null"], "minLength": 2, "maxLength": 128 },    "freeze\_required": { "type": "boolean" }  }}
\`\`\`

A4) Monthly close report (P&L + balance snapshot)
type = acct.close.monthly.report.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_acct\_close\_monthly\_report.v1.json",  "title": "Payload: acct.close.monthly.report.v1",  "type": "object",  "additionalProperties": false,  "required": [    "period",    "completed\_ts",    "currency",    "revenue\_cents",    "cogs\_cents",    "opex\_cents",    "fees\_cents",    "refunds\_cents",    "net\_income\_cents",    "cash\_delta\_cents",    "journal\_entries\_hash",    "recon\_reports\_hash",    "evidence"  ],  "properties": {    "period": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$" },    "completed\_ts": { "type": "string", "format": "date-time" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "revenue\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "cogs\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "opex\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "fees\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "refunds\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "net\_income\_cents": { "type": "integer", "minimum": -100000000000, "maximum": 100000000000 },    "cash\_delta\_cents": { "type": "integer", "minimum": -100000000000, "maximum": 100000000000 },    "journal\_entries\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "recon\_reports\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

A5) Monthly close FSM

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/acct\_monthly\_close\_fsm.v1.json",  "initial\_state": "IDLE",  "states": ["IDLE", "STARTED", "RECONCILING", "POSTING\_JOURNALS", "REVIEWING", "COMPLETE", "BLOCKED"],  "transitions": [    {      "from": "IDLE",      "to": "STARTED",      "on": "acct.close.monthly.started.v1",      "guard": "true",      "actions": ["ledger.append", "acct.lock\_period\_if\_required"]    },    {      "from": "STARTED",      "to": "RECONCILING",      "on": "rev.payout.paid.v1",      "guard": "provider in ['stripe','marketplace']",      "actions": ["recon.match\_payments\_to\_payout", "ledger.append"]    },    {      "from": "RECONCILING",      "to": "POSTING\_JOURNALS",      "on": "recon.completed.v1",      "guard": "mismatch\_cents == 0",      "actions": ["acct.post\_journals", "ledger.append"]    },    {      "from": "RECONCILING",      "to": "BLOCKED",      "on": "recon.completed.v1",      "guard": "mismatch\_cents != 0",      "actions": ["sys.alert.anomaly.emit", "ledger.append"]    },    {      "from": "POSTING\_JOURNALS",      "to": "REVIEWING",      "on": "acct.journals.posted.v1",      "guard": "true",      "actions": ["acct.generate\_close\_report", "ledger.append"]    },    {      "from": "REVIEWING",      "to": "COMPLETE",      "on": "acct.close.monthly.report.v1",      "guard": "true",      "actions": ["ledger.append", "acct.unlock\_period\_if\_locked"]    }  ]}
\`\`\`

B) ModelOps / token accounting spec
You want tokens treated as “energy spend” with role budgets, forecast reserve, and caps. Here are the payloads that make it enforceable.
B1) Token usage observed (per agent/role, per window)
type = model.tokens.usage.observed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_model\_tokens\_usage\_observed.v1.json",  "title": "Payload: model.tokens.usage.observed.v1",  "type": "object",  "additionalProperties": false,  "required": ["usage\_id", "window", "agent\_id", "role", "model\_tier", "in\_tokens", "out\_tokens", "observed\_ts", "eau\_equiv"],  "properties": {    "usage\_id": { "type": "string", "format": "uuid" },    "window": { "type": "string", "enum": ["5m", "15m", "1h", "24h"] },    "agent\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "role": { "type": "string", "enum": ["dispatcher", "strategist", "builder", "operator", "verifier", "reader"] },    "model\_tier": { "type": "string", "enum": ["opus", "sonnet", "haiku", "local", "other"] },    "in\_tokens": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "out\_tokens": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "observed\_ts": { "type": "string", "format": "date-time" },    "eau\_equiv": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

B2) Token budget updated (per role)
type = model.tokens.budget.updated.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_model\_tokens\_budget\_updated.v1.json",  "title": "Payload: model.tokens.budget.updated.v1",  "type": "object",  "additionalProperties": false,  "required": ["date", "role\_caps", "policy\_decision\_hash"],  "properties": {    "date": { "type": "string", "format": "date" },    "role\_caps": {      "type": "object",      "additionalProperties": false,      "required": ["dispatcher", "strategist", "builder", "operator", "verifier", "reader"],      "properties": {        "dispatcher": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "strategist": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "builder": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "operator": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "verifier": { "type": "integer", "minimum": 0, "maximum": 1000000000 },        "reader": { "type": "integer", "minimum": 0, "maximum": 1000000000 }      }    },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

B3) Token forecast proposed (predicted expansion)
type = model.tokens.forecast.proposed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_model\_tokens\_forecast\_proposed.v1.json",  "title": "Payload: model.tokens.forecast.proposed.v1",  "type": "object",  "additionalProperties": false,  "required": ["forecast\_id", "workflow\_id", "horizon", "expected\_in", "expected\_out", "p95\_in", "p95\_out", "eau\_commit", "evidence\_hash"],  "properties": {    "forecast\_id": { "type": "string", "format": "uuid" },    "workflow\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "horizon": { "type": "string", "enum": ["24h", "7d", "30d"] },    "expected\_in": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "expected\_out": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "p95\_in": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "p95\_out": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "eau\_commit": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "evidence\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

B4) Token forecast reserved (policy reserve is applied)
type = model.tokens.forecast.reserved.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_model\_tokens\_forecast\_reserved.v1.json",  "title": "Payload: model.tokens.forecast.reserved.v1",  "type": "object",  "additionalProperties": false,  "required": ["forecast\_id", "reserved\_eau\_increment", "policy\_decision\_hash"],  "properties": {    "forecast\_id": { "type": "string", "format": "uuid" },    "reserved\_eau\_increment": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

C) Token guard FSM (enforcement + mode switching)
This FSM is what makes “tokens = labor/energy” operational:

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/token\_guard\_fsm.v1.json",  "initial\_state": "NORMAL",  "states": ["NORMAL", "THROTTLED", "MONITOR\_ONLY"],  "transitions": [    {      "from": "NORMAL",      "to": "THROTTLED",      "on": "model.tokens.usage.observed.v1",      "guard": "role\_usage\_today > role\_cap\_today \* 0.9",      "actions": ["modelops.downgrade\_model\_tier", "ledger.append"]    },    {      "from": "THROTTLED",      "to": "MONITOR\_ONLY",      "on": "model.tokens.usage.observed.v1",      "guard": "total\_usage\_today > total\_cap\_today",      "actions": ["sys.mode.freeze\_enabled.emit", "ledger.append"]    },    {      "from": "MONITOR\_ONLY",      "to": "NORMAL",      "on": "sys.tick.daily.v1",      "guard": "new\_day == true",      "actions": ["modelops.reset\_caps", "ledger.append"]    }  ]}
\`\`\`

D) Wiring into your existing daily close (what changes)
On sys.tick.daily.v1, daily close now also:

emits model.tokens.budget.updated.v1

consumes prior-day model.tokens.usage.observed.v1 rollups

applies forecast reserve via model.tokens.forecast.reserved.v1 for scheduled workflows

So your EAU reserve now includes:

cash commitments

money intent forecasts

token forecasts

E) Next spec chunk to finish the “runnable core”
If you keep going, the remaining “must-have” specs are:

metrics.snapshot.completed.v1 payload (so daily close isn’t hand-wavy)

cei.updated.v1 payload (explicit CEI calc output)

recon.completed.v1 payload (so reconciliation FSM is fully typed)

acct.journals.posted.v1 payload (for monthly close FSM)

Say “continue” again and I’ll add those four schemas plus the concrete CEI formula contract (inputs/outputs) so the allocator can make kill/scale decisions strictly from events.

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Continuing spec: here are the 4 missing payload schemas plus a strict CEI contract (inputs/outputs) and a metrics snapshot contract so daily close and reconciliation become fully typed and machine-executable.
All JSON Schema 2020-12, strict (additionalProperties: false).

1) metrics.snapshot.completed.v1
This is the canonical “daily facts” object that everything else depends on.

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_metrics\_snapshot\_completed.v1.json",  "title": "Payload: metrics.snapshot.completed.v1",  "type": "object",  "additionalProperties": false,  "required": [    "snapshot\_id",    "date",    "tz",    "venture\_id",    "currency",    "rev\_gross\_cents",    "rev\_net\_cents",    "refunds\_cents",    "chargebacks\_cents",    "fees\_cents",    "cash\_spend\_cents",    "cash\_spend\_breakdown",    "token\_usage",    "eau\_spent\_total",    "eau\_reserved\_total",    "support",    "gtm",    "quality",    "evidence"  ],  "properties": {    "snapshot\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "tz": { "type": "string", "minLength": 3, "maxLength": 64 },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "rev\_gross\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "rev\_net\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "refunds\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "chargebacks\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "fees\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "cash\_spend\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "cash\_spend\_breakdown": {      "type": "object",      "additionalProperties": false,      "required": ["ads\_cents", "vendors\_cents", "hosting\_cents", "software\_cents", "other\_cents"],      "properties": {        "ads\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },        "vendors\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },        "hosting\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },        "software\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },        "other\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" }      }    },    "token\_usage": {      "type": "object",      "additionalProperties": false,      "required": ["in\_tokens", "out\_tokens", "eau\_equiv"],      "properties": {        "in\_tokens": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "out\_tokens": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "eau\_equiv": { "type": "integer", "minimum": 0, "maximum": 2000000000 }      }    },    "eau\_spent\_total": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "eau\_reserved\_total": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "support": {      "type": "object",      "additionalProperties": false,      "required": ["tickets\_opened", "tickets\_closed", "refund\_requests", "avg\_first\_response\_minutes"],      "properties": {        "tickets\_opened": { "type": "integer", "minimum": 0, "maximum": 1000000 },        "tickets\_closed": { "type": "integer", "minimum": 0, "maximum": 1000000 },        "refund\_requests": { "type": "integer", "minimum": 0, "maximum": 1000000 },        "avg\_first\_response\_minutes": { "type": "integer", "minimum": 0, "maximum": 1000000 }      }    },    "gtm": {      "type": "object",      "additionalProperties": false,      "required": ["emails\_sent", "replies", "positive\_replies", "bounces", "spam\_complaints"],      "properties": {        "emails\_sent": { "type": "integer", "minimum": 0, "maximum": 10000000 },        "replies": { "type": "integer", "minimum": 0, "maximum": 10000000 },        "positive\_replies": { "type": "integer", "minimum": 0, "maximum": 10000000 },        "bounces": { "type": "integer", "minimum": 0, "maximum": 10000000 },        "spam\_complaints": { "type": "integer", "minimum": 0, "maximum": 1000000 }      }    },    "quality": {      "type": "object",      "additionalProperties": false,      "required": ["fulfillment\_sla\_breaches", "qa\_failures", "defect\_rate\_est"],      "properties": {        "fulfillment\_sla\_breaches": { "type": "integer", "minimum": 0, "maximum": 1000000 },        "qa\_failures": { "type": "integer", "minimum": 0, "maximum": 1000000 },        "defect\_rate\_est": { "type": "number", "minimum": 0, "maximum": 1 }      }    },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 50,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

2) cei.updated.v1
This is the canonical output the allocator uses for kill/scale decisions.

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_cei\_updated.v1.json",  "title": "Payload: cei.updated.v1",  "type": "object",  "additionalProperties": false,  "required": [    "cei\_id",    "date",    "venture\_id",    "cei\_value",    "net\_eau",    "rev\_eau",    "cost\_eau",    "cost\_breakdown\_eau",    "confidence",    "policy\_flags",    "inputs\_hash"  ],  "properties": {    "cei\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "cei\_value": { "type": "number", "minimum": 0, "maximum": 1000 },    "net\_eau": { "type": "integer", "minimum": -2000000000, "maximum": 2000000000 },    "rev\_eau": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "cost\_eau": { "type": "integer", "minimum": 0, "maximum": 2000000000 },    "cost\_breakdown\_eau": {      "type": "object",      "additionalProperties": false,      "required": ["tokens", "ads", "vendors", "hosting", "software", "refunds", "fees", "other"],      "properties": {        "tokens": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "ads": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "vendors": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "hosting": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "software": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "refunds": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "fees": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "other": { "type": "integer", "minimum": 0, "maximum": 2000000000 }      }    },    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },    "policy\_flags": {      "type": "array",      "minItems": 0,      "maxItems": 20,      "items": {        "type": "string",        "enum": [          "CEI\_BELOW\_FREEZE",          "CEI\_BELOW\_KILL",          "SUPPORT\_LOAD\_HIGH",          "DISPUTE\_RISK\_HIGH",          "DELIVERABILITY\_RISK\_HIGH",          "SPEND\_ANOMALY",          "TOKEN\_BURN\_HIGH"        ]      }    },    "inputs\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

3) recon.completed.v1
Makes reconciliation FSM fully typed.

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_recon\_completed.v1.json",  "title": "Payload: recon.completed.v1",  "type": "object",  "additionalProperties": false,  "required": [    "recon\_id",    "payout\_id",    "provider",    "currency",    "expected\_total\_cents",    "actual\_payout\_cents",    "fee\_total\_cents",    "refund\_total\_cents",    "chargeback\_total\_cents",    "mismatch\_cents",    "matched\_payment\_ids\_hash",    "completed\_ts",    "evidence"  ],  "properties": {    "recon\_id": { "type": "string", "format": "uuid" },    "payout\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "marketplace", "other"] },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "expected\_total\_cents": { "type": "integer", "minimum": -100000000000, "maximum": 100000000000 },    "actual\_payout\_cents": { "type": "integer", "minimum": -100000000000, "maximum": 100000000000 },    "fee\_total\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "refund\_total\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "chargeback\_total\_cents": { "$ref": "https://orgstack.dev/schemas/money\_cents.v1.json" },    "mismatch\_cents": { "type": "integer", "minimum": -100000000000, "maximum": 100000000000 },    "matched\_payment\_ids\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "completed\_ts": { "type": "string", "format": "date-time" },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

4) acct.journals.posted.v1
Signals accounting has posted all journals for a period (day or month).

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_acct\_journals\_posted.v1.json",  "title": "Payload: acct.journals.posted.v1",  "type": "object",  "additionalProperties": false,  "required": ["period", "posted\_ts", "currency", "journal\_entries\_hash", "count", "evidence"],  "properties": {    "period": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$" },    "posted\_ts": { "type": "string", "format": "date-time" },    "currency": { "type": "string", "minLength": 3, "maxLength": 8 },    "journal\_entries\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "count": { "type": "integer", "minimum": 1, "maximum": 1000000 },    "evidence": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }  }}
\`\`\`

5) CEI contract (explicit formula + required inputs)
This is the “spec-of-the-spec” so CEI can’t be redefined silently.
5.1 cei.contract.v1 (static policy doc)
type = cei.contract.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_cei\_contract.v1.json",  "title": "Payload: cei.contract.v1",  "type": "object",  "additionalProperties": false,  "required": [    "contract\_id",    "version",    "eau\_unit\_usd",    "rev\_eau\_mapping",    "cost\_eau\_components",    "cei\_definition",    "thresholds"  ],  "properties": {    "contract\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "version": { "type": "string", "pattern": "^[0-9]+\\\\.[0-9]+$" },    "eau\_unit\_usd": { "type": "number", "exclusiveMinimum": 0, "maximum": 10 },    "rev\_eau\_mapping": {      "type": "object",      "additionalProperties": false,      "required": ["rev\_net\_cents\_to\_eau"],      "properties": {        "rev\_net\_cents\_to\_eau": { "type": "string", "enum": ["rev\_net\_cents / (eau\_unit\_usd\*100)"] }      }    },    "cost\_eau\_components": {      "type": "array",      "minItems": 3,      "uniqueItems": true,      "items": {        "type": "string",        "enum": ["tokens\_eau", "cash\_spend\_eau", "refunds\_eau", "fees\_eau", "chargebacks\_eau", "other\_eau"]      }    },    "cei\_definition": {      "type": "object",      "additionalProperties": false,      "required": ["net\_eau", "cei\_value"],      "properties": {        "net\_eau": { "type": "string", "enum": ["rev\_eau - cost\_eau"] },        "cei\_value": {          "type": "string",          "enum": [            "net\_eau / max(cost\_eau, 1)",            "rev\_eau / max(cost\_eau, 1)"          ],          "description": "Pick one and freeze it; net-based is preferred."        }      }    },    "thresholds": {      "type": "object",      "additionalProperties": false,      "required": ["freeze\_below", "kill\_below", "confidence\_min"],      "properties": {        "freeze\_below": { "type": "number", "minimum": 0, "maximum": 1000 },        "kill\_below": { "type": "number", "minimum": 0, "maximum": 1000 },        "confidence\_min": { "type": "number", "minimum": 0, "maximum": 1 }      }    }  }}
\`\`\`

Recommendation: lock cei\_value = net\_eau / max(cost\_eau,1) so it reflects true energy ROI.

6) Wiring: updated daily close FSM (typed)
Your existing daily close FSM references internal events. With these schemas, you can make it explicit:

sys.tick.daily.v1 → emits metrics.snapshot.completed.v1

then emits cei.updated.v1

then emits anomalies/freeze if needed

No new schema needed for the internal “cei.compute” action since CEI output is now typed.

If you want the next spec chunk, the remaining “core runnable” items are:

Allocator actions (kill/freeze/scale decisions as events):

alloc.venture.scaled.v1, alloc.venture.frozen.v1, alloc.venture.killed.v1, alloc.budget.rebalanced.v1

Experiment lifecycle as strict events:

prod.experiment.started.v1, prod.experiment.result.v1

Say “allocator next” or “experiments next” (or both).

---

### **ChatGPT**

Nxt

---

### **ChatGPT**

Next: Allocator spec (venture scale/freeze/kill + budget rebalance) with strict payload schemas + an allocator FSM that consumes cei.updated.v1, anomaly events, and emits enforceable actions.

1) Allocator action payloads (strict)
1.1 Venture scaled
type = alloc.venture.scaled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_alloc\_venture\_scaled.v1.json",  "title": "Payload: alloc.venture.scaled.v1",  "type": "object",  "additionalProperties": false,  "required": [    "decision\_id",    "date",    "venture\_id",    "scale\_kind",    "delta",    "new\_limits",    "justification\_hash",    "policy\_decision\_hash"  ],  "properties": {    "decision\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "scale\_kind": { "type": "string", "enum": ["gtm\_send\_cap", "ads\_budget", "compute\_budget", "vendor\_budget", "feature\_velocity"] },    "delta": {      "type": "object",      "additionalProperties": false,      "required": ["unit", "amount"],      "properties": {        "unit": { "type": "string", "enum": ["count", "cents", "eau", "tokens"] },        "amount": { "type": "integer", "minimum": -2000000000, "maximum": 2000000000 }      }    },    "new\_limits": {      "type": "object",      "additionalProperties": false,      "required": ["cap\_daily", "cap\_monthly"],      "properties": {        "cap\_daily": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "cap\_monthly": { "type": "integer", "minimum": 0, "maximum": 2000000000 }      }    },    "justification\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

1.2 Venture frozen (stop scaling, keep operating)
type = alloc.venture.frozen.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_alloc\_venture\_frozen.v1.json",  "title": "Payload: alloc.venture.frozen.v1",  "type": "object",  "additionalProperties": false,  "required": ["decision\_id", "date", "venture\_id", "freeze\_reason", "duration\_days", "policy\_decision\_hash"],  "properties": {    "decision\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "freeze\_reason": {      "type": "string",      "enum": ["CEI\_BELOW\_FREEZE", "SUPPORT\_LOAD\_HIGH", "DISPUTE\_RISK\_HIGH", "DELIVERABILITY\_RISK\_HIGH", "SPEND\_ANOMALY", "TOKEN\_BURN\_HIGH", "SECURITY\_RISK"]    },    "duration\_days": { "type": "integer", "minimum": 1, "maximum": 180 },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "notes": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

1.3 Venture killed (terminate operations)
type = alloc.venture.killed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_alloc\_venture\_killed.v1.json",  "title": "Payload: alloc.venture.killed.v1",  "type": "object",  "additionalProperties": false,  "required": ["decision\_id", "date", "venture\_id", "kill\_reason", "shutdown\_plan\_hash", "policy\_decision\_hash"],  "properties": {    "decision\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "kill\_reason": {      "type": "string",      "enum": ["CEI\_BELOW\_KILL", "NO\_TRACTION\_GATE\_FAIL", "PLATFORM\_BAN\_RISK", "COMPLIANCE\_RISK", "SECURITY\_INCIDENT", "NEGATIVE\_UNIT\_ECONOMICS"]    },    "shutdown\_plan\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

1.4 Budget rebalanced (EAU + cash + token budgets)
type = alloc.budget.rebalanced.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_alloc\_budget\_rebalanced.v1.json",  "title": "Payload: alloc.budget.rebalanced.v1",  "type": "object",  "additionalProperties": false,  "required": ["rebalance\_id", "date", "scope", "allocations", "policy\_decision\_hash", "inputs\_hash"],  "properties": {    "rebalance\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "scope": { "type": "string", "enum": ["daily", "weekly", "monthly"] },    "allocations": {      "type": "array",      "minItems": 1,      "maxItems": 200,      "items": {        "type": "object",        "additionalProperties": false,        "required": ["venture\_id", "caps"],        "properties": {          "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },          "caps": {            "type": "object",            "additionalProperties": false,            "required": ["eau\_daily", "eau\_monthly", "tokens\_daily", "cash\_daily\_cents", "cash\_monthly\_cents"],            "properties": {              "eau\_daily": { "type": "integer", "minimum": 0, "maximum": 2000000000 },              "eau\_monthly": { "type": "integer", "minimum": 0, "maximum": 2000000000 },              "tokens\_daily": { "type": "integer", "minimum": 0, "maximum": 2000000000 },              "cash\_daily\_cents": { "type": "integer", "minimum": 0, "maximum": 100000000000 },              "cash\_monthly\_cents": { "type": "integer", "minimum": 0, "maximum": 100000000000 }            }          }        }      }    },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "inputs\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

1.5 Venture spawned (new venture creation approval)
type = alloc.venture.spawned.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_alloc\_venture\_spawned.v1.json",  "title": "Payload: alloc.venture.spawned.v1",  "type": "object",  "additionalProperties": false,  "required": ["spawn\_id", "date", "new\_venture\_id", "seed\_caps", "thesis\_hash", "gates", "policy\_decision\_hash"],  "properties": {    "spawn\_id": { "type": "string", "format": "uuid" },    "date": { "type": "string", "format": "date" },    "new\_venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "seed\_caps": {      "type": "object",      "additionalProperties": false,      "required": ["eau\_monthly", "tokens\_daily", "cash\_monthly\_cents"],      "properties": {        "eau\_monthly": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "tokens\_daily": { "type": "integer", "minimum": 0, "maximum": 2000000000 },        "cash\_monthly\_cents": { "type": "integer", "minimum": 0, "maximum": 100000000000 }      }    },    "thesis\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "gates": {      "type": "object",      "additionalProperties": false,      "required": ["day7", "day14", "day30"],      "properties": {        "day7": { "type": "string", "minLength": 5, "maxLength": 256 },        "day14": { "type": "string", "minLength": 5, "maxLength": 256 },        "day30": { "type": "string", "minLength": 5, "maxLength": 256 }      }    },    "policy\_decision\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

2) Allocator FSM (consumes CEI + anomalies + freeze + gates)
This is the decision logic state machine that runs daily/weekly. It doesn’t do work itself; it emits actions.

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/allocator\_fsm.v1.json",  "initial\_state": "NORMAL",  "states": ["NORMAL", "VENTURE\_FROZEN", "VENTURE\_KILLED", "SYSTEM\_FROZEN"],  "transitions": [    {      "from": "NORMAL",      "to": "SYSTEM\_FROZEN",      "on": "sys.mode.freeze\_enabled.v1",      "guard": "severity >= 3",      "actions": ["alloc.reduce\_risk", "ledger.append"]    },    {      "from": "SYSTEM\_FROZEN",      "to": "NORMAL",      "on": "sys.mode.freeze\_disabled.v1",      "guard": "mitigation\_verified == true",      "actions": ["alloc.resume\_safe", "ledger.append"]    },    {      "from": "NORMAL",      "to": "VENTURE\_FROZEN",      "on": "cei.updated.v1",      "guard": "('CEI\_BELOW\_FREEZE' in policy\_flags) || ('SUPPORT\_LOAD\_HIGH' in policy\_flags) || ('DELIVERABILITY\_RISK\_HIGH' in policy\_flags)",      "actions": ["alloc.venture.frozen.emit", "alloc.budget.rebalanced.emit", "ledger.append"]    },    {      "from": "NORMAL",      "to": "VENTURE\_KILLED",      "on": "cei.updated.v1",      "guard": "'CEI\_BELOW\_KILL' in policy\_flags",      "actions": ["alloc.venture.killed.emit", "alloc.budget.rebalanced.emit", "ledger.append"]    },    {      "from": "NORMAL",      "to": "NORMAL",      "on": "cei.updated.v1",      "guard": "cei\_value >= policy.scale\_threshold && confidence >= policy.confidence\_min && freeze\_mode == false",      "actions": ["alloc.venture.scaled.emit", "alloc.budget.rebalanced.emit", "ledger.append"]    }  ]}
\`\`\`

Required policy knobs referenced above (these live in the policy engine)

policy.scale\_threshold (e.g., 1.2)

policy.confidence\_min (e.g., 0.6)

freeze/kill thresholds already in cei.contract.v1

3) Wiring notes (how this becomes enforceable)
Once the allocator emits actions, departments must subscribe:

alloc.budget.rebalanced.v1 → Treasury updates EAU/cash caps, ModelOps updates token caps, GTM updates send caps.

alloc.venture.frozen.v1 → GTM pauses sequences for venture, Ads budgets set to 0, new money intents denied except maintenance.

alloc.venture.killed.v1 → triggers shutdown workflow (close subs, stop GTM, archive infra, disable spend pools).

If you want, next I’ll define the shutdown plan schema (ops.shutdown.plan.v1) and the enforcement events that actually pause/cancel things (gtm.sequence.stop.v1, money.intent.revoked.v1, sre.disable\_service.v1).

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Cool — here’s the shutdown plan schema + the enforcement event payloads that make “freeze/kill” actually happen (stop GTM, revoke spend, disable services, cancel subs, archive data). All strict JSON Schema 2020-12.

1) Shutdown plan (what a “kill” executes)
1.1 Shutdown plan authored
type = ops.shutdown.plan.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_ops\_shutdown\_plan.v1.json",  "title": "Payload: ops.shutdown.plan.v1",  "type": "object",  "additionalProperties": false,  "required": [    "shutdown\_plan\_id",    "venture\_id",    "created\_ts",    "mode",    "steps",    "data\_retention\_policy",    "evidence\_hash"  ],  "properties": {    "shutdown\_plan\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "created\_ts": { "type": "string", "format": "date-time" },    "mode": { "type": "string", "enum": ["freeze", "kill", "sunset"] },    "steps": {      "type": "array",      "minItems": 5,      "maxItems": 100,      "items": {        "type": "object",        "additionalProperties": false,        "required": ["step\_id", "kind", "priority", "timeout\_minutes", "idempotency\_key", "depends\_on"],        "properties": {          "step\_id": { "type": "string", "format": "uuid" },          "kind": {            "type": "string",            "enum": [              "PAUSE\_GTM",              "STOP\_GTM",              "SUPPRESS\_CONTACTS",              "REVOKE\_MONEY\_INTENTS",              "FREEZE\_VCC\_POOLS",              "CANCEL\_ADS",              "CANCEL\_SUBSCRIPTIONS",              "DISABLE\_CHECKOUT",              "DISABLE\_SERVICE",              "ROLLBACK\_LAST\_DEPLOY",              "ARCHIVE\_REPO",              "BACKUP\_DATA",              "EXPORT\_CUSTOMER\_DATA",              "DELETE\_CUSTOMER\_DATA",              "NOTIFY\_CUSTOMERS",              "CLOSE\_SUPPORT"            ]          },          "priority": { "type": "integer", "minimum": 1, "maximum": 5 },          "timeout\_minutes": { "type": "integer", "minimum": 1, "maximum": 10080 },          "idempotency\_key": { "type": "string", "minLength": 16, "maxLength": 256 },          "depends\_on": {            "type": "array",            "maxItems": 20,            "items": { "type": "string", "format": "uuid" }          },          "params\_hash": {            "type": ["string", "null"],            "pattern": "^[a-fA-F0-9]{64}$"          }        }      }    },    "data\_retention\_policy": {      "type": "object",      "additionalProperties": false,      "required": ["retain\_days", "delete\_after\_days", "export\_required"],      "properties": {        "retain\_days": { "type": "integer", "minimum": 0, "maximum": 3650 },        "delete\_after\_days": { "type": "integer", "minimum": 0, "maximum": 3650 },        "export\_required": { "type": "boolean" }      }    },    "evidence\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" }  }}
\`\`\`

1.2 Shutdown execution started/completed (auditability)
type = ops.shutdown.started.v1
type = ops.shutdown.completed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_ops\_shutdown\_started.v1.json",  "title": "Payload: ops.shutdown.started.v1",  "type": "object",  "additionalProperties": false,  "required": ["shutdown\_id", "shutdown\_plan\_id", "venture\_id", "started\_ts"],  "properties": {    "shutdown\_id": { "type": "string", "format": "uuid" },    "shutdown\_plan\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "started\_ts": { "type": "string", "format": "date-time" }  }}
\`\`\`

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_ops\_shutdown\_completed.v1.json",  "title": "Payload: ops.shutdown.completed.v1",  "type": "object",  "additionalProperties": false,  "required": ["shutdown\_id", "shutdown\_plan\_id", "venture\_id", "completed\_ts", "status", "step\_results\_hash", "evidence"],  "properties": {    "shutdown\_id": { "type": "string", "format": "uuid" },    "shutdown\_plan\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "completed\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["success", "partial", "failed"] },    "step\_results\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 50,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

2) Enforcement event payloads (the actual “do stuff” commands)
These are the concrete events departments subscribe to.
2.1 Stop/pause GTM sequences
type = gtm.sequence.stop.v1
type = gtm.sequence.pause.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_sequence\_stop.v1.json",  "title": "Payload: gtm.sequence.stop.v1",  "type": "object",  "additionalProperties": false,  "required": ["sequence\_id", "venture\_id", "reason", "requested\_ts"],  "properties": {    "sequence\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "reason": { "type": "string", "enum": ["freeze\_mode", "venture\_frozen", "venture\_killed", "deliverability\_risk", "compliance"] },    "requested\_ts": { "type": "string", "format": "date-time" }  }}
\`\`\`

2.2 Suppress contacts (hard opt-out / do-not-contact)
type = gtm.contacts.suppressed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_gtm\_contacts\_suppressed.v1.json",  "title": "Payload: gtm.contacts.suppressed.v1",  "type": "object",  "additionalProperties": false,  "required": ["suppression\_id", "venture\_id", "count", "suppression\_list\_hash", "reason", "ts"],  "properties": {    "suppression\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "count": { "type": "integer", "minimum": 1, "maximum": 50000000 },    "suppression\_list\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "reason": { "type": "string", "enum": ["opt\_out", "spam\_trap\_suspect", "venture\_shutdown", "compliance"] },    "ts": { "type": "string", "format": "date-time" }  }}
\`\`\`

3) Money enforcement
3.1 Revoke intents (prevents future spend)
type = money.intent.revoked.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_intent\_revoked.v1.json",  "title": "Payload: money.intent.revoked.v1",  "type": "object",  "additionalProperties": false,  "required": ["intent\_id", "venture\_id", "revoked\_ts", "reason", "policy\_decision\_hash"],  "properties": {    "intent\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "revoked\_ts": { "type": "string", "format": "date-time" },    "reason": { "type": "string", "enum": ["freeze\_mode", "venture\_frozen", "venture\_killed", "policy\_breach", "security\_incident"] },    "policy\_decision\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" }  }}
\`\`\`

3.2 Freeze VCC pool (hard stop)
type = money.vcc.pool.frozen.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_vcc\_pool\_frozen.v1.json",  "title": "Payload: money.vcc.pool.frozen.v1",  "type": "object",  "additionalProperties": false,  "required": ["pool\_id", "venture\_id", "frozen\_ts", "scope", "reason"],  "properties": {    "pool\_id": { "type": "string", "minLength": 3, "maxLength": 128 },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "frozen\_ts": { "type": "string", "format": "date-time" },    "scope": { "type": "string", "enum": ["all\_cards", "new\_cards\_only"] },    "reason": { "type": "string", "enum": ["freeze\_mode", "venture\_frozen", "venture\_killed", "spend\_anomaly", "security\_incident"] }  }}
\`\`\`

3.3 Cancel ads (forces spend to zero)
type = money.ads.cancelled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_money\_ads\_cancelled.v1.json",  "title": "Payload: money.ads.cancelled.v1",  "type": "object",  "additionalProperties": false,  "required": ["venture\_id", "platform", "campaign\_ids\_hash", "cancelled\_ts", "reason"],  "properties": {    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "platform": { "type": "string", "enum": ["google\_ads", "meta\_ads", "reddit\_ads", "other"] },    "campaign\_ids\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "cancelled\_ts": { "type": "string", "format": "date-time" },    "reason": { "type": "string", "enum": ["freeze\_mode", "venture\_frozen", "venture\_killed", "roi\_negative", "compliance"] }  }}
\`\`\`

4) Revenue enforcement
4.1 Cancel subscriptions (for venture kill/sunset)
type = rev.subscription.cancel\_requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_subscription\_cancel\_requested.v1.json",  "title": "Payload: rev.subscription.cancel\_requested.v1",  "type": "object",  "additionalProperties": false,  "required": ["venture\_id", "provider", "subscription\_ids\_hash", "requested\_ts", "mode", "reason"],  "properties": {    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "provider": { "type": "string", "enum": ["stripe", "other"] },    "subscription\_ids\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "requested\_ts": { "type": "string", "format": "date-time" },    "mode": { "type": "string", "enum": ["immediate", "end\_of\_period"] },    "reason": { "type": "string", "enum": ["venture\_shutdown", "policy", "customer\_request"] }  }}
\`\`\`

4.2 Disable checkout (stop new purchases)
type = rev.checkout.disabled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_rev\_checkout\_disabled.v1.json",  "title": "Payload: rev.checkout.disabled.v1",  "type": "object",  "additionalProperties": false,  "required": ["venture\_id", "disabled\_ts", "scope", "reason"],  "properties": {    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "disabled\_ts": { "type": "string", "format": "date-time" },    "scope": { "type": "string", "enum": ["all\_products", "sku\_list\_only"] },    "reason": { "type": "string", "enum": ["freeze\_mode", "venture\_frozen", "venture\_killed", "compliance", "security"] }  }}
\`\`\`

5) SRE/service enforcement
5.1 Disable service
type = sre.service.disabled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_sre\_service\_disabled.v1.json",  "title": "Payload: sre.service.disabled.v1",  "type": "object",  "additionalProperties": false,  "required": ["venture\_id", "service\_name", "env", "disabled\_ts", "reason", "evidence"],  "properties": {    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "service\_name": { "type": "string", "minLength": 2, "maxLength": 128 },    "env": { "type": "string", "enum": ["staging", "prod"] },    "disabled\_ts": { "type": "string", "format": "date-time" },    "reason": { "type": "string", "enum": ["venture\_killed", "security", "freeze\_mode", "cost\_control"] },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

5.2 Archive repo
type = sre.repo.archived.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_sre\_repo\_archived.v1.json",  "title": "Payload: sre.repo.archived.v1",  "type": "object",  "additionalProperties": false,  "required": ["venture\_id", "repo", "archived\_ts", "reason"],  "properties": {    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "repo": { "type": "string", "minLength": 2, "maxLength": 256 },    "archived\_ts": { "type": "string", "format": "date-time" },    "reason": { "type": "string", "enum": ["venture\_shutdown", "sunset", "security"] }  }}
\`\`\`

6) Shutdown execution FSM (plan → steps → completed)
This is what actually runs ops.shutdown.plan.v1 deterministically.

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/shutdown\_execution\_fsm.v1.json",  "initial\_state": "PLANNED",  "states": ["PLANNED", "STARTED", "EXECUTING", "VERIFYING", "COMPLETED", "FAILED"],  "transitions": [    {      "from": "PLANNED",      "to": "STARTED",      "on": "ops.shutdown.started.v1",      "guard": "true",      "actions": ["ledger.append"]    },    {      "from": "STARTED",      "to": "EXECUTING",      "on": "ops.shutdown.plan.v1",      "guard": "mode in ['freeze','kill','sunset']",      "actions": ["shutdown.execute\_steps", "ledger.append"]    },    {      "from": "EXECUTING",      "to": "VERIFYING",      "on": "shutdown.steps.executed.v1",      "guard": "true",      "actions": ["shutdown.verify\_invariants", "ledger.append"]    },    {      "from": "VERIFYING",      "to": "COMPLETED",      "on": "ops.shutdown.completed.v1",      "guard": "status in ['success','partial']",      "actions": ["ledger.append"]    },    {      "from": "VERIFYING",      "to": "FAILED",      "on": "ops.shutdown.completed.v1",      "guard": "status == 'failed'",      "actions": ["sys.alert.anomaly.emit", "ledger.append"]    }  ]}
\`\`\`

Invariants the verifier should check (must be deterministic)

No active GTM sequences for venture

Checkout disabled (if kill)

Ads budgets set to zero

All open money intents revoked

VCC pools frozen (or scoped to maintenance only)

Service disabled or rolled back to safe state

Data retention policy scheduled (backup/export/delete)

If you want the next spec chunk, the remaining major gap is Data/Privacy ops:

comp.privacy.export\_requested.v1 / comp.privacy.delete\_requested.v1 payloads

plus the privacy execution FSM (export/delete confirmation, retention timers, audit).

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Yep — here’s the Data/Privacy Ops spec: payload schemas + an execution FSM that makes privacy requests (export/delete) deterministic, auditable, and safe under zero-HITL.
Assumptions:

You already have the common event envelope.

All payloads below are strict (additionalProperties: false).

Requests are only executed after a verification step (to avoid someone deleting another user’s data).

1) Privacy request payloads
1.1 Privacy export requested
type = comp.privacy.export\_requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_export\_requested.v1.json",  "title": "Payload: comp.privacy.export\_requested.v1",  "type": "object",  "additionalProperties": false,  "required": [    "request\_id",    "venture\_id",    "request\_ts",    "subject",    "request\_channel",    "scope",    "delivery\_method",    "evidence"  ],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "request\_ts": { "type": "string", "format": "date-time" },    "subject": {      "type": "object",      "additionalProperties": false,      "required": ["subject\_type", "subject\_id", "contact"],      "properties": {        "subject\_type": { "type": "string", "enum": ["customer\_email", "user\_id"] },        "subject\_id": { "type": "string", "minLength": 3, "maxLength": 256 },        "contact": { "type": "string", "minLength": 3, "maxLength": 256 }      }    },    "request\_channel": { "type": "string", "enum": ["email", "web\_form", "in\_app"] },    "scope": {      "type": "string",      "enum": ["all\_data", "account\_data\_only", "orders\_only", "support\_only"]    },    "delivery\_method": { "type": "string", "enum": ["secure\_link", "email\_attachment\_disabled"] },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

1.2 Privacy delete requested
type = comp.privacy.delete\_requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_delete\_requested.v1.json",  "title": "Payload: comp.privacy.delete\_requested.v1",  "type": "object",  "additionalProperties": false,  "required": [    "request\_id",    "venture\_id",    "request\_ts",    "subject",    "request\_channel",    "delete\_scope",    "exceptions\_policy",    "evidence"  ],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "request\_ts": { "type": "string", "format": "date-time" },    "subject": {      "type": "object",      "additionalProperties": false,      "required": ["subject\_type", "subject\_id", "contact"],      "properties": {        "subject\_type": { "type": "string", "enum": ["customer\_email", "user\_id"] },        "subject\_id": { "type": "string", "minLength": 3, "maxLength": 256 },        "contact": { "type": "string", "minLength": 3, "maxLength": 256 }      }    },    "request\_channel": { "type": "string", "enum": ["email", "web\_form", "in\_app"] },    "delete\_scope": {      "type": "string",      "enum": ["account\_and\_content", "content\_only", "marketing\_only"]    },    "exceptions\_policy": {      "type": "string",      "enum": ["retain\_legal\_financial\_minimum", "full\_delete\_if\_possible"]    },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

2) Verification payloads (mandatory gate)
2.1 Verification initiated (challenge sent)
type = comp.privacy.request.verification\_sent.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_verification\_sent.v1.json",  "title": "Payload: comp.privacy.request.verification\_sent.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "sent\_ts", "method", "token\_ttl\_minutes", "evidence\_hash"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "sent\_ts": { "type": "string", "format": "date-time" },    "method": { "type": "string", "enum": ["email\_magic\_link", "in\_app\_confirmation"] },    "token\_ttl\_minutes": { "type": "integer", "minimum": 5, "maximum": 10080 },    "evidence\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

2.2 Verification completed
type = comp.privacy.request.verified.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_request\_verified.v1.json",  "title": "Payload: comp.privacy.request.verified.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "verified\_ts", "status", "reason"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "verified\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["verified", "failed", "expired"] },    "reason": {      "type": "string",      "enum": ["token\_valid", "token\_invalid", "token\_expired", "subject\_mismatch", "rate\_limited"]    }  }}
\`\`\`

3) Export execution payloads
3.1 Export started
type = comp.privacy.export.started.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_export\_started.v1.json",  "title": "Payload: comp.privacy.export.started.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "started\_ts", "scope", "eau\_budget"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "started\_ts": { "type": "string", "format": "date-time" },    "scope": { "type": "string", "enum": ["all\_data", "account\_data\_only", "orders\_only", "support\_only"] },    "eau\_budget": { "type": "integer", "minimum": 0, "maximum": 2000000000 }  }}
\`\`\`

3.2 Export completed (secure link)
type = comp.privacy.export.completed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_export\_completed.v1.json",  "title": "Payload: comp.privacy.export.completed.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "completed\_ts", "status", "bundle\_hash", "delivery", "evidence"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "completed\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["success", "partial", "failed"] },    "bundle\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" },    "delivery": {      "type": "object",      "additionalProperties": false,      "required": ["method", "secure\_link\_ref", "link\_ttl\_hours"],      "properties": {        "method": { "type": "string", "enum": ["secure\_link"] },        "secure\_link\_ref": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" },        "link\_ttl\_hours": { "type": "integer", "minimum": 1, "maximum": 720 }      }    },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

4) Delete execution payloads (with exceptions)
4.1 Delete started
type = comp.privacy.delete.started.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_delete\_started.v1.json",  "title": "Payload: comp.privacy.delete.started.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "started\_ts", "delete\_scope", "exceptions\_policy"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "started\_ts": { "type": "string", "format": "date-time" },    "delete\_scope": { "type": "string", "enum": ["account\_and\_content", "content\_only", "marketing\_only"] },    "exceptions\_policy": { "type": "string", "enum": ["retain\_legal\_financial\_minimum", "full\_delete\_if\_possible"] }  }}
\`\`\`

4.2 Delete completed (what was deleted/retained)
type = comp.privacy.delete.completed.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_delete\_completed.v1.json",  "title": "Payload: comp.privacy.delete.completed.v1",  "type": "object",  "additionalProperties": false,  "required": [    "request\_id",    "venture\_id",    "completed\_ts",    "status",    "deleted\_categories",    "retained\_categories",    "retention\_schedule",    "evidence"  ],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "completed\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["success", "partial", "failed"] },    "deleted\_categories": {      "type": "array",      "minItems": 0,      "maxItems": 30,      "items": {        "type": "string",        "enum": ["profile", "orders", "generated\_docs", "support\_tickets", "marketing\_records", "analytics\_identifiers"]      }    },    "retained\_categories": {      "type": "array",      "minItems": 0,      "maxItems": 30,      "items": {        "type": "string",        "enum": ["financial\_records\_minimum", "fraud\_prevention", "legal\_hold", "chargeback\_evidence", "tax\_records\_minimum"]      }    },    "retention\_schedule": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 30,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

5) Retention policy scheduling (timers as events)
5.1 Retention scheduled
type = comp.data.retention.scheduled.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_data\_retention\_scheduled.v1.json",  "title": "Payload: comp.data.retention.scheduled.v1",  "type": "object",  "additionalProperties": false,  "required": ["schedule\_id", "venture\_id", "subject\_ref", "scheduled\_ts", "actions", "evidence\_hash"],  "properties": {    "schedule\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "subject\_ref": {      "type": "object",      "additionalProperties": false,      "required": ["subject\_type", "subject\_id"],      "properties": {        "subject\_type": { "type": "string", "enum": ["customer\_email", "user\_id"] },        "subject\_id": { "type": "string", "minLength": 3, "maxLength": 256 }      }    },    "scheduled\_ts": { "type": "string", "format": "date-time" },    "actions": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": {        "type": "string",        "enum": ["delete\_marketing\_records", "delete\_generated\_docs", "delete\_support\_tickets", "anonymize\_analytics\_ids", "purge\_exports"]      }    },    "evidence\_hash": { "$ref": "https://orgstack.dev/schemas/hash\_sha256.v1.json" }  }}
\`\`\`

6) Privacy execution FSM (request → verify → export/delete → retention)

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/privacy\_ops\_fsm.v1.json",  "initial\_state": "REQUESTED",  "states": [    "REQUESTED",    "VERIFICATION\_SENT",    "VERIFIED",    "EXPORTING",    "DELETING",    "COMPLETED",    "REJECTED",    "EXPIRED"  ],  "transitions": [    {      "from": "REQUESTED",      "to": "VERIFICATION\_SENT",      "on": "comp.privacy.export\_requested.v1",      "guard": "true",      "actions": ["comp.send\_verification", "ledger.append"]    },    {      "from": "REQUESTED",      "to": "VERIFICATION\_SENT",      "on": "comp.privacy.delete\_requested.v1",      "guard": "true",      "actions": ["comp.send\_verification", "ledger.append"]    },    {      "from": "VERIFICATION\_SENT",      "to": "VERIFIED",      "on": "comp.privacy.request.verified.v1",      "guard": "status == 'verified'",      "actions": ["ledger.append"]    },    {      "from": "VERIFICATION\_SENT",      "to": "REJECTED",      "on": "comp.privacy.request.verified.v1",      "guard": "status == 'failed'",      "actions": ["ledger.append"]    },    {      "from": "VERIFICATION\_SENT",      "to": "EXPIRED",      "on": "comp.privacy.request.verified.v1",      "guard": "status == 'expired'",      "actions": ["ledger.append"]    },    {      "from": "VERIFIED",      "to": "EXPORTING",      "on": "comp.privacy.export\_requested.v1",      "guard": "true",      "actions": ["comp.privacy.export.started.emit", "comp.export\_bundle", "ledger.append"]    },    {      "from": "VERIFIED",      "to": "DELETING",      "on": "comp.privacy.delete\_requested.v1",      "guard": "true",      "actions": ["comp.privacy.delete.started.emit", "comp.delete\_data\_per\_policy", "ledger.append"]    },    {      "from": "EXPORTING",      "to": "COMPLETED",      "on": "comp.privacy.export.completed.v1",      "guard": "status in ['success','partial']",      "actions": ["comp.data.retention.scheduled.emit", "ledger.append"]    },    {      "from": "DELETING",      "to": "COMPLETED",      "on": "comp.privacy.delete.completed.v1",      "guard": "status in ['success','partial']",      "actions": ["comp.data.retention.scheduled.emit", "ledger.append"]    }  ]}
\`\`\`

Deterministic rules you should enforce in the implementation

Exports are delivered only via secure link, time-limited, and link access is logged.

Deletes honor exceptions\_policy (retain minimum financial/tax/fraud/chargeback evidence).

Retention schedules are emitted as explicit events (so the office can later purge export bundles, anonymize analytics IDs, etc.).

Any suspicious pattern (mass requests, mismatched subject) should emit sys.alert.anomaly.v1 and potentially sys.mode.freeze\_enabled.v1.

If you want the next increment, the last big compliance gap is Do Not Sell/Share + marketing suppression + data-sharing inventory (for ad pixels, email providers, analytics). That’s where “privacy” actually breaks in practice.

---

### **ChatGPT**

Yes

---

### **ChatGPT**

Yep. Next compliance gap: Do Not Sell/Share, marketing suppression, and data-sharing inventory (pixels, analytics, email providers). This is the part that stops you from accidentally violating privacy obligations and makes “zero-HITL marketing” survivable.
Below is a spec pack: strict payload schemas + a policy-driven FSM that enforces (a) opt-out of sale/sharing, (b) suppression across all GTM, and (c) a registry of third parties + data flows + what must be disabled when a user opts out.

1) Data-sharing inventory (the registry you must have)
1.1 Third-party registry updated
type = comp.third\_party.registry.updated.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_third\_party\_registry\_updated.v1.json",  "title": "Payload: comp.third\_party.registry.updated.v1",  "type": "object",  "additionalProperties": false,  "required": ["registry\_id", "venture\_id", "updated\_ts", "entries\_hash", "evidence"],  "properties": {    "registry\_id": { "type": "string", "minLength": 6, "maxLength": 128 },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "updated\_ts": { "type": "string", "format": "date-time" },    "entries\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 50,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

What entries\_hash points to (the actual registry content)
Store it as an artifact (JSON file in object store). Each entry looks like:

provider\_name (e.g., google\_analytics, meta\_pixel, posthog, mailgun, sendgrid, etc.)

category (analytics, advertising, email, crm, support, payments)

data\_types (email, device\_id, ip, event\_logs, purchase\_history)

purpose (measurement, ads targeting, transactional email)

sharing\_type (service\_provider | sale\_or\_share | unknown)

disable\_controls (feature flags / env vars / tag manager toggles)

subject\_match\_keys (email hash, user\_id, cookie id)

This registry becomes the authoritative map for “what gets turned off” per user and per venture.

2) “Do Not Sell/Share” (DNSS) requests + enforcement
2.1 DNSS request received
type = comp.privacy.dnss\_requested.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_dnss\_requested.v1.json",  "title": "Payload: comp.privacy.dnss\_requested.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "request\_ts", "subject", "channel", "scope", "evidence"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "request\_ts": { "type": "string", "format": "date-time" },    "subject": {      "type": "object",      "additionalProperties": false,      "required": ["subject\_type", "subject\_id", "contact"],      "properties": {        "subject\_type": { "type": "string", "enum": ["customer\_email", "user\_id", "cookie\_id"] },        "subject\_id": { "type": "string", "minLength": 3, "maxLength": 256 },        "contact": { "type": "string", "minLength": 3, "maxLength": 256 }      }    },    "channel": { "type": "string", "enum": ["web\_form", "in\_app", "email"] },    "scope": { "type": "string", "enum": ["ads\_only", "analytics\_and\_ads", "all\_sharing"] },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

2.2 DNSS applied (enforcement completed)
type = comp.privacy.dnss\_applied.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_privacy\_dnss\_applied.v1.json",  "title": "Payload: comp.privacy.dnss\_applied.v1",  "type": "object",  "additionalProperties": false,  "required": ["request\_id", "venture\_id", "applied\_ts", "status", "disabled\_providers", "suppression\_list\_hash", "evidence"],  "properties": {    "request\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "applied\_ts": { "type": "string", "format": "date-time" },    "status": { "type": "string", "enum": ["success", "partial", "failed"] },    "disabled\_providers": {      "type": "array",      "minItems": 0,      "maxItems": 200,      "items": { "type": "string", "minLength": 2, "maxLength": 128 }    },    "suppression\_list\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 30,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

3) Marketing suppression (global across all GTM channels)
This is separate from DNSS because you also need “do-not-contact” and opt-outs for CAN-SPAM style compliance.
3.1 Suppression entry added
type = comp.marketing.suppression.added.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_marketing\_suppression\_added.v1.json",  "title": "Payload: comp.marketing.suppression.added.v1",  "type": "object",  "additionalProperties": false,  "required": ["suppression\_id", "venture\_id", "added\_ts", "subject", "channels", "reason", "evidence\_hash"],  "properties": {    "suppression\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "added\_ts": { "type": "string", "format": "date-time" },    "subject": {      "type": "object",      "additionalProperties": false,      "required": ["subject\_type", "subject\_id"],      "properties": {        "subject\_type": { "type": "string", "enum": ["email", "user\_id", "domain", "cookie\_id"] },        "subject\_id": { "type": "string", "minLength": 3, "maxLength": 256 }      }    },    "channels": {      "type": "array",      "minItems": 1,      "uniqueItems": true,      "items": { "type": "string", "enum": ["email", "linkedin\_dm", "community", "ads\_retargeting"] }    },    "reason": { "type": "string", "enum": ["opt\_out", "complaint", "bounce\_hard", "spam\_trap\_suspect", "policy"] },    "evidence\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" }  }}
\`\`\`

3.2 Suppression list snapshot published
type = comp.marketing.suppression.snapshot.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_marketing\_suppression\_snapshot.v1.json",  "title": "Payload: comp.marketing.suppression.snapshot.v1",  "type": "object",  "additionalProperties": false,  "required": ["snapshot\_id", "venture\_id", "generated\_ts", "count", "suppression\_list\_hash", "evidence"],  "properties": {    "snapshot\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "generated\_ts": { "type": "string", "format": "date-time" },    "count": { "type": "integer", "minimum": 0, "maximum": 500000000 },    "suppression\_list\_hash": { "type": "string", "pattern": "^[a-fA-F0-9]{64}$" },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 10,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

4) Provider disable controls (feature flag / tag-manager / config toggles)
4.1 Provider controls applied (per venture)
type = comp.third\_party.controls.applied.v1

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://orgstack.dev/schemas/payload\_comp\_third\_party\_controls\_applied.v1.json",  "title": "Payload: comp.third\_party.controls.applied.v1",  "type": "object",  "additionalProperties": false,  "required": ["controls\_id", "venture\_id", "applied\_ts", "changes", "status", "evidence"],  "properties": {    "controls\_id": { "type": "string", "format": "uuid" },    "venture\_id": { "type": "string", "minLength": 2, "maxLength": 128 },    "applied\_ts": { "type": "string", "format": "date-time" },    "changes": {      "type": "array",      "minItems": 1,      "maxItems": 200,      "items": {        "type": "object",        "additionalProperties": false,        "required": ["provider\_name", "action", "target"],        "properties": {          "provider\_name": { "type": "string", "minLength": 2, "maxLength": 128 },          "action": { "type": "string", "enum": ["disable", "enable", "switch\_to\_anonymous\_mode"] },          "target": { "type": "string", "enum": ["global", "subject\_only"] }        }      }    },    "status": { "type": "string", "enum": ["success", "partial", "failed"] },    "evidence": {      "type": "array",      "minItems": 1,      "maxItems": 30,      "items": { "$ref": "https://orgstack.dev/schemas/evidence\_ref.v1.json" }    }  }}
\`\`\`

5) DNSS + suppression execution FSM
This FSM ensures:

DNSS requests lead to provider controls being applied

marketing suppression is updated everywhere

GTM sequences are prevented from sending to suppressed contacts

auditing is complete

\`\`\`
JSON{  "$id": "https://orgstack.dev/fsm/dnss\_and\_suppression\_fsm.v1.json",  "initial\_state": "REQUESTED",  "states": ["REQUESTED", "VERIFIED", "APPLYING", "SUPPRESSED", "COMPLETED", "REJECTED", "FAILED"],  "transitions": [    {      "from": "REQUESTED",      "to": "VERIFIED",      "on": "comp.privacy.request.verified.v1",      "guard": "status == 'verified'",      "actions": ["ledger.append"]    },    {      "from": "REQUESTED",      "to": "REJECTED",      "on": "comp.privacy.request.verified.v1",      "guard": "status in ['failed','expired']",      "actions": ["ledger.append"]    },    {      "from": "VERIFIED",      "to": "APPLYING",      "on": "comp.privacy.dnss\_requested.v1",      "guard": "true",      "actions": ["comp.apply\_third\_party\_controls", "ledger.append"]    },    {      "from": "APPLYING",      "to": "SUPPRESSED",      "on": "comp.third\_party.controls.applied.v1",      "guard": "status in ['success','partial']",      "actions": ["comp.marketing.suppression.added.emit", "ledger.append"]    },    {      "from": "SUPPRESSED",      "to": "COMPLETED",      "on": "comp.privacy.dnss\_applied.v1",      "guard": "status in ['success','partial']",      "actions": ["ledger.append"]    },    {      "from": "APPLYING",      "to": "FAILED",      "on": "comp.third\_party.controls.applied.v1",      "guard": "status == 'failed'",      "actions": ["sys.alert.anomaly.emit", "ledger.append"]    }  ]}
\`\`\`

Enforcement rule for GTM (must be implemented, but spec-friendly)
Before any send event:

gtm.sequence.launch\_approved.v1 must include suppression\_list\_hash

sender must check the current suppression snapshot hash

if contact is suppressed → emit gtm.optout.received.v1 or internal gtm.send.blocked.v1 (optional) and do not send

If you want a schema for gtm.send.blocked.v1, say so and I’ll add it.

6) Minimal policy knobs you need (so this is deterministic)
These live in your policy engine:

policy.dnss.default\_scope (ads\_only vs analytics\_and\_ads)

policy.third\_party.default\_to\_disable\_when\_unknown (true/false)

policy.registry.required\_for\_any\_tracking (true)

policy.suppression.hard\_bounce\_is\_permanent (true)

policy.suppression.spam\_trap\_is\_global (true)

policy.disable\_controls.must\_succeed\_for\_ads (true)

If you want the next increment, I’d add Data-sharing classification as a schema so each third-party entry is explicitly labeled service\_provider vs sale\_or\_share vs unknown, and the system auto-treats unknown as sale\_or\_share until reviewed. That’s the safest default for zero-HITL.

---