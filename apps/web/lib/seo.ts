/**
 * SEO helpers — canonical URL, schema.org JSON-LD builders, OG metadata
 * assembly. Stays pure (no DB / network) so it can be reused from any route.
 */

import type { Metadata } from 'next';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Canonical absolute base URL for the site. Falls back to localhost in dev so
 * Metadata.metadataBase doesn't crash builds when the env var is missing.
 */
export function siteBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}

export function storeUrl(slug: string): string {
  return `${siteBaseUrl()}/shop/${slug}`;
}

export function productUrl(slug: string, handle: string): string {
  return `${siteBaseUrl()}/shop/${slug}/products/${handle}`;
}

/**
 * schema.org BreadcrumbList builder. Items in order from root → current page.
 */
export function breadcrumbList(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * schema.org Organization for a store. Minimal but valid — name, URL, logo
 * (we use the og:image when present, otherwise omit), description.
 */
export function organizationSchema(store: StoreConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: store.name,
    url: storeUrl(store.slug),
    description: store.description || store.tagline || undefined,
    logo: store.heroImageUrl || undefined,
  };
}

/**
 * schema.org Product + nested Offer. Currency must be a 3-letter ISO code
 * (uppercased — Medusa returns lowercase, we normalize here).
 */
export function productSchema(args: {
  storeSlug: string;
  storeName: string;
  productTitle: string;
  productDescription: string | null | undefined;
  productHandle: string;
  imageUrl: string | null | undefined;
  priceMinor: number | undefined;
  currency: string | undefined;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
}) {
  const offers =
    args.priceMinor !== undefined && args.currency
      ? {
          '@type': 'Offer',
          url: productUrl(args.storeSlug, args.productHandle),
          priceCurrency: args.currency.toUpperCase(),
          price: (args.priceMinor / 100).toFixed(2),
          availability:
            args.availability === 'out_of_stock'
              ? 'https://schema.org/OutOfStock'
              : args.availability === 'preorder'
              ? 'https://schema.org/PreOrder'
              : 'https://schema.org/InStock',
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: args.productTitle,
    description: args.productDescription || undefined,
    image: args.imageUrl || undefined,
    brand: { '@type': 'Brand', name: args.storeName },
    offers,
  };
}

/**
 * Helper to attach metadataBase + canonical to a per-page Metadata object.
 * Wraps a partial Metadata with the base URL and canonical alternate.
 */
export function withCanonical(metadata: Metadata, path: string): Metadata {
  const base = siteBaseUrl();
  return {
    ...metadata,
    metadataBase: new URL(base),
    alternates: {
      ...(metadata.alternates || {}),
      canonical: path,
    },
  };
}
