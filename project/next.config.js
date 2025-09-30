/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["undici", "cheerio"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  fonts: {
    google: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub Node-only modules so frontend build doesn't fail
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "utf-8-validate": false,
        "bufferutil": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
