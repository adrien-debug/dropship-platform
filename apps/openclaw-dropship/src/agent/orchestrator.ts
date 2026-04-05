import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { PipelineEvent, PipelineInput, PipelineResult } from './types.js';
import { createToolRegistry, getToolSpecs, getToolHandler } from './tools.js';

const VLLM_URL = process.env['VLLM_AGENT_URL'] ?? process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] ?? 'not-needed';
const VLLM_MODEL = process.env['VLLM_MODEL'] ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
const MAX_ITERATIONS = 25;
const TIMEOUT_MS = 10 * 60 * 1000;

const SYSTEM_PROMPT = `You are the autonomous agent of the Dropship platform. Your mission: take product keywords and create a complete, ready-to-sell e-commerce site from A to Z.

## Required process (in this order)

1. **Niche analysis**: From keywords, determine the niche, target market, price positioning, and suitable design system.

2. **Product search**: Use search_products with ENGLISH keywords to find 20-30 products. Analyze results and select the 15-20 best (good margin, images, niche relevance).

3. **Site content**: Use generate_site_content to create brand identity, hero section, about page, policies. Pass the niche, market, positioning, and top product names.

4. **Product enrichment**: Use enrich_products to generate AI descriptions and SEO metadata for each selected product. Pass the brand name for consistency.

5. **Shop creation**: Use create_shop with all enriched products, site content, and chosen design system. Choose a URL-safe slug, shop name, and port between 3101-3190.

6. **Verification**: Use check_health to verify the site responds.

7. **Marketing**: Generate ad campaign plans:
   - Google Ads: use create_google_ads_campaign with optimized headlines and descriptions
   - Meta Ads: use create_meta_ads_campaign with targeted interests and engaging copy

8. **SEO**: Use run_seo_audit on the deployed site to identify improvements.

## Rules
- Execute ALL steps, skip nothing
- Use tools, don't simulate results
- ALWAYS search CJ in English (translate keywords if needed)
- Choose the design system best suited to the niche (swiss=minimal, cyber=tech/gaming, radical=fashion/young, avant=art/design, chrome=futuristic)
- Selling price = cost x 2.5 minimum
- All content in English
- At the end, provide a complete recap with the site URL, product count, design, and marketing plans`;

export class AgentOrchestrator {
  private client: OpenAI;
  private registry = createToolRegistry();
  private events: PipelineEvent[] = [];

  constructor() {
    this.client = new OpenAI({ baseURL: VLLM_URL, apiKey: VLLM_API_KEY });
  }

  private emit(event: PipelineEvent, onEvent?: (e: PipelineEvent) => void): void {
    this.events.push(event);
    onEvent?.(event);
    console.log(`[orchestrator] ${event.step}: ${event.status}`, event.detail ? JSON.stringify(event.detail).slice(0, 200) : '');
  }

  private parseInlineToolCalls(content: string): Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> {
    const results: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }> = [];

