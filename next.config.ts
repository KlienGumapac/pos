import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove output: 'export' for API routes to work
  trailingSlash: true,
  eslint: {
    // Temporary workaround for Vercel build failing due to ESLint v9 option changes
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
  // Remove distDir for Vercel deployment
  // distDir: 'out'
};

export default nextConfig;
