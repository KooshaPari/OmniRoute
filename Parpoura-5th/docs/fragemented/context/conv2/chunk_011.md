### **You**

Here’s the current landscape of agent frameworks / orchestration systems / security tooling / SaaS primitives that are actually useful for what you’re building (zero-HITL, headless, always-on “office”), plus how to stitch them together without getting wrecked by prompt injection + supply-chain.

1) The stack you actually want (3 layers)
Layer A — Durable workflow engine (keeps the office alive)
If you don’t have durable execution + retries + event history, your “always-on office” will either:

silently die, or

rerun expensive steps, or

do duplicate money actions.

Best-in-class pattern: run agents inside workflows, not as free-running loops.

Temporal is a common “durable execution” choice; the general point is deterministic replay + audit trails for long-running workflows. There are now explicit “agents in production” integrations being marketed around this idea. Business Wire+1

LangGraph also pushes durable execution via checkpointing/persistence (resume after failures / long waits). LangChain Docs+1

Prefect is positioning itself as orchestration for “state machines” (dynamic control flow vs static DAGs), which maps well to agent loops. Prefect

Use-case fit for you: Temporal / LangGraph / Prefect are what make “always-on” real, because they persist state and handle retries deterministically.

Layer B — Agent orchestration framework (teams + handoffs)
This is where you define “15 concurrent agents” in roles and patterns (dispatcher, verifier, operator, strategist), not just one big chat.
Good options:

Semantic Kernel Agent Orchestration (Microsoft) has explicit patterns (Concurrent, Sequential, Handoff, Group Chat, “Magentic” inspired by Magentic-One). Microsoft Learn+1

LlamaIndex Workflows / AgentWorkflow gives you multi-agent patterns (AgentWorkflow, orchestrator-as-agent, DIY planner) + event-driven workflows. LlamaIndex Python Documentation+2LlamaIndex Python Documentation+2

CrewAI is popular for role-playing / multi-agent delegation, but treat it as a coordination layer you’ll still need to harden and wrap with policies. Agent Installer

My blunt take: pick one orchestration layer and keep it thin. The workflow engine (Layer A) should own durability; the orchestration framework should only do routing/handoffs.

Layer C — Tooling + primitives (payments, DB, spend controls)
You don’t want agents “doing business logic” by typing in browsers. You want them calling narrow APIs.

Stripe: you can run your whole revenue/event system via webhooks; signature verification is first-class and documented. Stripe Docs+1

Supabase: use Auth + Postgres RLS as the core “permissions plane” so even if an agent is compromised, it can’t exfiltrate arbitrary rows. Supabase+1

Ramp: spend controls matter for “denial-of-wallet” and runaway budgets; Ramp explicitly supports per-card and business limits and monitoring. Ramp Support

This layer is how you make “zero-HITL governance” real: the constitution becomes enforced spend caps + RLS policies + webhook gates + tool allowlists.

2) Your biggest risk is not “prompt injection” — it’s prompt injection + tools
OWASP literally ranks prompt injection and “excessive agency” as top risks for LLM applications, along with supply-chain and unbounded consumption. OWASP Foundation+1
And in the wild, agent ecosystems are already getting nailed by:

indirect prompt injection (malicious content in web pages, docs, emails) OpenClaw

skills/plugin supply-chain malware (marketplaces) The Verge+2Tom's Hardware+2

OpenClaw’s own security docs explicitly say “system prompts are soft” and the real defense is tool policy, sandboxing, allowlists, and treating content as hostile. OpenClaw+1
So your baseline (AgentZero/OpenClaw-like) risk is real: “skills marketplaces” are basically npm for agent instructions—expect malicious payloads.

3) The secure pattern for your headless office (what to copy)
Steal these principles from the “hard” systems:
Principle 1 — Split “Reader” from “Doer”
OpenClaw docs recommend using a read-only reader agent to summarize untrusted content, then pass summaries into tool-enabled agents. OpenClaw
Concrete rule:

Reader agents can browse / fetch / open docs, but have no exec, no secrets, no money tools

Doer agents can run tools, but cannot browse arbitrary internet content

