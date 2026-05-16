import type { ChatMessage, ShortlistPayload } from './types';

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function fmtEur(n: number) {
  if (!Number.isFinite(n)) return '0,00 €';
  return n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  });
}

/**
 * Stored rows arrive with role 'tool' for both tool_call and tool_result
 * lines. The DB-only history doesn't carry a separate "shortlist" event,
 * so on hydrate we look at tool_name === 'shortlist_niche' and pin the
 * payload onto the message so the special card renders.
 */
export function rehydrate(raw: ChatMessage[]): ChatMessage[] {
  return raw.map((m) => {
    if (m.role === 'tool' && m.tool_name === 'shortlist_niche' && m.tool_output) {
      const sl = m.tool_output as Partial<ShortlistPayload>;
      if (sl && sl.niche && sl.suggested_store_name && sl.rationale) {
        return {
          ...m,
          shortlist: {
            niche: sl.niche,
            rationale: sl.rationale,
            suggested_store_name: sl.suggested_store_name,
            saturation: sl.saturation,
            estimated_aov_eur: sl.estimated_aov_eur,
            target_audience: sl.target_audience,
            featured_product: sl.featured_product,
            suggested_mode: sl.suggested_mode,
            suggested_template: sl.suggested_template,
            media_plan: sl.media_plan,
          },
        };
      }
    }
    return m;
  });
}
