-- ============================================================
-- Schovka – schéma databázy (Supabase / PostgreSQL)
-- Spusti celé v Supabase SQL Editori.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Denné kódy: hráč zadá kód, aby sa mu odokryla schovka.
-- ------------------------------------------------------------
create table if not exists public.daily_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text,
  active      boolean not null default true,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists daily_codes_code_idx on public.daily_codes (code);
create index if not exists daily_codes_expires_idx on public.daily_codes (expires_at);

-- ------------------------------------------------------------
-- Schovky: jedno miesto = jeden riadok, viazané na denný kód.
-- ------------------------------------------------------------
create table if not exists public.hides (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references public.daily_codes (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  hint        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists hides_code_id_idx on public.hides (code_id);
create index if not exists hides_created_idx on public.hides (created_at desc);

-- ------------------------------------------------------------
-- Overenie kódu prebieha výhradne cez túto funkciu.
-- Je SECURITY DEFINER, takže anonymný hráč nevidí celú tabuľku,
-- dostane len schovku k PLATNÉMU (aktívnemu, neexpirovanému) kódu.
-- ------------------------------------------------------------
create or replace function public.redeem_code(p_code text)
returns table (
  hide_id    uuid,
  lat        double precision,
  lng        double precision,
  hint       text,
  note       text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select h.id, h.lat, h.lng, h.hint, h.note, c.expires_at
  from public.daily_codes c
  join public.hides h on h.code_id = c.id
  where c.code = upper(btrim(p_code))
    and c.active
    and c.expires_at > now()
  order by h.created_at desc
  limit 1;
$$;

-- Anonymní hráči smú funkciu len spustiť, nie čítať tabuľky priamo.
revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to anon, authenticated;

-- ------------------------------------------------------------
-- RLS: tabuľky sú zatvorené, číta/zapisuje len prihlásený admin.
-- ------------------------------------------------------------
alter table public.daily_codes enable row level security;
alter table public.hides      enable row level security;

drop policy if exists "admin all daily_codes" on public.daily_codes;
create policy "admin all daily_codes" on public.daily_codes
  for all to authenticated using (true) with check (true);

drop policy if exists "admin all hides" on public.hides;
create policy "admin all hides" on public.hides
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Demo dáta (voliteľné – môžeš zmazať).
-- Najprv si vytvor admin používateľa v Authentication → Users.
-- ------------------------------------------------------------
insert into public.daily_codes (code, label, expires_at)
values ('SCHOVKA', 'Ukážkový kód', now() + interval '7 days')
on conflict (code) do nothing;

-- Ukážková schovka (Holíč, námestie):
insert into public.hides (code_id, lat, lng, hint, note)
select id, 48.8103, 17.1631, 'Námestie v centre — pri fontáne.', 'Demo schovka'
from public.daily_codes
where code = 'SCHOVKA'
  and not exists (select 1 from public.hides);
