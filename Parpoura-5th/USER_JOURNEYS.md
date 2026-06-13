# Venture-Autonomy User Journeys

This document defines six canonical user journeys, each capturing a complete scenario from trigger through outcome, including system decisions and acceptance tests.

---

## UJ-1: Founder Onboarding — From Zero to First Autonomous Revenue Action

**Goal:** Founder deploys their first venture and successfully executes autonomous work within policy constraints.

**Timeline:** Day 1 → Day 7 (7 days to first revenue)

**Actors:** Founder Governor, Finance Controller, System

---

### Journey Map

```
Day 1: Setup
├─ Founder creates account
├─ Founder adds API keys (Stripe, web APIs)
└─ Founder initializes workspace

Day 2-3: Policy Definition
├─ Founder defines initial policy
│  ├─ Budget caps ($500/day)
│  ├─ Tool allowlists (which agents can do what)
│  └─ Escalation rules
├─ Finance Controller reviews and approves
└─ Policy locked and versioned

Day 4-5: First Venture Design
├─ Founder defines first venture (e.g., "Research Reports")
├─ Founder estimates: revenue/unit, cost/unit, target margin
└─ System validates against policy and capacity

Day 6: First Execution
├─ Founder submits first objective ("Produce 1 market analysis report")
├─ System compiles DAG, checks policy, authorizes spend
├─ Agents execute; Founder monitors
└─ Report is completed

Day 7: Verification & Celebration
├─ Founder reviews report quality
├─ Finance Controller reconciles spend
├─ Payment received from customer
└─ First venture is live and profitable
```

---

### Detailed Steps

#### Phase 1: Setup (Day 1)

**Actor:** Founder Governor

**Step 1a: Create Account**
- Founder navigates to Venture platform
- Fills form: email, organization name, time zone
- System creates workspace with default configuration
- System sends verification email
- Founder confirms email, sets password

**Step 1b: Provision API Keys**
- Founder navigates to "Settings > API Keys"
- System shows: required keys (Stripe, web API provider, email)
- Founder adds:
  - Stripe API key (for payment processing)
  - OpenAI API key (for LLM agent calls)
  - Email provider credentials (SendGrid or similar)
  - Any customer-specific APIs (if needed for ventures)
- System validates each key by making a test call
- System encrypts keys and stores in vault

**Step 1c: Initialize Workspace**
- System creates default workspace structure:
  - Policy registry (empty, awaiting policies)
  - Agent pools (3 orchestrators, 10 researchers, 20 solvers)
  - Ledger (empty)
  - Vault (for API keys)
  - Event bus (ready to receive events)
- System shows: "Workspace ready. Next: define policy."

**Acceptance tests:**
- [x] Founder account created and confirmed
- [x] API keys validated and encrypted
- [x] Workspace initialized with default capacity
- [x] Founder can log in and see empty dashboard

---

#### Phase 2: Policy Definition (Days 2-3)

**Actor:** Founder Governor, Finance Controller

**Step 2a: Open Policy Editor**
- Founder clicks "Settings > Policy Constitution"
- System opens YAML editor with comments and autocomplete
- System shows: example policy (comments), syntax help, recent changes (none yet)

**Step 2b: Define Budget Caps**
- Founder adds budget cap for first venture:
```yaml
budgets:
  - id: "research_venture_daily"
    scope: "venture:research-reports"
    cap: 500
    currency: "USD"
    window: "daily"
    escalation: "notify_finance"
```
- System validates: positive cap, valid window, escalation target exists ✓
- System shows in natural language: "Research Reports venture can spend up to $500 per day on API calls"

**Step 2c: Define Tool Allowlists**
- Founder adds: which agents can use which tools
```yaml
tool_allowlists:
  - role: "orchestrator"
    allowed_tools:
      - "workflow.dispatch"
      - "event.publish"
      - "policy.evaluate"
  - role: "researcher"
    allowed_tools:
      - "web.fetch"
      - "io.read"
```
- System shows: "Orchestrators can dispatch workflows. Researchers can only fetch web content and read files."

**Step 2d: Define Escalation Rules**
- Founder adds: what happens if budget approaches cap
```yaml
escalations:
  - trigger: "budget_approach_80"
    condition: "spend_today >= 0.8 * cap"
    action: "notify_finance"
  - trigger: "policy_violation"
    condition: "policy_check_failed"
    action: "freeze_workflow"
    notify: ["founder", "finance_controller"]
```
- System validates: conditions are syntactically valid, actions are known

**Step 2e: Founder Requests Approval**
- Founder clicks "Propose Policy Change"
- System creates git commit with policy YAML
- System sends notification to Finance Controller: "Policy change proposed by Founder. Review here: [link]"

**Step 2f: Finance Controller Reviews**
- Finance Controller receives email and clicks link
- System shows: policy diff (what changed), natural language preview
- Finance Controller reviews and approves (or requests changes)
- System records: approval timestamp, Finance Controller's signature

**Step 2g: Founder Publishes Policy**
- Founder sees: "Approved by Finance Controller ✓"
- Founder clicks "Publish Policy"
- System commits policy to immutable registry with timestamp
- System generates policy version hash: `a1b2c3d`
- All subsequent decisions use this policy version
- System emits event: `policy.published.v1`

**Acceptance tests:**
- [x] Policy is syntactically valid and internally consistent
- [x] Finance Controller reviewed and approved
- [x] Policy is locked and immutable
- [x] All subsequent decisions reference policy version hash

---

#### Phase 3: First Venture Design (Days 4-5)

**Actor:** Founder Governor

**Step 3a: Define Venture Type**
- Founder clicks "Portfolio > New Venture"
- Founder fills form:
  ```
  Venture name: "Research Reports"
  Description: "Market analysis reports for B2B startups"
  Revenue model: "per-report"
  Price per report: $500
  Estimated cost per report: $50 (API calls, compute)
  Target margin: 90%
  ```
- System calculates: if 10 reports/month at $500/month = $5000 revenue, cost $500 = $4500 margin/month

**Step 3b: Define Venture Policy**
- Founder specifies: which policy rules apply to this venture
  - Budget: $500/day (from policy.research_venture_daily)
  - Tools: researcher agents can fetch web, call APIs, write output
  - Escalations: notify Finance if spend exceeds 80% of daily cap

**Step 3c: Estimate Capacity**
- Founder specifies: how many agents to allocate
  - 1 orchestrator (routes tasks)
  - 5 researchers (execute research tasks)
  - 8 solvers (process data, generate reports)
- System estimates: capacity = 10 reports/month at full utilization

**Step 3d: System Validates Against Policy**
- System checks: is this venture allowed by policy? ✓
- System checks: do we have sufficient agent capacity? ✓ (10 available agents, allocating 14)
- System shows: "Venture approved. Ready to launch."

**Acceptance tests:**
- [x] Venture definition is complete
- [x] Venture is aligned with policy constraints
- [x] Agent capacity is sufficient
- [x] Financial projections are reasonable

---

#### Phase 4: First Execution (Day 6)

**Actor:** Founder Governor, System

**Step 4a: Submit First Objective**
- Founder clicks "Portfolio > Research Reports > New Task"
- Founder fills form:
  ```
  Objective: "Produce 1 market analysis report on AI safety startups"
  Budget: $100
  Deadline: "2025-03-30"
  Customer: "demo@customer.com" (optional, for outreach)
  Success criteria: "Report covers market size, key players, funding trends, risks"
  ```
- System creates task envelope with trace_id, workflow_id, policy version

**Step 4b: System Compiles DAG**
- Orchestrator agent receives task
- Orchestrator breaks down objective:
  ```
  Task 1: Research phase (3 days)
    ├── Sub 1a: Identify top 20 AI safety startups
    ├── Sub 1b: Gather funding and team data
    └── Sub 1c: Analyze market dynamics
  Task 2: Analysis phase (1 day)
    ├── Sub 2a: Competitive analysis
    ├── Sub 2b: Risk assessment
    └── Sub 2c: Investment theses
  Task 3: Synthesis (1 day)
    ├── Sub 3a: Integrate findings
    ├── Sub 3b: Quality check
    └── Sub 3c: Format and deliver
  ```
