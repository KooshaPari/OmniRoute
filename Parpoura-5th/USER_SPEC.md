# Venture-Autonomy User Specification

---

## Detailed Persona Profiles

### Persona A: Founder Governor

**Demographics**
- Age: 28–45
- Background: startup founder, engineering leader, or operations executive
- Technical level: advanced (comfortable with YAML, APIs, git workflows)
- Time available: 30 min–2 hours per day

**Goals**
1. Deploy AI agents that run autonomously, generating revenue without constant oversight
2. Define safety boundaries (budget caps, allowed actions, escalation rules) once, then trust the system to enforce them
3. Monitor venture performance with minimal friction; make portfolio decisions quickly
4. Scale to profitability without hiring more humans or raising venture capital

**Pain Points & Frustrations**
- **Fear of runaway spend**: Traditional tools offer no treasury layer; if something goes wrong, the damage is uncapped
- **Policy drift**: Hard to know if the system is still following the rules as the operation evolves
- **Black-box behavior**: Agents take actions, but the founder can't easily answer "why did that happen?"
- **Manual oversight**: Every decision requires approval, defeating the purpose of automation
- **Lack of trust**: Can't prove to external stakeholders (investors, customers, regulators) that the system is operating safely

**Success Criteria**
- Ventures run autonomously under policy for 7+ consecutive days with zero policy violations
- Revenue exceeds operational burn rate within 30 days of venture launch
- No more than 1 manual intervention required per 100 autonomous decisions
- Founder can make a portfolio rebalancing decision in under 5 minutes using the dashboard
- Full audit trail exists for any decision; founder can prove safety to auditors in <30 min

**Daily Workflow**
1. **Morning (5–10 min)**: Check portfolio dashboard—revenue trends, any alerts
2. **Mid-day (as-needed)**: Respond to critical incidents (budget overrun, policy violation)
3. **Weekly (30 min)**: Review policy compliance, rebalance ventures if needed
4. **Monthly (1 hour)**: Strategy review—should we expand, pause, or pivot any ventures?

---

### Persona B: Operations Auditor

**Demographics**
- Age: 30–50
- Background: compliance officer, internal auditor, or operations manager
- Technical level: intermediate (comfortable with logs, SQL queries, audit tools)
- Time available: 1–4 hours per day

**Goals**
1. Verify that agents only took actions permitted by founder policy
2. Detect anomalies early (unusual spend, unexpected agents, new tool usage)
3. Generate compliance evidence for internal audits and external reviews
4. Support incident investigation and post-mortems

**Pain Points & Frustrations**
- **Manual correlation**: Logs are produced, but correlating decisions across multiple systems is tedious
- **Silent failures**: Policy violations might go undetected if not explicitly logged
- **Incomplete provenance**: Hard to answer "why did the system do X?" without deep technical investigation
- **Evidence gaps**: Collecting evidence for audits is time-consuming and error-prone
- **External audit burden**: External auditors ask for evidence, but we can't provide it in a standardized format

**Success Criteria**
- Can reproduce any agent decision in under 2 minutes (find policy rule, inputs, outputs, approvals)
- Monthly compliance report is generated in under 1 hour with full evidence chain
- Anomalies are detected and escalated on the same day as occurrence
- External auditors can review evidence without requiring direct system access
- Zero audit findings related to policy violations or missing evidence

**Weekly Workflow**
1. **Daily (15 min)**: Check alerts—any anomalies, policy violations, or incidents?
2. **Weekly (1–2 hours)**: Deep dive—query audit trail, investigate any red flags
3. **Monthly (2–3 hours)**: Generate compliance report, attach evidence bundles
4. **As-needed (30 min–2 hours)**: Support incident investigation or external audit request

---

### Persona C: Finance Controller

**Demographics**
- Age: 35–55
- Background: CFO, financial analyst, or accounting manager
- Technical level: intermediate (Excel, accounting software, API basics)
- Time available: 1–3 hours per day

**Goals**
1. Ensure budgets are realistic and enforced in real-time (no overruns)
2. Reconcile autonomous spend against bank statements daily
3. Optimize the venture portfolio for margin and risk
4. Prepare financial statements and audit-ready spend ledgers

**Pain Points & Frustrations**
- **Budget overruns**: If there's no real-time enforcement, runaway ventures consume reserves unchecked
- **Reconciliation delays**: Manual matching of internal ledger to bank statements is slow and error-prone
- **Poor spend visibility**: Hard to trace spend to specific ventures, decisions, or justifications
- **Risk blindness**: Limited insight into venture performance; hard to identify underperformers early
- **Compliance risk**: External auditors ask for spend justification; hard to provide without full context

**Success Criteria**
- Budget caps are enforced before transactions execute (zero overruns)
- Daily reconciliation completes in under 10 minutes with less than $0.01 drift
- Can drill into any transaction and see: venture, decision rule, approval chain, business justification
- Monthly P&L and venture margin analysis are auto-generated and ready for executive review
- Can present spend/revenue data to external auditors with full supporting evidence in under 30 minutes

