/**
 * Deterministic pre-vision product scorer.
 *
 * Purpose: rank ~50 raw supplier results BEFORE we send their image URLs
 * to the Haiku vision filter (~$0.001/image). By keeping the top-N
 * (typically 25) we cut the vision token bill ~50% and improve the final
 * store quality — we stop asking a vision model to look at obvious junk
 * (1.50€ unbranded, 12 orders, no rating, no image).
 *
 * This is intentionally NOT an LLM agent. It is a pure pondered formula
 * over signals that the AE DS search response already gives us for free
 * (cost, orders count, evaluateRate). Each weight is a top-level constant
 * so tuning is one-line.
 *
 * Signals & weights (sum = 1.0 by convention, normalized at the bottom):
 *
 *  - COST       : sweet-spot 8-40 € (Gaussian centred at 18 €, σ ≈ 14).
 *                 Sub-3 € items are usually contrefaçon / junk. Over 100 €
 *                 is fine but rare on AE dropship — small penalty.
 *  - ORDERS     : log-scale (log10(orders+1) / log10(100_000)). 100k orders
 *                 = 1.0, 1 order ≈ 0.0. Cheap market-validation signal.
 *  - RATING     : evaluateRate is often a percentage string ("94.6%") or
 *                 a 0-5 float. Normalised to 0..1. Missing → 0.5 neutral.
 *  - MARGIN     : retail = cost × 2.2 ⇒ gross margin (absolute) = cost × 1.2.
 *                 We prefer absolute margin ≥ 8 € because % margin always
 *                 favours the 2 € junk. Sub-3 € margin → 0.
 *  - IMAGE      : strict gate. No imageUrl ⇒ overall score = 0 (the vision
 *                 filter downstream would reject it anyway).
 *
 * `reasons` returns 2-3 short human-readable strings, used in admin logs
 * and (optionally later) shown to the founder when debugging a store run.
 */

export interface ScorableProduct {
  supplier: 'aliexpress' | 'cj';
  externalId: string;
  title: string;
  /** Supplier cost in EUR (parsed from sale_price / sellPrice). */
  price: number;
  imageUrl: string;
  /** AE only: 30-day orders count (parsed int). Optional. */
  orders?: number;
  /**
   * AE evaluateRate. AliExpress returns this either as a percentage string
   * ("94.6%") or sometimes as a raw 0-5 float. We accept both forms and
   * normalise to [0,1]. Missing → treated as neutral 0.5.
   */
  evaluateRate?: string;
}

export interface ProductScore {
  /** 0..1, higher = better candidate. */
  score: number;
  /** Human-readable explanation, 2-3 entries. */
  reasons: string[];
}

// ---- Tunable weights (one knob per signal). Sum normalised at the end. ----
const WEIGHT_COST = 0.25;
const WEIGHT_ORDERS = 0.30;
const WEIGHT_RATING = 0.20;
const WEIGHT_MARGIN = 0.25;

const COST_SWEET_SPOT_EUR = 18;
const COST_SIGMA_EUR = 14;
const COST_HARD_FLOOR = 3;          // below = contrefaçon / junk
const COST_SOFT_CEILING = 100;      // above = niche premium, mild penalty

const ORDERS_LOG_REF = Math.log10(100_000); // 100k orders ⇒ orders sub-score = 1

const MARGIN_TARGET_EUR = 8;        // absolute gross margin we aim for

const RETAIL_MULTIPLIER = 2.2;      // mirrors store-creator enrichment rule

const RATING_NEUTRAL = 0.5;

/**
 * Convert AE `evaluateRate` to a 0..1 sub-score.
 * Accepted forms: "94.6%", "94.6", "4.7", "4.7/5", "" (empty / missing).
 */
function normaliseRating(raw: string | undefined): { value: number; raw: string } {
  if (!raw || !raw.trim()) return { value: RATING_NEUTRAL, raw: '' };
  const cleaned = raw.trim().replace('%', '').replace(/\/.*$/, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return { value: RATING_NEUTRAL, raw };
  // Heuristic: > 5 is a percentage (0-100), <= 5 is a star rating.
  if (n > 5) return { value: Math.min(1, Math.max(0, n / 100)), raw };
  return { value: Math.min(1, Math.max(0, n / 5)), raw };
}

function costSubScore(cost: number): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (cost < COST_HARD_FLOOR) {
    // Linear ramp 0 → 0.4 as price approaches the floor — never zero so a
    // 2.50€ product with great orders can still survive if everything else
    // is excellent.
    return Math.max(0, (cost / COST_HARD_FLOOR) * 0.4);
  }
  // Gaussian centred at sweet-spot.
  const z = (cost - COST_SWEET_SPOT_EUR) / COST_SIGMA_EUR;
  const gaussian = Math.exp(-0.5 * z * z);
  if (cost > COST_SOFT_CEILING) {
    // Cap the over-100€ tail at 0.5 so it doesn't dominate.
    return Math.min(gaussian, 0.5);
  }
  return gaussian;
}

