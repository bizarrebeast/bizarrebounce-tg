import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyInitData } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrackEvent = 'play_start' | 'play_end';

type TrackBody = {
  event: TrackEvent;
  initData: string;
  game?: string;                          // defaults to 'bizarrebounce' for back-compat
  score?: number;
  play_id?: number;                       // returned from play_start, echoed back on play_end
  meta?: Record<string, unknown>;         // high-score-context (e.g., { level, diamonds }) — stored on player_game_stats.high_score_meta if this score sets a new high
  client_meta?: Record<string, unknown>;  // per-play debug payload — stored on plays.client_meta
};

function bad(reason: string, status = 400) {
  return NextResponse.json({ ok: false, error: reason }, { status });
}

export async function POST(req: NextRequest) {
  let body: TrackBody;
  try {
    body = await req.json();
  } catch {
    return bad('invalid_json');
  }

  if (!body?.event || !body?.initData) return bad('missing_fields');
  if (body.event !== 'play_start' && body.event !== 'play_end') return bad('bad_event');

  let parsed;
  try {
    parsed = verifyInitData(body.initData);
  } catch (e) {
    return bad('initdata_invalid', 401);
  }

  const { user, start_param } = parsed;
  const game = typeof body.game === 'string' && body.game.length > 0 ? body.game : 'bizarrebounce';
  const now = new Date().toISOString();

  // Upsert player row (creates on first contact, refreshes last_seen + profile fields).
  const { error: upsertErr } = await supabase
    .from('players')
    .upsert(
      {
        tg_user_id: user.id,
        username: user.username ?? null,
        first_name: user.first_name ?? null,
        language_code: user.language_code ?? null,
        is_premium: user.is_premium ?? false,
        last_seen: now,
      },
      { onConflict: 'tg_user_id', ignoreDuplicates: false },
    );
  if (upsertErr) return bad('player_upsert_failed:' + upsertErr.message, 500);

  if (body.event === 'play_start') {
    const { data, error } = await supabase
      .from('plays')
      .insert({
        tg_user_id: user.id,
        game,
        start_param: start_param ?? null,
        client_meta: body.client_meta ?? null,
      })
      .select('id')
      .single();
    if (error) return bad('play_insert_failed:' + error.message, 500);
    return NextResponse.json({ ok: true, play_id: data.id });
  }

  // play_end
  const score = typeof body.score === 'number' && Number.isFinite(body.score) ? Math.floor(body.score) : 0;

  if (body.play_id) {
    const { error } = await supabase
      .from('plays')
      .update({ ended_at: now, score })
      .eq('id', body.play_id)
      .eq('tg_user_id', user.id); // defense: user can only close their own play
    if (error) return bad('play_update_failed:' + error.message, 500);
  } else {
    // Fallback when client lost the play_id (page refresh mid-session): insert a closed play.
    const { error } = await supabase
      .from('plays')
      .insert({
        tg_user_id: user.id,
        game,
        ended_at: now,
        score,
        start_param: start_param ?? null,
        client_meta: body.client_meta ?? null,
      });
    if (error) return bad('play_close_insert_failed:' + error.message, 500);
  }

  // Update per-game stats. high_score_meta only changes when this score sets a new high.
  const { data: current } = await supabase
    .from('player_game_stats')
    .select('high_score, total_plays, high_score_meta')
    .eq('tg_user_id', user.id)
    .eq('game', game)
    .maybeSingle();

  const prevHigh = current?.high_score ?? 0;
  const isNewHigh = score > prevHigh;
  const newHigh = Math.max(prevHigh, score);
  const newTotal = (current?.total_plays ?? 0) + 1;
  const newMeta = isNewHigh && body.meta ? body.meta : current?.high_score_meta ?? null;

  await supabase
    .from('player_game_stats')
    .upsert(
      {
        tg_user_id: user.id,
        game,
        high_score: newHigh,
        total_plays: newTotal,
        high_score_meta: newMeta,
        last_played: now,
      },
      { onConflict: 'tg_user_id,game' },
    );

  return NextResponse.json({
    ok: true,
    high_score: newHigh,
    total_plays: newTotal,
    high_score_meta: newMeta,
  });
}
