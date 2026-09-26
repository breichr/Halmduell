import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { duelsRoute } from './routes/duels';

const app = new Hono().basePath('/api');

app.use(logger());

app.get('/health', (c) => c.json({ ok: true }));
app.route('/duels', duelsRoute);

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
