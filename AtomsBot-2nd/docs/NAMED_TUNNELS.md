Named Tunnels: Quick Use in This Repo

- Prereqs: `cloudflared` installed and logged in (`cloudflared tunnel login`).
- Env: set `TUNNEL_ID` and `TUNNEL_DOMAIN` (e.g., `kooshapari.com`).
- Optional: `SRVC` for service slug; falls back to folder name or `local`.

Add a route and start a background process
- Command: `npm run tunnel:add -- <service> <port>`
- Example: `npm run tunnel:add -- atomsbot 3100`
- Result: Creates `~/.cloudflared/config-atomsbot.yml` and starts `cloudflared` for that route.
- URLs: `https://atomsbot.<TUNNEL_DOMAIN>`

Stop a route
- Command: `npm run tunnel:down -- <service>`
- Example: `npm run tunnel:down -- atomsbot`

Check status
- Command: `npm run tunnel:status`

Notes
- Each service gets its own small config file and background `cloudflared` process using the same `TUNNEL_ID` credentials.
- This keeps services independent and avoids restarts of a central tunnel while developing many projects.
- The app also logs an expected hostname on startup and probes `/healthz` once the public host should be live.

Optional path-based routing
- Set `TUNNEL_PATH_ROUTE=true` to also map `https://<TUNNEL_DOMAIN>/<segment>/*` to the same local port.
- `TUNNEL_PATH_PREFIX` customizes the `<segment>` (defaults to `<service>`). It is normalized to DNS-safe lowercase.
- Example: with `SRVC=atomsbot`, `TUNNEL_DOMAIN=kooshapari.com`, and `TUNNEL_PATH_PREFIX=bot`, the path route `https://kooshapari.com/bot/*` will be added.