**Daily Workflow**
1. **Morning (10–15 min)**: Check treasury firewall—any spend above thresholds, reconciliation issues?
2. **Midday (as-needed)**: Approve/review high-value spend approvals pending founder sign-off
3. **End of day (10 min)**: Run daily reconciliation, verify ledger matches bank statements
4. **Weekly (1 hour)**: Venture margin analysis, cost optimization review
5. **Monthly (2–3 hours)**: P&L, audit readiness, budget planning for next month

---

### Persona D: Venture Manager

**Demographics**
- Age: 25–40
- Background: product manager, project manager, or operations specialist
- Technical level: intermediate (comfortable with dashboards, basic SQL, task management)
- Time available: 2–6 hours per day

**Goals**
1. Maximize revenue for assigned venture(s) within policy constraints
2. Identify and eliminate bottlenecks in the venture's task workflow
3. Propose new ventures or venture types based on market demand
4. Mentor team members on venture best practices and scaling strategies

**Pain Points & Frustrations**
- **Limited visibility**: Hard to see why a venture is underperforming (slow agents? bad market fit? high costs?)
- **Manual interventions**: Some decisions require founder approval, slowing execution
- **Knowledge gaps**: Best practices for running ventures aren't documented; learning is trial-and-error
- **Resource contention**: Can't easily see if agent capacity is available or overallocated
- **Unclear ROI**: Hard to forecast revenue growth or justify scaling investments

**Success Criteria**
- Assigned venture(s) achieve target revenue within 60 days of launch
- Can identify top 3 optimization opportunities in under 30 minutes using venture dashboard
- Proposes at least one new venture per quarter based on market data
- Mentors new venture managers; mentees achieve profitability in under 90 days
- Reduces average cost-per-output by 5–10% per quarter through process optimization

**Daily Workflow**
1. **Morning (30 min)**: Check assigned venture dashboards—revenue trends, any blockers?
2. **Throughout day (1–2 hours)**: Unblock agents, adjust task priorities, communicate with stakeholders
3. **3x weekly (2–3 hours)**: Deep dive into venture performance, identify optimization opportunities
4. **Weekly (1 hour)**: Mentor new venture managers, share learnings across ventures
5. **Monthly (2 hours)**: Strategic planning—new ventures, resource allocation, forecasting

---

### Persona E: External Compliance Reviewer

**Demographics**
- Age: 35–60
- Background: external auditor, regulatory consultant, or compliance analyst
- Technical level: intermediate to advanced (comfortable with system documentation, cryptographic verification)
- Time available: 2–8 hours (as-needed, usually once per quarter)

**Goals**
1. Verify the venture is following declared policies and legal obligations
2. Collect evidence for regulatory submissions (SOC 2, ISO 27001, GDPR assessments, etc.)
3. Assess risk and identify gaps in governance or controls
4. Build confidence that the venture is trustworthy and compliant

**Pain Points & Frustrations**
- **Data silos**: Evidence is scattered across multiple systems; have to request it from multiple teams
- **Incomplete records**: Older evidence is hard to find, or has been deleted
- **Manual validation**: Reviewing and validating evidence is slow and error-prone
- **Reproducibility**: Hard to verify that evidence hasn't been tampered with after the fact
- **Time burden**: Audits are expensive; collecting evidence takes weeks

**Success Criteria**
- Can download complete evidence chain for any time period in under 5 minutes
- Policy versions and event logs are tamper-evident (digitally signed, checksummed)
- Audit trail is continuous with no gaps or missing data
- Can validate evidence cryptographically without needing to access the live system
- Quarterly audit completeness in under 2 weeks, with all questions answered from self-service documentation

**Audit Workflow**
1. **Kick-off (2–4 hours)**: Understand business model, review declared policies, identify scope
2. **Evidence collection (4–8 hours)**: Download evidence bundles, validate tamper-evidence, spot-check data
3. **Analysis & testing (4–8 hours)**: Query audit trails, verify policy compliance, identify any gaps
4. **Report generation (2–4 hours)**: Compile findings, recommendations, attestation certificate
5. **Follow-up (as-needed)**: Respond to questions, help management address any gaps

---

## Core User Flows (Expanded)

### Flow 1: Define Policy Constitution → Publish → Lock Version

**Actors:** Founder Governor, Finance Controller

**Trigger:** New venture launch, quarterly policy review, incident-driven policy change

**Preconditions:**
- Founder has identified a new business opportunity (or is reviewing existing policy)
- Finance Controller is available to review and approve
- Previous policy version (if updating) is locked and documented

**Steps:**

1. **[Founder] Open policy editor**
   - Click "New Policy Version" or "Edit Current Policy"
   - System loads current policy in YAML editor with syntax highlighting
   - Auto-complete suggests policy keys and values
   - System shows recent policy changes as comments

2. **[Founder] Define budget caps**
   - Add/update `budgets` section:
   ```yaml
   budgets:
     - id: "research_venture_daily"
       scope: "venture:research-reports"
       cap: 500
       currency: "USD"
       window: "daily"
       escalation: "notify_finance"
   ```
   - System validates: cap is positive, window is valid (daily/weekly/monthly), escalation target exists

3. **[Founder] Define tool allowlists**
   - Add/update `tool_allowlists` section:
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
   - System warns if researcher is allowed to call `io.write` (potential data leak)
   - System checks: all referenced roles exist, all referenced tools exist

