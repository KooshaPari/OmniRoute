import { Hono } from 'hono';

export const mediaProvidersRoutes = new Hono()

  // GET /api/dashboard/media-providers
  .get('/', (c) => c.json({ providers: [] }))

  // GET /api/dashboard/media-providers/:kind
  .get('/:kind', (c) => {
    const kind = c.req.param('kind');
    return c.json({ kind, providers: [] });
  })

  // GET /api/dashboard/media-providers/:kind/:id
  .get('/:kind/:id', (c) => {
    const { kind, id } = c.req.param();
    return c.json({ kind, id, name: `Media Provider ${id}` });
  });
