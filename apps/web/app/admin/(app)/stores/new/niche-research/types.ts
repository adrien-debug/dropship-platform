import type { StoreTemplate } from '@/lib/template-catalog';

export interface SessionSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
  streaming?: boolean;
  // Pinned shortlist info — when tool_name === 'shortlist_niche', the UI
  // renders a CTA card that pre-fills the form below.
  shortlist?: ShortlistPayload;
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
  pricing_rationale?: string;
  expected_aov_eur?: number;
}

export interface MediaChannel {
  name: 'meta' | 'tiktok' | 'google' | 'pinterest';
  weight_pct: number;
  expected_cpm_eur?: number;
  expected_cpc_eur?: number;
  expected_cpa_eur?: number;
  rationale?: string;
}

export interface MediaPlan {
  daily_budget_eur: number;
  channels: MediaChannel[];
  geo: {
    primary_countries: string[];
    emphasis?: string[];
    rationale?: string;
  };
  audience: {
    demographics: string;
    interests: string[];
    lookalike_seeds?: string[];
  };
  schedule: {
    best_hours_local: string[];
    best_days: string[];
    timezone?: string;
    rationale?: string;
  };
  expected_outcomes: {
    daily_orders_low: number;
    daily_orders_high: number;
    target_cpa_eur: number;
    target_roas: number;
    breakeven_note?: string;
  };
  top_hooks?: string[];
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
  featured_product?: FeaturedProduct;
  suggested_mode?: 'mono' | 'collection';
  suggested_template?: StoreTemplate;
  media_plan?: MediaPlan;
  design_proposals?: DesignProposal[];
}

export interface CostSummary {
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
}

export interface CreationProgress {
  running: boolean;
  percent: number;
  elapsed: number;
  currentStep: string;
  storeName: string;
  logs: { id: number; type: string; message: string; ts: string }[];
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
}
