import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Summary = {
  unique_players: number;
  total_plays: number;
  completed_plays: number;
  top_score: number | null;
  plays_24h: number;
  dau: number;
};
type Referrer = { start_param: string; plays: number; unique_players: number };
type Play = {
  id: number;
  tg_user_id: number;
  score: number | null;
  started_at: string;
  ended_at: string | null;
  start_param: string | null;
};

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString());

function timeAgo(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default async function StatsPage() {
  const [summaryR, refsR, recentR] = await Promise.all([
    supabase.from('stats_summary').select('*').single(),
    supabase.from('top_referrers').select('*').limit(20),
    supabase
      .from('plays')
      .select('id, tg_user_id, score, started_at, ended_at, start_param')
      .order('id', { ascending: false })
      .limit(50),
  ]);

  const s = (summaryR.data ?? {}) as Partial<Summary>;
  const refs = (refsR.data ?? []) as Referrer[];
  const recent = (recentR.data ?? []) as Play[];

  const card: React.CSSProperties = {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 12,
    padding: 20,
  };
  const big: React.CSSProperties = { fontSize: 32, fontWeight: 700, color: '#ffdd00', lineHeight: 1 };
  const label: React.CSSProperties = { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 };
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #374151' };
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 14, color: '#e5e7eb', borderBottom: '1px solid #1f2937' };

  return (
    <html>
      <head>
        <title>BizarreBounce Stats</title>
        <meta httpEquiv="refresh" content="30" />
        <style>{`body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#111827;color:#e5e7eb}`}</style>
      </head>
      <body>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 24, color: '#ffdd00' }}>🎮 BizarreBounce Stats</h1>
            <span style={{ color: '#6b7280', fontSize: 12 }}>auto-refreshes every 30s</span>
          </header>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={card}><div style={big}>{fmt(s.unique_players ?? 0)}</div><div style={label}>Unique Players</div></div>
            <div style={card}><div style={big}>{fmt(s.total_plays ?? 0)}</div><div style={label}>Total Plays</div></div>
            <div style={card}><div style={big}>{fmt(s.dau ?? 0)}</div><div style={label}>DAU (24h)</div></div>
            <div style={card}><div style={big}>{fmt(s.top_score)}</div><div style={label}>Top Score</div></div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={card}><div style={big}>{fmt(s.plays_24h ?? 0)}</div><div style={label}>Plays in last 24h</div></div>
            <div style={card}><div style={big}>{fmt(s.completed_plays ?? 0)}</div><div style={label}>Completed plays (finished)</div></div>
          </section>

          <section style={{ ...card, marginBottom: 24, padding: 0 }}>
            <h2 style={{ margin: 0, padding: 16, fontSize: 16, color: '#ffdd00', borderBottom: '1px solid #374151' }}>Top Referrers</h2>
            {refs.length === 0 ? (
              <div style={{ padding: 16, color: '#9ca3af', fontSize: 14 }}>No attributed plays yet — share links like <code>t.me/BizarreBeastsBot/bbbounce?startapp=channel_name</code> and they’ll show up here.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>start_param</th><th style={th}>plays</th><th style={th}>unique players</th></tr></thead>
                <tbody>
                  {refs.map(r => (
                    <tr key={r.start_param}><td style={td}><code>{r.start_param}</code></td><td style={td}>{fmt(r.plays)}</td><td style={td}>{fmt(r.unique_players)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={{ ...card, padding: 0 }}>
            <h2 style={{ margin: 0, padding: 16, fontSize: 16, color: '#ffdd00', borderBottom: '1px solid #374151' }}>Recent plays</h2>
            {recent.length === 0 ? (
              <div style={{ padding: 16, color: '#9ca3af', fontSize: 14 }}>No plays yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>id</th><th style={th}>tg user</th><th style={th}>score</th><th style={th}>started</th><th style={th}>ended</th><th style={th}>source</th></tr></thead>
                <tbody>
                  {recent.map(p => (
                    <tr key={p.id}>
                      <td style={td}>#{p.id}</td>
                      <td style={td}>{p.tg_user_id}</td>
                      <td style={td}>{fmt(p.score)}</td>
                      <td style={td}>{timeAgo(p.started_at)}</td>
                      <td style={td}>{p.ended_at ? timeAgo(p.ended_at) : <span style={{ color: '#f87171' }}>open</span>}</td>
                      <td style={td}>{p.start_param ? <code>{p.start_param}</code> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </body>
    </html>
  );
}
