-- Migration: add crowdsourced labels table
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to run once; re-running is a no-op thanks to IF NOT EXISTS guards.

-- Enable trigram extension for similarity search (optional, but useful for cleanup queries)
create extension if not exists pg_trgm;

-- 1. Create the labels table.
create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- canonical display form (e.g. "Vinegar Syndrome")
  normalized text not null unique,  -- lowercase, trimmed, collapsed whitespace
  usage_count int not null default 0,
  created_at timestamptz default now()
);

-- 2. Seed with the existing hardcoded label list so current users don't lose suggestions.
insert into labels (name, normalized, usage_count)
values
  ('101 Films', '101 films', 0),
  ('20th Century Studios', '20th century studios', 0),
  ('88 Films', '88 films', 0),
  ('A24', 'a24', 0),
  ('AGFA', 'agfa', 0),
  ('Anchor Bay Entertainment', 'anchor bay entertainment', 0),
  ('Arrow Video', 'arrow video', 0),
  ('Blue Underground', 'blue underground', 0),
  ('Cauldron Films', 'cauldron films', 0),
  ('Cinema Guild', 'cinema guild', 0),
  ('ClassicFlix', 'classicflix', 0),
  ('Code Red', 'code red', 0),
  ('Cohen Media Group', 'cohen media group', 0),
  ('The Criterion Collection', 'the criterion collection', 0),
  ('Deaf Crocodile', 'deaf crocodile', 0),
  ('DiabolikDVD', 'diabolikdvd', 0),
  ('Disney / Buena Vista', 'disney / buena vista', 0),
  ('Eureka Classics', 'eureka classics', 0),
  ('Flicker Alley', 'flicker alley', 0),
  ('Full Moon Features', 'full moon features', 0),
  ('Grasshopper Film', 'grasshopper film', 0),
  ('Imprint', 'imprint', 0),
  ('Kino Lorber', 'kino lorber', 0),
  ('Lionsgate Films', 'lionsgate films', 0),
  ('MGM', 'mgm', 0),
  ('Mill Creek', 'mill creek', 0),
  ('MVD Rewind', 'mvd rewind', 0),
  ('New Line Cinema', 'new line cinema', 0),
  ('Olive Films', 'olive films', 0),
  ('Oscilloscope Laboratories', 'oscilloscope laboratories', 0),
  ('Paramount Pictures', 'paramount pictures', 0),
  ('powerhouse/Indicator', 'powerhouse/indicator', 0),
  ('Radiance Films', 'radiance films', 0),
  ('Raro Video', 'raro video', 0),
  ('Sandpiper Pictures', 'sandpiper pictures', 0),
  ('Scream Factory', 'scream factory', 0),
  ('Second Run', 'second run', 0),
  ('Second Sight', 'second sight', 0),
  ('Severin Films', 'severin films', 0),
  ('Shout! Factory', 'shout! factory', 0),
  ('Sony Pictures', 'sony pictures', 0),
  ('StudioCanal', 'studiocanal', 0),
  ('Synapse Films', 'synapse films', 0),
  ('Terror Vision', 'terror vision', 0),
  ('Troma Entertainment', 'troma entertainment', 0),
  ('Umbrella Entertainment', 'umbrella entertainment', 0),
  ('Unearthed Films', 'unearthed films', 0),
  ('Universal Pictures', 'universal pictures', 0),
  ('Vinegar Syndrome', 'vinegar syndrome', 0),
  ('Warner Archive', 'warner archive', 0),
  ('Warner Bros', 'warner bros', 0)
on conflict (normalized) do nothing;

-- 3. Index for fast prefix/contains search.
create index if not exists idx_labels_name on labels using gin(name gin_trgm_ops);