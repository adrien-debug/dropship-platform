export function formatPriceEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** @deprecated Use formatPriceEur */
export const formatPriceUsd = formatPriceEur;
