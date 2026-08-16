-- Let an admin take a room off the map after checking a report.
--
-- Handling a report is really one of two decisions: the room is fine and the
-- report was wrong ("keep"), or the room is genuinely gone ("remove"). A single
-- "mark resolved" recorded that someone looked, but not what they concluded —
-- and gave no way to act on the second case at all.
--
-- Removal is a soft delete. A hard delete would cascade through room_details,
-- confirmations, photos and reviews, destroying the reports that justified the
-- decision and making a mistaken removal unrecoverable. Rooms also reopen:
-- a mall refurbishment closes a nursing room for three months, not forever.

alter table venues
  add column if not exists removed_at timestamptz,
  add column if not exists removed_reason text;

create index if not exists venues_active_idx on venues (id) where removed_at is null;

-- Exclude removed rooms from the public map and list.
drop function if exists nearest_venues(double precision, double precision, int);

create or replace function nearest_venues(
  user_lat double precision,
  user_lng double precision,
  radius_meters int default 2000
)
returns table (
  id uuid,
  name text,
  type text,
  address text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  floor_level text,
  has_lock boolean,
  has_changing_table boolean,
  has_sink boolean,
  has_power_outlet boolean,
  stroller_friendly boolean,
  dad_friendly boolean,
  has_diaper_mat boolean,
  can_buy_diaper boolean,
  distance_meters double precision,
  last_confirmed_at timestamptz,
  negative_reports bigint,
  avg_rating numeric,
  review_count bigint
)
language sql stable
as $$
  select
    v.id,
    v.name,
    v.type,
    v.address,
    v.postal_code,
    ST_Y(v.location::geometry)::double precision as latitude,
    ST_X(v.location::geometry)::double precision as longitude,
    rd.floor_level,
    rd.has_lock,
    rd.has_changing_table,
    rd.has_sink,
    rd.has_power_outlet,
    rd.stroller_friendly,
    rd.dad_friendly,
    rd.has_diaper_mat,
    rd.can_buy_diaper,
    ST_Distance(v.location, ST_MakePoint(user_lng, user_lat)::geography) as distance_meters,
    max(c.created_at) filter (where c.still_there) as last_confirmed_at,
    count(c.id) filter (where not c.still_there) as negative_reports,
    (select round(avg(r.rating)::numeric, 1)
       from reviews r where r.venue_id = v.id and r.status = 'visible') as avg_rating,
    (select count(*)
       from reviews r where r.venue_id = v.id and r.status = 'visible') as review_count
  from venues v
  left join room_details rd on rd.venue_id = v.id
  left join confirmations c on c.venue_id = v.id
  where ST_DWithin(v.location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
    and v.removed_at is null
  group by v.id, v.name, v.type, v.address, v.postal_code, v.location, rd.floor_level, rd.has_lock,
           rd.has_changing_table, rd.has_sink, rd.has_power_outlet, rd.stroller_friendly,
           rd.dad_friendly, rd.has_diaper_mat, rd.can_buy_diaper
  order by distance_meters asc;
$$;
