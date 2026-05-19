// Fallback page. The rewrite in next.config.ts serves /game.html at the root,
// but if the rewrite ever misses (e.g., the file is missing), this is what users see.
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>BizarreBounce</h1>
      <p>Game asset missing. Run <code>npm run copy-game</code> from this directory after building bizarre-bounce-v2.</p>
    </main>
  );
}
