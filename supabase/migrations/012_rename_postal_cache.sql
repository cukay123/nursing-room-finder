-- Rename postal_code_cache -> location_cache.
--
-- The lookup was always passing free text straight to OneMap's search endpoint,
-- which matches building names and streets as happily as postal codes. So the
-- cache has been storing rows keyed "Bedok Mall" in a column called postal_code
-- since day one — the name described an assumption nobody had checked, not the
-- data.
--
-- Renaming rather than leaving it: a misleading schema name is exactly what made
-- seed_nursing_rooms.csv (hand-curated, not the merge output) so easy to
-- misread. ALTER ... RENAME carries the policies, grants and indexes across.

alter table postal_code_cache rename to location_cache;
alter table location_cache rename column postal_code to query;

alter policy "postal_code_cache_select_all" on location_cache
  rename to "location_cache_select_all";
