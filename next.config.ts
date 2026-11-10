import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext checks multipart uploads against this limit before API routing.
  experimental: { serverActions: { bodySizeLimit: '22mb' } },
};

export default nextConfig;