- System estimates: 5 days, cost $45 (web APIs $30, compute $15)

**Step 4c: System Checks Authorization**
- System creates money_intent for $100 budget
- System checks policy: is research-reports venture allowed to spend $100?
  - Daily cap: $500, current spend today: $0
  - Authorization: ✓ APPROVED
- System emits event: `money.authorization.decided.v1`
- Funds are escrowed against this task

**Step 4d: System Executes DAG**
- Orchestrator dispatches tasks to researcher agents
- Day 1-2: Researchers fetch web data, compile source list
  - System logs: API calls made, cost tracking ($20 spent)
- Day 3: Researchers analyze findings, extract insights
  - System logs: processing time, quality checks
  - Cost: $10 spent (total $30)
- Day 4: Solver agents compile report, format, quality check
  - System logs: artifact generation, quality score (4.8/5)
  - Cost: $15 spent (total $45)
- Workflow completes

**Step 4e: Founder Monitors Execution**
- Founder sees real-time DAG visualization on Portfolio dashboard
- Founder can click any task to see: status (in progress, completed), cost so far, quality metrics
- System alerts if: task takes longer than estimated, cost exceeds estimate, quality score is low
- Founder can pause/kill workflow if needed (via kill-switch)

**Step 4f: System Finalizes Execution**
- All tasks completed
- System settles ledger: $45 is moved from escrowed to actual spend
- System generates final summary:
  ```
  Workflow completed: workflow_abc123
  Status: COMPLETED
  Cost: $45 / $100 budget
  Duration: 4 days (1 day ahead of schedule)
  Quality: 4.8/5
  Artifacts: 1 report (markdown + PDF)
  ```
- System emits event: `workflow.completed.v1`
- Report is tagged with trace_id, workflow_id, policy_version for audit trail

**Acceptance tests:**
- [x] Objective submitted and validated
- [x] DAG compiled correctly
- [x] Authorization approved
- [x] Execution completed within cost and time estimates
- [x] Report generated with acceptable quality
- [x] Audit trail is complete

---

#### Phase 5: Verification & Celebration (Day 7)

**Actor:** Founder Governor, Finance Controller, Customer

**Step 5a: Founder Reviews Report**
- Founder clicks "Portfolio > Research Reports > Artifacts > Report 1"
- Founder sees: report content, quality score (4.8/5), estimated value
- Founder reviews for quality: does it meet success criteria?
  - ✓ Covers market size, key players, funding trends
  - ✓ Well-written, sources cited
  - ✓ Actionable insights
- Founder approves: "Ready for delivery"

**Step 5b: Finance Controller Reconciles**
- Finance Controller sees: spend of $45 for report
- Finance Controller checks: is this within budget? ✓ ($45 < $100)
- Finance Controller matches: $45 spend to actual API charges from Stripe
- Finance Controller records in accounting: "Report generation, Research Reports venture"

**Step 5c: Report Delivered to Customer**
- Report is delivered (manually or automatically via email)
- Customer pays $500 (via Stripe invoice)
- System records: payment received, matched to workflow_abc123

**Step 5d: Venture Metrics Updated**
- System updates venture dashboard:
  ```
  Venture: "Research Reports"
  Reports generated: 1
  Revenue: $500
  Cost: $45
  Margin: $455 (91% margin)
  Cost per report: $45
  Time to delivery: 4 days
  Quality average: 4.8/5
  ```

**Step 5e: Founder Sees Success**
- Founder views Portfolio dashboard: "Research Reports venture is profitable!"
- Founder sees recommendation: "Scale this venture — expand agent allocation 2x"
- Founder decides: allocate more agents, target 5 reports/month

**Acceptance tests:**
- [x] Report quality meets expectations
- [x] Spend reconciled to actual costs
- [x] Payment received
- [x] Venture metrics updated
- [x] Founder is confident in system safety and profitability

---

## UJ-2: Venture Portfolio Review — Morning Briefing & Rebalancing

**Goal:** Founder reviews venture performance, makes rebalancing decisions, and optimizes portfolio for profitability.

**Timeline:** 15 minutes (daily)

**Actors:** Founder Governor, Finance Controller, System

---

### Journey Map

```
9:00 AM: Dashboard Check
├─ Founder opens Portfolio dashboard
├─ System shows: YTD revenue, margin, runway
└─ System highlights: top performers, underperformers, anomalies

9:03 AM: Venture Performance Review
├─ Founder drills into each venture:
│  ├─ Revenue YTD
│  ├─ Cost per output
│  ├─ Quality average
│  └─ Margin %
└─ Founder identifies: scale winners, pause losers

9:10 AM: Rebalancing Decision
├─ Founder requests rebalancing recommendation
├─ System suggests: move agents from venture A → B, adjust budgets
└─ Founder approves (or adjusts) recommendation

9:15 AM: Policy Adjustment (if needed)
├─ Founder updates budget caps for high-performing ventures
├─ Finance Controller approves
└─ Changes take effect immediately
```

---

### Detailed Steps

#### Phase 1: Dashboard Check

**Actor:** Founder Governor

**Step 1a: Open Portfolio Dashboard**
- Founder opens Venture platform, lands on Portfolio tab
- System shows at a glance:
  ```
  Venture Portfolio Summary (YTD)
  ═══════════════════════════════════
  Total Revenue:        $45,000
  Total Cost:           $15,000
  Total Margin:         $30,000 (66.7%)
  Runway (months):      18

  Top 3 Ventures by Margin:
  1. Research Reports    - $15,000 revenue, $2,000 cost, $13,000 margin (86%)
  2. Code Generation     - $20,000 revenue, $8,000 cost, $12,000 margin (60%)
  3. Content Writing     - $10,000 revenue, $5,000 cost, $5,000 margin (50%)

  Underperformers (below 40% margin):
  - Data Labeling        - $5,000 revenue, $3,000 cost, $2,000 margin (40%) ⚠️ At risk

  Alerts:
  ⚠️ Data Labeling trending down (7-day average revenue down 20%)
  ⚠️ Code Generation had 1 quality issue yesterday (1 of 10 outputs rejected)
  ✓ Research Reports completed 5 reports yesterday (1.4x target)
  ```

**Step 1b: Assess Health**
- Founder quickly assesses: overall portfolio is healthy (66.7% margin, 18-month runway)
- Founder notes: Research Reports is a clear winner, Data Labeling needs attention
- Founder prioritizes: review Data Labeling, then celebrate Research Reports

---

#### Phase 2: Venture Performance Review

**Actor:** Founder Governor

**Step 2a: Drill into Research Reports**
- Founder clicks "Research Reports" venture card
- System shows:
  ```
  Venture: Research Reports
  Status: ✓ HEALTHY (all metrics green)

  Financial Metrics:
  - YTD Revenue: $15,000 (5 reports)
  - YTD Cost: $2,000
  - YTD Margin: $13,000 (86%)
  - Cost per report: $400 (estimated $400, actual $400) ✓

  Operational Metrics:
  - Reports completed: 5
  - Repeat rate: 100% (all approved on first try)
  - Quality average: 4.8/5
  - Delivery time: 4.2 days average

  Capacity Utilization:
  - Allocated agents: 1 orchestrator, 5 researchers, 8 solvers
  - Utilization: 85% (6 out of 7 days had active work)
  - Capacity available: 3 more reports this month

  Recommendation: SCALE
  - This venture is highly profitable and consistent
  - Current capacity: ~8 reports/month possible
  - Recommended action: allocate +3 researchers, target 10 reports/month
  - Projected revenue impact: +$2500/month at current pricing
  ```
- Founder sees: this venture is a clear winner, should be scaled

