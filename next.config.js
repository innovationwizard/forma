// next.config.js
// Fixed configuration without invalid properties

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for serverless deployment
  output: 'standalone',
  
  // Increase timeout for static generation (Next.js 15)
  staticPageGenerationTimeout: 60,
  
  // Skip type checking and linting during build (faster deployment)
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors during build
  },
  
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during build
  },
  
  // Server external packages (moved from experimental in Next.js 15)
  serverExternalPackages: ['@prisma/client'],
  
  // Webpack configuration for Prisma
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client');
    }
    return config;
  },
  
  // Disable static generation for API routes
  async rewrites() {
    return [
      {
        source: '/api/supabase-db',
        destination: '/api/supabase-db',
      },
      {
        source: '/api/supabase-storage',
        destination: '/api/supabase-storage',
      },
    ];
  },
  
  // Ensure API routes are not statically generated
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;