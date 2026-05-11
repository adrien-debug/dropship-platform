import type { MetadataRoute } from 'next';
import { siteBaseUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/shop/', '/products/', '/legal/'],
        disallow: [
          '/admin/',
          '/api/',
          '/cart',
          '/checkout',
          '/order/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