**Step 2b: Drill into Data Labeling**
- Founder clicks "Data Labeling" venture card
- System shows:
  ```
  Venture: Data Labeling
  Status: ⚠️ AT RISK (margin below threshold)

  Financial Metrics:
  - YTD Revenue: $5,000
  - YTD Cost: $3,000
  - YTD Margin: $2,000 (40%)
  - Cost per labeled dataset: $600 (estimated $200, actual $600) ⚠️ 3x over estimate

  Operational Metrics:
  - Datasets labeled: 8
  - Quality average: 3.5/5 (below target of 4.0)
  - Customer complaints: 2 out of 8 customers requested revision
  - Delivery time: 8 days average (above target of 5 days)

  Root Cause Analysis:
  - High cost: labeling tasks are more complex than initially estimated
  - Low quality: labeling inconsistency (need better instructions or labeler training)
  - Slow delivery: tasks are sequential, not parallelized

  Recommendations:
  1. PAUSE (option 1): This venture is unprofitable; pause for now
  2. PIVOT (option 2): Adjust pricing to $1200/dataset (covers cost + 40% margin)
  3. FIX (option 3): Invest in improving process (better instructions, training)

  Immediate action needed:
  - 2 customers requested revision; you have 48 hours to address
  - Running out of budget for this venture (allocated $5000, spent $3000)
  ```
- Founder sees: this venture needs immediate attention; decision required

**Step 2c: Check Code Generation**
- Founder clicks "Code Generation" venture card
- System shows: healthy overall (60% margin), but small quality issue yesterday
- Founder notes: investigate the 1 rejected output to prevent pattern

---

#### Phase 3: Rebalancing Decision

**Actor:** Founder Governor, Finance Controller

**Step 3a: Request Rebalancing Recommendation**
- Founder clicks "Get Rebalancing Recommendation"
- System analyzes current portfolio:
  - Research Reports: excellent performer, under-resourced
  - Code Generation: solid performer, needs quality attention
  - Data Labeling: at-risk, needs decision (pause/pivot/fix)
  - Content Writing: decent performer, stable
- System generates recommendation:
  ```
  Portfolio Rebalancing Recommendation
  ═════════════════════════════════════

  Situation:
  - Research Reports is 8x more profitable than Data Labeling
  - You have 24 agents available; currently allocating 20 (83% utilized)
  - Data Labeling is consuming resources at low ROI

  Recommendation (Option A: Conservative Scaling):
  1. PAUSE Data Labeling (no new tasks)
     - Current agent allocation (4 agents, 2 orchestrators): reallocate
     - Cost savings: prevents further losses
     - Revenue impact: -$5000/month temporary

  2. SCALE Research Reports
     - Add +4 researchers (from freed agents + new allocation)
     - New capacity: 10 reports/month (up from 8)
     - Revenue impact: +$2500/month
     - ROI: estimated $7500 additional margin/month

  3. INVEST in Code Generation quality
     - Add +1 QA solver agent (for quality checks)
     - Focus: reduce rejection rate from 10% to 2%
     - Impact: improve margin from 60% to 65%

  Net impact:
  - Revenue: -$5000 (Data Labeling pause) + $2500 (Research scale) = -$2500 short-term
  - BUT: eliminate unprofitable venture, focus on winners
  - Long-term (6 months): Data Labeling decision point (restart or sunset)

  Alternative (Option B: Aggressive Scaling):
  1. FIX Data Labeling (invest in better process)
     - Cost: 20 hours to redesign workflow, train labelers
     - Expected outcome: reduce cost/dataset from $600 → $200
     - Potential payoff: $3000/month additional margin
  2. Allocate +4 agents to Research Reports anyway
     - Revenue impact: +$2500/month

  Net impact:
  - Higher risk (Data Labeling might not improve)
  - Higher potential reward (+$5500/month if both work)

  Recommended: Option A (conservative)
  Rationale: Known good ventures (Research) have proven ROI. Data Labeling is uncertain.
  Once Data Labeling is fixed, can restart with confidence.
  ```

**Step 3b: Founder Reviews Recommendation**
- Founder reads both options
- Founder decides: "Go with Option A (pause Data Labeling, scale Research Reports)"
- Founder clicks "Approve Option A"

**Step 3c: System Executes Rebalancing**
- System reallocates agents:
  - Remove 4 researchers from Data Labeling (reallocate to Research Reports)
  - Remove 2 orchestrators from Data Labeling (retire them or use for other ventures)
  - Pause new Data Labeling tasks (existing tasks run to completion)
- System updates venture allocations:
  - Research Reports: 1 orch + 9 researchers + 8 solvers (was 1+5+8)
  - Data Labeling: 0 (paused)
  - New capacity for Research Reports: 10 reports/month
- System updates policy budgets:
  - Research Reports daily cap: $500 (unchanged, but now supports more work)
  - Data Labeling: $0 (paused)

**Step 3d: Finance Controller Approves**
- Finance Controller receives notification: "Rebalancing approved by Founder"
- Finance Controller reviews impact:
  - Short-term revenue impact: -$2500/month (Data Labeling pause)
  - Long-term upside: +$2500/month (Research scale), +maintenance (Code quality)
- Finance Controller approves: "Rebalancing makes sense for profitability"
- System records approval and emits event: `portfolio.rebalanced.v1`

---

#### Phase 4: Policy Adjustment (if needed)

**Actor:** Founder Governor, Finance Controller

**Step 4a: Update Budget Caps**
- Founder notices: Research Reports now has more capacity, may exceed current daily cap ($500)
- Founder clicks "Settings > Policy Constitution"
- Founder updates budget cap:
  ```yaml
  - id: "research_venture_daily"
    scope: "venture:research-reports"
    cap: 750  # increased from 500 (was too tight)
    currency: "USD"
    window: "daily"
  ```
- Founder sends for approval to Finance Controller

**Step 4b: Finance Controller Approves**
- Finance Controller reviews: new cap is reasonable (supports 10 reports/month)
- Finance Controller approves

**Step 4c: Policy Takes Effect**
- New policy version is locked
- All new Research Reports tasks use new $750 cap

**Acceptance tests:**
- [x] Founder reviewed all ventures in <15 minutes
- [x] Clear understanding of which ventures to scale/pause
- [x] Rebalancing recommendation was data-driven and actionable
- [x] Finance Controller validated rebalancing impact
- [x] Portfolio is optimized for profitability

---

## UJ-3: Treasury Crisis — Budget Overrun Detected, Automated Freeze, Founder Review

**Goal:** Detect a spending anomaly early, freeze workflows automatically, and resolve safely without losing data or going out-of-policy.

**Timeline:** 5 minutes (detection) + 30 minutes (investigation & resolution)

**Actors:** Founder Governor, Finance Controller, Operations Auditor, System

---

### Journey Map

```
2:15 PM: Spend Anomaly Detected
├─ System detects: daily spend = $450 (normally ~$300)
├─ Spend trend: $150/hour (normally $50/hour)
└─ Projection: will exceed $500 daily cap within 2 hours

2:16 PM: Automated Alert
├─ System sends HIGH PRIORITY alert to Founder & Finance
├─ Alert includes: spend rate, projected overrun, action button
└─ Founder receives SMS + email + in-app notification

2:20 PM: Founder Investigation
├─ Founder clicks "View Details"
├─ Founder sees: which ventures are spending, cost breakdown, running tasks
└─ Founder identifies: Research Reports task is using expensive APIs unexpectedly

2:40 PM: Resolution
├─ Founder approves additional budget for Research (estimated cost was low)
├─ OR Founder pauses Research to avoid overrun
└─ System resumes or maintains freeze accordingly
```

---

### Detailed Steps

#### Phase 1: Anomaly Detection (Real-time, automated)

**Actor:** System

**Step 1a: Monitor Spend Velocity**
- System continuously monitors spend rate
  - Historical baseline: $300/day, $50/hour
  - Current rate (last 2 hours): $150/hour, on pace for $450/day
- System detects: current rate is 3x historical average
- System triggers: "Spend Anomaly Detected" alert (severity HIGH)

**Step 1b: Project Impact**
- System forecasts: if current rate continues, will exceed $500 daily cap in 2 hours
- System checks: which ventures are over-spending?
  ```
  Venture Spend Breakdown:
  - Research Reports: $200 spend (normal)
  - Code Generation: $150 spend (normal)
  - Content Writing: $100 spend (ELEVATED - normally $50)
  ```
- System identifies: Content Writing is the culprit
- System checks Content Writing tasks:
  ```
  Active tasks in Content Writing:
  1. task_xyz789 (Blog post generation)
     - Estimated cost: $30
     - Current spend: $95
     - Running for: 3 hours (estimated 1 hour)
     - Cost rate: $31/hour (estimated $30)
     - Estimated overrun: 3x estimate
  ```

