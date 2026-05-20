-- Multi-game refactor.
-- Adds per-(player, game) stats so a single player can have separate high scores
-- across multiple games hosted on @BizarreBeastsBot.
-- Additive only: existing players.high_score / players.total_plays columns are
-- left intact for safety; new code stops writing to them and will be cleaned
-- up in a future migration.

-- 1. Per-game stats keyed on the composite (tg_user_id, game).
create table if not exists player_game_stats (
  tg_user_id      bigint  not null references players(tg_user_id) on delete cascade,
  game            text    not null,
  total_plays     integer not null default 0,
  high_score      integer not null default 0,
  high_score_meta jsonb,                            -- e.g. {"level": 17, "diamonds": 4} for TQ
  first_played    timestamptz not null default now(),
  last_played     timestamptz not null default now(),
  primary key (tg_user_id, game)
);

create index if not exists player_game_stats_game_idx
  on player_game_stats (game, high_score desc);

-- 2. Backfill from existing plays. Aggregates by (user, game) so the truth lives
--    in the plays table and we derive stats from it.
insert into player_game_stats (tg_user_id, game, total_plays, high_score, first_played, last_played)
select
  p.tg_user_id,
  p.game,
  count(*)                                                      as total_plays,
  coalesce(max(p.score), 0)                                     as high_score,
  min(p.started_at)                                             as first_played,
  max(coalesce(p.ended_at, p.started_at))                       as last_played
from plays p
group by p.tg_user_id, p.game
on conflict (tg_user_id, game) do nothing;

-- 3. Per-game summary view. The original stats_summary stays (it aggregates
--    across all games and still works for global ops); this one is parameterized
--    via the WHERE-clause pattern most apps use.
create or replace view stats_by_game as
select
  p.game,
  count(distinct p.tg_user_id)                                                       as unique_players,
  count(*)                                                                            as total_plays,
  count(*) filter (where p.ended_at is not null)                                      as completed_plays,
  max(p.score)                                                                        as top_score,
  count(*) filter (where p.started_at > now() - interval '24 hours')                  as plays_24h,
  count(distinct p.tg_user_id) filter (where p.started_at > now() - interval '24 hours') as dau
from plays p
group by p.game;

-- 4. Per-game referrers (top_referrers stays as the global view).
create or replace view top_referrers_by_game as
select p.game, p.start_param, count(*) as plays, count(distinct p.tg_user_id) as unique_players
from plays p
where p.start_param is not null
group by p.game, p.start_param
order by p.game, plays desc;
