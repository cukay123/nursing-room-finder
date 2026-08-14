-- Grant permissions for anon role to submit venues
grant insert, select on submissions to anon;
grant insert, select on room_details to anon;

-- Drop existing restrictive policy and allow anonymous submissions
drop policy if exists "submissions_insert_auth" on submissions;

-- New policy: allow anonymous submissions (submitted_by = null)
create policy "submissions_insert_anon" on submissions
  for insert
  with check (submitted_by is null);

-- Allow anyone to view submissions
drop policy if exists "submissions_select_all" on submissions;
create policy "submissions_select_all" on submissions
  for select
  using (true);

-- Allow anon to insert into room_details
alter table room_details enable row level security;
drop policy if exists "room_details_insert_auth" on room_details;
drop policy if exists "room_details_select_all" on room_details;
create policy "room_details_insert_anon" on room_details
  for insert
  with check (true);
create policy "room_details_select_all" on room_details
  for select
  using (true);
