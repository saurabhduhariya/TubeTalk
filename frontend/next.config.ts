import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',      // Outputs a static 'out' folder
  images: {
    unoptimized: true,   // Extensions don't support the Next.js Image Optimization API
  },
};

export default nextConfig;