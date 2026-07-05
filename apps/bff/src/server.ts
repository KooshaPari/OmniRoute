import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT ?? 4322);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`OmniRoute BFF listening on http://localhost:${info.port}`);
});
