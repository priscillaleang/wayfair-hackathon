import type { NextConfig } from 'next';

const WORKER = process.env.WORKER_ORIGIN ?? 'http://127.0.0.1:8787';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${WORKER}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