Principle 2 — Durable execution for every money-moving or irreversible workflow
Use a workflow engine checkpoint on:

invoice creation

payouts

ad spend changes

vendor payments

contract signing

This prevents duplicate execution and gives you an audit trail. LangChain Docs+1
Principle 3 — Treat “skills” as third-party code
If you allow marketplace skills:

you must sandbox them,

you must scan them,

you must pin versions,

you must keep secrets out of their reach.

The current real-world situation shows malicious skills are a practical attack vector. Snyk+1
Principle 4 — Spend firewall is non-negotiable
Use:

Ramp limits for cards and business-level caps Ramp Support

Token burn caps at the orchestrator level (unbounded consumption is an OWASP-class risk) OWASP Foundation

Principle 5 — DB permissions are your blast-radius limiter
Supabase RLS is a “defense in depth” tool when you expose APIs; it’s specifically designed for granular authorization. Supabase+1
Principle 6 — Webhooks must be authenticated + idempotent
Stripe explicitly recommends verifying webhook signatures using the Stripe-Signature header and the endpoint secret via constructEvent. Stripe Docs+1

4) Recommended modern “office stack” for you (pragmatic shortlist)
Option A (cleanest): Workflow engine + thin orchestration + strict tool plane

Temporal (durability + retries + audit) Business Wire+1

Semantic Kernel orchestration for patterns (handoff/concurrent/sequential) Microsoft Learn+1

Supabase for auth + RLS + event tables Supabase+1

Stripe for billing/events via signed webhooks Stripe Docs+1

Ramp for spend limits Ramp Support

This gives you “always-on office” with the right failure semantics.
Option B: LangGraph-centric (if you want graph-native workflows)

LangGraph durable execution + checkpoints LangChain Docs+1

Use its interrupt capability even if you’re “zero-HITL” (interrupts still help for deterministic pausing/retries, even without a human resuming immediately). LangChain Docs

Option C: LlamaIndex for doc-heavy ops
If your ventures depend heavily on documents/contracts/receipts:

LlamaIndex Workflows as the agent pipeline engine LlamaIndex+1
Still wrap with a durable workflow runtime if you’re doing money actions.

5) Where AgentZero / OpenClaw fit (and where they don’t)
They’re useful as UX baselines and “agent loop ergonomics,” but:

Prompt injection is not solved; the OpenClaw team itself says hard safety comes from tool policy + sandboxing + allowlists, not from system prompts. OpenClaw+1

Skills ecosystems are supply-chain risk in practice (malicious skills and malware have been reported). Snyk+1

So: borrow their patterns, don’t inherit their trust assumptions.

6) What I’d research next for you (high impact)
If you want “deep” beyond what we already pulled:

Agent eval / red-team harnesses (Promptfoo OWASP pack + custom tests for “excessive agency”) Promptfoo+1

Policy engines / sandboxing (how each framework enforces tool allowlists and filesystem/network isolation)

Secrets management (never in prompt; only env/vault; short-lived tokens) — strongly implied by OpenClaw security guidance. OpenClaw+1

If you tell me your preferred implementation language (Python vs TS) and whether you’ll run a small always-on VPS, I’ll pin this down to an exact “reference architecture” diagram + service list + what runs where, with the security boundaries drawn in bold.

---

### **ChatGPT**

For yr 1 I need the day 1 hourly and then daily /wkly to see what happens from moment sys prompt and money is pushed for the agent to on its own find self sufficiency and profitability

---

### **ChatGPT**

Below is a zero-HITL Year-1 ignition runbook that starts the moment you “push the system prompt + money” and then runs itself to self-sufficiency.
Assumptions (locked):

16GB laptop (control plane)

Claude Code can run 15 concurrent agents

Monthly external inflow: $200 services + $100 capital

No human-in-the-loop after genesis (no approvals, no manual steering)

Agents can only spend through bounded Money APIs (caps + allowlists)

All web/content is treated as hostile (reader/doer split)

0) Genesis Inputs (the only “push” you do)
Genesis packet contains:

