import { createHmac, timingSafeEqual } from 'node:crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN env var');
const BOT_TOKEN = token;

const MAX_AGE_SECONDS = 60 * 60 * 24; // reject initData older than 24h

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type ParsedInitData = {
  user: TelegramUser;
  start_param?: string;
  auth_date: Date;
};

/**
 * Verifies a Telegram WebApp initData string against the bot token.
 * Algorithm: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Throws on invalid signature, missing user, or stale auth_date.
 */
export function verifyInitData(initDataRaw: string): ParsedInitData {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  if (!hash) throw new Error('missing_hash');

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad_signature');

  const authDateStr = params.get('auth_date');
  if (!authDateStr) throw new Error('missing_auth_date');
  const authDateSec = Number(authDateStr);
  if (!Number.isFinite(authDateSec)) throw new Error('bad_auth_date');
  const ageSec = Math.floor(Date.now() / 1000) - authDateSec;
  if (ageSec > MAX_AGE_SECONDS) throw new Error('stale_initdata');

  const userJson = params.get('user');
  if (!userJson) throw new Error('missing_user');
  let userRaw: {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  try {
    userRaw = JSON.parse(userJson);
  } catch {
    throw new Error('bad_user_json');
  }
  if (typeof userRaw?.id !== 'number') throw new Error('bad_user_id');

  return {
    user: {
      id: userRaw.id,
      username: userRaw.username,
      first_name: userRaw.first_name,
      language_code: userRaw.language_code,
      is_premium: userRaw.is_premium,
    },
    start_param: params.get('start_param') ?? undefined,
    auth_date: new Date(authDateSec * 1000),
  };
}
