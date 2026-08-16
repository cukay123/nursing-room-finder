-- "Verified X days ago" must only reflect positive confirmations.
--
-- nearest_venues computed last_confirmed_at as max(c.created_at) across every
-- confirmation row, ignoring still_there. So once the Yes/No buttons started
-- writing rows, reporting a room as gone would have made the card announce
-- "✅ Verified today" — the exact opposite of what the reporter said.
--
-- Also exposes negative_reports so the UI can warn when a room has been flagged.

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
  negative_reports bigint
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
    count(c.id) filter (where not c.still_there) as negative_reports
  from venues v
  left join room_details rd on rd.venue_id = v.id
  left join confirmations c on c.venue_id = v.id
  where ST_DWithin(v.location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
  group by v.id, v.name, v.type, v.address, v.postal_code, v.location, rd.floor_level, rd.has_lock,
           rd.has_changing_table, rd.has_sink, rd.has_power_outlet, rd.stroller_friendly,
           rd.dad_friendly, rd.has_diaper_mat, rd.can_buy_diaper
  order by distance_meters asc;
$$;