Constitution (hard rules): liquidity floor, spend caps, exploration cap, banned sectors, no spam/impersonation, max platform dependency, kill rules.

Starting budget: $300/month inflow schedule + vendor allowlist + max transaction size.

Goal: reach operational self-sufficiency (cover Claude + tools + vendor budget) ASAP while building liquidity buffer.

After genesis: you do nothing.

1) Day 1 — Hour-by-hour (Minute 0 → Hour 24)
Agent roster (fixed for Day 1)

S0 Sentinel/Dispatcher (cheap model): schedule + queue + dedupe + budget accounting

S1 Strategy Lead (strong model): opportunity selection + architecture decisions

S2 Risk/Finance Strategist (strong model): unit economics, kill criteria, spend gating

R1 Reader (cheap): browses web/forums; produces sanitized summaries only

R2 Reader (cheap): additional sources; same constraints

B1–B6 Builders (mid): implement landing/MVP, automations, content, outreach assets

O1–O3 Operators (cheap): accounts, webhooks, analytics wiring, vendor RFQs, posting scheduler

V1–V2 Verifiers (mid/strong): tests, copy lint, claim compliance, policy checks

Hour 0 (T+0 to T+60): Boot + safety rails
S0

Initializes: job queue, daily token budget, “no spend without policy check”

Creates “Venture Ledger” (JSON/CSV) and “Decision Log” (append-only)

S2

Sets day-1 spend envelope:

Vendor spend today: $0 (no vendor until venture candidate chosen)

Ad spend today: $0

Only allowed payments: domain/hosting if needed, capped.

V1

Confirms tool allowlists: no browser automation with creds, no money actions except through Money API with cap.

Deliverable: DAY1\_BOOT\_REPORT.json
Hour 1–2: Market scan wave 1 (read-only)
R1/R2 (readers only)

Pull 30–50 “pain signals” from:

niche subreddits, indie forums, job boards, SaaS complaints

Output: sanitized opportunity list with evidence links (no raw page content passed through; only summaries)

Deliverable: OPPORTUNITIES\_v1.json
Hour 2–3: Opportunity scoring + selection
S1 + S2

Score each idea with a strict rubric:

time-to-first-dollar ≤ 14 days

low liability

clear buyer

can be shipped with templates

low platform dependency

Select 1 primary + 1 backup.

Deliverable: VENTURE1\_SELECTION.json
Hour 3–4: Venture spec + constraints
S1

Writes PRD + 1-page user journey + monetization hypothesis
S2

Writes kill criteria:

by Day 14: must have paying signal or qualified pipeline threshold

by Day 30: must hit minimum MRR or gets downgraded

Deliverables:

PRD\_v1.md

KILL\_RULES\_v1.json

Hour 4–6: Build sprint A (MVP skeleton)
B1–B4

Generate code scaffold:

landing page

auth (optional; prefer no-auth if possible)

payment (Stripe checkout link or minimal integration)

analytics events
O1

Sets up domain + hosting + basic deploy pipeline (allowed spend if needed within cap)

V1

Runs tests + checks for obvious security issues

Deliverable: MVP\_SKELETON\_DEPLOYED=true
Hour 6–7: Offer design + pricing test setup
B5

Writes pricing page variants (2-tier)
B6

Drafts outreach sequences (B2B) OR app-store-style listing copy (B2C)
V2

“No fake claims” compliance pass

Deliverables:

PRICING\_A\_B.json

OUTREACH\_SEQ\_v1.json

Hour 7–9: Build sprint B (core value path)
B1–B4

Implement the single “value moment” workflow end-to-end

Add onboarding steps
O2

Set up email capture + auto follow-up sequence (cheap + deterministic)

V1

Verifies: user can pay → access value → get outcome

Deliverable: VALUE\_PATH\_PASS=true
Hour 9–10: Launch assets + publishing scheduler
O3

Schedules:

3 posts/day for 7 days (value-first, non-spam)

3 blog drafts queued (if SEO is used)

Sets up CRM-lite table for leads/responses

Deliverable: LAUNCH\_CALENDAR\_week1.json
Hour 10–12: Outreach wave 1 (small, measurable)
Operators

