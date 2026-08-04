-- Migration: enable Row-Level Security (RLS) on all tables
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: drops old policies before recreating them.
--
-- Rationale:
--   • releases, films, special_features: public read for future community
--     features; writes scoped to the owning user.
--   • labels: public read; authenticated users can add/update (crowdsourced
--     pool). No DELETE policy — manual cleanup via SQL editor only.

-- ── 1. Enable RLS on all tables ───────────────────────────────────────────────

alter table if exists releases enable row level security;
alter table if exists films enable row level security;
alter table if exists special_features enable row level security;
alter table if exists labels enable row level security;

-- ── 2. Drop any existing policies so this script is idempotent ────────────────

drop policy if exists "Releases: public read" on releases;
drop policy if exists "Releases: owner insert" on releases;
drop policy if exists "Releases: owner update" on releases;
drop policy if exists "Releases: owner delete" on releases;

drop policy if exists "Films: public read" on films;
drop policy if exists "Films: owner insert" on films;
drop policy if exists "Films: owner update" on films;
drop policy if exists "Films: owner delete" on films;

drop policy if exists "Special features: public read" on special_features;
drop policy if exists "Special features: owner insert" on special_features;
drop policy if exists "Special features: owner update" on special_features;
drop policy if exists "Special features: owner delete" on special_features;

drop policy if exists "Labels: public read" on labels;
drop policy if exists "Labels: authenticated insert" on labels;
drop policy if exists "Labels: authenticated update" on labels;

-- ── 3. releases policies ──────────────────────────────────────────────────────

create policy "Releases: public read"
  on releases for select
  using (true);

create policy "Releases: owner insert"
  on releases for insert
  with check (user_id = auth.uid());

create policy "Releases: owner update"
  on releases for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Releases: owner delete"
  on releases for delete
  using (user_id = auth.uid());

-- ── 4. films policies (ownership through parent release) ──────────────────────

create policy "Films: public read"
  on films for select
  using (true);

create policy "Films: owner insert"
  on films for insert
  with check (
    exists (
      select 1 from releases
      where releases.id = films.release_id
        and releases.user_id = auth.uid()
    )
  );

create policy "Films: owner update"
  on films for update
  using (
    exists (
      select 1 from releases
      where releases.id = films.release_id
        and releases.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from releases
      where releases.id = films.release_id
        and releases.user_id = auth.uid()
    )
  );

create policy "Films: owner delete"
  on films for delete
  using (
    exists (
      select 1 from releases
      where releases.id = films.release_id
        and releases.user_id = auth.uid()
    )
  );

-- ── 5. special_features policies (ownership through parent release) ───────────

create policy "Special features: public read"
  on special_features for select
  using (true);

create policy "Special features: owner insert"
  on special_features for insert
  with check (
    exists (
      select 1 from releases
      where releases.id = special_features.release_id
        and releases.user_id = auth.uid()
    )
  );

create policy "Special features: owner update"
  on special_features for update
  using (
    exists (
      select 1 from releases
      where releases.id = special_features.release_id
        and releases.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from releases
      where releases.id = special_features.release_id
        and releases.user_id = auth.uid()
    )
  );

create policy "Special features: owner delete"
  on special_features for delete
  using (
    exists (
      select 1 from releases
      where releases.id = special_features.release_id
        and releases.user_id = auth.uid()
    )
  );

-- ── 6. labels policies (crowdsourced pool) ────────────────────────────────────

create policy "Labels: public read"
  on labels for select
  using (true);

create policy "Labels: authenticated insert"
  on labels for insert
  with check (auth.role() = 'authenticated');

create policy "Labels: authenticated update"
  on labels for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- No DELETE policy on labels — prevents vandalism of the shared pool.