/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: ["undici", "cheerio"],
  // Provide an empty turbopack config to avoid the Turbopack vs webpack error
  turbopack: {},
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub Node-only modules so frontend build doesn't fail
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        "utf-8-validate": false,
        "bufferutil": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
