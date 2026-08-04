-- Migration: add special feature ratings table
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: drops old policies before recreating them.

-- ── 1. Create table ───────────────────────────────────────────────────────────

create table if not exists special_feature_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  release_id uuid not null references releases on delete cascade,
  special_feature_id uuid not null references special_features on delete cascade,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz default now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

create index if not exists idx_sfr_user_feature
  on special_feature_ratings (user_id, special_feature_id);

create index if not exists idx_sfr_feature
  on special_feature_ratings (special_feature_id);

create index if not exists idx_sfr_release
  on special_feature_ratings (release_id);

-- ── 3. Unique constraint ──────────────────────────────────────────────────────

-- One vote per user per special feature
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sfr_user_feature_unique'
  ) then
    alter table special_feature_ratings
      add constraint sfr_user_feature_unique
      unique (user_id, special_feature_id);
  end if;
end $$;

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

alter table if exists special_feature_ratings enable row level security;

-- Drop existing policies for idempotency
drop policy if exists "SFR: public read" on special_feature_ratings;
drop policy if exists "SFR: owner insert" on special_feature_ratings;
drop policy if exists "SFR: owner update" on special_feature_ratings;
drop policy if exists "SFR: owner delete" on special_feature_ratings;

-- Public read (future community aggregation)
create policy "SFR: public read"
  on special_feature_ratings for select
  using (true);

-- Owner insert
create policy "SFR: owner insert"
  on special_feature_ratings for insert
  with check (user_id = auth.uid());

-- Owner update
create policy "SFR: owner update"
  on special_feature_ratings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Owner delete
create policy "SFR: owner delete"
  on special_feature_ratings for delete
  using (user_id = auth.uid());