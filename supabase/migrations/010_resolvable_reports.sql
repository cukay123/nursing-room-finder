-- Let an admin clear a handled report without destroying it.
--
-- Negative confirmations (the "No" button and Report Issue) were being written
-- with nowhere to surface them, so they accumulated unseen. The admin portal now
-- lists them, which needs a way to mark one dealt with — otherwise the list only
-- ever grows and stops being read, which is how it ended up ignored in the first
-- place.
--
-- Resolving rather than deleting keeps the history: a room repeatedly reported
-- as gone is a signal worth seeing even after each individual report is cleared.

alter table confirmations
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

-- The admin list only ever asks for unresolved negatives, so index exactly that.
create index if not exists confirmations_open_reports_idx
  on confirmations (created_at desc)
  where not still_there and resolved_at is null;
