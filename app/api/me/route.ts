import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyInitData } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only stats for the current player in a given game. Used by games to show "BEST: X" on splash.
export async function POST(req: NextRequest) {
  let body: { initData?: string; game?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.initData) return NextResponse.json({ ok: false, error: 'missing_initdata' }, { status: 400 });

  let parsed;
  try {
    parsed = verifyInitData(body.initData);
  } catch {
    return NextResponse.json({ ok: false, error: 'initdata_invalid' }, { status: 401 });
  }

  const game = typeof body.game === 'string' && body.game.length > 0 ? body.game : 'bizarrebounce';

  const [statsR, playerR] = await Promise.all([
    supabase
      .from('player_game_stats')
      .select('high_score, total_plays, high_score_meta')
      .eq('tg_user_id', parsed.user.id)
      .eq('game', game)
      .maybeSingle(),
    supabase
      .from('players')
      .select('username')
      .eq('tg_user_id', parsed.user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    high_score: statsR.data?.high_score ?? 0,
    total_plays: statsR.data?.total_plays ?? 0,
    high_score_meta: statsR.data?.high_score_meta ?? null,
    username: playerR.data?.username ?? null,
  });
}