4. **[Founder] Define escalation rules**
   - Add/update `escalations` section:
   ```yaml
   escalations:
     - trigger: "spend_above_100"
       condition: "transaction_amount > 100"
       action: "notify_founder"
       timeout_hours: 2
     - trigger: "policy_violation"
       condition: "policy_check_failed"
       action: "freeze_workflow"
       notify: ["founder", "finance_controller"]
   ```
   - System simulates: shows what would trigger this rule based on recent transactions

5. **[Founder] Define jurisdiction & data handling rules**
   - Add/update `compliance` section:
   ```yaml
   compliance:
     jurisdictions_allowed: ["US", "CA", "GB"]
     jurisdictions_forbidden: ["CN", "RU"]
     data_retention_days: 90
     dsar_sla_days: 30
   ```
   - System validates against known regulatory requirements

6. **[Founder] Preview policy in natural language**
   - Click "Preview Policy" button
   - System generates human-readable version:
     ```
     This venture can:
     - Spend up to $500/day on API calls for market research
     - Dispatch workflows using the orchestrator agent
     - Fetch web content using the researcher agent
     - Use only agents in the US, Canada, and UK

     If spending exceeds $100 in a single transaction, the founder will be notified and must approve within 2 hours.
     If a policy rule is violated, the workflow will freeze and both the founder and finance controller will be notified.
     ```
   - Review for clarity; adjust policy if needed

7. **[Founder] Detect conflicts**
   - System highlights potential conflicts:
     - "researcher role can fetch_web but not write_data; is this intentional?"
     - "budget window is 'daily' but escalation timeout is '2 hours'; consider alignment"
   - Founder reviews and resolves conflicts, or acknowledges them as intentional

8. **[Founder] Commit policy to version control**
   - Click "Propose Policy Change"
   - System creates a git commit with the policy YAML and a summary of changes
   - Commit message: "Policy: add research-venture budget cap and researcher tool allowlist"
   - System generates a short-sha hash (e.g., `a1b2c3d`) for reference in events

9. **[Finance Controller] Review & approve**
   - Email notification: "Policy change proposed by Founder, requires your review"
   - Click link to review interface
   - System shows: diff of policy changes, natural language preview, recent incidents that would be affected by this policy
   - Finance Controller reviews and either approves or requests changes
   - System tracks: who reviewed, timestamp, approval signature

10. **[Founder] Address feedback (if needed)**
    - If Finance Controller requested changes, return to step 2 and edit policy
    - System shows Finance Controller's comments inline
    - Propose new version; Finance Controller reviews again
    - Repeat until approved

11. **[Founder] Lock policy version**
    - Click "Publish Policy"
    - System commits policy to immutable policy registry
    - Policy is now active; all subsequent decisions use this policy version
    - System generates timestamp and cryptographic signature
    - Ledger entry created: `policy.published.v1` event with commit hash

12. **System outcomes**
    - Policy is locked and immutable
    - All subsequent workflows use this policy version
    - Audit trail shows: who proposed, who approved, exact policy text, timestamp
    - Can be reverted only by creating a new policy version (no silent edits)

**Error paths:**

- **Syntax error in YAML**: System highlights line, shows error message, prevents submission
- **Undefined escalation target**: System shows error "escalation.notify_founder references undefined role 'founder'" and prevents submission
- **Circular budget cap logic**: System detects and warns (e.g., "daily cap is $100 but monthly cap is $90; daily can exceed monthly")
- **Finance Controller rejects policy**: Founder is notified; can request specific changes or propose alternative policy

---

### Flow 2: Submit Objective → Compile DAG → Execute Autonomous Run

**Actors:** Founder Governor, Venture Manager, System (Orchestrator agent, Researcher agents)

**Trigger:** Founder decides to launch a new venture, or manually submits a task

**Preconditions:**
- Policy is published and locked
- At least one agent pool is available (orchestrators, researchers, etc.)
- Customer request or business objective is defined
- Budget is available and within policy limits

**Steps:**

1. **[Venture Manager] Define objective**
   - Click "New Venture" or "New Task"
   - Fill form:
     ```
     Objective: "Produce 5 market analysis reports on AI safety startups"
     Venture type: "Research Reports"
     Budget allocated: $500
     Deadline: "March 31, 2025"
     Success criteria: "Reports meet customer quality standards; delivered on time; cost <$100 per report"
     Customer contact: "alex@customer.com" (optional)
     ```
   - System creates a task envelope:
     ```json
     {
       "task_id": "task_abc123",
       "workflow_id": "workflow_xyz789",
       "task_type": "venture:research-reports",
       "input": {
         "num_reports": 5,
         "topic": "AI safety startups",
         "budget": 500,
         "deadline": "2025-03-31"
       },
       "created_at": "2025-03-15T10:00:00Z",
       "agent_role": "orchestrator"
     }
     ```
   - System validates task schema against known task types
   - System injects trace_id and workflow_id for audit trail

2. **[System] Validate objective against policy**
   - System checks policy bundle:
     - Is task_type "research-reports" allowed? ✓
     - Is budget ($500) within daily/weekly/monthly cap? ✓
     - Will this task require agents in permitted jurisdictions? ✓
   - If any check fails, system rejects and returns reason code (e.g., "budget_exceeds_monthly_cap")
   - If manual gate required (high risk or high cost), system creates approval task for Founder

