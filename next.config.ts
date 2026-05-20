import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // beforeFiles so each rewrite wins over any matching Next route. Each game
    // gets its own Mini App URL; the rewrites translate to the static HTML.
    return {
      beforeFiles: [
        { source: '/', destination: '/game.html' },                // bbbounce
        { source: '/treasurequest', destination: '/treasurequest.html' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
