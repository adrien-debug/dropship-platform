import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { productSearchRouter } from './routes/product-search.js';
import { shopCreatorRouter } from './routes/shop-creator.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3849', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/products', productSearchRouter);
app.use('/shop', shopCreatorRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[openclaw-dropship] Unhandled error: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[openclaw-dropship] Server running on port ${PORT}`);
  console.log(`[openclaw-dropship] Health: http://localhost:${PORT}/health`);
});

export { app };
