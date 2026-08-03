-- Label Cleanup Reference
-- =======================
-- Run these snippets in the Supabase SQL Editor when you need to maintain
-- the crowdsourced label pool.  No admin UI is required.
--
-- Prerequisites:
--   • The labels table must exist (see supabase_migration_labels.sql)
--   • You have SQL Editor access in the Supabase dashboard

-- ── 1. Merge two labels (e.g. a misspelling into the canonical form) ──

-- Example: merge "Vinegar Syndicate" → "Vinegar Syndrome"
update releases
set label = 'Vinegar Syndrome'
where label = 'Vinegar Syndicate';

delete from labels
where normalized = 'vinegar syndicate';

update labels
set usage_count = (
  select count(*) from releases where label = 'Vinegar Syndrome'
)
where normalized = 'vinegar syndrome';


-- ── 2. Rename a label globally ──

-- Example: rebrand "Arrow Video" → "Arrow Films"
update releases
set label = 'Arrow Films'
where label = 'Arrow Video';

update labels
set name = 'Arrow Films',
    normalized = 'arrow films'
where normalized = 'arrow video';


-- ── 3. Delete a bogus label entirely ──

-- Clear it from releases first (optional — they'll show as unlabeled)
update releases
set label = ''
where label = 'Some Bogus Label';

delete from labels
where normalized = 'some bogus label';


-- ── 4. Recalculate all usage counts from scratch ──

-- Useful after bulk imports or manual cleanup
update labels l
set usage_count = coalesce((
  select count(*) from releases r where r.label = l.name
), 0);


-- ── 5. Find likely typos / low-usage outliers ──

select *
from labels
where usage_count <= 2
order by usage_count, name;

-- ── 6. Find potential near-duplicates with trigram similarity ──

select
  a.name as label_a,
  b.name as label_b,
  similarity(a.name, b.name) as sim
from labels a
join labels b on a.normalized < b.normalized
where similarity(a.name, b.name) > 0.5
order by sim desc;