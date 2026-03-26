import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/5mouse",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
