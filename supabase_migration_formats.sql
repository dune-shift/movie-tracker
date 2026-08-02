-- Migration: convert films.format (single text) -> films.formats (text[])
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to run once; re-running is a no-op thanks to IF NOT EXISTS / guards.

-- 1. Add the new array column.
alter table films
  add column if not exists formats text[] not null default '{}';

-- 2. Backfill: copy each row's existing single `format` value into the new
--    array column (skipping empty/null values).
update films
set formats = array[format]
where format is not null
  and format <> ''
  and (formats is null or formats = '{}');

-- 3. (Optional cleanup) Once you've verified the app is reading/writing
--    `formats` correctly, you can drop the old column:
--
-- alter table films drop column format;
