-- Reviews: a star rating and optional comment per visit.
--
-- Distinct from `confirmations`, which answer "is this room still here and
-- accurate". Reviews answer "what was it like". Keeping them separate means a
-- one-star review never suppresses the freshness signal, and a confirmation
-- never inflates a rating.
--
-- Anonymous, like submissions and confirmations — the app has no user accounts.
-- Writes therefore go through the service role in /api/reviews, never directly
-- from the browser.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- null while anonymous
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  -- Moderation escape hatch. Reviews publish immediately (a queue nobody empties
  -- makes the feature feel dead), but an admin can hide abuse after the fact.
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz default now()
);

create index reviews_venue_id_idx on reviews(venue_id) where status = 'visible';
create index reviews_status_idx on reviews(status);

alter table reviews enable row level security;

-- Public may read visible reviews only; hidden ones vanish for everyone but the
-- service role, which bypasses RLS.
create policy "reviews_select_visible" on reviews
  for select
  using (status = 'visible');

grant select on reviews to anon;
grant select, insert, update, delete on reviews to service_role;

-- Note there is deliberately no INSERT grant for anon. Posting goes through
-- /api/reviews so it can be rate-limited and validated server-side.

-- Surface rating aggregates alongside the venue list, so the map and list views
-- do not need a query per venue.
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
    -- Scalar subqueries, not another join: joining reviews alongside
    -- confirmations would multiply the rows and corrupt both aggregates.
    (select round(avg(r.rating)::numeric, 1)
       from reviews r where r.venue_id = v.id and r.status = 'visible') as avg_rating,
    (select count(*)
       from reviews r where r.venue_id = v.id and r.status = 'visible') as review_count
  from venues v
  left join room_details rd on rd.venue_id = v.id
  left join confirmations c on c.venue_id = v.id
  where ST_DWithin(v.location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
  group by v.id, v.name, v.type, v.address, v.postal_code, v.location, rd.floor_level, rd.has_lock,
           rd.has_changing_table, rd.has_sink, rd.has_power_outlet, rd.stroller_friendly,
           rd.dad_friendly, rd.has_diaper_mat, rd.can_buy_diaper
  order by distance_meters asc;
$$;