3. **[System] Compile DAG**
   - Orchestrator agent receives task
   - Orchestrator breaks down objective into sub-tasks:
     ```
     Task 1: Research AI safety startups (broad market scan)
       ├── Sub 1a: Identify top 20 startups (web search, researcher agent)
       ├── Sub 1b: Gather funding & team data (web scrape, researcher agent)
       └── Sub 1c: Compile initial report (researcher → draft document)
     Task 2: Deeper analysis on selected startups
       ├── Sub 2a: Interview preparation (outline, researcher)
       ├── Sub 2b: Simulate outreach email (researcher)
       └── Sub 2c: Analyze customer reviews (web search, researcher)
     Task 3: Synthesis & quality check
       ├── Sub 3a: Integrate findings (researcher → document)
       ├── Sub 3b: Fact-check & validate sources (researcher)
       └── Sub 3c: Final report generation (formatter agent → PDF/markdown)
     ```
   - System represents as DAG: nodes = tasks, edges = dependencies
   - System estimates: time required per task, compute cost, API calls needed
   - System checks estimates against budget: if over-budget, breaks down into smaller chunks or parallelizes

4. **[Venture Manager] Review DAG (optional)**
   - Orchestrator publishes DAG visualization
   - Venture Manager can see task breakdown, estimated costs, timeline
   - May suggest changes: "Can tasks 1a and 1b run in parallel to save time?" or "Task 2b seems over-scoped, reduce it"
   - System recalculates costs/timeline with changes and re-validates against budget
   - Venture Manager approves DAG or requests refinement

5. **[System] Authorize spend for DAG**
   - System creates `money_intent` for total budget required:
     ```json
     {
       "money_intent_id": "intent_def456",
       "venture_id": "research-reports",
       "total_amount": 500,
       "currency": "USD",
       "merchant_category": "api_calls",
       "ttl_seconds": 3600,
       "task_id": "task_abc123",
       "policy_version": "a1b2c3d"
     }
     ```
   - System checks authorization against policy:
     - Is $500 within the daily cap for research-reports? ✓
     - Policy rule: "research_venture_daily" permits up to $500/day
     - Decision: ✓ APPROVED
   - System emits event: `money.authorization.decided.v1`
     ```json
     {
       "event_id": "event_ghi789",
       "event_type": "money.authorization.decided.v1",
       "trace_id": "trace_abc123",
       "workflow_id": "workflow_xyz789",
       "payload": {
         "money_intent_id": "intent_def456",
         "decision": "approved",
         "policy_rule": "research_venture_daily",
         "amount": 500,
         "timestamp": "2025-03-15T10:05:00Z"
       }
     }
     ```
   - Ledger is updated: money is escrowed against this task
   - If authorization fails, system sends escalation notification and task is queued for manual review

6. **[System] Execute DAG in stages**
   - Stage 1: Prepare (verify agents are available, provision compute resources)
   - Stage 2: Execute tasks in dependency order, respecting parallelism
   - As each task completes, system:
     - Records outputs (artifacts, logs, decisions)
     - Tracks costs (API calls, compute time)
     - Emits event: `task.completed.v1`
     - Checks for errors; if found, escalates or retries per policy
   - System monitors spend: if costs exceed estimate, alerts Venture Manager

7. **[System] Quality assurance & validation**
   - As reports are generated, system checks:
     - Does each report have the required sections? (intro, findings, recommendations, sources)
     - Are sources cited and verified?
     - Is the report readable (no garbled text, proper formatting)?
   - If quality checks fail, system re-runs the task or escalates to Venture Manager

8. **[System] Finalize run**
   - All tasks completed
   - System generates final run summary:
     ```json
     {
       "workflow_id": "workflow_xyz789",
       "status": "completed",
       "tasks_completed": 15,
       "total_cost": 487.23,
       "budget_allocated": 500,
       "margin": 12.77,
       "artifacts_generated": 5,
       "quality_checks_passed": 5,
       "timestamp": "2025-03-20T14:30:00Z"
     }
     ```
   - Artifacts are stored and tagged with workflow_id, trace_id, policy_version
   - Ledger is settled: escrowed funds are converted to actual spend

9. **[System] Emit completion event**
   - System publishes: `workflow.completed.v1` event with full execution summary
   - Founder, Finance Controller, and Venture Manager are notified
   - Summary shows: objective achieved, cost vs budget, quality metrics, next steps

10. **[Venture Manager] Review outcomes**
    - Venture Manager reviews reports and quality scores
    - Marks reports as "ready for delivery" or "needs revision"
    - If revision needed, creates new task for refinement (costs come from remaining budget)
    - Once approved, reports are delivered to customer

11. **System outcomes**
    - Objective completed within budget and policy constraints
    - All intermediate states recorded in event log
    - Artifacts are versioned and tagged with policy version, trace_id, workflow_id
    - Ledger shows: spend authorized, spent, and settled
    - Audit trail is complete: can replay the entire workflow from event log

**Error paths:**

