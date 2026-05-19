import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyInitData } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only stats for the current player. Used by the game to show "BEST: X" on splash.
export async function POST(req: NextRequest) {
  let body: { initData?: string };
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

  const { data } = await supabase
    .from('players')
    .select('high_score, total_plays, username')
    .eq('tg_user_id', parsed.user.id)
    .maybeSingle();

  // First-time player → return zeros so the splash just hides the BEST line.
  return NextResponse.json({
    ok: true,
    high_score: data?.high_score ?? 0,
    total_plays: data?.total_plays ?? 0,
    username: data?.username ?? null,
  });
}
