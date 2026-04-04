import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

let cachedConfig: Record<string, unknown> | null = null;

export async function getSiteConfig() {
  if (cachedConfig) return cachedConfig;
  const siteId = process.env.SITE_ID;
  if (!siteId) return { name: 'Store', theme: {}, config: {} };
  
  const { data } = await supabase.from('sites').select('*').eq('id', siteId).single();
  cachedConfig = data;
  return data ?? { name: 'Store', theme: {}, config: {} };
}
