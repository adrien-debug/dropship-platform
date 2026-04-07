import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import { runFastPipeline } from '../agent/fast-pipeline.js';
import { logger } from '../logger.js';

export const agentPipelineRouter = Router();

const pipelineSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(5),
  market: z.enum(['FR', 'EU', 'US', 'WORLD']).default('FR'),
  positioning: z.enum(['budget', 'mid', 'premium']).default('mid'),
  design_system: z.string().optional(),
  budget_eur: z.number().positive().optional(),
  mode: z.enum(['fast', 'agent']).default('fast'),
});

agentPipelineRouter.post('/pipeline', async (req: Request, res: Response) => {
  const parsed = pipelineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  const mode = input.mode;
  logger.info('agent-pipeline', `Starting ${mode} pipeline`, { mode, keywords: input.keywords, market: input.market });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (mode === 'agent') {
      const orchestrator = new AgentOrchestrator();
      const result = await orchestrator.runPipeline(input, sendEvent);
      sendEvent({ step: 'result', status: 'done', detail: result, progress: 100, timestamp: Date.now() });
    } else {
      const result = await runFastPipeline(input, sendEvent);
      sendEvent({ step: 'result', status: 'done', detail: result, progress: 100, timestamp: Date.now() });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('agent-pipeline', 'Fatal error', { error: msg });
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
      agent: { connected: !!(process.env['VLLM_AGENT_URL'] ?? process.env['VLLM_GPU1_URL']) },
      fast: { connected: !!process.env['VLLM_GPU1_FAST_URL'] },
    },
  });
});
