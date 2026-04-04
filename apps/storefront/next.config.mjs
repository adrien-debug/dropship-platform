/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dropship/core', '@dropship/ui'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  env: {
    SITE_ID: process.env.SITE_ID,
    SITE_SLUG: process.env.SITE_SLUG,
  },
};

export default nextConfig;
