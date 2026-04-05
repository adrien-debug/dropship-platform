import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format integer cents as EUR (French locale). */
export function formatPrice(cents: number): string {
  const amount = cents / 100;
  return amount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a date for display (French locale). */
export function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function truncate(text: string, length: number): string {
  if (length <= 0) {
    return '';
  }
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length)}…`;
}
