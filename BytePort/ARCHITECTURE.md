# Architecture

## Overview
- BytePort is a multi-language workspace centered on the Tauri frontend shell
  and its Go backend services.
- The desktop app is supported by a local Go module tree, backend artifacts,
  and bundled frontend assets.
- This document captures the current component boundaries and the main
  integration points.

## Components

### `frontend/web/src-tauri`
- Desktop application shell and Rust-side integration for the frontend.

### `backend/byteport`
- Go backend service for BytePort domain logic and server-side coordination.

### `backend/nvms`
- Supporting Go module for BytePort infrastructure and platform integration.

### `frontend/web`
- Web frontend assets and application code for the user-facing experience.

## Data flow
```text
user actions -> frontend/web -> frontend/web/src-tauri -> backend services -> external systems
```

## Key invariants
- Keep the frontend shell and backend services aligned on shared contracts.
- Prefer explicit interfaces between the Tauri layer and Go services.
- Do not bypass the documented service boundaries when adding new features.

## Cross-cutting concerns (config, telemetry, errors)
- Config: keep runtime settings centralized and environment-driven.
- Telemetry: standardize logs and traces across the desktop and backend layers.
- Errors: surface actionable failures at the boundary layer and preserve context internally.

## Future considerations
- Document persistence boundaries around `backend/database.db` and any sync
  contracts that bridge the desktop shell and backend services.
- Capture packaging and release flow details for the Tauri shell and Go
  backend once the build pipeline stabilizes.
- Expand the startup/sync/release diagrams after the service contract settles.
