import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyInitData } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrackEvent = 'play_start' | 'play_end';

type TrackBody = {
  event: TrackEvent;
  initData: string;
  score?: number;
  play_id?: number;            // returned from play_start, echoed back on play_end
  client_meta?: Record<string, unknown>;
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
        ended_at: now,
        score,
        start_param: start_param ?? null,
        client_meta: body.client_meta ?? null,
      });
    if (error) return bad('play_close_insert_failed:' + error.message, 500);
  }

  // Bump player totals. Two queries instead of one RPC to keep this dependency-light.
  const { data: current } = await supabase
    .from('players')
    .select('high_score, total_plays')
    .eq('tg_user_id', user.id)
    .single();
  const newHigh = Math.max(current?.high_score ?? 0, score);
  const newTotal = (current?.total_plays ?? 0) + 1;
  await supabase
    .from('players')
    .update({ high_score: newHigh, total_plays: newTotal })
    .eq('tg_user_id', user.id);

  return NextResponse.json({ ok: true, high_score: newHigh, total_plays: newTotal });
}