- **Task fails mid-execution**: System catches error, logs it, retries with backoff per policy, or escalates to Venture Manager
- **Spend exceeds estimate**: System alerts Venture Manager; if approaching cap, pauses and waits for approval to continue
- **Quality check fails**: System re-runs task, or escalates if repeated failures
- **Agent unavailable**: System queues task and retries when agent becomes available
- **Customer cancels**: Venture Manager marks task as cancelled; Ledger refunds unused portion of budget

---

### Flow 3: Review Run Outcomes → Approve Safe Continuations

**Actors:** Founder Governor, Operations Auditor, Finance Controller

**Trigger:** Workflow completion, anomaly detection, escalation event, or scheduled compliance review

**Preconditions:**
- Workflow has completed or encountered an issue
- Founder/Finance has time to review
- Previous policy is locked and audit trail is available

**Steps:**

1. **[System] Detect completion or anomaly**
   - If workflow completed normally: send completion notification to Founder
   - If anomaly detected (cost overrun, policy violation, quality issue): send escalation notification
   - Notification includes: quick summary, link to detailed outcomes, any required approvals

2. **[Founder] Receive notification**
   - Email: "Workflow workflow_xyz789 completed: 5 reports generated, cost $487.23 (within budget)"
   - Or alert: "Spend anomaly detected: task_jkl012 exceeded estimate by 50%. Current spend: $750 / cap: $500. Approve continuation?"
   - Click link to view full outcomes

3. **[Founder] Review outcomes dashboard**
   - See workflow execution summary:
     ```
     Workflow: "5 AI Safety Market Reports"
     Status: COMPLETED
     Started: 2025-03-15 10:00 AM
     Ended: 2025-03-20 2:30 PM
     Duration: 5 days 4 hours 30 min

     Results:
     - Tasks completed: 15/15
     - Artifacts generated: 5 reports
     - Quality score: 4.8/5
     - Cost: $487.23 / $500 allocated

     Spend breakdown:
     - API calls (web search): $250
     - Compute (agent execution): $200
     - Storage: $30
     - Processing fees: $7.23

     Policy compliance: ✓ All checks passed
     - Budget cap: $487.23 < $500 daily cap ✓
     - Tool usage: within allowlist ✓
     - Jurisdiction: all agents in permitted regions ✓
     ```

4. **[Founder] Drill down on specific aspects**
   - Click "Artifacts" to see generated reports and quality scores
   - Click "Cost breakdown" to see where money was spent
   - Click "Audit trail" to see detailed event log (what each agent did, when)
   - Click "Policy compliance" to see which rules were checked and passed

5. **[Founder] Check for issues**
   - System highlights any warnings:
     - "Quality score for Report 3 is 4.2/5; customer may request revision"
     - "Spend accelerated on day 4; consider investigating agent efficiency"
     - "One task failed and was retried; see details"
   - Founder can investigate further or proceed

6. **[Operations Auditor] (optional) Review for anomalies**
   - If workflow involved high spend or risky actions, auditor reviews in parallel
   - Auditor checks: were all decisions within policy? Are there any concerning patterns?
   - Auditor can flag any issues to Founder or Finance Controller

7. **[Founder] Approve continuation**
   - If outcomes look good and policy was followed: click "Approve for Delivery"
   - System records approval: `founder_approval.v1` event with founder's signature
   - Artifacts are released to customer (or staged for delivery)
   - Venture metrics are updated: this venture now has 5 completed reports, $487.23 cost, ~$2500 revenue (customer payment)

8. **[Founder] Request refinement (if needed)**
   - If quality score is low or issue was found: click "Request Refinement"
   - System creates a new refinement task with budget from remaining allocation
   - Workflow is updated and re-run
   - Loop back to step 1

9. **[Finance Controller] Review financials (daily or on request)**
   - Finance Controller sees: spend is within cap, no policy violations
   - Finance Controller checks: does cost per report ($97.45) match expectations?
   - If concern: Finance Controller flags for review
   - If all looks good: Finance Controller approves venture financials for accounting

10. **[System] Update venture metrics**
    - Venture performance is updated:
      ```
      Venture: "Research Reports"
      YTD Revenue: $2500 (5 reports × $500)
      YTD Cost: $487.23
      YTD Margin: $2012.77 (80.5% margin)
      Cost per report: $97.45
      Avg quality score: 4.8/5
      Repeat rate: 100% (all reports approved)
      ```
    - Dashboard is updated in real-time
    - If margin is high, system may recommend scaling: "This venture is highly profitable; consider allocating more agents"

11. **System outcomes**
    - Workflow is marked APPROVED and outcomes are final
    - Artifacts are archived and immutable
    - Ledger is settled and reconciled
    - Venture metrics are updated for portfolio analysis
    - Audit trail is complete and tamper-evident

**Error paths:**

- **Quality issues found**: Founder can request refinement (costs come from remaining budget) or accept as-is and document the issue
- **Policy violation detected**: System escalates to Finance Controller and Operations Auditor; Founder must review and approve exception (rare)
- **Cost overrun**: If spend exceeded budget, system already prevented it (thanks to authorization layer); Founder can approve additional budget or cancel remaining tasks
- **Agent error**: If an agent made a mistake, system can re-run the task or escalate for manual investigation

---

### Flow 4: Trigger Freeze/Rollback on Policy or Risk Breaches

