-- Add permissions for anon role to read data
grant select on venues to anon;
grant select on room_details to anon;
grant select on confirmations to anon;
grant select on photos to anon;
grant select on submissions to anon;
grant select on postal_code_cache to anon;

-- Add permissions for service role to insert data
grant select, insert, update on venues to service_role;
grant select, insert, update on room_details to service_role;
grant select, insert, update on submissions to service_role;
grant select, insert, update on confirmations to service_role;
grant select, insert, update on photos to service_role;
grant select, insert, update on postal_code_cache to service_role;

-- Add INSERT policies for venues and room_details to allow imports
-- Service role can insert venues
create policy "venues_insert" on venues
  for insert
  with check (true);

-- Service role can insert room_details
create policy "room_details_insert" on room_details
  for insert
  with check (true);
