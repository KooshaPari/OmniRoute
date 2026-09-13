import { Hono } from 'hono';

/**
 * Batch 6 BFF routes — System proxy configuration.
 *
 *   - GET /api/dashboard/system/mitm-proxy   MITM proxy config
 *   - GET /api/dashboard/system/1proxy        1proxy config
 *   - GET /api/dashboard/system/proxy         upstream proxy config
 */
export const systemRoutes = new Hono()

  // GET /api/dashboard/system/mitm-proxy
  .get('/mitm-proxy', (c) =>
    c.json({
      config: {
        enabled: false,
        port: 8080,
        upstream: '',
        interceptTls: false,
        logRequests: true,
      },
    }),
  )

  // GET /api/dashboard/system/1proxy
  .get('/1proxy', (c) =>
    c.json({
      config: {
        enabled: false,
        listenPort: 9090,
        target: '',
        rateLimit: 100,
      },
    }),
  )

  // GET /api/dashboard/system/proxy
  .get('/proxy', (c) =>
    c.json({
      config: {
        enabled: false,
        upstream: '',
        timeout: 30,
        retries: 3,
        healthCheck: true,
      },
    }),
  );
