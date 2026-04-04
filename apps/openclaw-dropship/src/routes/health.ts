import { Router } from 'express';
import { MedusaClient } from '../services/medusa-client.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = {
    medusa: 'down',
    cj: 'up',
    supabase: process.env['SUPABASE_URL'] ? 'up' : 'down',
  };

  try {
    const medusa = new MedusaClient();
    await medusa.healthCheck();
    checks['medusa'] = 'up';
  } catch {
    checks['medusa'] = 'down';
  }

  const allUp = Object.values(checks).every((s) => s === 'up');

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ok' : 'degraded',
    version: '1.0.0',
    services: ['medusa', 'cj', 'supabase'],
    checks,
    timestamp: new Date().toISOString(),
  });
});
