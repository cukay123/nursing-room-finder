-- Enable PostGIS extension for geospatial queries
create extension if not exists postgis;

-- Venues table: core nursing room data
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'Nursing Room', -- Nursing Room | Nursing Pod | Family Room
  address text,
  postal_code text,
  location geography(Point, 4326) not null, -- PostGIS point: (latitude, longitude)
  building_match_confidence text,            -- HIGH | LOW_REVIEW | NO_MATCH | MANUAL
  source text,                               -- BMSG | SassyMama | Nominatim | USER_SUBMITTED
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Room amenities and details
create table room_details (
  venue_id uuid primary key references venues(id) on delete cascade,
  floor_level text,
  has_changing_table boolean default false,
  has_lock boolean default false,
  has_sink boolean default false,
  has_power_outlet boolean default false,
  stroller_friendly boolean default false,
  dad_friendly boolean default false,  -- not inside female-only restroom
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User submissions: new venue proposals or edits to existing venues
create table submissions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete set null, -- null if proposing a new venue
  submitted_by uuid references auth.users(id) on delete set null,
  payload jsonb not null,  -- { name, address, type, amenities_edits, etc. }
  status text default 'pending', -- pending | approved | rejected
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- Confirmations: users verify venue still exists / info is current
create table confirmations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  still_there boolean not null,
  notes text,
  created_at timestamptz default now()
);

-- Photos: user-uploaded images of nursing rooms
create table photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  storage_path text not null, -- path in Supabase Storage
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Postal code cache: avoid re-querying OneMap for popular codes
create table postal_code_cache (
  postal_code text primary key,
  latitude double precision not null,
  longitude double precision not null,
  resolved_at timestamptz default now()
);

-- Indexes for performance
create index venues_location_idx on venues using gist (location);
create index venues_postal_code_idx on venues(postal_code);
create index submissions_status_idx on submissions(status);
create index confirmations_venue_id_idx on confirmations(venue_id);
create index photos_venue_id_idx on photos(venue_id);

-- PostGIS helper function: find nearest nursing rooms to user
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
  distance_meters double precision,
  last_confirmed_at timestamptz
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
    ST_Distance(v.location, ST_MakePoint(user_lng, user_lat)::geography) as distance_meters,
    max(c.created_at) as last_confirmed_at
  from venues v
  left join room_details rd on rd.venue_id = v.id
  left join confirmations c on c.venue_id = v.id
  where ST_DWithin(v.location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
  group by v.id, v.name, v.type, v.address, v.postal_code, v.location, rd.floor_level, rd.has_lock,
           rd.has_changing_table, rd.has_sink, rd.has_power_outlet, rd.stroller_friendly,
           rd.dad_friendly
  order by distance_meters asc;
$$;

-- Row-level security: allow public read, authenticated users can submit
alter table venues enable row level security;
alter table room_details enable row level security;
alter table submissions enable row level security;
alter table confirmations enable row level security;
alter table photos enable row level security;

create policy "venues_select_all" on venues for select using (true);
create policy "room_details_select_all" on room_details for select using (true);
create policy "submissions_insert_auth" on submissions for insert with check (auth.uid() = submitted_by);
create policy "submissions_select_all" on submissions for select using (true);
create policy "confirmations_insert_auth" on confirmations for insert with check (auth.uid() = user_id);
create policy "confirmations_select_all" on confirmations for select using (true);
create policy "photos_insert_auth" on photos for insert with check (auth.uid() = uploaded_by);
create policy "photos_select_all" on photos for select using (true);
