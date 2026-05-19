import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Serve the game HTML at the root. Telegram Mini App URL points here.
      { source: '/', destination: '/game.html' },
    ];
  },
};

export default nextConfig;
