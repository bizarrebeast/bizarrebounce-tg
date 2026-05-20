import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!BOT_TOKEN || !WEBHOOK_SECRET) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET');
}

const BOT_USERNAME = 'BizarreBeastsBot';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PUBLIC_ORIGIN = 'https://bizarrebounce-tg.bizarrebeasts.io';

// /start picks one of these at random — keeps the welcome fresh, surfaces each
// game as you ship more. Drop a new GIF into public/ and add the URL here.
const START_GIFS = [
  `${PUBLIC_ORIGIN}/bizarrebounce-bizarrebeasts.gif`,
  `${PUBLIC_ORIGIN}/treasurequest-bizarrebeasts-loop.gif`,
];
const pickStartGif = () => START_GIFS[Math.floor(Math.random() * START_GIFS.length)];

// Games available under @BizarreBeastsBot. Add a new entry when you register
// another Mini App with BotFather and want it in the /start menu.
const GAMES = [
  { short: 'bbbounce', label: '🎮 Bizarre Bounce' },
  { short: 'treasurequest', label: '⛏️ Treasure Quest' },
];

type InlineKeyboard = { inline_keyboard: { text: string; url: string }[][] };

function gameMenu(startParam?: string): InlineKeyboard {
  const suffix = startParam ? `?startapp=${encodeURIComponent(startParam)}` : '';
  return {
    inline_keyboard: GAMES.map((g) => [
      { text: g.label, url: `https://t.me/${BOT_USERNAME}/${g.short}${suffix}` },
    ]),
  };
}

async function sendMessage(chat_id: number, text: string, reply_markup?: InlineKeyboard) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', reply_markup, disable_web_page_preview: true }),
  });
}

async function sendAnimation(chat_id: number, animationUrl: string, caption: string, reply_markup?: InlineKeyboard) {
  await fetch(`${TG_API}/sendAnimation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, animation: animationUrl, caption, parse_mode: 'HTML', reply_markup }),
  });
}

const WELCOME = [
  '🎮 <b>Welcome to BizarreBeasts!</b>',
  '',
  'Two games live on Telegram. Pick one 👇',
  '',
  '• <b>Bizarre Bounce</b> — tap to fly, dodge pipes, go BIZARRE',
  '• <b>Treasure Quest</b> — retro climber, dodge enemies, collect treasure',
].join('\n');

export async function POST(req: NextRequest) {
  // Only Telegram knows the secret; anything else gets 401 and Telegram will retry.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
  if (!chatId || !text) return NextResponse.json({ ok: true });

  // /start optionally carries an attribution payload: /start twitter_may19 — this
  // flows into every game button's startapp param so we can track which channel sent them.
  if (text === '/start' || text.startsWith('/start ')) {
    const param = text.slice('/start'.length).trim() || undefined;
    await sendAnimation(chatId, pickStartGif(), WELCOME, gameMenu(param));
  } else if (text === '/play' || text === '/help' || text === '/games') {
    await sendMessage(chatId, 'Pick a game 👇', gameMenu());
  } else {
    await sendMessage(chatId, 'Try /start, or pick a game below.', gameMenu());
  }

  return NextResponse.json({ ok: true });
}
