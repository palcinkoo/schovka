-- ============================================================
-- Schovka – GPS navigácia a záznam trás (Supabase / PostgreSQL)
-- Spusti celé v Supabase SQL Editori.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Trasy: jeden záznam = jedna zaznamenaná trasa.
-- points = pole bodov [{lat, lng, acc, t}] vo formáte JSON.
-- ------------------------------------------------------------
create table if not exists public.tracks (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  distance_m    numeric not null default 0 check (distance_m >= 0),
  duration_s    integer not null default 0 check (duration_s >= 0),
  avg_speed_kmh numeric,
  points        jsonb not null default '[]'::jsonb check (jsonb_typeof(points) = 'array'),
  created_at    timestamptz not null default now()
);

create index if not exists tracks_started_idx on public.tracks (started_at desc);

-- ------------------------------------------------------------
-- RLS – DEMO nastavenie: aplikácia nemá prihlásenie, preto môže
-- anonymný návštevník trasy čítať aj zapisovať.
--
-- ‼️ PRE PRODUKCIU: pridaj prihlásenie a obmedz politiky na
-- vlastníka riadku (návod na konci súboru).
-- ------------------------------------------------------------
alter table public.tracks enable row level security;

drop policy if exists "anon select tracks" on public.tracks;
create policy "anon select tracks" on public.tracks
  for select to anon, authenticated using (true);

drop policy if exists "anon insert tracks" on public.tracks;
create policy "anon insert tracks" on public.tracks
  for insert to anon, authenticated with check (true);

drop policy if exists "anon update tracks" on public.tracks;
create policy "anon update tracks" on public.tracks
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "anon delete tracks" on public.tracks;
create policy "anon delete tracks" on public.tracks
  for delete to anon, authenticated using (true);

-- ------------------------------------------------------------
-- Voliteľné obmedzenie veľkosti jednej trasy (počty bodov):
-- dlhé trasy môžu mať tisíce bodov, zváž ich zjednodušenie
-- (napr. ukladať každý 3. bod) alebo limit v aplikácii.
-- ------------------------------------------------------------

-- ============================================================
-- PRODUKČNÉ NASTAVENIE (odkomentuj po pridaní prihlásenia):
-- ============================================================
-- alter table public.tracks add column if not exists user_id uuid references auth.users (id);
--
-- drop policy if exists "anon select tracks"   on public.tracks;
-- drop policy if exists "anon insert tracks"   on public.tracks;
-- drop policy if exists "anon update tracks"   on public.tracks;
-- drop policy if exists "anon delete tracks"   on public.tracks;
--
-- create policy "own tracks" on public.tracks
--   for all to authenticated
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
