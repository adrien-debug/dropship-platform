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

let cachedConfig: Record<string, unknown> | null = null;

export async function getSiteConfig() {
  if (cachedConfig) return cachedConfig;
  const siteId = process.env.SITE_ID;
  if (!siteId) return { name: 'Store', theme: {}, config: {} };

  try {
    const { data } = await getSupabase().from('sites').select('*').eq('id', siteId).single();
    cachedConfig = data;
    return data ?? { name: 'Store', theme: {}, config: {} };
  } catch {
    return { name: 'Store', theme: {}, config: {} };
  }
}
