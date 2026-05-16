/**
 * Tool executors for the research copilot.
 *
 * Split from `research-copilot.ts` for maintainability. The public surface
 * (`executeTool` via `__internals`) is re-exported via
 * `lib/agent/research-copilot.ts`.
 */

import { trackedMessage } from '../anthropic';
import { validateNiche, type ValidatorCountry } from '@/lib/trends/meta-library';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';
import { tavilySearch } from '@/lib/research/tavily';
import { perplexityAnswer } from '@/lib/research/perplexity';
import {
  WebSearchInput,
  AskPerplexityInput,
  MetaAdsLibraryInput,
  SupplierSearchInput,
  AdBenchmarksInput,
  ShortlistNicheInput,
} from './tools';
import type {
  ResearchToolResult,
  ShortlistPayload,
  ToolName,
} from './types';

// ── Tool executors ─────────────────────────────────────────────────────

async function execWebSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = WebSearchInput.parse(raw);
  const results = await tavilySearch({
    query: input.query,
    max_results: 5,
    topic: input.topic,
    search_depth: 'basic',
  });
  return {
    output: { query: input.query, topic: input.topic, results },
    summary: `Recherche web "${input.query}" — ${results.length} résultat${results.length === 1 ? '' : 's'}`,
  };
}

async function execAskPerplexity(raw: unknown): Promise<ResearchToolResult> {
  const input = AskPerplexityInput.parse(raw);
  const { answer, citations } = await perplexityAnswer(input.query);
  return {
    output: { query: input.query, answer, citations },
    summary: answer ? `Perplexity: ${answer.slice(0, 80)}…` : 'Perplexity: réponse vide',
  };
}

async function execMetaAdsLibrary(raw: unknown): Promise<ResearchToolResult> {
  const input = MetaAdsLibraryInput.parse(raw);
  const result = await validateNiche(input.niche, {
    country: (input.country ?? 'FR') as ValidatorCountry,
  });
  return {
    output: result,
    summary: `Meta Ads Library "${input.niche}" — saturation ${result.saturation}/100 (${result.verdict})`,
  };
}

async function execAliexpressSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = SupplierSearchInput.parse(raw);
  const limit = Math.min(20, input.limit ?? 10);
  const res = await aliexpress.searchProducts({
    keywords: input.query,
    pageSize: limit,
    currency: 'EUR',
    countryCode: 'FR',
    locale: 'fr_FR',
  });
  if (!res.success || !res.data) {
    return {
      output: {
        query: input.query,
        candidates: [],
        error: res.error ?? 'AliExpress: erreur inconnue',
      },
      summary: `AliExpress "${input.query}" — erreur (${res.error ?? 'inconnu'})`,
    };
  }
  const candidates = res.data.products.slice(0, limit).map((p) => {
    const costCents = Math.max(0, Math.round(parseFloat(p.sale_price || p.original_price || '0') * 100));
    const retailCents = Math.max(999, Math.round((costCents * 2.2) / 100) * 100 - 1);
    const ordersParsed = parseInt(p.thirty_days_sold_count || '0', 10);
    return {
      supplier: 'aliexpress' as const,
      supplier_product_id: p.product_id,
      title: p.product_title,
      image_url: p.product_main_image_url,
      supplier_url: p.product_url,
      cost_cents: costCents,
      suggested_price_cents: retailCents,
      margin_cents: retailCents - costCents,
      orders: Number.isFinite(ordersParsed) ? ordersParsed : 0,
      rating: p.evaluate_rate || null,
    };
  });
  return {
    output: { query: input.query, candidates, total_found: res.data.total_record_count },
    summary: `AliExpress "${input.query}" — ${candidates.length} produit${candidates.length === 1 ? '' : 's'}`,
  };
}

async function execCjSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = SupplierSearchInput.parse(raw);
  const limit = Math.min(20, input.limit ?? 10);
  let res;
  try {
    res = await cj.searchProducts({ keywords: input.query, pageSize: limit });
  } catch (e) {
    // CJ frequently 401s when the key is invalid — never crash the loop.
    return {
      output: {
        query: input.query,
        candidates: [],
        error: e instanceof Error ? e.message : String(e),
      },
      summary: `CJ "${input.query}" — indisponible`,
    };
  }
  if (!res.success || !res.data) {
    return {
      output: {
        query: input.query,
        candidates: [],
        error: res.error ?? 'CJ: erreur inconnue',
      },
      summary: `CJ "${input.query}" — ${res.error ?? 'indisponible'}`,
    };
  }
  const candidates = res.data.list.slice(0, limit).map((p) => {
    const costCents = Math.max(0, Math.round(p.sellPrice * 100));
    const retailCents = Math.max(999, Math.round((costCents * 2.2) / 100) * 100 - 1);
    return {
      supplier: 'cj' as const,
      supplier_product_id: p.pid,
      title: p.productNameEn,
      image_url: p.productImage,
      supplier_url: p.sellUrl,
      cost_cents: costCents,
      suggested_price_cents: retailCents,
      margin_cents: retailCents - costCents,
      orders: 0,
      rating: null,
    };
  });
  return {
    output: { query: input.query, candidates, total_found: res.data.total },
    summary: `CJ "${input.query}" — ${candidates.length} produit${candidates.length === 1 ? '' : 's'}`,
  };
}

