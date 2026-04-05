import { createAdminClient } from '@/utils/supabase/admin';

export async function resolveSessionSubjectForEmail(
  email: string,
  fallbackUserId: string,
): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('customers')
      .select('id')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle();
    return data?.id ?? fallbackUserId;
  } catch (err) {
    console.error('[resolve-session-subject] lookup failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return fallbackUserId;
  }
}
