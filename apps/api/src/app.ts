import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authRoute } from './routes/auth';
import { duelsRoute } from './routes/duels';

export const app = new Hono().basePath('/api');

if (process.env.NODE_ENV !== 'test') app.use(logger());

app.get('/health', (c) => c.json({ ok: true }));
app.route('/auth', authRoute);
app.route('/duels', duelsRoute);
