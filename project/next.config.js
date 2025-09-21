/** @type {import('next').NextConfig} */
const nextConfig = {
experimental: {
    serverComponentsExternalPackages: ["undici", "cheerio"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