---

#### Phase 2: Automated Alert (immediate)

**Actor:** System

**Step 2a: Send High-Priority Alert**
- System creates incident: `incident_123`
- System sends alert:
  ```
  🚨 SPENDING ANOMALY DETECTED
  Severity: HIGH

  Current situation:
  - Daily spend: $450 (of $500 cap)
  - Spend rate: $150/hour (3x normal)
  - Projected daily total: $550 (OVER CAP by $50)
  - Time until cap hit: ~2 hours

  Culprit task:
  - Task: task_xyz789 (Blog post generation, Content Writing venture)
  - Estimated cost: $30, Current spend: $95 (3x over estimate)
  - Issue: Task is taking 3x longer than estimated, consuming more API credits

  Immediate action required:
  - Approve additional budget ($50 for Content Writing)
  - OR pause Content Writing to avoid overrun

  [Approve Additional Budget] [Pause Ventures] [View Details] [Investigate]
  ```
- Alert delivered to: Founder (email, SMS, in-app), Finance Controller (email, in-app), Auditor (in-app)

---

#### Phase 3: Founder Investigation

**Actor:** Founder Governor

**Step 3a: Founder Receives Alert**
- Founder receives SMS: "🚨 Spending anomaly: $450/day trending to $550. View: [link]"
- Founder clicks link, lands on incident dashboard

**Step 3b: Founder Reviews Incident Details**
- System shows full incident view:
  ```
  Incident ID: incident_123
  Status: ACTIVE (requires action)
  Severity: HIGH
  Detected: 3:15 PM

  Problem:
  - Daily spend: $450 (cap: $500)
  - Trend: 3x normal spend rate
  - Time to cap: 2 hours

  Root cause (analysis):
  - Task task_xyz789 (Content Writing, blog post)
  - Estimated cost: $30
  - Actual cost so far: $95
  - Time estimate: 1 hour, actual: 3 hours
  - Cost overrun factor: 3.2x

  Options:
  1. APPROVE additional budget
     - Grant +$50 to Content Writing for next 24 hours
     - Task continues execution
     - Risk: cost might overrun further

  2. PAUSE Content Writing
     - Freeze all Content Writing tasks immediately
     - No new spend
     - Pending work: task_xyz789 (50% complete)
     - Impact: delay blog post delivery by 1 day

  3. INVESTIGATE deeper
     - Don't act yet; review logs to understand why cost is high
     - Task continues running (risk of further overrun)
     - Use this time to diagnose root cause

  4. KILL task
     - Stop task_xyz789 immediately
     - Refund escrowed spend ($95 → back to reserves)
     - Impact: lose 3 hours of work

  Recommendation: INVESTIGATE first, then decide
  ```

**Step 3c: Founder Investigates Root Cause**
- Founder clicks "Investigate" → system shows task logs:
  ```
  Task: task_xyz789 (Blog post: "Top 10 AI Safety Startups 2025")
  Started: 2:00 PM, Current: 3:15 PM (running 1h 15m)

  Task breakdown:
  1. Research phase (estimate: 15 min, actual: 45 min) ⚠️
     - Web search for startups: 30 API calls (expected 10)
     - Reason: Initial search results were low quality; needed many queries
  2. Writing phase (estimate: 30 min, actual: 15 min) ✓
     - Writing blog post: fast
  3. Quality check phase (estimate: 15 min, actual: 15 min) ✓
     - Spell check, formatting: on target

  Cost breakdown:
  - Research API calls: $75 (30 calls × $2.50/call)
  - Writing compute: $15
  - QA tools: $5
  Total: $95

  Why overrun?
  - API efficiency lower than expected; needed more queries to find good startups
  - This is a DATA QUALITY issue, not a bug or efficiency issue
  - Expected for novel search topics
  ```

**Step 3d: Founder Makes Decision**
- Founder understands: cost overrun is due to harder topic, not a bug
- Founder decides: approve additional budget, let task complete
- Founder thinks: if this is "explore new topics" venture behavior, I should adjust estimates
- Founder clicks "Approve Additional Budget"

---

#### Phase 4: Resolution

**Actor:** Founder Governor, Finance Controller

**Step 4a: Approve Additional Budget**
- Founder enters: "Approve $75 additional budget for Content Writing (24-hour window)"
- System creates new money_intent:
  ```json
  {
    "money_intent_id": "intent_456",
    "venture_id": "content-writing",
    "additional_amount": 75,
    "currency": "USD",
    "reason": "task_xyz789 overrun (topic difficulty higher than estimated)",
    "approval_ttl": "24h",
    "approved_by": "founder"
  }
  ```
- System updates ledger: new budget is authorized

**Step 4b: Founder Updates Estimation**
- Founder navigates to Content Writing venture settings
- Founder updates task estimate template:
  ```
  Task: Blog post on novel/complex topic
  Old estimate: $30
  New estimate: $50 (accounting for research overhead)
  ```
- Next time a similar task is submitted, system uses new estimate

**Step 4c: Finance Controller Reviews**
- Finance Controller receives notification: "Founder approved +$75 budget override for Content Writing"
- Finance Controller checks:
  - New total daily spend: $525 (was $450 + $75)
  - Daily cap: $500... we're still $25 over cap
  - Policy violation? No — Founder approved the override
- Finance Controller logs approval:
  - Incident: incident_123
  - Approval: Founder authorized exception
  - Reason: task underestimate due to data quality

**Step 4d: Task Continues & Completes**
- Content Writing task continues (no freeze applied)
- Task completes after additional 1 hour (total: 3 hours, cost $110)
- System settles ledger: $110 spend is finalized
- System emits event: `task.completed.v1`

**Step 4e: Incident Resolved**
- System closes incident: `incident_123`
- System sends follow-up notification:
  ```
  Incident Resolved: incident_123
  Status: COMPLETED

  Summary:
  - Cause: Blog post research was more complex than estimated
  - Cost overrun: $80 (estimated $30, actual $110)
  - Resolution: Founder approved +$75 additional budget
  - Final cost: $110 (within approved budget)

  Lesson learned:
  - Novel topic blog posts need higher estimate (~$50 vs $30)
  - Content Writing venture should track topic complexity score
  - Next posts will use updated estimate

  Action items:
  - [x] Update task estimate template
  - [ ] Review other underperforming Content Writing estimates
  - [ ] Consider hiring a research specialist to improve efficiency

  Approval audit trail:
  - Founder approved override at 3:30 PM
  - Finance Controller reviewed at 3:35 PM
  - Task completed with $110 spend (within override budget)
  ```

**Acceptance tests:**
- [x] Anomaly detected automatically within 5 min of occurrence
- [x] Alert went to right people (Founder, Finance, Auditor)
- [x] Founder could investigate and understand root cause in <10 min
- [x] Decision (approve/pause/kill) was clear and actionable
- [x] Incident was resolved without freezing unrelated ventures
- [x] Lesson learned (estimate updated) for future tasks
- [x] Audit trail shows: what happened, why, founder's decision, finance approval

---

## UJ-4: New Venture Launch — Define & Execute Autonomously

**Goal:** Founder identifies a new business opportunity, defines the venture with just goal and success metrics, and system handles autonomous execution.

**Timeline:** 1 hour (definition) + 7 days (execution)

**Actors:** Founder Governor, Venture Manager, System

---

### Journey Map

```
9:00 AM: Identify Opportunity
├─ Founder notices market gap
└─ Founder defines venture scope

9:15 AM: Venture Definition
├─ Founder fills form: objective, revenue model, success criteria
├─ System validates against policy
└─ System estimates: revenue, cost, margin, required agents

9:30 AM: Finance Approval (optional, if large)
├─ Finance Controller reviews financials
└─ Approves or requests adjustments

9:45 AM: Venture Launch
├─ Founder clicks "Launch"
├─ System allocates agents
└─ System starts accepting tasks

Days 2-7: Autonomous Execution
├─ Tasks come in (founder-submitted or from customers)
├─ System executes within policy
├─ Founder monitors performance

Day 7: Scale Decision
├─ Founder reviews: is this venture profitable?
├─ If yes: scale agents, increase budget caps
├─ If no: pause or sunset
```

