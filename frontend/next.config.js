/** @type {import('next').NextConfig} */

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath = rawBasePath ? `/${rawBasePath.replace(/^\/|\/$/g, '')}` : '';
const backendOrigin = process.env.NEWSBOXONE_BACKEND_ORIGIN ?? 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: normalizedBasePath || undefined,
  assetPrefix: normalizedBasePath || undefined,
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