Send small batch (e.g., 30–100) to test messaging

Track responses + objections

S0

Opens “feedback tickets” automatically from replies

Deliverable: OUTREACH\_RESULTS\_day1.json
Hour 12–13: Midday review (strict)
S1 + S2

Check only hard signals:

clicks

replies

conversion

dropout points

Decide one of:

keep course

adjust messaging

adjust offer

adjust onboarding friction

Deliverable: DAY1\_PIVOT\_DECISION.json
Hour 13–16: Iteration sprint (fix top friction)
Builders

Implement the top 1–2 fixes only
Verifiers

Re-test conversion path

Deliverable: ITERATION\_1\_COMPLETE=true
Hour 16–18: Vendor procurement (if needed)
Only if a clear need is proven (e.g., landing visuals improve conversion).
O1

Issues RFQ for a single bounded asset:

logo/hero image OR 30s explainer OR screenshot pack

Escrow/milestone rules; acceptance criteria

Spend cap: within the monthly $200 service budget and per-transaction cap.
Deliverable: RFQ\_001.json
Hour 18–20: Outreach wave 2 (adjusted)

Send second batch with improved messaging

Log all results

Deliverable: OUTREACH\_RESULTS\_day1\_wave2.json
Hour 20–22: Daily closeout
S2

Writes P&L snapshot (even if zero)
S0

Updates backlog for Day 2
S1

Sets Day 2 objective: “maximize paid conversion” or “maximize qualified pipeline”

Deliverable: DAY1\_CLOSEOUT.json
Hour 22–24: Monitoring idle mode
Only sentinel + on-call verifier awake.

2) Day 2–14 — Daily Runbook (repeatable)
Every day follows the same structure; only the objectives change.
Daily schedule (tight)

06:00 Metrics ingest (revenue, spend, conversions, churn signals)

07:00 Council (S1+S2+V1): choose 3 objectives max

08:00–12:00 Build + ship improvements (Builders)

12:00 Verify gate (Verifiers)

13:00–16:00 Distribution actions (Operators): outreach/posts/SEO publish

16:00 Verify gate

17:00 Closeout + next day plan

Night Monitor-only

Day 2–3 objectives

Fix onboarding friction

Tighten offer clarity

Build 1 “instant proof” feature (e.g., report/export/result)

Day 4–7 objectives

Distribution + message-market fit

Launch 2nd channel lightly (SEO or community or partnerships)

Add “annual plan” or upsell if conversion exists

Day 8–14 objectives

Conversion rate optimization

Retention instrumentation

Customer support macros + KB stub

Day 14 hard gate (zero-HITL)
If BOTH are true:

paying users < threshold (e.g., <3) AND

qualified pipeline weak (you define the number in constitution)
→ automatic pivot to Venture #1b (the backup), using the same 1-week build template.

No debate.

3) Week-by-week plan for Year 1 (what changes each week)
Weeks 1–2: Prove first dollars

Primary KPI: paid conversions or strong pipeline

Spend: no ads unless conversion path validated

Weeks 3–4: Stabilize + make repeatable

Add one retention improvement per week

Start tiny paid tests only if unit economics support it

Weeks 5–8: Second revenue engine selection + build

Venture #2 must have different failure mode:

different channel

different buyer

different platform

Build using the same 7–10 day template

Weeks 9–12: Portfolio discipline begins

Kill/continue logic becomes monthly

Begin liquidity buffer accumulation (rule-based)

Start vendor trust scoring (late delivery/quality)

Months 4–6: Reach operational self-sufficiency
Pass criteria:

Monthly revenue ≥ monthly burn (Claude + hosting + vendor budget)

Liquidity ≥ 2–3 months burn

At least 2 distinct revenue streams

Months 7–12: Reduce correlated failure risk

No single channel > 50% of revenue

No single vendor/provider as a single point of failure

Begin external low-risk reserve allocation (small)

4) The “moment it becomes self-sufficient” (what happens automatically)
As soon as:

trailing 30-day revenue ≥ trailing 30-day burn

