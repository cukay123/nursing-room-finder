-- Stop anonymous clients reading the submissions queue.
--
-- 001 created `submissions_select_all using (true)` and 002/005 granted anon
-- SELECT, so anyone holding the public anon key could read every pending and
-- rejected submission — including the free-text notes people type into the
-- add-a-room form, which can carry personal detail.
--
-- Nothing in the app needs that access: /api/admin/submissions reads through the
-- service role, which bypasses RLS. INSERT stays open, since submitting a room
-- is the whole point of the crowdsourcing form.

revoke select on submissions from anon;

drop policy if exists "submissions_select_all" on submissions;

-- Keep a SELECT policy in place for the authenticated role so that adding real
-- user accounts later does not silently re-expose the whole queue: a signed-in
-- user sees only their own submissions.
drop policy if exists "submissions_select_own" on submissions;
create policy "submissions_select_own" on submissions
  for select
  to authenticated
  using (submitted_by = auth.uid());