**Actors:** Founder Governor, Finance Controller, System (Compliance Evaluator)

**Trigger:** Policy violation detected, budget overrun, or founder manually initiates freeze

**Preconditions:**
- A breach condition has occurred or is imminent
- Founder or Finance Controller has authority to freeze workflows
- System has ability to pause ongoing tasks

**Steps:**

1. **[System] Detect breach condition**
   - System continuously monitors for breach triggers:
     - Spend velocity exceeds 2x historical baseline
     - Policy rule evaluation fails (unauthorized tool, forbidden jurisdiction)
     - Budget cap exceeded
     - Quality metric drops below threshold
     - Unauthorized access attempt
   - When breach is detected, system creates incident record and emits alert

2. **[System] Emergency notification**
   - System sends high-priority alert:
     ```
     🚨 FREEZE TRIGGERED
     Incident: Policy violation detected
     Severity: High

     Details:
     - Task task_mno345 attempted to call tool "send_payment" without authorization
     - Policy rule "researcher_tool_allowlist" prohibits this tool for researcher role
     - Workflow workflow_pqr678 is paused

     Actions taken:
     - All active tasks in workflow paused
     - No new tasks will start
     - Spend is frozen; no more transactions will be authorized

     Next steps:
     - Review the incident (link below)
     - Determine root cause
     - Approve resumption or rollback
     ```
   - Notification sent to: Founder, Finance Controller, Operations Auditor (immediate)
   - Notification also sent to escalation contacts (if defined in policy)

3. **[Founder] Review incident**
   - Click link to incident dashboard
   - System shows:
     ```
     Incident ID: incident_stu901
     Classification: Policy Violation (Tool Misuse)
     Severity: High
     Detected: 2025-03-22 03:45 PM
     Status: FROZEN

     Breach Details:
     - Agent: researcher_agent_2
     - Attempted action: send_payment to stripe.com, amount $2000
     - Policy rule: "researcher_tool_allowlist" restricts researcher to ["web.fetch", "io.read"]
     - Authorization decision: DENIED
     - Reason: Tool "send_payment" not in researcher allowlist

     Root cause analysis (preliminary):
     - Researcher agent was trying to complete a payment task that should have been routed to orchestrator
     - Likely cause: DAG routing error or incorrect task assignment

     Tasks affected:
     - workflow_pqr678: 4 active tasks paused

     Rollback options:
     1. Resume: Approve agent fix and resume tasks
     2. Revert: Undo changes from past N hours; go back to known good state
     3. Investigate: Pause and investigate; decide later
     ```

4. **[Founder] Investigate root cause**
   - Click "Audit trail" to see:
     - All events leading up to the breach
     - Which agent made the decision
     - What policy rules were checked
     - Why the tool call was attempted (what task was it trying to complete?)
   - Example audit trail:
     ```
     task_uvw123 started (market research)
     task_uvw123 > sub_task_a started (web research)
     task_uvw123 > sub_task_a completed (scraped 50 sources)
     task_uvw123 > sub_task_b started (process payments for data access)
       <- ERROR: researcher agent routed to payment task (should be orchestrator)
       <- sub_task_b attempted send_payment
       <- Policy check: send_payment NOT in researcher_tool_allowlist
       <- Authorization DENIED
       <- Freeze triggered
     ```
   - Founder reviews and identifies: "Sub-task routing error. Researcher agent should have passed payment task to orchestrator."

5. **[Founder] Decide on remediation**
   - **Option A: Resume with fix**
     - Click "Fix and Resume"
     - System shows: "Fix sub-task_b routing (send to orchestrator instead of researcher)"
     - Founder reviews fix (policy/system makes the change)
     - Founder clicks "Approve fix and resume"
     - System resumes workflow with correction applied

   - **Option B: Revert and replay**
     - Click "Revert to checkpoint"
     - System shows available checkpoints (hourly snapshots)
     - Founder selects: "Revert to 03:00 PM checkpoint" (before the error)
     - System rolls back task state, refunds escrowed spend, clears partial outputs
     - Founder reviews policies or DAG, makes changes, re-submits

   - **Option C: Investigate and pause**
     - Click "Keep frozen, investigate"
     - System remains paused; no automatic resumption
     - Founder can investigate at own pace
     - Finance Controller is notified (spend is frozen, budget is reserved)

6. **[Finance Controller] Monitor impact**
   - Finance Controller reviews impact:
     ```
     Freeze Impact Report:
     - Workflow: workflow_pqr678
     - Status: FROZEN since 03:45 PM
     - Tasks paused: 4 (sub_task_b, task_xyx456, ...)
     - Spend at freeze: $450 / $500 budget
     - Remaining budget: $50 (if resumed)
     - Rollback cost: -$450 (if reverted)

     Recommendation: This appears to be a routing error. Fix is straightforward.
     Cost to resume: minimal additional spend to complete retried task.
     Cost to revert: lose 4 hours of progress, restart tasks from checkpoint.
     ```
   - Finance Controller approves/recommends course of action to Founder

7. **[Founder] Execute remediation**
   - Founder clicks "Approve fix and resume" (assuming option A)
   - System makes change (routing sub-task_b to orchestrator)
   - System updates ledger: records the fix, policy version, founder approval
   - System emits event: `freeze.resolved.v1` with remediation details
   - System resumes workflow; paused tasks restart

