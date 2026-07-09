# Tier 3.9 — Phenotype Portfolio (Tauri 2 + SvelteKit)

**Target**: `Phenotype-Apps/phenotype-portfolio/` (new)  
**Value proposition**: A unified desktop + web app that surfaces all Phenotype services (BytePort, OmniRoute, NVMS, PhenoCompose) as a personal portfolio/ecosystem.

## Stack

| Layer | Tech | Role |
|-------|------|------|
| Desktop shell | **Tauri 2** (Rust) | System tray, menubar, local-first launch |
| Web framework | **SvelteKit 2** | Dashboard pages, auth flows, portfolio cards |
| Styling | Tailwind CSS v4 | Utility-first, design-system agnostic |
| Icons | Lucide | Coherent icon language |
| Data layer | BytePort API + OmniRoute UDS | Read deployment status, usage stats |

## Interaction model

```
┌──────────────────────────────────────────┐
│  System Tray Icon (Tauri)                │
│  ┌────────────────────────────────┐      │
│  │ ● BytePort (3 deployments)     │      │
│  │ ● OmniRoute (1 active)         │      │
│  │ ● NVMS (2.3 GB used)           │      │
│  │ ● PhenoCompose Online          │      │
│  ├────────────────────────────────┤      │
│  │ Open Dashboard                  │      │
│  │ Settings                        │      │
│  │ Quit                            │      │
│  └────────────────────────────────┘      │
└──────────────────────────────────────────┘
```

## SvelteKit routes

```markdown
/                            → Portfolio landing (public)
/login                       → GitHub OAuth (BytePort delegate)
/dashboard                   → Personal overview
/dashboard/deployments       → All deployments, filtering, search
/dashboard/deployments/:id   → Single deployment (logs, metrics, stop)
/dashboard/providers         → LLM provider status (OmniRoute)
/dashboard/settings          → Preferences, theme, notifications
/dashboard/org               → Org settings, members (RBAC)
/api/portfolio               → SvelteKit server-side proxy to BytePort API
```

## Phases

### Phase 1 — Scaffold + tray (1 session)

1. `npm create tauri-app@latest`
2. Tauri system tray with 4 status indicators
3. Rust `tauri-plugin-sql` for local settings cache

### Phase 2 — Dashboard (2 sessions)

1. SvelteKit 2 pages: `/dashboard`, `/dashboard/deployments`
2. BytePort API integration (deployment list, status icons)
3. OmniRoute status via UDS socket (read-only, no auth needed for localhost)

### Phase 3 — Agent surface (2 sessions)

1. Agent status: which MCP tools are active, A2A skill registry
2. Quick-action buttons: deploy repo, run nvms vm exec
3. Notifications for deployment completion, cost thresholds

## Acceptance criteria

1. Tauri tray launches on macOS login  
2. Dashboard loads BytePort deployment list within 500ms  
3. System tray reflects real-time deployment count  
4. Portfolio passes `tauri build` for macOS .dmg  
5. SvelteKit PWA scores ≥ 90 on Lighthouse
