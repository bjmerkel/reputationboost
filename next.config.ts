import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/profile-guide/flyer/generate": [
      "./src/lib/profile-guide/flyer/fonts/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default nextConfig;
