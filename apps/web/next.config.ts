import type { NextConfig } from 'next';

/**
 * Security headers applied site-wide. Notes:
 *  - HSTS: 2-year max-age with includeSubDomains + preload-ready value. Once
 *    set in prod, removing it is a multi-year process (browsers remember).
 *  - Permissions-Policy: lock down browser APIs we don't use. `payment=(self
 *    "https://js.stripe.com")` is mandatory for Apple Pay / Google Pay via
 *    Stripe Payment Elements, do NOT remove.
 *  - CSP intentionally NOT enforced yet: Next.js runtime needs unsafe-inline
 *    on script-src/style-src and we haven't done a full smoke test of Stripe
 *    Elements with a strict CSP. Adding it blind would risk a white-screen
 *    on paid traffic. Wire it in via a Report-Only header first when we
 *    have time to monitor reports.
 */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=(self "https://js.stripe.com")',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'sync-xhr=()',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '),
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
