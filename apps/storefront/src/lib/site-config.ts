import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const FALLBACK: Record<string, unknown> = {
  name: 'One Piece Shop',
  slug: 'onepiece-shop',
  theme: {
    brand: 'One Piece',
    colors: { primary: '#DC2626', secondary: '#1E3A5F', accent: '#F59E0B' },
    fonts: { heading: 'Bangers', body: 'Inter' },
  },
  config: { locale: 'fr', currency: 'EUR' },
};

let cachedConfig: Record<string, unknown> | null = null;

export interface SiteContent {
  brand?: { name: string; tagline: string; tone_of_voice?: string; color_mood?: string };
  hero_title?: string;
  hero_subtitle?: string;
  hero_cta?: string;
  about_html?: string;
  shipping_policy?: string;
  return_policy?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
}

export function getSiteContent(config: Record<string, unknown>): SiteContent {
  const cfg = (config?.config ?? {}) as Record<string, unknown>;
  return (cfg?.site_content ?? {}) as SiteContent;
}

export async function getSiteId(): Promise<string | null> {
  const config = await getSiteConfig();
  return (config?.id as string) ?? null;
}

export async function getSiteConfig() {
  if (cachedConfig) return cachedConfig;

  const siteId = process.env.SITE_ID;
  const siteSlug = process.env.SITE_SLUG;
  if (!siteId && !siteSlug) return FALLBACK;

  try {
    const supabase = getSupabase();
    const query = siteId
      ? supabase.from('sites').select('*').eq('id', siteId).single()
      : supabase.from('sites').select('*').eq('slug', siteSlug!).single();

    const { data, error } = await query;
    if (error) {
      console.error('[site-config] Supabase error, using fallback:', error.message);
      cachedConfig = FALLBACK;
      return FALLBACK;
    }
    cachedConfig = data;
    return data ?? FALLBACK;
  } catch (err) {
    console.error('[site-config] Exception, using fallback:', err);
    cachedConfig = FALLBACK;
    return FALLBACK;
  }
}
