# Adding a Game to BizarreBeasts Telegram + Kids Site

Step-by-step playbook for taking a game from "exists somewhere" to "live on
Telegram and the kids site." Two playbooks below, plus the current URL inventory.

---

## Production URL inventory

### Live games

| Game | Telegram launch | Web App URL (BotFather) | Kids site |
|---|---|---|---|
| Bizarre Bounce | `t.me/BizarreBeastsBot/bbbounce` | `https://bizarrebounce-tg.bizarrebeasts.io/` | `https://kids.bizarrebeasts.io/games/bizarre-bounce` |
| Treasure Quest | `t.me/BizarreBeastsBot/treasurequest` | `https://treasurequest-tg.bizarrebeasts.io/` | `https://kids.bizarrebeasts.io/games/treasure-quest` |

### Bot

- `https://t.me/BizarreBeastsBot` — `/start` shows welcome GIF + game menu

### Repos

| Repo | Purpose |
|---|---|
| `github.com/bizarrebeast/bizarrebounce-tg` | Tracker + `/api/track` + `/api/me` + `/api/telegram-webhook` + `/stats` |
| `github.com/bizarrebeast/bizarre-bounce-v2` | Bizarre Bounce source |
| `github.com/bizarrebeast/bbdugeongame` | Treasure Quest source |
| `github.com/bizarrebeast/bizarrebeasts-kids` | kids.bizarrebeasts.io |

### Pending placeholder games (registered in kids site, not yet built)

`munchies-climb`, `head-crush`, `memory-game`, `tictactoe`, `checkerz`, `sliderz`, `food-fling`, `sudoku`, `sweeper`

---

## Playbook A — Enable a game on Telegram

### A.1. Pick a slug

The slug is the canonical short identifier used across BotFather, the tracker
(`plays.game` column), the subdomain, and the Mini App URL. Lowercase, no hyphens
where the bot Mini App URL is concerned (BotFather rejects hyphens in short names).

Examples: `bbbounce`, `treasurequest`, `headcrush`.

### A.2. Wire the Telegram adapter into the game

The pattern depends on the game's tech stack:

#### Pattern 1 — Inline HTML/Canvas (bbbounce style)

Inside the game's `<script>` block, after declaring `const TG = window.Telegram?.WebApp`
and `const inTelegram`:

```js
const GAME_ID = '<slug>';
let currentPlayId = null;
let pendingTrack = Promise.resolve();

function trackTG(event, payload = {}) {
  if (!inTelegram) return Promise.resolve(null);
  pendingTrack = pendingTrack.then(() =>
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, game: GAME_ID, initData: TG.initData, ...payload }),
      keepalive: true,
    }).then(r => r.ok ? r.json() : null).catch(() => null)
  );
  return pendingTrack;
}

// On Telegram init:
if (inTelegram) {
  TG.ready(); TG.expand(); TG.disableVerticalSwipes?.();
  fetch('/api/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: TG.initData, game: GAME_ID }),
  }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.high_score) playerHighScore = d.high_score; });
}
```

Then call `trackTG('play_start')` when a run starts and
`trackTG('play_end', { score, play_id: currentPlayId })` when it ends.

#### Pattern 2 — Phaser + TypeScript (Treasure Quest style)

Create `src/utils/TelegramUtils.ts` (copy from
`/Users/dylan/bizarre-underground/src/utils/TelegramUtils.ts` and change `GAME_ID`).

In `main.ts`:

```ts
import { initializeTelegram } from "./utils/TelegramUtils";
// ...
game.events.once("ready", () => {
  initializeFarcadeSDK(game);
  initializeTelegram(game);
});
```

In your main scene, mirror the existing Farcade hooks:

```ts
import { notifyTelegramPlayStart, notifyTelegramPlayEnd, isTelegramHost, shareScore } from "../utils/TelegramUtils";

// In your ready handler:
notifyTelegramPlayStart();

// In your game-over handler:
notifyTelegramPlayEnd(finalScore, { level });
if (isTelegramHost()) this.restartGame();  // no Farcade overlay in TG
```

### A.3. Add the third-party script tags (with `data-kids-strip`)

In the game's `index.html` `<head>`:

```html
<script data-kids-strip src="https://cdn.jsdelivr.net/npm/@farcade/game-sdk@latest/dist/index.min.js"></script>
<script data-kids-strip src="https://telegram.org/js/telegram-web-app.js"></script>
<script data-kids-strip async src="https://www.googletagmanager.com/gtag/js?id=G-ELH2WGKGQX"></script>
<script data-kids-strip>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ELH2WGKGQX');
</script>
```

**`data-kids-strip` is required** — it's the marker the kids build script (Playbook B) uses to remove these tags.

### A.4. Add OG meta tags

```html
<meta property="og:title" content="<Game Title>" />
<meta property="og:description" content="<one-line blurb>" />
<meta property="og:image" content="https://<slug>-tg.bizarrebeasts.io/<slug>-splash.png" />
<meta property="og:url" content="https://<slug>-tg.bizarrebeasts.io/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="BizarreBeasts" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="<Game Title>" />
<meta name="twitter:description" content="<one-line blurb>" />
<meta name="twitter:image" content="https://<slug>-tg.bizarrebeasts.io/<slug>-splash.png" />
```

Drop a 640×360 PNG at `public/<slug>-splash.png` in the tracker repo.

### A.5. Add the kids build script (also unlocks Playbook B)

Copy `/Users/dylan/bizarre-bounce-v2/scripts/build-kids.js` into the new game's
`scripts/` directory. Update `package.json`:

```json
"scripts": {
  "build": "<existing build> && node scripts/build-kids.js",
  "copy-kids": "cp dist/kids.html ../bizarrebeasts-kids/public/games/<kids-slug>/index.html"
}
```

(Note `<kids-slug>` is the hyphenated form used by the kids site, e.g.
`treasure-quest`. Different from the TG slug which has no hyphens.)

### A.6. Host on the tracker

In the tracker repo (`bizarrebounce-tg`):

1. Add a `copy-<game>` script to `package.json`:
   ```json
   "copy-<slug>": "cp ../<game-repo>/dist/index.html public/<slug>.html"
   ```
2. Add a host-based rewrite in `next.config.ts`:
   ```ts
   {
     source: '/',
     has: [{ type: 'host', value: '<slug>-tg.bizarrebeasts.io' }],
     destination: '/<slug>.html',
   },
   ```
3. Build the game, run `npm run copy-<slug>` in the tracker, commit + push.

### A.7. DNS + Vercel domain

1. Add CNAME at your DNS provider:
   - Name: `<slug>-tg`
   - Target: `cname.vercel-dns.com`
2. In Vercel project (`bizarrebeasts-tg`) → Settings → Domains → Add `<slug>-tg.bizarrebeasts.io`. SSL provisions within a minute or two.

### A.8. Register the Mini App in BotFather

In Telegram chat with `@BotFather`:

```
/newapp
→ select @BizarreBeastsBot
→ Title: <Game Title>
→ Description: <long-form description>
→ Photo: upload square icon (640x360 PNG works)
→ Demo GIF: optional, helps in Mini App store listings
→ Web App URL: https://<slug>-tg.bizarrebeasts.io/
→ Short name: <slug>
```

Launch URL becomes `t.me/BizarreBeastsBot/<slug>`.

### A.9. Update bot welcome menu

Edit `app/api/telegram-webhook/route.ts`:

```ts
const GAMES = [
  { short: 'bbbounce', label: '🎮 Bizarre Bounce' },
  { short: 'treasurequest', label: '⛏️ Treasure Quest' },
  { short: '<slug>', label: '<emoji> <Game Title>' },  // add here
];
```

If you have a welcome GIF for the new game, add it to `START_GIFS` so it
enters the rotation:

```ts
const START_GIFS = [
  `${PUBLIC_ORIGIN}/bizarrebounce-bizarrebeasts.gif`,
  `${PUBLIC_ORIGIN}/treasurequest-bizarrebeasts-loop.gif`,
  `${PUBLIC_ORIGIN}/<slug>-loop.gif`,
];
```

Drop the GIF in `public/<slug>-loop.gif`. If >10MB, ffmpeg-compress it first
(see Playbook A.10).

Commit + push the tracker repo.

### A.10. Optional — compress big GIFs

Telegram has a 20MB URL limit for `sendAnimation`. Source GIFs from designers
are often 15-20MB. Re-encode:

```bash
cd /tmp
ffmpeg -i input.gif -vf "fps=15,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff" -y palette.png
ffmpeg -i input.gif -i palette.png -lavfi "fps=15,scale=480:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" -y small.gif
```

Targets: ~5-9MB. Replace the file in `public/`.

### A.11. Verify

1. Vercel deploys (~60-90s)
2. Open `t.me/BizarreBeastsBot/<slug>` in Telegram (mobile + desktop)
3. Play through to game over
4. Check `/stats` — new section should appear with your play

---

## Playbook B — Add the game to kids.bizarrebeasts.io

### B.1. Confirm the game has Playbook A.3 + A.5 done

- `data-kids-strip` attribute on tracker `<script>` tags
- `scripts/build-kids.js` post-build step in the game project
- `npm run build` produces `dist/kids.html` (not just `dist/index.html`)

If either is missing, complete those steps first.

### B.2. Choose the kids-slug

Use the hyphenated form for URL aesthetics. Examples: `bizarre-bounce`,
`treasure-quest`, `head-crush`.

This must match the existing `id` in `lib/games-kids.ts` in the kids repo.

### B.3. Create the kids-side directory

```bash
mkdir -p /Users/dylan/bizarrebeasts-kids/public/games/<kids-slug>
```

### B.4. Copy the kids HTML

From the game project:

```bash
npm run build           # produces dist/index.html + dist/kids.html
npm run copy-kids       # cp dist/kids.html ../bizarrebeasts-kids/public/games/<kids-slug>/index.html
```

### B.5. Drop a banner image

The kids site reads `banner` from `games-kids.ts`. Default convention:

- Path: `/games/banners/<kids-slug>.png`
- Filesystem: `/Users/dylan/bizarrebeasts-kids/public/games/banners/<kids-slug>.png`

640×360 PNG works (matches Telegram splash). Source from the parent miniapp's
`/public/assets/page-assets/games/banners/` if available.

### B.6. Update the kids registry

In `/Users/dylan/bizarrebeasts-kids/lib/games-kids.ts`, find the existing
placeholder entry and:

- Set `href: "/games/<kids-slug>"`
- Remove `comingSoon: true` (or set to `false`)
- Set `banner: "/games/banners/<kids-slug>.png"`
- Confirm `accent` color matches the game's brand

### B.7. Verify the click handler still allows it

`app/api/click/route.ts` already accepts same-origin `/games/...` paths. No
changes needed. If you ever swap a game to an external host, add the
hostname to `ALLOWED_HOSTS` in that file.

### B.8. Commit + push kids repo

Vercel auto-deploys.

### B.9. Verify

1. `kids.bizarrebeasts.io/play` — tile shows with banner + title (no "Coming Soon")
2. Click tile → opens `/api/click` → 302 → `/games/<kids-slug>` → game loads
3. DevTools Network tab during play: **no requests** to `googletagmanager.com`, `telegram.org`, or any tracker domain. Phaser CDN + Google Fonts only.

If the kids HTML has any tracker requests, the `data-kids-strip` markers
weren't applied correctly in source — fix in the game project, rebuild,
re-copy.

---

## Future-game checklist (copy this when starting on the next one)

- [ ] Pick TG slug + kids slug
- [ ] Wire Telegram adapter (Pattern 1 inline or Pattern 2 TS module)
- [ ] Add `data-kids-strip` on tracker `<script>` tags
- [ ] Add OG meta tags pointing at `<slug>-tg.bizarrebeasts.io`
- [ ] Add `scripts/build-kids.js`, update `package.json` scripts
- [ ] Add `copy-<slug>` script in tracker `package.json`
- [ ] Add host-based rewrite in tracker `next.config.ts`
- [ ] Add CNAME at DNS provider
- [ ] Attach domain in Vercel
- [ ] `/newapp` in BotFather
- [ ] Add to `GAMES` array in webhook route
- [ ] Add welcome GIF to `START_GIFS` (optional)
- [ ] Build + verify TG flow
- [ ] `mkdir public/games/<kids-slug>` in kids repo
- [ ] `npm run copy-kids` from game project
- [ ] Banner PNG → `public/games/banners/<kids-slug>.png`
- [ ] Update `lib/games-kids.ts` entry (href, banner, remove `comingSoon`)
- [ ] Commit + push kids repo
- [ ] Verify tile + click flow + no tracker requests in DevTools
