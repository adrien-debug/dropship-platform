import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export interface ToolDefinition {
  spec: ChatCompletionTool;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface PipelineEvent {
  step: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  detail?: unknown;
  progress?: number;
  timestamp: number;
}

export interface PipelineInput {
  keywords: string[];
  market?: 'FR' | 'EU' | 'US' | 'WORLD';
  positioning?: 'budget' | 'mid' | 'premium';
  design_system?: string;
  budget_eur?: number;
}

export interface PipelineResult {
  success: boolean;
  shop?: {
    name: string;
    slug: string;
    url: string;
    site_id: string;
    sales_channel_id: string;
    products_created: number;
    design_system: string;
  };
  marketing?: {
    seo_done: boolean;
    google_ads?: { campaign_id?: string; status: string };
    meta_ads?: { campaign_id?: string; status: string };
  };
  events: PipelineEvent[];
  duration_ms: number;
}

export interface BrandIdentity {
  name: string;
  tagline: string;
  tone_of_voice: string;
  color_mood: string;
}

export interface SiteContent {
  brand: BrandIdentity;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  about_html: string;
  shipping_policy: string;
  return_policy: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
}

export interface EnrichedProduct {
  title: string;
  description: string;
  price: number;
  cost_cents: number;
  images: string[];
  seo_title: string;
  seo_description: string;
  category: string;
  supplier: string;
  external_id: string;
}