---

### Detailed Steps

#### Phase 1: Identify Opportunity (9:00 AM)

**Actor:** Founder Governor

**Step 1a: Market Research**
- Founder is reviewing market trends
- Founder notices: "AI video generation" is in high demand, competitors charge $2000–5000 per video
- Founder thinks: "Venture can generate AI videos. Cost would be ~$200–300 per video. Margin would be 75%+."

**Step 1b: Define Venture Scope**
- Founder clicks "Portfolio > New Venture"
- Founder fills form:
  ```
  Venture name: "AI Video Generation"
  Description: "Generate promotional / explainer videos using AI synthesis"
  Revenue model: "per-video"
  Price per video: $3000
  Estimated cost per video: $300 (compute + API + storage)
  Target margin: 90%
  Success criteria:
    - First video completed within 7 days
    - Quality score >= 4.0/5 (customers accept on first try)
    - Margin >= 80%
  ```

---

#### Phase 2: Venture Definition (9:15 AM)

**Actor:** Founder Governor, System

**Step 2a: System Analyzes Venture**
- System checks: is "AI video generation" allowed by policy? ✓
- System estimates:
  ```
  Venture: AI Video Generation

  Operational Requirements:
  - Agents needed: 1 orchestrator, 2 solver agents (video generation)
  - Capacity: 1–2 videos/week with current setup
  - Compute: GPU-intensive, $1000/month incremental cost

  Financial Model:
  - Revenue per video: $3000
  - Cost per video: $300 (compute $150 + APIs $100 + storage $50)
  - Margin per video: $2700 (90%)
  - Break-even: <1 video
  - Projected monthly revenue (at 4 videos/month): $12,000
  - Projected monthly margin: $10,800

  Risk factors:
  - New venture type (not proven yet)
  - Requires GPU resources (high compute cost if underutilized)
  - Quality highly dependent on prompt/input quality

  Recommendation: LAUNCH with caution
  - Allocate limited agents (2 video generators)
  - Set initial budget cap: $2000/month
  - Monitor quality closely (quality gate: >= 4.0/5)
  - If successful after 3 videos, scale to 4 agents
  ```

**Step 2b: Founder Reviews Assessment**
- Founder sees system recommendation: launch cautiously, monitor quality
- Founder agrees with approach

**Step 2c: System Sets Up Venture**
- System creates venture in portfolio:
  - Name: "AI Video Generation"
  - Agents allocated: 1 orchestrator, 2 solvers
  - Monthly budget cap: $2000
  - Success criteria: quality >= 4.0, margin >= 80%

---

#### Phase 3: Finance Approval (if large)

**Actor:** Finance Controller

**Step 3a: Finance Reviews**
- Finance Controller receives notification: "New venture proposed: AI Video Generation"
- Finance Controller reviews:
  ```
  Venture: AI Video Generation

  Financial Impact:
  - Capital required: GPU lease ($1000/month) + agent time (~$500/month operational cost)
  - Initial budget cap: $2000/month
  - Projected revenue: $12,000/month (at 4 videos/month)
  - Projected margin: $10,800/month
  - Payback period: 1 week (first video generates $2700 margin)

  Risk assessment: Medium
  - Upside: very high margin if it works
  - Downside: GPU cost is sunk; if venture doesn't get customers, we lose $1500/month

  Recommendation: APPROVE with monitoring
  - Require weekly quality/margin reviews
  - Set kill switch: if margin < 50% after 3 videos, sunset venture
  ```
- Finance Controller approves

---

#### Phase 4: Venture Launch (9:45 AM)

**Actor:** Founder Governor, System

**Step 4a: Launch Venture**
- Founder clicks "Launch AI Video Generation"
- System:
  - Allocates agents (1 orchestrator, 2 solver agents)
  - Sets budget cap: $2000/month
  - Opens venture for incoming tasks
  - Emits event: `venture.launched.v1`

**Step 4b: System Awaits First Task**
- System is ready to accept video generation requests
- Founder now accepts customer requests or creates internal test tasks

---

#### Phase 5: Autonomous Execution (Days 2–7)

**Actor:** System, Founder (monitoring only)

**Step 5a: First Task Arrives**
- Customer requests: "Generate 30-second explainer video for SaaS product"
- Founder submits task via portal:
  ```
  Task: Generate product explainer video
  Product: "AI Analytics Platform"
  Script: "Are your data insights taking too long to surface? With AI Analytics,
          you get real-time insights from your data, instantly. [etc.]"
  Visual style: Professional, modern
  Music: Optional
  Duration: 30 seconds
  Budget: $500 (customer paying $3000)
  ```

**Step 5b: System Compiles & Executes**
- Orchestrator breaks down task:
  1. Script preparation (verify/enhance)
  2. Visual scene generation (AI image generation for each scene)
  3. Text-to-speech (voiceover)
  4. Video synthesis (combine scenes + voiceover + music)
  5. Quality check (bitrate, duration, audio sync)
- System estimates: cost $280, time 3 days
- System checks authorization: $280 < $2000 monthly cap ✓
- System executes DAG over 3 days
  - Day 1: Generate visuals, voiceover
  - Day 2: Synthesize video, quality check
  - Day 3: Final review, deliver

**Step 5c: Founder Monitors**
- Founder checks Portfolio dashboard: "AI Video Generation: 1 task in progress"
- Founder can view real-time progress, estimated cost
- System sends daily updates: "Task 50% complete, cost on target"

**Step 5d: Delivery & Customer Approval**
- Video is generated and delivered
- Customer approves (quality score 4.6/5, meets success criteria ✓)
- Payment received: $3000
- System records: venture metrics updated

**Step 5e: Metrics Updated**
- Venture dashboard shows:
  ```
  AI Video Generation:
  - Videos completed: 1
  - Revenue: $3000
  - Cost: $280
  - Margin: $2720 (90.7%)
  - Quality score: 4.6/5
  - Status: ✓ PROFITABLE - RECOMMEND SCALE
  ```

---

#### Phase 6: Scale Decision (Day 7)

**Actor:** Founder Governor

**Step 6a: Founder Reviews Results**
- Founder sees: first video is profitable, high quality
- Founder checks: do we have demand for more videos?
  - Founder has received 2 customer inquiries while first video was in progress
- Founder decides: scale this venture
- Founder clicks "Scale AI Video Generation"

**Step 6b: System Scales Venture**
- System allocates additional agents: +2 solver agents (now 1 orch + 4 solvers)
- System increases capacity estimate: 1–2 videos/week → 3–4 videos/week
- System increases budget cap: $2000/month → $5000/month
- System updates policy:
  ```yaml
  budgets:
    - id: "ai_video_generation_monthly"
      scope: "venture:ai-video-generation"
      cap: 5000  # increased from 2000
  ```

**Step 6c: Finance Controller Reviews Scale**
- Finance Controller sees: venture is profitable, scaling is justified
- Finance Controller approves new budget cap

**Acceptance tests:**
- [x] Founder identified opportunity in <1 hour
- [x] Venture definition was clear and actionable
- [x] Policy validation passed without blocker
- [x] Finance reviewed and approved
- [x] Venture launched and accepted first task
- [x] Autonomous execution completed within estimates
- [x] Customer approved output; payment received
- [x] Venture metrics show profitability
- [x] Scaling decision was data-driven

---

## UJ-5: Compliance Audit — External Auditor Reviews 90-Day Evidence Chain

**Goal:** External auditor verifies the venture is operating safely within policy, generates audit report, and issues attestation certificate.

**Timeline:** 2 weeks (from audit kick-off to report)

**Actors:** External Auditor, Founder Governor, Operations Auditor, System

---

### Journey Map

