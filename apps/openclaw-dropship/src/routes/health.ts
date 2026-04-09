import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { MedusaClient } from '../services/medusa-client.js';
import { CJClient } from '../services/cj-client.js';
import { AliExpressClient } from '../services/aliexpress-client.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = {
    medusa: 'down',
    cj: 'down',
    aliexpress: 'down',
    supabase: 'down',
  };

  const run = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks[name] = 'up';
    } catch {
      checks[name] = 'down';
    }
  };

  await Promise.allSettled([
    run('medusa', async () => {
      const medusa = new MedusaClient();
      await medusa.healthCheck();
    }),
    run('cj', async () => {
      const cj = new CJClient();
      await cj.searchProducts('test', 1, 1);
    }),
    run('aliexpress', async () => {
      const client = AliExpressClient.create();
      if (!client) throw new Error('AliExpress not configured');
      const ok = await client.testConnection();
      if (!ok) throw new Error('AliExpress connection failed');
    }),
    run('supabase', async () => {
      const url = process.env['SUPABASE_URL'];
      const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
      if (!url || !key) throw new Error('missing env');
      const sb = createClient(url, key);
      const { error } = await sb.from('sites').select('id', { count: 'exact', head: true }).limit(1);
      if (error) throw error;
    }),
  ]);

  const allUp = Object.values(checks).every((s) => s === 'up');

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ok' : 'degraded',
    version: '1.0.0',
    services: ['medusa', 'cj', 'aliexpress', 'supabase'],
    checks,
    timestamp: new Date().toISOString(),
  });
});
