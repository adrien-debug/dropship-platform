/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dropship/core', '@dropship/ui', '@dropship/suppliers', '@dropship/ai', '@dropship/deploy', '@dropship/marketing'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