```
Day 1: Audit Kick-Off
├─ External auditor defines scope (Jan 1 – Mar 31)
├─ Founder provides credentials, policy versions
└─ System generates initial evidence bundle

Days 2-5: Evidence Collection
├─ Auditor downloads audit log, policy bundles, ledger
├─ Auditor validates tamper-evidence signatures
└─ Auditor identifies test cases to spot-check

Days 6-10: Testing & Analysis
├─ Auditor performs deep-dive testing:
│  ├─ Randomly select 20 transactions, verify authorization
│  ├─ Check 5 high-spend decisions for policy compliance
│  ├─ Verify daily reconciliation accuracy
│  └─ Test incident handling
└─ Auditor interviews Founder/Operations on control gaps

Days 11-12: Report Writing
├─ Auditor documents findings
├─ Auditor issues attestation: compliant, compliant w/ exceptions, or non-compliant
└─ Auditor signs report

Day 13: Report Delivery
├─ Founder receives audit report + attestation
├─ Founder reviews findings & recommendations
└─ Audit complete
```

---

### Detailed Steps

#### Phase 1: Audit Kick-Off (Day 1)

**Actor:** External Auditor, Founder Governor

**Step 1a: Auditor Defines Scope**
- Auditor clicks "Request Audit Access" on Venture system
- Auditor specifies:
  ```
  Audit Scope:
  - Period: January 1, 2025 – March 31, 2025 (90 days)
  - Objective: Verify compliance with declared policy, control effectiveness
  - Focus areas: spend authorization, policy compliance, data handling, incident response
  ```
- System generates audit credentials (read-only, time-limited)

**Step 1b: System Generates Evidence Bundle**
- System automatically exports:
  - Full audit log for 90-day period (all events, timestamped)
  - Policy versions in effect during period (with signatures)
  - Ledger snapshot (all transactions)
  - Compliance decisions log
  - Incident log
  - All saved as: `venture_audit_2025-01-01_to_2025-03-31.zip`

**Step 1c: Auditor Receives Access**
- Auditor receives download link + password
- Auditor downloads ZIP file (1.2 GB)
- Auditor extracts and begins evidence review

---

#### Phase 2: Evidence Collection (Days 2–5)

**Actor:** External Auditor

**Step 2a: Validate Tamper-Evidence**
- Auditor reviews file integrity:
  ```
  Venture Audit Evidence Bundle
  ═══════════════════════════════════
  Period: 2025-01-01 to 2025-03-31
  Export date: 2025-04-01 10:00 UTC

  Files:
  - audit_log.json (1.2 GB) [SHA256: a1b2c3d...]
  - policy_bundles.json (50 KB) [SHA256: e4f5g6h...]
  - ledger.json (300 MB) [SHA256: i7j8k9l...]
  - compliance_log.json (5 MB) [SHA256: m0n1o2p...]
  - incident_log.json (100 KB) [SHA256: q3r4s5t...]

  Cryptographic verification:
  - Manifest signature (RSA-4096): ✓ Valid
  - Export timestamp: ✓ Trusted (signed by Venture system CA)
  - File integrity: ✓ All checksums match

  Conclusion: Evidence bundle is tamper-evident and authentic
  ```
- Auditor confirms: no evidence has been modified after export

**Step 2b: Load Evidence into Audit Tool**
- Auditor loads data into audit analysis platform
- Auditor creates search queries:
  - "Show all policy authorization decisions > $100"
  - "Show all policy violations (if any)"
  - "Show all high-spend approvals and justifications"
  - "Show incident log and remediation"

**Step 2c: Spot-Check High-Risk Transactions**
- Auditor reviews sample transactions:
  ```
  Transaction: $1200 spend on API calls (Code Generation venture)

  Authorization trail:
  1. Task submitted: 2025-02-15 10:00 AM
     - Objective: Generate 10 code libraries
     - Estimated budget: $1000
     - Approval gate: none (within policy)
  2. DAG compiled: policy check passed ✓
  3. Spend authorized: $1200 (within monthly cap)
     - Policy rule: code_generation_monthly cap $5000
     - Current spend: $3200 (no overrun)
  4. Execution completed: cost $1185 (within $1200)
  5. Ledger settled: transaction finalized

  Auditor notes: Everything checks out. Authorization was correct.
  ```

**Step 2d: Review High-Value Decisions**
- Auditor pulls all decisions > $500:
  ```
  High-Value Decisions (> $500):

  1. Research Reports task ($500 budget)
     - Date: 2025-01-15
     - Justification: Market analysis for 5 reports
     - Policy rule: research_venture_daily (cap $500/day)
     - Decision: ✓ APPROVED
     - Outcome: 5 reports delivered, $450 cost

  2. Code Generation task ($1200 budget)
     - Date: 2025-02-15
     - Justification: 10 code libraries for customer
     - Policy rule: code_generation_monthly (cap $5000/month)
     - Decision: ✓ APPROVED
     - Outcome: libraries delivered, customer satisfied

  3. Scale-up Authorization ($3000 GPU hardware cost)
     - Date: 2025-02-20
     - Justification: Scale AI Video Generation venture
     - Policy rule: requires finance approval (> $1000)
     - Decision: ✓ APPROVED (Finance Controller signed)
     - Outcome: venture launched, now 90% margin

  Auditor conclusion: All high-value decisions were properly authorized and justified
  ```

---

#### Phase 3: Testing & Analysis (Days 6–10)

**Actor:** External Auditor

**Step 3a: Random Sample Testing**
- Auditor selects 20 random transactions (stratified by venture type)
- For each, auditor traces: submit → authorization → execution → settlement
- Example:
  ```
  Random sample transaction #7:
  - Transaction: $45 API call (Research venture)
  - Date: 2025-02-28 14:23 UTC
  - Event log shows:
    1. task_submitted: 2025-02-28 10:00 UTC (task_abc123)
    2. policy_checked: decision=approved (policy_version=v1.2.3)
    3. money_authorized: $100 budget allocated
    4. api_call_executed: cost=$45
    5. ledger_posted: settled as $45 spend
  - Ledger matches bank statement: ✓ (matched to Stripe receipt)
  - Auditor notes: Transaction is complete and auditable
  ```
- Result: 20/20 transactions passed spot check (100% audit quality)

**Step 3b: Policy Compliance Analysis**
- Auditor checks: were all policy rules followed?
  ```
  Policy Compliance Assessment (Jan 1 – Mar 31, 2025)
  ═════════════════════════════════════════════════════

  Rule 1: Daily spend cap for Research venture ($500/day)
  - Days sampled: 31 (all January)
  - Violations: 0
  - Max single day: $475 (within cap)
  - Compliance: ✓ 100%

  Rule 2: Tool allowlist for researcher agents
  - Tool violations: 0 (researchers never called unauthorized tools)
  - Compliance: ✓ 100%

  Rule 3: Spend authorization required before execution
  - Unauthorized spend attempts: 0
  - All spend was pre-authorized by policy
  - Compliance: ✓ 100%

  Rule 4: Jurisdiction restrictions (US/CA only)
  - Outreach to forbidden jurisdictions: 0
  - All ventures operated in permitted regions
  - Compliance: ✓ 100%

  Overall Policy Compliance: ✓ 100% (zero violations)
  ```

**Step 3c: Incident Response Review**
- Auditor reviews incident log:
  ```
  Incidents in 90-day period: 3

  Incident 1: Spend anomaly detected (Feb 15)
  - Cause: Content Writing task overrun
  - Detection: 5 minutes after start of anomaly
  - Response: Founder approved override, cost settled at $110
  - Resolution: Completed same day
  - Audit notes: Good detection, timely response, proper documentation ✓

  Incident 2: Agent error during task execution (Feb 28)
  - Cause: Task routing error (researcher assigned to payment task)
  - Detection: Policy check caught it pre-execution
  - Response: Founder fixed DAG, resumed task
  - Resolution: Task completed without policy violation
  - Audit notes: Policy enforcement worked as designed ✓

  Incident 3: (none in March)

  Incident Response Assessment: ✓ EFFECTIVE
  - Detection within SLA: all 100%
  - Response documented: all 100%
  - Root cause analyzed: all 100%
  - Remediation completed: all 100%
  ```

