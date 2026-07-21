# Device deployment contract

`device-compose.sh` is the desktop/tailnet adapter for the existing
`docker-compose.prod.yml` stack. It is intentionally Docker Compose based; no
Fly or other cloud runtime is involved.

```sh
cp .env.example .env                 # keep the file local and secret
OMNIROUTE_DEVICE_DATA_DIR="$HOME/Library/Application Support/OmniRoute/data" \
  ./deploy/device-compose.sh
```

The adapter validates Compose interpolation, starts the Redis + OmniRoute
services, and waits for `/api/monitoring/health` on loopback before returning.
The production Compose healthchecks remain authoritative for container
readiness. `OMNIROUTE_DEVICE_DATA_DIR` is the persistent SQLite/application
data root; back it up before upgrades. The script never prints `.env` values.

For a tailnet deployment, bind the host port through the device firewall or a
tailnet reverse proxy; do not expose the container directly to the public
internet. Set `PROD_DASHBOARD_PORT` and `PROD_API_PORT` explicitly when those
ports must differ from the defaults.

Useful lifecycle commands:

```sh
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f omniroute-prod
docker compose --env-file .env -f docker-compose.prod.yml down
```
