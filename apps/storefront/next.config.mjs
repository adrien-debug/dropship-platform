/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dropship/core', '@dropship/design-systems', '@dropship/ui', '@dropship/suppliers'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
