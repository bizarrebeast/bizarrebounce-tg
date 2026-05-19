import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!BOT_TOKEN || !WEBHOOK_SECRET) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET');
}

const BOT_USERNAME = 'BizarreBeastsBot';
const MINI_APP_SHORT = 'bbbounce';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PUBLIC_ORIGIN = 'https://bizarrebounce-tg.vercel.app';
const START_GIF_URL = `${PUBLIC_ORIGIN}/bizarrebounce-bizarrebeasts.gif`;

type InlineKeyboard = { inline_keyboard: { text: string; url: string }[][] };

function playButton(startParam?: string): InlineKeyboard {
  const base = `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT}`;
  const url = startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
  return { inline_keyboard: [[{ text: '🎮 Play Bizarre Bounce', url }]] };
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
  '🎮 <b>Welcome to Bizarre Bounce!</b>',
  '',
  'Tap to bounce. Avoid obstacles. Go BIZARRE!',
  '',
  'Tap below to play 👇',
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

  // /start optionally carries an attribution payload: /start twitter_may19
  if (text === '/start' || text.startsWith('/start ')) {
    const param = text.slice('/start'.length).trim() || undefined;
    await sendAnimation(chatId, START_GIF_URL, WELCOME, playButton(param));
  } else if (text === '/play' || text === '/help') {
    await sendMessage(chatId, 'Tap below to play 👇', playButton());
  } else {
    await sendMessage(chatId, 'Try /start, or tap the button below to play.', playButton());
  }

  return NextResponse.json({ ok: true });
}
