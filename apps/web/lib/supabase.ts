import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Client Supabase lazy : évite l’échec de `next build` sans variables,
 * et permet de déployer sur Vercel/Railway avec secrets uniquement côté hébergeur.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase non configuré : définir NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (recommandé serveur) sur Vercel ou Railway.',
    );
  }

  client = createClient(supabaseUrl, supabaseKey);
  return client;
}
