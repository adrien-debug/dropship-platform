// Client-side analytics helper
// Wraps GA4 + Meta Pixel + custom events
// All functions are no-ops if keys are not configured

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function hasGtag(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function hasFbq(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', name, params ?? {});
  }
  if (hasFbq()) {
    window.fbq!('trackCustom', name, params ?? {});
  }
}

export function trackPageView(url: string): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', 'page_view', { page_location: url });
  }
  if (hasFbq()) {
    window.fbq!('track', 'PageView');
  }
}

export function trackPurchase(
  orderId: string,
  value: number,
  currency: string,
  items: Array<{ id: string; name: string; quantity: number; price: number }>,
): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', 'purchase', {
      transaction_id: orderId,
      value,
      currency,
      items: items.map(i => ({
        item_id: i.id,
        item_name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });
  }
  if (hasFbq()) {
    window.fbq!('track', 'Purchase', { value, currency });
  }
}

export function trackAddToCart(
  productId: string,
  productName: string,
  value: number,
  currency = 'EUR',
): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', 'add_to_cart', {
      currency,
      value,
      items: [{ item_id: productId, item_name: productName, price: value, quantity: 1 }],
    });
  }
  if (hasFbq()) {
    window.fbq!('track', 'AddToCart', { content_ids: [productId], content_name: productName, value, currency });
  }
}

export function trackViewProduct(
  productId: string,
  productName: string,
  value: number,
  currency = 'EUR',
): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', 'view_item', {
      currency,
      value,
      items: [{ item_id: productId, item_name: productName, price: value, quantity: 1 }],
    });
  }
  if (hasFbq()) {
    window.fbq!('track', 'ViewContent', { content_ids: [productId], content_name: productName, value, currency });
  }
}

export function trackBeginCheckout(value: number, currency = 'EUR'): void {
  if (typeof window === 'undefined') return;
  if (hasGtag()) {
    window.gtag!('event', 'begin_checkout', { value, currency });
  }
  if (hasFbq()) {
    window.fbq!('track', 'InitiateCheckout', { value, currency });
  }
}
