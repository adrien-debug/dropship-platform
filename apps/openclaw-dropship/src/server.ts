import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';
import { productSearchRouter } from './routes/product-search.js';
import { shopExecutorRouter } from './routes/shop-executor.js';
import { agentPipelineRouter } from './routes/agent-pipeline.js';

const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MEDUSA_ADMIN_EMAIL', 'MEDUSA_ADMIN_PASSWORD'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  logger.warn('server', 'Missing recommended env vars', { missing });
}
if (!process.env['OPENCLAW_API_KEY']) {
  logger.warn('server', 'OPENCLAW_API_KEY not set — /shop and /agent endpoints are unprotected');
}

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3849', 10);
const API_KEY = process.env['OPENCLAW_API_KEY'] ?? '';

function apiKeyAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!API_KEY) { next(); return; }
  const key = req.headers['x-api-key'] as string | undefined;
  if (key === API_KEY) { next(); return; }
  res.status(401).json({ error: 'Unauthorized — set x-api-key header' });
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/products', productSearchRouter);
app.use('/shop', apiKeyAuth, shopExecutorRouter);
app.use('/agent', apiKeyAuth, agentPipelineRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('server', 'Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('server', `Running on port ${PORT}`, { port: PORT, health: `http://localhost:${PORT}/health` });
});

export { app };
