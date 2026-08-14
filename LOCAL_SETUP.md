# 🐳 Local Development with Docker (Supabase CLI)

This guide covers running Nursing Room Finder locally using Supabase CLI with Docker, which eliminates the need for a hosted Supabase account and allows full control of your development database.

## Prerequisites

- **Docker Desktop** installed and running (Mac/Windows) or Docker Engine (Linux)
  - [Mac install](https://www.docker.com/products/docker-desktop)
  - [Windows install](https://www.docker.com/products/docker-desktop)
  - [Linux install](https://docs.docker.com/engine/install/)
- **Supabase CLI** v2.111.0+
  - Install via npm: `npm install -g supabase`
  - Or via Homebrew (Mac): `brew install supabase/tap/supabase`
- **Node.js** 18+ and npm

## Setup (First Time)

### 1. Initialize Supabase Project

If not already done:
```bash
cd nursing-room-finder
supabase init
```

This creates `supabase/` directory with migrations folder. The project is already initialized for you.

### 2. Start Docker Containers

```bash
supabase start
```

This runs in the foreground and outputs credentials. Example:
```
Started Supabase local development setup.

         API URL: http://localhost:54321
     Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     Studio URL: http://localhost:54323
```

Keep this terminal running. Open a new terminal for the next steps.

### 3. Deploy Migrations

In a new terminal (while `supabase start` is still running):
```bash
supabase db push
```

This applies all migrations in `supabase/migrations/` to your local database. You should see:
```
Applying migration: 001_initial_schema.sql
✓ Database migration complete
```

### 4. Configure Environment

```bash
cp .env.local.example .env.local
```

The `.env.local.example` already has localhost credentials. If you need to update them:
```bash
supabase status
```

Copy the **Anon key** and use `http://localhost:54321` for the URL.

### 5. Install Dependencies

```bash
npm install
```

### 6. Import Seed Data

```bash
npx ts-node scripts/import-venues.ts /Users/anjasjefrianto/Desktop/projectfun/geocoded_nursing_rooms.csv
```

Expected output: "Inserted 85 venues successfully"

### 7. Run Dev Server

```bash
npm run dev
```

Open http://localhost:3000

## Daily Development Workflow

### Start Your Session

**Terminal 1** — Start Supabase:
```bash
supabase start
```

This starts PostgreSQL + PostGIS, Redis, and the Studio admin UI. Leave it running in the background.

**Terminal 2** — Start the dev server:
```bash
cd nursing-room-finder
npm run dev
```

### Accessing Tools

- **Web App**: http://localhost:3000
- **Supabase Studio** (SQL editor + admin): http://localhost:54323
  - Use any email and password (it's local, no authentication required)
- **Database**: `postgresql://postgres:postgres@localhost:5432/postgres`
  - Use with `psql`, DataGrip, pgAdmin, etc.

### Making Schema Changes

To add tables or modify the schema:

1. Create a new migration file in `supabase/migrations/`:
```bash
touch supabase/migrations/002_add_feature_table.sql
```

2. Write your SQL (following the PostGIS + RLS pattern in `001_initial_schema.sql`):
```sql
CREATE TABLE feature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp DEFAULT now()
);
```

3. Apply the migration:
```bash
supabase db push
```

4. Restart your dev server for TypeScript type updates:
```bash
npm run dev
```

### Resetting the Database

To clear all data and re-run migrations:
```bash
supabase db reset
supabase db push
```

Then re-import seed data if needed:
```bash
npx ts-node scripts/import-venues.ts /path/to/csv
```

### Viewing Database Contents

**Option 1** — Supabase Studio SQL editor:
- Go to http://localhost:54323
- Click "SQL Editor"
- Run queries like `SELECT * FROM venues LIMIT 5;`

**Option 2** — Direct psql connection:
```bash
psql postgresql://postgres:postgres@localhost:5432/postgres
```

Then in the psql prompt:
```sql
SELECT COUNT(*) FROM venues;
SELECT name, address FROM venues LIMIT 5;
```

## Stopping and Cleanup

### Stop for the Day
```bash
# In the terminal where supabase start is running:
# Press Ctrl+C
```

Containers stop but persist. Your data is saved.

### Full Cleanup (Delete Local Database)
```bash
supabase stop --no-backup
```

Next `supabase start` will recreate empty containers.

## Troubleshooting

### Docker not running
```
Error: Cannot connect to Docker daemon
```
Start Docker Desktop (Mac/Windows) or `sudo systemctl start docker` (Linux).

### Port 54321 already in use
```
Error: listen tcp :54321: bind: address already in use
```
Either:
- Kill the process: `lsof -i :54321` then `kill -9 <PID>`
- Or change the port in `supabase/config.toml`

### Migrations failing
```
Error: could not execute query: ERROR: function nearest_venues does not exist
```
Ensure `supabase db push` completed successfully. Check for SQL syntax errors in `001_initial_schema.sql`.

### Node modules not found after Docker reset
```bash
rm -rf node_modules
npm install
```

### CSV import fails
```
Error: ENOENT: no such file or directory
```
Provide the full absolute path to the CSV file:
```bash
npx ts-node scripts/import-venues.ts $(pwd)/path/to/geocoded_nursing_rooms.csv
```

## Switching Between Local and Hosted

To use a hosted Supabase account instead:

1. Create project at https://app.supabase.com
2. Paste `supabase/migrations/001_initial_schema.sql` in the SQL editor
3. Copy your URL + key from Settings → API
4. Update `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```
5. `npm run dev`

To switch back to local:
```bash
cp .env.local.example .env.local
supabase start
npm run dev
```

## Advanced: Running Migrations in CI/CD

For CI pipelines (GitHub Actions, etc.), use:
```bash
supabase db push --db-url "$DATABASE_URL"
```

Example `.github/workflows/test.yml`:
```yaml
- name: Run migrations
  run: supabase db push --db-url "postgresql://user:pass@host/db"
```

## Performance Tips

- **Disable vector indexing in development**: Add `VECTOR_INDEX=false` to `.env.local`
- **Clear cache**: `supabase cache clear` (if caching is enabled)
- **Monitor resources**: `docker stats` shows CPU/memory usage of containers

## Next Steps

- Read `QUICK_START.md` for the 5-minute setup path
- Check `README.md` for architecture overview
- See `BUILD_SUMMARY.md` for critical fixes needed
- Explore `NEXT_STEPS.md` for Phase 2 features
