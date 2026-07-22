# OmniRoute device compute plane

The desktop device runs the long-lived gateway locally. Vercel is reserved for
the stateless web/BFF surface; the device owns provider credentials, durable
local state, and optional sidecars.

## Native process-compose mode

```sh
export OMNIROUTE_REPO_DIR=/path/to/OmniRoute
export OMNIROUTE_DATA_DIR=/path/to/OmniRoute/.data
export BFF_API_KEY='use-a-device-secret'
process-compose -f process-compose.device.yaml up
```

The gateway binds to loopback by default on port `20128`. To expose it over a
trusted tailnet, set `OMNIROUTE_HOSTNAME` explicitly and enforce tailnet ACLs;
never put provider keys in the compose file or commit them to the repository.

The process file creates the Redis data directory and restarts either process
after an unexpected exit. Its readiness probes are local-only and bounded;
`npm run start` must pass the production environment validation, including
`BFF_API_KEY`.

Docker Compose remains the canonical production container topology. Use
`docker-compose.prod.yml` when isolation or reproducible images are required.