The system flips modes:
Mode: Subsidy-free

Stops relying on $300/mo inflow for survival

Uses inflow as additional exploration capital (still capped)

Mode: Liquidity doctrine enforced

Builds buffer to 6 months burn before any major expansion

5) What you should expect in reality (no sugar)
A zero-HITL system will:

waste money if you don’t hard-cap retries and scope

accidentally spam if you don’t throttle community/outreach

overbuild if you don’t enforce “3 objectives/day”

die if you don’t have strict kill rules

The win condition is not “one big idea.”
It’s fast cycles + ruthless pruning.

If you want, I can output:

A Day 2 hourly schedule (it differs slightly from Day 1), and

The exact Day 14 pivot playbook (hour-by-hour), and

The Day 30 go/no-go gate and how Venture #2 is spawned automatically.

Say which of those you want first.

---

### **ChatGPT**

Remember llm spend is factored in, all expended tokens and predicted expension must be considered labor/energy spend 

We may want to standardize to a core more intuitive expense unit if dollar not best, as items like power and all other expenses do need to be factored

---

### **ChatGPT**

Yep — if you’re serious about zero-HITL and long-horizon optimization, LLM tokens must be treated as first-class burn, same as wages, power, hosting, ads, refunds, chargebacks, everything. The system should never think in “free text.” It should think in resource spend.
The practical reality
You can’t reliably convert “tokens → joules” across providers today (you don’t get direct energy telemetry for cloud inference, and energy per token varies wildly by model/hardware/utilization). So you need a two-layer accounting system:

A canonical internal unit (intuitive + stable)

A shadow-price conversion layer (turns dollars, kWh, tokens, etc. into that unit)

1) Pick a Core Unit: EAU (Energy-Adjusted Unit)
Use one of these as your “core expense unit”:
Option A: Dollar-based but intuitive (best for Year 1–2)
EAU = $0.01 of fully-loaded cost (or $0.10 if you want coarser).

Pros: easy, accurate, works with every vendor and subscription.

Cons: not “pure energy,” but it is a universal constraint and includes opportunity costs.

Option B: Joule-based (matches your technocratic framing)
EAU = 1 kJ (or 1 MJ).

Pros: philosophically clean; directly handles power for local compute.

Cons: cloud inference energy is opaque; you’ll still need shadow pricing.

Recommendation: start with Option A immediately, and add Joule equivalents later where measurable. You’ll get 95% of the benefit without pretending you know energy per token.

2) Create a Shadow Price Table (the conversion layer)
Define a table the system updates monthly (or weekly) that maps every spend type into EAU.
Example (EAU = $0.01):

LLM tokens (Claude)

LLM\_EAU = (in\_tokens \* price\_in + out\_tokens \* price\_out) / $0.01

Local compute power (measured)

PowerCost = kWh \* $/kWh → convert to EAU

If you want joules: Joules = watts \* seconds then multiply by a “$/J” shadow price

Cloud GPU

GPU\_EAU = (gpu\_seconds \* $/gpu\_second) / $0.01

Bandwidth / storage

GB\_EAU = (GB \* $/GB) / $0.01

Human vendors / contractors

Labor\_EAU = ($paid) / $0.01

Ads

Ads\_EAU = ($spent) / $0.01

Fees / chargebacks / refunds

same

The key: everything becomes one comparable scalar.

3) Make “energy spend” the universal budget, not dollars
Then your constitution governs EAU, not “money.”
Examples:

Daily EAU burn cap (prevents runaway agents)

Per-workflow EAU cap (prevents infinite loops)

Exploration EAU cap (prevents the system from gambling itself to death)

Compute EAU cap (prevents “token fire”)

This makes “tokens” behave like labor hours: scarce, priced, budgeted.

4) Add predicted expansion as a committed liability (critical)
You asked for predicted expansion to be counted too. Do it like this:
For any proposed action, the planner must output:

EAU\_now (immediate cost)

EAU\_commit (expected future burn it creates)

EAU\_tail (worst-case burn under failure)

Then the policy engine checks:

Liquidity doctrine: can we cover EAU\_commit for N days?