8. **[Operations Auditor] Post-incident review**
   - After workflow completes, auditor reviews incident for patterns
   - Question: "Why did task routing fail? Is this a systemic issue?"
   - Auditor recommends: "Implement additional validation to catch routing errors before execution"
   - Founder considers policy update: add pre-execution task validation before routing to agents

9. **System outcomes**
    - Freeze is resolved
    - Incident is fully documented (breach, investigation, remediation, approval)
    - Audit trail shows: what happened, why, how it was fixed, who approved
    - Ledger is updated: spend corrected, checkpoint cleared
    - If systemic issue: founder may update policy/DAG compilation logic to prevent recurrence

**Error paths:**

- **Founder can't determine root cause**: System provides diagnostic tools (trace logs, agent decision history) to help
- **Rollback not possible** (e.g., task has external side effects): Founder must manually investigate and decide; escalate to Finance/Auditor if needed
- **Repeated freeze**: If same incident occurs multiple times, system suggests policy change; Founder makes strategic decision
- **Unrelated freeze during investigation**: If freeze is triggered by different issue while investigating, system queues it and alerts Founder of compounded incidents

---

## UX Requirements (Detailed)

### 1. Explainable Decisions for Each High-Impact Action

**Requirement:** Every decision that involves spend, policy evaluation, or artifact generation must be explainable to a non-technical user in under 2 minutes.

**Implementation:**
- Every high-impact decision includes a "Why" explanation in plain English:
  ```
  Decision: Approved spend of $150 for API calls

  Why: Policy rule "research_venture_daily" (version a1b2c3d) allows up to $500/day spend.
  Current spend today: $350. This transaction: $150.
  Total if approved: $500 (exactly at cap).

  Policy rule source: Founder locked this policy on 2025-03-01 10:00 AM.
  Approved by: Founder, Finance Controller.
  ```

- Decision UI shows:
  - Clear statement of what was approved and why
  - Link to policy rule (founder can review exact rule text)
  - Timestamp and approval chain
  - Link to similar recent decisions (shows pattern)

### 2. One-Click Provenance Chain for Every Artifact and Spend Event

**Requirement:** Any artifact or spend event must have a complete trace from initial objective to final output.

**Implementation:**
- Every artifact page includes a "Provenance" tab:
  ```
  Report: "AI Safety Startups Q1 2025"

  Provenance Chain:
  1. Objective submitted: 2025-03-15 10:00 AM
     - By: venture_manager_alice
     - Input: { topic: "AI safety startups", budget: $500, deadline: "2025-03-31" }

  2. DAG compiled: 2025-03-15 10:05 AM
     - Policy check: PASSED (policy version a1b2c3d)
     - Estimated cost: $450, time: 5 days

  3. Spend authorized: 2025-03-15 10:06 AM
     - Authorization: money.authorization.decided.v1
     - Amount: $500, currency: USD
     - Policy rule: research_venture_daily (allows up to $500/day)

  4. Execution started: 2025-03-15 10:15 AM
     - Assigned to: orchestrator_1, researcher_2, researcher_3
     - Workflow ID: workflow_xyz789, Trace ID: trace_abc123

  5. Execution completed: 2025-03-20 2:30 PM
     - Tasks completed: 15/15
     - Cost actual: $487.23 (vs $450 estimated)
     - Quality score: 4.8/5

  6. Approval: 2025-03-20 3:00 PM
     - Approved by: venture_manager_alice
     - Status: APPROVED FOR DELIVERY

  [Export full event log (JSON)] [Export evidence bundle (ZIP)]
  ```

- Every spend event is similarly traceable:
  ```
  Transaction: API call to stripe.com
  Amount: $25
  Timestamp: 2025-03-18 11:23 AM

  Provenance:
  - Task: market_research_subtask_2
  - Reason: Fetch competitor pricing data
  - Authorization: APPROVED (under budget cap)
  - Policy rule: research_venture_daily (allows $500/day)
  - Ledger entry: ledger_entry_4567
  - Bank reconciliation: Matched to Stripe statement on 2025-03-19
  ```

### 3. Clear Kill-Switch and Emergency Operations

**Requirement:** Founder can freeze/kill any workflow with one click; all state is preserved for recovery.

**Implementation:**
- Kill-switch UI is always visible (top-right corner of any workflow view):
  ```
  [FREEZE WORKFLOW] [KILL WORKFLOW] [ROLLBACK]
  ```

- **FREEZE**: pauses all active tasks, stops new task starts, prevents spend, preserves state
- **KILL**: stops all tasks, marks workflow as terminated, no further action
- **ROLLBACK**: returns to last checkpoint (hourly snapshots), refunds spend, clears outputs

- Emergency procedures document:
  - How to freeze (1 click)
  - How to investigate (see incident dashboard)
  - How to resume or rollback (approve/click)
  - How to report incident (automatically reported to Finance/Auditor)

### 4. Separate Governance from Execution Privileges

**Requirement:** Policy decisions (what can happen) are made by governance roles; execution decisions (make it happen) are separate and logged.

