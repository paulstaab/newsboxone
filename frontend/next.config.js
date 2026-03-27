/** @type {import('next').NextConfig} */

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath = rawBasePath ? `/${rawBasePath.replace(/^\/|\/$/g, '')}` : '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: normalizedBasePath || undefined,
  assetPrefix: normalizedBasePath || undefined,
};

module.exports = nextConfig;
