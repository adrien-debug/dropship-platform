/**
 * Shared types for the research copilot.
 *
 * Split from `research-copilot.ts` for maintainability. The public surface
 * is re-exported via `lib/agent/research-copilot.ts` — do not import this
 * file directly from outside the `research/` directory.
 */

import type { z } from 'zod';
import type { MediaPlanInput } from './tools';

export interface ResearchStreamEvent {
  type:
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'message'
    | 'shortlist'
    | 'done'
    | 'error';
  data: unknown;
}

export interface FeaturedProduct {
  supplier: 'aliexpress' | 'cj';
  supplier_product_id: string;
  title: string;
  image_url: string;
  supplier_url: string;
  cost_cents: number;
  suggested_price_cents: number;
  orders?: number;
  rating?: string | null;
  why_this_one?: string;
  pricing_rationale: string;
  expected_aov_eur?: number;
}

export interface DesignProposal {
  preset:
    | 'editorial-serif'
    | 'tech-mono'
    | 'brutalist-luxe'
    | 'gen-z-bold'
    | 'lifestyle-warm';
  primary: string;
  accent: string;
  rationale: string;
}

export interface ShortlistPayload {
  niche: string;
  rationale: string;
  saturation?: number;
  estimated_aov_eur?: number;
  suggested_store_name: string;
  target_audience?: string;
  featured_product: FeaturedProduct;
  suggested_mode?: 'mono' | 'collection';
  suggested_template?: string;
  media_plan: z.infer<typeof MediaPlanInput>;
  design_proposals: DesignProposal[];
}

/**
 * Research-specific tool result that adds a `shortlist` payload for the
 * shortlist_niche tool which triggers a UI side-effect.
 */
export interface ResearchToolResult {
  output: unknown;
  /** Short human-readable label shown in the inline tool card. */
  summary: string;
  /** Optional structured payload to bubble up as a stream event. */
  shortlist?: ShortlistPayload;
}

export type ToolName =
  | 'web_search'
  | 'ask_perplexity'
  | 'meta_ads_library'
  | 'aliexpress_search'
  | 'cj_search'
  | 'search_ad_benchmarks'
  | 'shortlist_niche';