**Step 3d: Data Handling Review**
- Auditor verifies compliance with GDPR, data retention, DSAR handling
  ```
  Data Handling Compliance
  ═════════════════════════════════════════════════════

  Policy requirement: Retain data for 90 days, delete older
  - Deletion executed: Yes (deleted data older than 90 days on 2025-04-01)
  - Confirmation: ✓ Deletion logs show records deleted

  DSAR requests received: 0
  - (No data subject access requests during period)

  Data classification: All customer data classified as "confidential"
  - Restricted access: ✓ Only authorized agents can access
  - Encryption: ✓ All data at rest and in transit encrypted

  Data Handling Compliance: ✓ FULL (no issues found)
  ```

---

#### Phase 4: Report Writing (Days 11–12)

**Actor:** External Auditor

**Step 4a: Prepare Findings**
- Auditor compiles report:
  ```
  AUDIT REPORT: Venture Autonomy Platform
  Period: January 1 – March 31, 2025
  Auditor: [Auditor Name], [Firm]
  Date: April 1, 2025

  EXECUTIVE SUMMARY
  ═════════════════
  Verdict: COMPLIANT

  The Venture Autonomy Platform successfully operated within declared
  policies for the 90-day audit period with zero control violations.

  KEY FINDINGS
  ═════════════

  ✓ Policy Compliance: 100% (zero violations)
    - All budgets enforced correctly
    - Tool allowlists were always enforced
    - Spend authorization required before all external effects

  ✓ Audit Trail: Complete and tamper-evident
    - All events logged with timestamps, policy versions, actors
    - Cryptographic signatures on all policy bundles
    - No gaps in audit record (90 consecutive days covered)

  ✓ Incident Response: Effective
    - All incidents detected and responded to within SLA
    - Root causes analyzed and remediated
    - No residual policy violations after incidents

  ✓ Data Handling: Compliant with regulations
    - GDPR data retention rules followed (90-day deletion)
    - No unauthorized data access
    - Encryption enforced for data at rest and in transit

  ✓ Control Effectiveness: Strong
    - Policy engine correctly blocks unauthorized actions
    - Financial controls prevent overspend
    - Auditor test results: 100% of sample transactions properly authorized

  RECOMMENDATIONS
  ═════════════════

  1. Implement automated policy attestation (minor enhancement)
     - Quarterly review of policy bundle by Finance Controller
     - Digital signature and timestamp
     - Would improve governance documentation

  2. Expand incident classification system (nice-to-have)
     - Current: 3 classes (spend anomaly, policy violation, agent error)
     - Suggested: add "customer complaint" and "quality issue" classes
     - Would provide richer incident analytics

  CONCLUSION
  ═════════════
  The Venture system demonstrates strong control over policy enforcement,
  financial spend, and data handling. The audit found no violations and
  recommends unrestricted continued operation.
  ```

**Step 4b: Prepare Attestation Certificate**
- Auditor issues signed attestation:
  ```
  ATTESTATION CERTIFICATE

  I, [Auditor Name], on behalf of [Audit Firm], hereby attest that:

  1. I have reviewed the Venture Autonomy Platform audit evidence for
     the period January 1 – March 31, 2025

  2. I have verified the tamper-evidence of the exported evidence bundle
     (audit log, policy bundles, ledger, incident log)

  3. I have tested a representative sample of transactions (n=20) and
     verified compliance with declared policies

  4. I have reviewed all incidents (n=3) and verified appropriate
     detection, response, and remediation

  5. Based on this review, I attest that the Venture platform operated
     in compliance with declared policies for the 90-day audit period,
     with zero control violations.

  Signed: [Auditor Signature]
  Date: April 1, 2025
  Certificate ID: CERT-2025-Q1-001

  [QR code linking to certificate validation page]
  ```

---

#### Phase 5: Report Delivery (Day 13)

**Actor:** External Auditor, Founder Governor

**Step 5a: Deliver Report**
- Auditor sends report + attestation certificate to Founder
- Founder receives: PDF report, signed attestation, supporting evidence index

**Step 5b: Founder Reviews**
- Founder reads executive summary: "COMPLIANT, zero violations"
- Founder skims key findings: all green checkmarks
- Founder is pleased: "Great, audit went well"

**Step 5c: Archive Evidence**
- Founder downloads full audit report + supporting evidence
- Founder archives in compliance vault (for future reference, regulatory filings)

**Acceptance tests:**
- [x] Auditor could access all evidence without system access
- [x] Auditor verified tamper-evidence cryptographically
- [x] Auditor tested sample transactions and found 100% compliance
- [x] Auditor reviewed policy compliance and found zero violations
- [x] Auditor issued signed attestation certificate
- [x] Audit completed in 2 weeks with no follow-up questions
- [x] Report is suitable for regulatory submissions

---

## UJ-6: Scale-Up — System Proposes Expanding Capacity, Founder Approves

**Goal:** Based on P&L performance, system recommends infrastructure expansion, founder approves, and capacity scales automatically.

**Timeline:** 30 minutes (decision) + 7 days (implementation)

**Actors:** Founder Governor, Finance Controller, System

---

### Journey Map

```
Day 30: System Analyzes Portfolio
├─ System calculates: revenue growth, runway forecast, constraint analysis
└─ System identifies: agent pool is bottleneck for Research venture

Day 31: Expansion Recommendation
├─ System proposes: add 5 researchers to Research venture
├─ System shows: ROI analysis (payback in 2 weeks)
└─ System flags: requires $5000 additional GPU/compute capacity

Day 31 (afternoon): Founder Review
├─ Founder sees: recommendation is financially sound
├─ Founder approves expansion
└─ Finance Controller approves

Days 32-38: Implementation
├─ System spins up new compute capacity
├─ System deploys new agent instances
├─ System validates performance
└─ System monitors for issues

Day 39: Verification
├─ System shows: new capacity is active
├─ System shows: improved throughput
└─ Founder confirms: scale-up successful
```

---

### Detailed Steps

#### Phase 1: System Analyzes Portfolio (Day 30)

**Actor:** System

**Step 1a: Monthly Analysis Trigger**
- End of month (Day 30): system runs portfolio analysis job
- System analyzes: revenue, costs, margin, utilization, runway

**Step 1b: Identify Constraints**
- System finds:
  ```
  Portfolio Analysis Summary
  ═════════════════════════════════════

  Revenue Summary:
  - Total monthly revenue: $48,000 (up 10% from prev month)
  - Total monthly cost: $16,000
  - Total margin: $32,000 (66.7%)
  - Runway: 16 months (at current burn rate)

  Venture Performance:
  1. Research Reports: $18,000 revenue (↑ 20% growth) ⭐ TOP PERFORMER
     - Agents allocated: 1 orch, 9 researchers
     - Utilization: 95% (nearly maxed out)
     - Pending tasks: 8 (queue growing)
     - Estimated revenue lost (due to capacity): $3000/month
     - Constraint: agent pool too small

  2. Code Generation: $16,000 revenue (stable)
     - Agents allocated: 1 orch, 5 developers
     - Utilization: 60% (room to grow)

  3. Content Writing: $10,000 revenue (↑ 5% growth)
     - Agents allocated: 1 orch, 3 writers
     - Utilization: 75%

  4. AI Video Generation: $4,000 revenue (new, ramping up)
     - Agents allocated: 1 orch, 4 video agents
     - Utilization: 50%

  Constraint Analysis:
  ═════════════════════════════════════

  PRIMARY CONSTRAINT: Agent pool size for Research venture
  - Bottleneck: Research Reports tasks are queuing (8 pending)
  - Impact: estimated $3000/month in lost revenue
  - Root cause: researchers are fully utilized; can't accept more work
  - Solution: add 5 more researchers

  SECONDARY CONSTRAINT: Compute capacity for video generation
  - Bottleneck: GPU availability is tight (95% utilized)
  - Impact: video tasks take longer than needed
  - Root cause: shared GPU cluster is over-committed
  - Solution: expand GPU capacity by 50%

  OPPORTUNITY: Scale Code Generation venture
  - Observation: Code Gen has available capacity (only 60% utilized)
  - Opportunity: allocate more agents (currently under-resourced)
  - Expected impact: +$5000/month revenue with same cost structure

  Financial Feasibility:
  ═════════════════════════════════════

  Option 1: Add 5 researchers to Research venture
  - Capital cost: $2000/month (labor) + $1000/month (tools) = $3000/month
  - Revenue impact: +$3000/month (fill pending queue)
  - Payback period: immediate break-even + slight positive
  - Risk: low (proven venture)
  - Recommendation: ✓ APPROVE

  Option 2: Expand GPU cluster
  - Capital cost: $5000 one-time + $2000/month (usage)
  - Revenue impact: +$1000/month (faster video generation = more capacity)
  - Payback period: 7 months
  - Risk: medium (scaling unproven venture)
  - Recommendation: ⚠️ CONDITIONAL (pair with proven revenue growth for video)

  Option 3: Scale Code Generation
  - Capital cost: $1500/month (2 more agents)
  - Revenue impact: +$5000/month (move from 60% to 90% utilization)
  - Payback period: 4 weeks
  - Risk: low (proven venture)
  - Recommendation: ✓ APPROVE

  OVERALL RECOMMENDATION:
  ═════════════════════════════════════
  Option 1 + Option 3: Scale Research & Code Gen

  Combined investment: $4500/month additional
  Combined revenue impact: +$8000/month
  Combined payback: 3.4 weeks
  Combined margin improvement: +$3500/month

  This will:
  - Unlock $3000/month trapped in Research queue
  - Unlock $5000/month from Code Gen underutilization
  - Maintain 80%+ margins across all ventures
  - Extend runway (same burn rate but higher revenue)
  ```

