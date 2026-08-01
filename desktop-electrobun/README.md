# OmniRoute desktop — Electrobun spike

> **Status:** Selection-gate spike (ADR-ECO-015 hybrid gateway app layer)  
> **Registry choice:** FFI + Electrobun → canonical path `apps/desktop/` (this tree promoted from
> repo root)

Electrobun + Bun shell that wraps the OmniRoute web UI (`RENDERER_URL`, default
`http://localhost:3000`) with optional one-click `process-compose` service boot. This is the
**canonical desktop spike** (not Electron, not Tauri-on-main). Legacy Electron remains in
[`../electron/`](../electron/) for packaging until this spike passes the gate below; CI Electron
smoke is path-filtered and is not the required desktop gate.

## Selection gate

The release shell packages the SvelteKit SSR output and Hono BFF into one local Bun gateway. It
starts the gateway on loopback, waits for `/healthz`, serves the Svelte shell and immutable assets,
and navigates the native window to that URL. The bundled HTML is only an explicit fallback when the
gateway bundle is absent. Set `RENDERER_URL` for dev/HMR; it is not used as the production renderer
when a gateway bundle is present.

Prototype must demonstrate all three before replacing Electron / absorbing vibeproxy client work:

| #   | Gate                      | Pass criteria                                                                                                                                                                                                                          |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tray / menu-bar UX**    | CLI proxy control (start/stop/status) from a native tray or menu-bar affordance — harvest patterns from [vibeproxy `apps/macos/`](https://github.com/automazeio/vibeproxy/tree/main/src) (menu-bar OAuth, status, local endpoint copy) |
| 2   | **Local OpenAI endpoint** | App exposes or surfaces an OpenAI-compatible local base URL wired to phenotype-gateway planes (cliproxy++ / router), consumable by coding tools without extra config                                                                   |
| 3   | **macOS build**           | Reproducible signed or ad-hoc `.app` from `bun run build:release` on macOS (P0). Linux build optional (P1)                                                                                                                             |

Checklist:

- [ ] Tray or menu-bar UX for CLI proxy control
- [ ] OpenAI-compatible local endpoint to gateway planes
- [ ] Reproducible macOS build (P0)
- [ ] Linux build (P1, optional)

## vibeproxy disposition

Per ADR-ECO-015, **vibeproxy is ABSORB (redirect only)** — no third canonical desktop repo. Harvest
reference UX from vibeproxy macOS client sources; do not fork or duplicate large Swift trees here.

| Harvest                  | Source                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Menu-bar / tray patterns | [automazeio/vibeproxy](https://github.com/automazeio/vibeproxy) — `src/` (Swift menu-bar app; registry audit label: `apps/macos/`) |
| OAuth + proxy UX flows   | Same repo — status indicators, local endpoint surfacing                                                                            |
| Router UI + deploy       | OmniRoute dashboard + existing `electron/` integration                                                                             |

## Quick start

```bash
cd desktop-electrobun   # or apps/desktop/ (redirect)
cp .env.example .env
bun install
bun dev                 # or: just dev
```

Optional service boot — set in `.env`:

```bash
SERVICES_COMPOSE_FILE=/path/to/OmniRoute/process-compose.yml
```

Build:

```bash
bun run build           # dev bundle
bun run build:release   # release .app (macOS)
```

The Svelte frontend has a stable handoff for the desktop shell: build it with
`bun --cwd apps/web run build`, then run `bun run prepare:web` from this directory. The script
copies `.vercel/output/static` and the self-contained SSR function into ignored `generated/web/` and
`generated/renderer/` directories, then stages the Hono gateway at `generated/backend/`. The
production view keeps only a fallback page; the running gateway serves the actual Svelte app.

## Layout

| Path                   | Role                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `src/main.ts`          | Electrobun main process — gateway boot/readiness, window, menu, tray |
| `src/views/`           | Bundled fallback renderer (polls dev server)                         |
| `electrobun.config.ts` | App identity, fallback view, bundled gateway copies                  |
| `.env.example`         | `RENDERER_URL`, `SERVICES_COMPOSE_FILE`, window overrides            |

## Related

- Registry:
  [ADR-ECO-015 hybrid gateway app layer](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-015-hybrid-gateway-app-layer.md)
- Spike matrix:
  [DESKTOP_CLIENT_SPIKE_MATRIX.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/rationalization/DESKTOP_CLIENT_SPIKE_MATRIX.md)
- Canonical entry: [`../apps/desktop/`](../apps/desktop/) (redirect only — no duplicate code)
