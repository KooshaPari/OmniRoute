# User Journeys — FocalPoint

> **Status:** Living document — updated as flows are designed or shipped.
> **Last updated:** 2026-06-14

## Journey 1: Parent Onboarding (NOT YET SHIPPED)

**Actor:** Parent
**Goal:** Set up FocalPoint on their child's iOS device

### Flow
1. Parent downloads FocalPoint from App Store
2. **(NOT SHIPPED)** Onboarding wizard: grant FamilyControls permission, add child profile
3. **(NOT SHIPPED)** Connect Canvas LMS: OAuth2 flow, authorize data access
4. **(NOT SHIPPED)** Configure first rule: "Allow 30 min gaming after homework completion"
5. **(NOT SHIPPED)** Child sees Coachy mascot and understands the rules

### Current Status
- **0 onboarding screens shipped.** Users cannot self-serve setup today.
- Canvas OAuth button exists in settings but no guided flow.

## Journey 2: Rule Creation (SHIPPED)

**Actor:** Parent
**Goal:** Create a new screen-time rule

### Flow
1. Parent opens app → **Rules tab**
2. Taps **"New Rule"**
3. 4-step wizard:
   - **When:** Schedule trigger (e.g., weekdays 3–6 PM)
   - **If:** Condition (e.g., Canvas assignment overdue)
   - **Then:** Action (e.g., Block Social Media, Semi-rigidity)
   - **Settings:** Priority, cooldown, explanation
4. Rule saved → syncs to child's device via FamilyControls

### Current Status
- Rule authoring wizard shipped (SwiftUI, 4-step)
- JSON preview and DSL catalog included
- FamilyControls enforcement scaffolded (awaiting entitlement)

## Journey 3: Child Compliance (PARTIAL)

**Actor:** Child
**Goal:** Complete tasks to earn screen time

### Flow
1. Child opens app → **Home tab**
2. Sees **Coachy mascot** with current status
3. **Tasks tab** shows assigned tasks from Canvas
4. Completes task → earns credits
5. **Wallet tab** shows balance and streak
6. Attempts to open blocked app → sees explanation + grace period (Semi-rigidity)

### Current Status
- App shell shipped (5 tabs)
- Coachy SwiftUI render shipped; `.riv` Rive animation pending
- Wallet and penalties logic shipped in Rust core
- FamilyControls enforcement blocked by entitlement

## Journey 4: Morning Brief (SHIPPED)

**Actor:** Parent or Child
**Goal:** Start the day with a structured overview

### Flow
1. Morning notification triggers at configured time
2. App shows **Morning Brief** screen:
   - Schedule-derived tasks for today
   - LLM-coached encouragement (via CoachingProvider)
   - Current credit balance and streak status
3. Child taps **"Start Day"** → Brief dismissed

### Current Status
- Rituals crate shipped (15 integration tests)
- Morning Brief logic complete
- LLM rendering scaffolded (StubCoachingProvider in use)

## Journey 5: Evening Shutdown (SHIPPED)

**Actor:** Parent or Child
**Goal:** End the day with reflection and task classification

### Flow
1. Evening notification triggers at configured time
2. App shows **Evening Shutdown** screen:
   - Task classification: completed / incomplete / rescheduled
   - Streak update (increment or reset)
   - LLM summary of the day's progress
3. Parent reviews → adjusts rules for tomorrow

### Current Status
- Evening Shutdown logic shipped
- Task classification and streak updates complete

## References

- [`docs/journeys/`](./docs/journeys/) — journey manifests and wireframes
- [`SPEC.md`](./SPEC.md) — system specification
- [`PRD.md`](./PRD.md) — product requirements
- [`PLAN.md`](./PLAN.md) — phased roadmap