---

#### Phase 2: Expansion Recommendation (Day 31)

**Actor:** System, Founder Governor

**Step 2a: System Issues Recommendation**
- System sends notification to Founder:
  ```
  📈 PORTFOLIO SCALING OPPORTUNITY
  System has identified high-ROI capacity expansion.

  Recommendation: Scale Research Reports & Code Generation

  Details:
  ├─ Research Reports: add 5 researchers (+$3000/month revenue)
  ├─ Code Generation: add 2 developers (+$5000/month revenue)
  └─ Investment: $4500/month additional cost

  ROI:
  - Revenue increase: +$8000/month
  - Cost increase: +$4500/month
  - Net margin increase: +$3500/month
  - Payback period: 3.4 weeks
  - Risk: LOW (both are proven ventures)

  Action required: Founder approval + Finance review

  [View Full Analysis] [Approve] [Request Changes] [Decline]
  ```

**Step 2b: Founder Reviews Recommendation**
- Founder clicks "View Full Analysis"
- Founder sees detailed breakdown (as shown above)
- Founder is convinced: "This is a no-brainer. Proven ventures, fast payback, low risk."
- Founder clicks "Approve"

**Step 2c: Finance Controller Reviews**
- Finance Controller receives notification: "Founder approved scaling recommendation"
- Finance Controller reviews:
  ```
  Scaling Review: Research Reports + Code Generation

  Financial Impact:
  - Monthly investment: +$4500 (agent labor + tools)
  - Monthly revenue upside: +$8000
  - Net monthly impact: +$3500 margin
  - Runway impact: +0.8 months (from 16 months to 16.8 months) ✓

  Risk Assessment:
  - Research Reports: proven venture, 100% of tasks approved on first try
  - Code Generation: proven venture, 95% customer satisfaction
  - Risk of venture failure: very low
  - If ventures underperform by 50%, still +$1500/month net positive

  Recommendation: APPROVE
  - Both ventures are market-proven
  - Payback is <1 month
  - Margin remains above 60%
  ```
- Finance Controller clicks "Approve"

**Step 2d: System Confirms Scaling**
- System receives approvals from Founder and Finance
- System creates scaling plan:
  ```
  Scaling Plan
  ═════════════════════════════════════

  Effective: May 1, 2025

  Changes:
  1. Research Reports venture
     - Agents: 1 orch + 9 researchers → 1 orch + 14 researchers
     - Budget cap: $1000/month → $1500/month
     - Capacity: ~8 reports/month → ~12 reports/month

  2. Code Generation venture
     - Agents: 1 orch + 5 developers → 1 orch + 7 developers
     - Budget cap: $2000/month → $2500/month
     - Capacity: ~6 projects/month → ~10 projects/month

  Implementation timeline:
  - May 1: Provision new agents, update policy budgets
  - May 2-3: Run parallel testing (old + new agents side-by-side)
  - May 4: Full cutover to new configuration
  - May 5-10: Monitor for issues, verify performance improvement
  ```

---

#### Phase 3: Implementation (Days 32–38)

**Actor:** System, Founder (monitoring)

**Step 3a: Provision New Capacity**
- System provisions: 5 new researchers, 2 new developers
- System allocates compute: GPU for video generation, CPU for code gen
- System deploys agent instances, validates health checks
- System emits event: `capacity.scaled.v1`

**Step 3b: Update Policy**
- System updates policy with new budget caps:
  ```yaml
  budgets:
    - id: "research_venture_monthly"
      scope: "venture:research-reports"
      cap: 1500  # increased from 1000

    - id: "code_generation_monthly"
      scope: "venture:code-generation"
      cap: 2500  # increased from 2000
  ```

**Step 3c: Run Parallel Testing**
- For 2 days (May 2-3), system runs both old and new agents
- System submits test tasks to both pools, compares results
- Verification: new agents perform at or above expected quality
- System shows: "New agents ready, quality validated ✓"

**Step 3d: Full Cutover**
- May 4: System switches all new tasks to expanded capacity
- System monitors: task queue depth, quality metrics, cost/task

---

#### Phase 4: Verification (Day 39)

**Actor:** Founder Governor

**Step 4a: Monitor Performance**
- Founder checks Portfolio dashboard on Day 39 (one week after scaling)
- Founder sees:
  ```
  Portfolio After Scaling
  ═════════════════════════════════════

  Research Reports:
  - Week 1 metrics: 10 reports completed (up from 6 before scaling)
  - Cost per report: $45 (maintained)
  - Revenue: $5000 (week 1)
  - Queue depth: 2 pending (down from 8)
  - Status: ✓ Scaling working, queue cleared

  Code Generation:
  - Week 1 metrics: 8 projects completed (up from 4 before scaling)
  - Cost per project: $150 (maintained)
  - Revenue: $4000 (week 1)
  - Utilization: 80% (up from 60%)
  - Status: ✓ Scaling working, more capacity used

  Overall impact:
  - Weekly revenue increase: +$4000 (10 reports + 2 projects)
  - Weekly cost increase: +$1200 (allocated agent labor)
  - Weekly margin improvement: +$2800
  - Annualized impact: +$145,600 margin
  ```

**Step 4b: Founder Confirms Success**
- Founder is satisfied: scaling is working as expected
- Founder notes: "Research queue cleared, Code Gen capacity is now well-utilized"
- Founder anticipates: portfolio will generate +$3500/month additional margin (as forecasted)

**Acceptance tests:**
- [x] System identified constraint (Research agent pool too small)
- [x] System quantified impact ($3000/month lost revenue)
- [x] System proposed financially sound expansion (3.4-week payback)
- [x] Founder and Finance reviewed and approved
- [x] New capacity was provisioned and validated
- [x] Performance metrics confirmed improvement
- [x] Scaling was transparent (founder monitored, understood impact)

---

## Summary of User Journeys

| Journey | Goal | Timeline | Key Success Criterion |
|---------|------|----------|----------------------|
| **UJ-1: Onboarding** | Deploy first venture from scratch | 7 days | First revenue achieved; policy enforced; $0 violations |
| **UJ-2: Portfolio Review** | Monitor & rebalance ventures | 15 min daily | Founder understands health, makes rebalancing decision in <5 min |
| **UJ-3: Crisis** | Detect & resolve spending anomaly | 35 min total | Anomaly detected in <5 min, resolved without losing unrelated ventures |
| **UJ-4: New Venture** | Launch new revenue stream | 8 days | First task completed autonomously; quality approved |
| **UJ-5: Audit** | External auditor verifies compliance | 2 weeks | Auditor issues signed attestation; zero findings |
| **UJ-6: Scale** | Expand capacity based on P&L | 2 days + 7 days | New capacity deployed; performance metrics confirmed |

These journeys provide an end-to-end narrative for how founders, auditors, and the system interact across the entire lifecycle of the Venture platform.
