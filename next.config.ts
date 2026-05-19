import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // beforeFiles so the rewrite wins over app/page.tsx — the Telegram Mini App
    // URL points at /, and we want the game asset served there.
    return {
      beforeFiles: [{ source: '/', destination: '/game.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
