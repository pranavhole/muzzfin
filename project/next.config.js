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
    google: false, // disables fetching Google Fonts during build
  },
};

module.exports = nextConfig;