function ordersSubScore(orders: number | undefined): number {
  if (orders == null || !Number.isFinite(orders) || orders <= 0) return 0;
  return Math.min(1, Math.log10(orders + 1) / ORDERS_LOG_REF);
}

function marginSubScore(cost: number): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const absoluteMargin = cost * (RETAIL_MULTIPLIER - 1);
  // Saturating curve: at MARGIN_TARGET ⇒ ~1.0, at half target ⇒ ~0.5.
  return Math.min(1, absoluteMargin / MARGIN_TARGET_EUR);
}

function fmtEur(n: number): string {
  return n.toFixed(2) + ' €';
}

function fmtOrders(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function scoreProduct(p: ScorableProduct): ProductScore {
  const reasons: string[] = [];

  // Image is a strict gate: no image ⇒ score 0. The vision filter
  // downstream would unconditionally reject it anyway, so we save the
  // Haiku call.
  if (!p.imageUrl || !p.imageUrl.trim()) {
    return { score: 0, reasons: ['Image manquante (rejet immédiat)'] };
  }

  const cost = Number.isFinite(p.price) ? p.price : 0;

  // Cost gate: a missing / zero / negative cost means the AE response
  // was malformed for this row. We can't reason about margin or pricing
  // tier, so the row is effectively unusable downstream. Hard-zero.
  if (cost <= 0) {
    return { score: 0, reasons: ['Coût absent ou invalide (rejet immédiat)'] };
  }

  const sCost = costSubScore(cost);
  const sOrders = ordersSubScore(p.orders);
  const { value: sRating, raw: rawRating } = normaliseRating(p.evaluateRate);
  const sMargin = marginSubScore(cost);

  const totalWeight = WEIGHT_COST + WEIGHT_ORDERS + WEIGHT_RATING + WEIGHT_MARGIN;
  const score =
    (sCost * WEIGHT_COST +
      sOrders * WEIGHT_ORDERS +
      sRating * WEIGHT_RATING +
      sMargin * WEIGHT_MARGIN) /
    totalWeight;

  // Build reasons: prefer the 2-3 most informative signals (positive AND
  // negative). We always say something about cost (it anchors the price
  // tier in the operator's head), then we add orders and margin if they
  // are notable. cost <= 0 is already handled above by the hard gate.
  if (cost < COST_HARD_FLOOR) {
    reasons.push(`Coût trop bas (${fmtEur(cost)}, suspicieux)`);
  } else if (cost > COST_SOFT_CEILING) {
    reasons.push(`Coût élevé (${fmtEur(cost)}, niche premium)`);
  } else if (sCost > 0.7) {
    reasons.push(`Coût idéal (${fmtEur(cost)})`);
  } else {
    reasons.push(`Coût raisonnable (${fmtEur(cost)})`);
  }

  if (p.orders != null && p.orders > 0) {
    if (p.orders >= 5_000) reasons.push(`Orders élevés (${fmtOrders(p.orders)}+)`);
    else if (p.orders >= 100) reasons.push(`Orders corrects (${fmtOrders(p.orders)})`);
    else reasons.push(`Orders faibles (${fmtOrders(p.orders)})`);
  } else {
    reasons.push('Orders inconnus');
  }

  const absMargin = cost * (RETAIL_MULTIPLIER - 1);
  if (absMargin < MARGIN_TARGET_EUR / 2) {
    reasons.push(`Marge insuffisante (${fmtEur(absMargin)})`);
  } else if (absMargin >= MARGIN_TARGET_EUR && reasons.length < 3) {
    // Only surface this when there is "room" left in the reasons array.
    reasons.push(`Marge confortable (${fmtEur(absMargin)})`);
  }

  if (rawRating && reasons.length < 3) {
    reasons.push(`Note ${rawRating}`);
  }

  // Defensive clamp
  const clamped = Math.min(1, Math.max(0, score));

  return { score: clamped, reasons: reasons.slice(0, 3) };
}

/**
 * Sort `items` by score DESC (stable on equal scores via original index)
 * and return the top `n`. Mutates nothing — returns a new array.
 *
 * Items are decorated with `_score` and `_scoreReasons` for downstream
 * logging / debugging. We do NOT persist these in DB at this stage; if
 * we want that later, surface them through `dropship_store_products`.
 */
export function rankAndKeepTop<T extends ScorableProduct>(
  items: readonly T[],
  n: number,
): Array<T & { _score: number; _scoreReasons: string[] }> {
  const scored = items.map((p, idx) => {
    const { score, reasons } = scoreProduct(p);
    return { p, score, reasons, idx };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx; // stable
  });
  return scored
    .slice(0, Math.max(0, n))
    .map(({ p, score, reasons }) => ({ ...p, _score: score, _scoreReasons: reasons }));
}