async function execAdBenchmarks(raw: unknown): Promise<ResearchToolResult> {
  const input = AdBenchmarksInput.parse(raw);
  const country = input.country ?? 'FR';
  const countryLabel: Record<string, string> = {
    FR: 'France', BE: 'Belgique', CH: 'Suisse', CA: 'Canada', US: 'États-Unis', UK: 'Royaume-Uni',
  };
  const label = countryLabel[country] ?? country;

  const query =
    `Benchmarks publicitaires e-commerce dropshipping "${input.niche}" ${label} 2025 2026: ` +
    `Meta Ads (Facebook/Instagram) CPM moyen EUR, CPC moyen EUR, CPA moyen EUR pour ce type de produit; ` +
    `TikTok Ads CPM moyen EUR, CPC moyen EUR; ` +
    `Google Shopping / Google Ads CPC moyen EUR; ` +
    `Pinterest Ads CPM moyen EUR. ` +
    `Quel canal a le meilleur ROAS pour "${input.niche}" et pourquoi? ` +
    `Quels jours de la semaine et créneaux horaires ont les meilleurs taux de conversion pour "${input.niche}" en ${label}?`;

  let rawText: string;
  let citations: string[];
  let summarySource: string;

  try {
    const result = await perplexityAnswer(query);
    rawText = result.answer ?? '';
    citations = result.citations ?? [];
    summarySource = 'Perplexity';
  } catch {
    // Fallback vers Tavily si Perplexity échoue
    const results = await tavilySearch({ query, max_results: 5 });
    rawText = results.map((r) => r.snippet).join('\n\n');
    citations = results.map((r) => r.url);
    summarySource = 'web search';
  }

  // Post-process via Haiku to extract structured numeric benchmarks.
  // Reduces hallucination risk when Claude must fill media_plan fields.
  let structured: Record<string, unknown> | null = null;
  try {
    const extraction = await trackedMessage(
      { step: 'ad-benchmarks-extraction', storeId: null },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'Extract advertising benchmark numbers from the provided text. Return ONLY valid JSON. If a value is not found, use null.',
        messages: [
          {
            role: 'user',
            content: `Text:\n${rawText}\n\nReturn JSON with this exact shape:\n{"meta":{"cpm_eur":number|null,"cpc_eur":number|null,"cpa_eur":number|null},"tiktok":{"cpm_eur":number|null,"cpc_eur":number|null,"cpa_eur":number|null},"google":{"cpc_eur":number|null,"cpa_eur":number|null},"pinterest":{"cpm_eur":number|null},"best_channel":string|null,"best_days":string[]|null,"best_hours":string[]|null}`,
          },
        ],
      },
    );
    const textBlock = extraction.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) structured = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Non-fatal — fall back to raw text only
  }

  return {
    output: {
      niche: input.niche,
      country,
      benchmarks: rawText,
      structured: structured ?? undefined,
      citations,
    },
    summary: `Ad benchmarks "${input.niche}" (${country}) — ${summarySource}${structured ? ' (structuré)' : ''}`,
  };
}

function execShortlistNiche(raw: unknown): ResearchToolResult {
  const input = ShortlistNicheInput.parse(raw);
  if (input.saturation !== undefined && input.saturation > 75) {
    throw new Error(
      `Saturation ${input.saturation}/100 > 75 — niche rejetée. Propose une niche alternative avec saturation ≤ 75.`,
    );
  }
  const payload: ShortlistPayload = {
    niche: input.niche.trim().toLowerCase(),
    rationale: input.rationale.trim(),
    suggested_store_name: input.suggested_store_name.trim(),
    saturation: input.saturation,
    estimated_aov_eur: input.estimated_aov_eur,
    target_audience: input.target_audience?.trim() || undefined,
    featured_product: {
      supplier: input.featured_product.supplier,
      supplier_product_id: input.featured_product.supplier_product_id,
      title: input.featured_product.title.trim(),
      image_url: input.featured_product.image_url,
      supplier_url: input.featured_product.supplier_url,
      cost_cents: input.featured_product.cost_cents,
      suggested_price_cents: input.featured_product.suggested_price_cents,
      orders: input.featured_product.orders,
      rating: input.featured_product.rating ?? null,
      why_this_one: input.featured_product.why_this_one?.trim() || undefined,
      pricing_rationale: input.featured_product.pricing_rationale.trim(),
      expected_aov_eur: input.featured_product.expected_aov_eur,
    },
    suggested_mode: input.suggested_mode,
    suggested_template: input.suggested_template,
    media_plan: input.media_plan,
    design_proposals: input.design_proposals.map((d) => ({
      preset: d.preset,
      primary: d.primary.toLowerCase(),
      accent: d.accent.toLowerCase(),
      rationale: d.rationale.trim(),
    })),
  };
  return {
    output: payload,
    summary: `Shortlist: ${payload.niche} → ${payload.suggested_store_name}`,
    shortlist: payload,
  };
}

export async function executeTool(name: string, input: unknown): Promise<ResearchToolResult> {
  switch (name as ToolName) {
    case 'web_search':
      return execWebSearch(input);
    case 'ask_perplexity':
      return execAskPerplexity(input);
    case 'meta_ads_library':
      return execMetaAdsLibrary(input);
    case 'aliexpress_search':
      return execAliexpressSearch(input);
    case 'cj_search':
      return execCjSearch(input);
    case 'search_ad_benchmarks':
      return execAdBenchmarks(input);
    case 'shortlist_niche':
      return execShortlistNiche(input);
    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}
