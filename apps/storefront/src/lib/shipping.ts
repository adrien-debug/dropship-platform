export type ShippingMethod = 'standard' | 'express';

/** Standard: 5 EUR, or 0 if subtotal after discount is above 50 EUR. Express: 10 EUR. */
export function shippingEur(method: ShippingMethod, subtotalAfterDiscount: number): number {
  if (method === 'express') return 10;
  return subtotalAfterDiscount > 50 ? 0 : 5;
}
