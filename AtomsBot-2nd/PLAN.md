# AtomsBot — PLAN.md

## Implementation Roadmap

### Phase 1: Core Bot (Week 1)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P1.1 | Bot scaffolding | discord.js client with TypeScript |
| P1.2 | Command registry | Slash command deployment |
| P1.3 | Database setup | Prisma schema + migrations |
| P1.4 | Forum mapping | /setup forums commands |

### Phase 2: GitHub Sync (Week 2)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P2.1 | GitHub provider | REST API integration |
| P2.2 | Issue creation | Post → Issue sync |
| P2.3 | Comment sync | Bidirectional comments |
| P2.4 | Webhooks | GitHub → Discord updates |

### Phase 3: PM Providers (Week 3)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P3.1 | Jira provider | Cloud API integration |
| P3.2 | Linear provider | GraphQL integration |
| P3.3 | Provider switcher | Runtime provider selection |
| P3.4 | Status mapping | Custom status workflows |

### Phase 4: Smart Features (Week 4)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P4.1 | Smart embeds | Rich issue previews |
| P4.2 | Auto-refresh | Background update loop |
| P4.3 | Modal forms | Bug/feature templates |
| P4.4 | Team management | Role-based access |

### Phase 5: Deployments (Week 5)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P5.1 | Vercel integration | Deployment tracking |
| P5.2 | Deployment forum | /deployments commands |
| P5.3 | Commit tracking | Auto-change log |
| P5.4 | Status updates | Deployment progress |

### Phase 6: Polish (Week 6)

| Task | Description | Deliverable |
|------|-------------|-------------|
| P6.1 | Testing | 80% coverage with Vitest |
| P6.2 | Rate limiting | Redis-based throttling |
| P6.3 | Error handling | Retry + dead letter |
| P6.4 | Documentation | Setup + usage guides |

---

## Resources

| Role | Allocation |
|------|------------|
| Backend Engineer | 1 FTE |
| DevOps | 0.25 FTE |

---

## Success Criteria

- [ ] <2s command response time
- [ ] 99.9% webhook delivery
- [ ] 3 PM providers supported
- [ ] 80% test coverage
- [ ] Zero credential leaks
