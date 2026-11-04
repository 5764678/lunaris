import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle, enabled only for the Docker image build
  // (apps/web/Dockerfile sets NEXT_OUTPUT=standalone). `next start` uses the default.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Workspace TypeScript sources and font packages are compiled by Next.
  transpilePackages: ["@lunaris/shared-types", "geist"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
