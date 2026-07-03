# OmniRoute Management Console

Next-free web management console for OmniRoute.

This is a greenfield Vite + React + TypeScript console. It is intentionally isolated from the current Next dashboard and targets a stable `/api/management/*` facade so web, tray, and desktop clients can share one control-plane contract.

## Run

```bash
npm install
npm run dev
```

Default daemon endpoint: `http://localhost:20128`.

## Initial route contract

```text
/api/management/health
/api/management/providers
/api/management/models
/api/management/keys
/api/management/virtual-keys
/api/management/routing
/api/management/compression/budget
/api/management/usage/call-logs
```

## Migration rule

Do not bind this console directly to legacy scattered dashboard routes. Add `/api/management/*` facade adapters first, then remove Next from runtime packaging after parity is proven.
