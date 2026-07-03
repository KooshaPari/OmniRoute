# OmniRoute macOS Tray

Native SwiftUI/AppKit menu-bar controller for OmniRoute.

Inspired by the VibeProxy pattern: keep local daemon controls native, keep the heavy management UI in a browser/static console, and avoid Electron for tray-only workflows.

## Run

```bash
swift run
```

Default daemon endpoint: `http://localhost:20128`.
Override with:

```bash
OMNIROUTE_BASE_URL=http://localhost:20128 swift run
```

## Current scope

- Menu-bar item
- Settings window
- Open management console
- Start/stop placeholders
- Health probe against `/api/management/health`

## Next scope

- Add launchd helper for daemon start/stop
- Add signed/notarized app bundle
- Add account/provider status from `/api/management/providers`
- Add Sparkle or native updater after distribution channel is chosen