    const toolNames = this.registry.map(t => t.spec.function.name);
    const patterns = [
      /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g,
      /\{"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        try {
          if (pattern.source.includes('tool_call')) {
            const obj = JSON.parse(match[1]);
            if (obj.name && toolNames.includes(obj.name)) {
              results.push({
                id: `call_${Date.now()}_${results.length}`,
                type: 'function',
                function: { name: obj.name, arguments: JSON.stringify(obj.arguments ?? {}) },
              });
            }
          } else {
            const name = match[1];
            const argsStr = match[2];
            if (toolNames.includes(name)) {
              JSON.parse(argsStr);
              results.push({
                id: `call_${Date.now()}_${results.length}`,
                type: 'function',
                function: { name, arguments: argsStr },
              });
            }
          }
        } catch { /* skip */ }
      }
    }

    return results;
  }

  async runPipeline(
    input: PipelineInput,
    onEvent?: (event: PipelineEvent) => void,
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const deadline = startTime + TIMEOUT_MS;

    this.emit({
      step: 'pipeline_start',
      status: 'running',
      detail: { keywords: input.keywords, market: input.market ?? 'FR' },
      progress: 0,
      timestamp: Date.now(),
    }, onEvent);

    const userPrompt = [
      `Cree un site e-commerce complet pour ces mots-cles: ${input.keywords.join(', ')}`,
      input.market ? `Marche cible: ${input.market}` : '',
      input.positioning ? `Positionnement: ${input.positioning}` : '',
      input.design_system ? `Design system prefere: ${input.design_system}` : '',
      input.budget_eur ? `Budget marketing: ${input.budget_eur} EUR/jour` : '',
    ].filter(Boolean).join('\n');

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    let iteration = 0;
    let shopResult: PipelineResult['shop'] | undefined;
    let marketingResult: PipelineResult['marketing'] | undefined;

    while (iteration < MAX_ITERATIONS && Date.now() < deadline) {
      iteration++;
      const progress = Math.min(95, Math.round((iteration / MAX_ITERATIONS) * 100));

      this.emit({
        step: `iteration_${iteration}`,
        status: 'running',
        progress,
        timestamp: Date.now(),
      }, onEvent);

      try {
        const response = await this.client.chat.completions.create({
          model: VLLM_MODEL,
          messages,
          tools: getToolSpecs(this.registry),
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.3,
        });

        const choice = response.choices[0];
        if (!choice) break;

        const assistantMsg = choice.message;
        messages.push(assistantMsg as ChatCompletionMessageParam);

        let toolCalls = assistantMsg.tool_calls ?? [];

        if (toolCalls.length === 0 && assistantMsg.content) {
          const parsed = this.parseInlineToolCalls(assistantMsg.content);
          if (parsed.length > 0) {
            toolCalls = parsed;
          }
        }

        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              args = {};
            }

            this.emit({
              step: `tool_${toolName}`,
              status: 'running',
              detail: { args_preview: JSON.stringify(args).slice(0, 300) },
              progress,
              timestamp: Date.now(),
            }, onEvent);

            const handler = getToolHandler(this.registry, toolName);
            let result: unknown;

            if (handler) {
              try {
                result = await handler(args);

                if (toolName === 'create_shop' && result && typeof result === 'object') {
                  const r = result as Record<string, unknown>;
                  if (r.shop || r.success) {
                    const shop = (r.shop ?? r) as Record<string, unknown>;
                    shopResult = {
                      name: String(shop.name ?? ''),
                      slug: String(shop.slug ?? ''),
                      url: String(shop.url ?? ''),
                      site_id: String(shop.site_id ?? ''),
                      sales_channel_id: String(shop.sales_channel_id ?? ''),
                      products_created: Number(shop.products_created ?? 0),
                      design_system: String(shop.design_system ?? 'swiss'),
                    };
                  }
                }

                if (toolName === 'create_google_ads_campaign' || toolName === 'create_meta_ads_campaign') {
                  if (!marketingResult) marketingResult = { seo_done: false };
                  if (toolName === 'create_google_ads_campaign') {
                    marketingResult.google_ads = { status: 'plan_ready' };
                  } else {
                    marketingResult.meta_ads = { status: 'plan_ready' };
                  }
                }

                if (toolName === 'run_seo_audit') {
                  if (!marketingResult) marketingResult = { seo_done: false };
                  marketingResult.seo_done = true;
                }

                this.emit({
                  step: `tool_${toolName}`,
                  status: 'done',
                  detail: typeof result === 'object' ? JSON.stringify(result).slice(0, 500) : result,
                  progress,
                  timestamp: Date.now(),
                }, onEvent);
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[orchestrator] Tool ${toolName} failed:`, errMsg);
                result = { error: errMsg };

                this.emit({
                  step: `tool_${toolName}`,
                  status: 'error',
                  detail: errMsg,
                  progress,
                  timestamp: Date.now(),
                }, onEvent);
              }
            } else {
              result = { error: `Unknown tool: ${toolName}` };
            }

            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            const truncated = resultStr.length > 3000 ? resultStr.slice(0, 3000) + '...(truncated)' : resultStr;
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: truncated,
            } as ChatCompletionMessageParam);
          }
        } else {
          if (choice.finish_reason === 'stop') {
            this.emit({
              step: 'pipeline_complete',
              status: 'done',
              detail: assistantMsg.content?.slice(0, 500),
              progress: 100,
              timestamp: Date.now(),
            }, onEvent);
            break;
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[orchestrator] Iteration ${iteration} error:`, errMsg);

        this.emit({
          step: `iteration_${iteration}_error`,
          status: 'error',
          detail: errMsg,
          timestamp: Date.now(),
        }, onEvent);

        if (iteration >= 3) break;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      success: !!shopResult,
      shop: shopResult,
      marketing: marketingResult,
      events: this.events,
      duration_ms: durationMs,
    };
  }
}
