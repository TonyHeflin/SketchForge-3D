import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.2.5"],
  images: {
    unoptimized: true
  },
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        assetPrefix: "./",
      }
    : {}),
};

export default nextConfig;
