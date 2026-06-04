import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // beforeFiles wins over Next pages. Order matters — first match applies.
    //
    // Host-based: each game gets its own branded subdomain. Subdomains all
    // point to this same Vercel project via CNAME; this routes their root URL
    // to the correct game HTML.
    //
    // Path-based fallbacks: kept so existing URLs (vercel.app, the original
    // bizarrebizarrebounce-tg.bizarrebeasts.io, /treasurequest path) keep working.
    return {
      beforeFiles: [
        // bizarrebounce-tg.bizarrebeasts.io → bbbounce at root
        {
          source: '/',
          has: [{ type: 'host', value: 'bizarrebounce-tg.bizarrebeasts.io' }],
          destination: '/game.html',
        },
        // treasurequest-tg.bizarrebeasts.io → Treasure Quest at root
        {
          source: '/',
          has: [{ type: 'host', value: 'treasurequest-tg.bizarrebeasts.io' }],
          destination: '/treasurequest.html',
        },
        // tictactoe-tg.bizarrebeasts.io → TicTacToe at root
        {
          source: '/',
          has: [{ type: 'host', value: 'tictactoe-tg.bizarrebeasts.io' }],
          destination: '/tictactoe.html',
        },
        // memorygame-tg.bizarrebeasts.io → Memory Game. Served from the
        // /memorygame/ folder (it has a sibling assets/ dir). URL stays at root
        // (rewrite, not redirect) so Telegram initData survives; the second rule
        // routes its relative ./assets/ requests into the namespaced folder.
        {
          source: '/',
          has: [{ type: 'host', value: 'memorygame-tg.bizarrebeasts.io' }],
          destination: '/memorygame/index.html',
        },
        {
          source: '/assets/:path*',
          has: [{ type: 'host', value: 'memorygame-tg.bizarrebeasts.io' }],
          destination: '/memorygame/assets/:path*',
        },
        // Default root for any other host (bizarrebounce.*, vercel.app, etc.) → bbbounce
        { source: '/', destination: '/game.html' },
        // Path-based access still works on any domain
        { source: '/treasurequest', destination: '/treasurequest.html' },
        { source: '/tictactoe', destination: '/tictactoe.html' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
