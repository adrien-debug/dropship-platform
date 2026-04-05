import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AgentOrchestrator } from '../agent/orchestrator.js';

export const agentPipelineRouter = Router();

const pipelineSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(5),
  market: z.enum(['FR', 'EU', 'US', 'WORLD']).default('FR'),
  positioning: z.enum(['budget', 'mid', 'premium']).default('mid'),
  design_system: z.string().optional(),
  budget_eur: z.number().positive().optional(),
});

agentPipelineRouter.post('/pipeline', async (req: Request, res: Response) => {
  const parsed = pipelineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  console.log(`[agent-pipeline] Starting pipeline for: ${input.keywords.join(', ')}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const orchestrator = new AgentOrchestrator();

  try {
    const result = await orchestrator.runPipeline(input, (event) => {
      sendEvent(event);
    });

    sendEvent({ step: 'result', status: 'done', detail: result, progress: 100, timestamp: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[agent-pipeline] Fatal error:', msg);
    sendEvent({ step: 'fatal_error', status: 'error', detail: msg, timestamp: Date.now() });
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

agentPipelineRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ready',
    tools: [
      'search_products', 'enrich_products', 'generate_site_content',
      'create_shop', 'check_health',
      'create_google_ads_campaign', 'create_meta_ads_campaign', 'run_seo_audit',
    ],
    models: {
      agent: process.env['VLLM_AGENT_URL'] ?? process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1',
      fast: process.env['VLLM_GPU1_FAST_URL'] ?? 'http://100.88.191.49:8001/v1',
    },
  });
});
