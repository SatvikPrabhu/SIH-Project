import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cesium is loaded at runtime via /public/cesium (see scripts/copy-cesium.mjs).
  // Do not bundle Cesium through webpack/turbopack in Phase 1.
  reactStrictMode: true,
};

export default nextConfig;
