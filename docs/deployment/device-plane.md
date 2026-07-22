# OmniRoute device compute plane

The desktop device runs the long-lived gateway locally. Vercel is reserved for
the stateless web/BFF surface; the device owns provider credentials, durable
local state, and optional sidecars.

## Native process-compose mode

```sh
export OMNIROUTE_REPO_DIR=/path/to/OmniRoute
export OMNIROUTE_DATA_DIR=/path/to/OmniRoute/.data
process-compose -f process-compose.device.yaml up
```

The gateway binds to loopback by default on port `20128`. If exposing it over a
trusted tailnet, enforce tailnet ACLs and configure the device's approved
binding through the supported process configuration; never put provider keys
in the compose file or commit them to the repository.

The process file creates the Redis data directory and restarts either process
after an unexpected exit. Its readiness probes are local-only and bounded;
`npm run start` must pass the production environment validation.

Docker Compose remains the canonical production container topology. Use
`docker-compose.prod.yml` when isolation or reproducible images are required.
