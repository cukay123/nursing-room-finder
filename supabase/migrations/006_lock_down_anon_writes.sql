-- Remove anonymous write access that was granted while wiring up the MVP.
--
-- Two holes are closed here:
--
--   1. postal_code_cache was the only table 001 never enabled RLS on, and 003
--      granted anon both INSERT and UPDATE. Since /api/postal-code-to-coords
--      serves the cache before falling back to OneMap, anyone holding the public
--      anon key could rewrite the coordinates any postal code resolves to.
--
--   2. 005 granted anon INSERT on room_details with a `with check (true)` policy.
--      Nothing in the app needs it: /api/submit-venue only writes to submissions,
--      and admin approval inserts room_details via the service role.
--
-- Writes to both tables now go through server-side routes on the service role,
-- which bypasses RLS. Public reads are unaffected.

-- 1. postal_code_cache: read-only for anon
revoke insert, update on postal_code_cache from anon;

alter table postal_code_cache enable row level security;

-- RLS is now on, so the existing anon SELECT grant needs a matching policy
-- or cached lookups would start returning empty.
drop policy if exists "postal_code_cache_select_all" on postal_code_cache;
create policy "postal_code_cache_select_all" on postal_code_cache
  for select
  using (true);

-- 2. room_details: no anonymous inserts
revoke insert on room_details from anon;

drop policy if exists "room_details_insert_anon" on room_details;
