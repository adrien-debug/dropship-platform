import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { PipelineEvent, PipelineInput, PipelineResult } from './types.js';
import { createToolRegistry, getToolSpecs, getToolHandler } from './tools.js';

const VLLM_URL = process.env['VLLM_AGENT_URL'] ?? process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] ?? 'not-needed';
const VLLM_MODEL = process.env['VLLM_MODEL'] ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
const MAX_ITERATIONS = 25;
const TIMEOUT_MS = 10 * 60 * 1000;

const SYSTEM_PROMPT = `Tu es l'agent autonome de la plateforme Dropship. Ta mission: prendre des mots-cles produits et creer un site e-commerce complet, pret a vendre, de A a Z.

## Processus obligatoire (dans cet ordre)

1. **Analyse niche** : A partir des mots-cles, determine la niche, le marche cible, le positionnement prix, et le design system adapte.

2. **Recherche produits** : Utilise search_products avec les mots-cles pour trouver 30-50 produits. Analyse les resultats et selectionne les 15-20 meilleurs (bonne marge, images, pertinence niche).

3. **Contenu du site** : Utilise generate_site_content pour creer l'identite de marque, le hero, la page a propos, les politiques. Passe la niche, le marche, le positionnement et les noms des top produits.

4. **Enrichissement produits** : Utilise enrich_products pour generer les descriptions AI et les meta SEO pour chaque produit selectionne. Passe le nom de la marque pour la coherence.

5. **Creation du shop** : Utilise create_shop avec tous les produits enrichis, le contenu du site, et le design system choisi. Choisis un slug URL-safe, un nom de boutique, et un port entre 3101-3190.

6. **Verification** : Utilise check_health pour verifier que le site repond.

7. **Marketing** : Genere des plans de campagnes publicitaires:
   - Google Ads : utilise create_google_ads_campaign avec des headlines et descriptions optimisees
   - Meta Ads : utilise create_meta_ads_campaign avec des interets cibles et un copy engageant

8. **SEO** : Utilise run_seo_audit sur le site deploye pour identifier les ameliorations.

## Regles
- Execute TOUTES les etapes, ne saute rien
- Utilise les tools, ne simule pas les resultats
- Choisis le design system le plus adapte a la niche (swiss=minimal, cyber=tech/gaming, radical=mode/jeune, avant=art/design, chrome=futuriste)
- Prix de vente = cout x 2.5 minimum
- Marche par defaut = FR
- Reponds en francais
- A la fin, fais un recap complet avec l'URL du site, le nombre de produits, le design, et les plans marketing`;

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

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: typeof result === 'string' ? result : JSON.stringify(result),
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
