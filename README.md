# BizarreBounce Tracker

Serves the BizarreBounce game **and** tracks Telegram plays in one Next.js app.
Same origin = no CORS. One Vercel deploy hosts everything.

```
GET  /            → public/game.html   (rewritten from /, opened by Telegram Mini App)
POST /api/track   → validates Telegram initData HMAC, writes to Supabase
```

## One-time setup

### 1. Install deps

```bash
cd /Users/dylan/bizarrebounce-tracker
npm install
```

### 2. Apply the Supabase schema

In your Supabase dashboard for the tracker project:
- **SQL editor → New query** → paste contents of `supabase/migrations/001_init.sql` → **Run**.
- Verify `players`, `plays`, `stats_summary`, `top_referrers` exist in **Table editor**.

### 3. Get the secret API key

`Project Settings → API → Project API keys → secret` key (starts with `sb_secret_`).
Replace the placeholder in `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### 4. Build the game and copy it in

```bash
cd /Users/dylan/bizarre-bounce-v2
npm run build           # writes dist/index.html (single-file)
cd /Users/dylan/bizarrebounce-tracker
npm run copy-game       # cp ../bizarre-bounce-v2/dist/index.html public/game.html
```

Rerun those two commands any time the game source changes.

### 5. Local sanity check

```bash
npm run dev
# Open http://localhost:3000  → the game's splash screen should load.
# (Telegram tracking won't fire — initData is empty outside Telegram. That's expected.)
```

## Deploy to Vercel

```bash
cd /Users/dylan/bizarrebounce-tracker
npx vercel login        # one-time, opens browser
npx vercel              # follow prompts → creates project, gives you a *.vercel.app URL
```

In the Vercel dashboard for the new project → **Settings → Environment Variables** → add:

- `TELEGRAM_BOT_TOKEN` — from `@BotFather` (`/mybots` → select bot → API Token)
- `SUPABASE_URL` — `https://<your-project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — the `sb_secret_...` key from Supabase

(All three are also in your local `.env.local`, which is gitignored. Don't commit them.)

Then `npx vercel --prod` to ship.

## Wire the Mini App in BotFather

In Telegram, chat with `@BotFather`:

```
/myapps                          → select @BizarreBeastsBot
→ Edit Bot → Mini App → Edit URL → <your-vercel-url>
```

Or, if no Mini App exists yet:

```
/newapp
→ select @BizarreBeastsBot
→ Title: BizarreBounce
→ Description: …
→ Photo / icon: (upload)
→ Web App URL: <your-vercel-url>
→ Short name: bounce
```

Users now launch the game from `t.me/BizarreBeastsBot/bounce`.

## Custom domain (later)

When you set the CNAME for `bizarrebounce.bizarrebeasts.io`:
1. **Vercel project → Settings → Domains → Add** `bizarrebounce.bizarrebeasts.io`
2. Vercel will display the exact CNAME target (typically `cname.vercel-dns.com`)
3. Add the CNAME at your DNS provider
4. Update the Mini App URL in BotFather to the custom domain

## Referral attribution

Share game links with a `startapp` param to track install sources:

```
https://t.me/BizarreBeastsBot/bounce?startapp=twitter_may16
https://t.me/BizarreBeastsBot/bounce?startapp=fc_announcement
```

The param shows up in `plays.start_param` and the `top_referrers` view.

## Checking the numbers

In Supabase SQL editor:

```sql
select * from stats_summary;            -- unique players, total plays, DAU, top score
select * from top_referrers;            -- which startapp params drive plays
select * from plays order by id desc limit 50;
```

## How tracking works

1. Telegram opens `https://<your-domain>/` → rewrite serves `public/game.html`.
2. Game detects `window.Telegram.WebApp.initData` → activates Telegram adapter.
3. When the countdown finishes (game enters `playing` state), game POSTs `play_start` to `/api/track` with raw `initData`.
4. Server validates HMAC against `TELEGRAM_BOT_TOKEN`, upserts the player, inserts a play row, returns the `play_id`.
5. When the game ends, game POSTs `play_end` with `score` and `play_id`. Server closes the row and bumps `players.high_score` / `players.total_plays`.

Outside Telegram (browser, Farcade), `initData` is empty → adapter falls through to Farcade SDK, tracking endpoint is never called.