**Implementation:**
- **Governance roles:**
  - Founder Governor: defines policy, approves exceptions, makes strategic decisions
  - Finance Controller: approves budgets, monitors spend, approves major initiatives
  - Operations Auditor: reviews compliance, investigates anomalies

- **Execution roles:**
  - Orchestrator agent: routes tasks, compiles DAGs, authorizes downstream actions
  - Researcher agents: execute research tasks, call web APIs
  - Solver agents: process data, generate artifacts
  - Formatter agents: compile artifacts into final output

- **Separation enforced by:**
  - Tool allowlists: agents can only call permitted tools; they cannot change policy
  - Policy bundles: governance decisions are versioned and immutable; agents follow the version active at task start
  - Event sourcing: all decisions are logged with actor (governance role or agent), timestamp, and outcome
  - Manual gates: high-risk decisions wait for governance approval before agents execute

---

## Accessibility and Observability Requirements

### Accessibility

1. **Screen reader support**: All UI elements have ARIA labels; dashboard is navigable via keyboard
2. **Color contrast**: Policy editor, dashboards meet WCAG AAA standards
3. **Mobile-friendly**: Dashboard works on mobile (phone/tablet) for on-call scenarios
4. **Error messages**: Clear, jargon-free, actionable (not "Error 500"; instead "The daily budget cap was exceeded. Click here to approve additional spend or pause this venture.")

### Observability

1. **Metrics dashboard**: Founder can see real-time metrics:
   - Agents active, idle, error
   - Compute utilization (%), API quota remaining, storage used
   - Revenue/hour, cost/hour, margin trend

2. **Alerting**:
   - Policy violations: immediate alert to Founder
   - Budget approaching cap: alert 1 hour before crossing threshold
   - Agent errors: aggregate and summarize (e.g., "Researcher 2 has 3 errors in past hour")
   - Quality issues: alert if quality score drops below threshold

3. **Audit logs**: Every action is logged with:
   - Actor (human user or agent)
   - Action (e.g., "authorized spend", "completed task")
   - Timestamp (ISO 8601)
   - Policy version in effect
   - Outcome (success, failure, partial)
   - Cost impact (if applicable)

---

## Notification and Alert Model

### Alert Types

| Alert | Trigger | Recipients | Action |
|-------|---------|-----------|--------|
| **Budget approach** | Spend + pending > 80% cap | Finance Controller | Approve additional budget or pause ventures |
| **Budget overrun (prevented)** | Spend attempt > cap | Founder | Review and approve additional spend |
| **Policy violation** | Policy rule check fails | Founder, Auditor | Freeze workflow, investigate, approve fix |
| **Quality issue** | Quality score < threshold | Venture Manager | Review output, request refinement or accept |
| **Anomaly** | Spend 2x historical baseline | Finance Controller | Investigate cost drivers |
| **Agent error** | Task fails 3x | Venture Manager | Retry, escalate, or cancel task |
| **Schedule miss** | Task overdue | Venture Manager | Extend deadline or pause task |
| **Incident** | Freeze triggered | All stakeholders | Resolve and document remediation |

### Alert Delivery

- **Critical** (policy violation): email + SMS + in-app notification, requires action within 2 hours
- **High** (budget approach, agent error): email + in-app notification
- **Medium** (quality issue, anomaly): in-app notification only
- **Low** (routine completion): digest email once daily

---

## Emergency Operations Playbook

### Scenario 1: Runaway Spend

**Trigger:** Spend is accelerating; on track to exceed daily cap by 2x within 1 hour

**Response:**
1. System alerts Finance Controller immediately
2. Finance Controller clicks "Freeze All Ventures"
3. All active workflows pause; no new spend authorized
4. Founder reviews ongoing tasks and decides:
   - Resume: approve additional budget, resume specific ventures
   - Pause: shut down ventures indefinitely
   - Investigate: keep paused until root cause is found
5. System logs: which workflows were paused, spend at freeze, founder decision

### Scenario 2: Policy Violation

**Trigger:** Agent attempts to call unauthorized tool or access forbidden jurisdiction

**Response:**
1. System blocks action, creates incident
2. System alerts Founder and Auditor immediately
3. Founder investigates: was this a bug, intentional, or malicious?
4. Based on investigation:
   - If bug: founder fixes code/DAG, approves resume
   - If intentional: founder approves exception and updates policy
   - If malicious: founder investigates agent behavior, updates security controls
5. System logs: what was attempted, why it was blocked, remediation, founder approval

### Scenario 3: Agent Compromised

**Trigger:** Agent behaves unexpectedly (e.g., tries to exfiltrate data or send unauthorized payments)

**Response:**
1. System immediately revokes agent credentials
2. System pauses all workflows using that agent
3. System alerts Founder and Security
4. Founder investigates: review agent logs, identify scope of damage
5. Remediation options:
   - Restart agent with fresh credentials (if bug)
   - Retire agent (if compromised)
   - Audit all recent actions by that agent (forensics)
6. System logs: incident, investigation, remediation, founder approval

---

## Summary

This user spec defines detailed personas (5), workflows (4), UX principles (4), and emergency procedures. Implementation teams should use this as a specification for building the Venture control plane UI/UX, ensuring every persona has the tools they need to govern safely, audit effectively, and scale profitably.
