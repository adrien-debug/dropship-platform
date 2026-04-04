/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dropship/core', '@dropship/design-systems', '@dropship/ui'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