Risk doctrine: does tail burn exceed threshold?

Example:

“Launch paid ads” isn’t just today’s $50.
It’s “this implies $X/day for 14 days + creative iteration cost + support load.”

So the action is priced as:
EAU\_total = EAU\_now + EAU\_commit + risk\_factor \* EAU\_tail

5) Use EAU in your CEI score (capital efficiency index)
Your ventures should be scored like:
CEI = Expected Net Value Created / Total EAU Spent
Where “value created” can be:

revenue (EAU equivalent)

or profit (preferred)

or verified pipeline value (discounted)

This makes the whole system optimize for energy return on energy invested, not vibes.

6) Implementation skeleton (what the always-on office enforces)
You want three ledgers:

Actuals Ledger (what was spent)

tokens, $ spend, kWh, vendor invoices, ads, etc.

Commitments Ledger (what the system has obligated itself to)

subscriptions, recurring ads budgets, contractor retainer, cloud reserved instances

Forecast Ledger (predicted burn by the planner)

expected + worst-case

The sentinel refuses to dispatch tasks if:

daily EAU cap would be exceeded

commitments would violate liquidity floor

forecast tail risk breaches constitution

7) What changes as you scale compute
As you add local GPUs / racks:

more of your spend becomes true power + depreciation + cooling (measurable)

cloud inference remains “shadow priced”

the system naturally learns whether owning compute is CEI-positive

That’s how compute expansion becomes rational under zero-HITL: it’s just an optimization problem under EAU.

If you want, I’ll propose a concrete EAU constitution block (caps, floors, exploration %, per-agent budgets, and forecast requirements) you can drop straight into your genesis prompt so the whole machine enforces “tokens = energy” from minute 0.

---

### **ChatGPT**

Make best judgment and map out

---

### **ChatGPT**

Alright — here’s a complete, best-judgment “EAU-first” map you can drop into your genesis prompt and your always-on office so tokens + predicted expansion + power + everything becomes one comparable spend unit, enforced automatically.
I’m going to assume EAU = $0.01 fully-loaded cost for Year 1–2 because it’s the only unit you can measure perfectly across vendors today. We’ll still track joules/kWh where possible, but EAU is the controlling unit.

1) Canonical Unit: EAU and Shadow Pricing
1.1 Definition
EAU (Energy-Adjusted Unit) = $0.01 of fully-loaded cost.
“Fully-loaded” means:

LLM usage (subscription shadow priced or API priced)

power (if measurable)

hosting, domains, SaaS

ads

contractors

refunds/chargebacks/fees

depreciation (later, when you own hardware)

1.2 Shadow Price Table (must exist on Day 1)
A single JSON table updated weekly or monthly:

\`\`\`
JSON{  "eau\_unit\_usd": 0.01,  "prices": {    "claude\_subscription\_monthly\_usd": 200,    "vendor\_services\_monthly\_usd": 200,    "investment\_capital\_monthly\_usd": 100,    "electricity\_usd\_per\_kwh": 0.25,    "cloud\_runner\_usd\_per\_hour": 0.03,    "domain\_annual\_usd": 12,    "hosting\_monthly\_usd": 10,    "ad\_usd\_per\_day\_default\_cap": 5  },  "token\_shadow": {    "enabled": true,    "model\_tiers": {      "opus": { "relative\_cost": 2.0 },      "sonnet": { "relative\_cost": 1.0 },      "haiku": { "relative\_cost": 0.5 }    },    "subscription\_token\_equivalent": {      "monthly\_in\_tokens": 100000000,      "monthly\_out\_tokens": 100000000    }  }}
\`\`\`

Important: how to price Claude subscription tokens
You don’t have per-token billing on subscription, but you do have scarcity. So you allocate the monthly subscription cost across the monthly token quota:
Let:

C = $200/month (subscription)

Tin = 100M, Tout = 100M

w\_in, w\_out = weights (use 1 and 1 unless you want asymmetric)

Then:

usd\_per\_token\_equiv = C / (Tin + Tout)

EAU\_per\_token\_equiv = usd\_per\_token\_equiv / 0.01

That makes tokens behave like scarce “energy units” even on subscription.

2) Three Ledgers: Actuals, Commitments, Forecast
You want zero-HITL, so the system must refuse actions that violate the ledgers.
2.1 Actuals Ledger (what happened)
Append-only records:

timestamp

category (LLM, power, ads, vendor, hosting, refunds, etc.)

amount\_native (tokens, kWh, USD)

amount\_eau

venture\_id

workflow\_id

2.2 Commitments Ledger (obligations)
Recurring and contractual commitments:

subscriptions

recurring ads budgets

contractor retainers

reserved compute

Commitments count as already spent for liquidity doctrine.
2.3 Forecast Ledger (predicted expansion)
Every proposal must include:

EAU\_now (immediate burn)

EAU\_commit\_30d (expected burn this creates in next 30d)

EAU\_tail\_30d\_p95 (worst case, 95th percentile)

EAU\_roi\_distribution (expected value + downside)

Forecasts become a “pre-authorization request.”

3) Constitution Block: EAU-Based Hard Rules
This is the part you asked for: the “map out” that turns intuition into enforcement.
3.1 Global survival rules
Liquidity floor

LiquidityMonths ≥ 6 at all times (Year 1 target)

LiquidityMonths ≥ 9 once monthly net profit exceeds monthly burn by 2× for 60 days

Where:

LiquidityMonths = LiquidEAU / MonthlyBurnEAU

Daily burn cap

DailyEAUCap = MonthlyBurnEAU / 30 \* 1.2
(20% headroom for spikes)

If ActualDailyEAU > DailyEAUCap, system enters Monitor-Only Mode until under cap.
Exploration cap

ExplorationEAU ≤ 15% of LiquidEAU
Exploration is anything not tied to sustaining or scaling proven revenue.

No “unbounded agency”
Every workflow has:

max\_eau

max\_tokens

max\_wall\_time

max\_retries

If exceeded → auto-fail, emit incident, no retries without policy gate.

3.2 Token-as-energy rules (per role and per day)
Because you have 15 concurrent agents, you must enforce per-role budgets.
Monthly token budget split (subscription equivalent)

Strategists (2): 15%

Builders (6): 55%

Operators/Dispatcher (5): 15%

Verifiers (2): 15%

Daily token caps
Let MonthlyTokens = Tin + Tout = 200M.
Daily base = ~6.67M tokens/day.
Then caps (example):

Strategists total: 1.0M/day

Builders total: 3.7M/day

Operators/Dispatcher: 1.0M/day

Verifiers: 1.0M/day

If any role hits cap:

it must switch to cheaper model tier or stop until reset.

3.3 Predicted expansion must be “reserved” like money
This is the big one.
Expansion reserve rule
Before executing any plan that creates future burn:
Require:

LiquidEAU - ReservedEAU ≥ LiquidityFloorEAU

Where:

ReservedEAU = sum(EAU\_commit\_30d) + risk\_factor \* sum(EAU\_tail\_30d\_p95)

Risk factor default: 0.5 in Year 1 (conservative).
Meaning:
Even if you haven’t spent it yet, you reserve capacity for it.

3.4 Spend firewall rules (Money API)
No agent can spend dollars directly. Only Money API calls with caps:

pay\_vendor(invoice\_id, amount\_usd <= $X, allowlist\_vendor=true)

set\_ad\_budget(campaign\_id, daily\_cap\_usd <= $Y, duration\_days <= Z)

subscribe(service, monthly\_cap\_usd <= $W) (rare; needs verifier sign-off)

Hard caps (Year 1):

Single vendor payment ≤ $50 unless the venture has ≥ $1k MRR

Daily ad spend ≤ $5 unless LTV proof exists

No annual commitments unless liquidity ≥ 9 months

4) EAU-Based CEI (Capital Efficiency Index) You Actually Use
Every venture is scored on energy return:
4.1 Define CEI

NetEAU = RevenueEAU - (LLM\_EAU + PowerEAU + VendorEAU + AdsEAU + HostingEAU + RefundEAU)

CEI = Expected(NetEAU\_next\_30d) / EAU\_spent\_last\_30d

Kill rule:

If CEI < 1.0 for 2 consecutive weekly reviews → freeze scaling

If CEI < 0.7 for 2 consecutive weekly reviews → kill

(Thresholds adjustable, but these are sane.)

5) Always-On Office “Idling” Driven by EAU
Your sentinel office must idle in a way that burns near-zero EAU.
5.1 Idle modes
Mode A: Monitor-Only
Active agents:

Sentinel (1)

On-call verifier (1)

Allowed actions:

read metrics

open incident tickets

pause spend

rollback deployments

No generation, no outreach, no new builds.
Triggered by:

daily EAU cap exceeded

anomaly detection

token cap exceeded

Mode B: Normal Ops
Active agents:

full wave schedule
Triggered by:

under caps and no incidents

Mode C: Growth Sprint
Active agents:

builders increased, strategists more active
Triggered only if:

LiquidityMonths ≥ 6

CEI top venture ≥ 1.2 sustained

No dependency cluster > threshold

6) Compute Scaling Under EAU (Zero-HITL)
Compute upgrades happen automatically by ROI gating.
6.1 Upgrade triggers
Upgrade to “more subscriptions / more throughput”
If:

LLM\_EAU / RevenueEAU > 0.15 for 30 days
AND

NetEAU remains positive
AND

LiquidityMonths ≥ 6

Then:

allocate EAU to additional capacity (or cheaper tier) until ratio returns under 0.12–0.15

Upgrade to local GPU
Only if:

predicted payback ≤ 12 months

liquidity after purchase ≥ 9 months

utilization forecast ≥ 40% (otherwise it’s idle capex)

Local GPU cost is amortized into EAU as depreciation + measured power.

7) Concrete Year-1 Numbers for Your $300/mo Genesis
Let’s anchor with your starting inputs:
Monthly inflow = $300 → 30,000 EAU
But your burn includes:

Claude subscription (if that’s the $200 or separate — you didn’t say; I’ll treat it as included in the $200 “labor” bucket OR separate depending on your reality)

hosting/domain (small)

vendor spend (up to $200/mo)

plus any ad tests (capped)

So Year 1 doctrine must be:

no ad scaling

vendor spend only after traction

tokens treated as scarce

You survive by:

using agents for output

spending EAU only on proven ROI activities

8) The “Genesis Constitution” You Can Paste
Here’s a compact block you can literally include:
EAU Constitution (Year 1 defaults):

EAU = $0.01 fully loaded cost

Maintain LiquidityMonths ≥ 6

DailyEAUCap = (MonthlyBurnEAU/30)\*1.2

ExplorationEAU ≤ 15% of LiquidEAU

Reserve predicted burn: ReservedEAU = Σ(EAU\_commit\_30d) + 0.5\*Σ(EAU\_tail\_30d\_p95)

No action if LiquidEAU - ReservedEAU < LiquidityFloorEAU

Per-workflow max: max\_eau, max\_tokens, max\_retries, max\_wall\_time required

Token budget split: Strategists 15%, Builders 55%, Operators+Dispatcher 15%, Verifiers 15%

Spend firewall: single vendor payment ≤ $50 (until venture ≥ $1k MRR); ads ≤ $5/day without LTV proof; no annual commitments unless LiquidityMonths ≥ 9

Kill rules: CEI<0.7 for 2 weekly cycles ⇒ kill; CEI<1.0 ⇒ freeze scaling

Idle modes: Monitor-Only triggers on cap breach or anomalies

9) What you get from this (why it matters)
This makes the system:

treat LLM tokens like labor hours

treat predicted expansion like a liability

stop “infinite agent thrash”

keep survival first

make compute scaling rational

If you want, I can now instantiate this into your Day-1 schedule so every hour block has:

expected token burn (EAU)

max retries

forecasted commitment

and what happens if the day breaches caps (auto mode-switch).

---

### **ChatGPT**

Vcc and other systems for agent governace/identity and isolation? Hashing systems for prompt injection protection  (treating injection like phishijg?)

---

