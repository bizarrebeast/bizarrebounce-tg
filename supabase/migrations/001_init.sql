-- BizarreBounce tracker schema
-- Run this in the Supabase SQL editor (or via `supabase db push` if using CLI).
-- All writes happen server-side with the service_role key, so we don't enable RLS.

create table if not exists players (
  tg_user_id    bigint primary key,
  username      text,
  first_name    text,
  language_code text,
  is_premium    boolean,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  total_plays   integer not null default 0,
  high_score    integer not null default 0
);

create table if not exists plays (
  id           bigserial primary key,
  tg_user_id   bigint not null references players(tg_user_id) on delete cascade,
  game         text not null default 'bizarrebounce',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  score        integer,
  start_param  text,                              -- referral attribution from t.me/<bot>?startapp=<param>
  client_meta  jsonb                              -- viewport, locale, platform — optional debug payload
);

create index if not exists plays_user_idx    on plays (tg_user_id, started_at desc);
create index if not exists plays_started_idx on plays (started_at desc);
create index if not exists plays_source_idx  on plays (start_param) where start_param is not null;

-- Helpful views for the "show me numbers" question.
create or replace view stats_summary as
select
  (select count(*) from players)                                  as unique_players,
  (select count(*) from plays)                                    as total_plays,
  (select count(*) from plays where ended_at is not null)         as completed_plays,
  (select max(score) from plays)                                  as top_score,
  (select count(*) from plays where started_at > now() - interval '24 hours') as plays_24h,
  (select count(distinct tg_user_id) from plays where started_at > now() - interval '24 hours') as dau;

create or replace view top_referrers as
select start_param, count(*) as plays, count(distinct tg_user_id) as unique_players
from plays
where start_param is not null
group by start_param
order by plays desc;
