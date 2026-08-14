# 🚀 Deployment Guide

## Overview
Nursing Room Finder is production-ready and can run anywhere with Docker.

## Technology Stack
- **Frontend**: Next.js 16 (React, TypeScript, Tailwind CSS)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with PostGIS
- **Auth**: Supabase (optional)
- **Maps**: Leaflet + OpenStreetMap
- **Containerization**: Docker

---

## Option 1: Docker Compose (Easiest)

### Prerequisites
- Docker & Docker Compose installed
- PostgreSQL will run in container (no local installation needed)

### Steps

1. **Clone and setup**
```bash
cd nursing-room-finder
cp .env.local.example .env.local
```

2. **Update environment variables**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

3. **Start services**
```bash
docker-compose up -d
```

4. **Verify it's running**
```bash
# Check containers
docker-compose ps

# View logs
docker-compose logs -f app
```

5. **Access the app**
- Map: http://localhost:3000
- Admin: http://localhost:3000/admin

6. **Stop services**
```bash
docker-compose down
```

---

## Option 2: Production Deployment (Hosted Supabase)

### Prerequisites
- Hosted Supabase account (supabase.com)
- Docker or any container hosting (Render, Railway, Fly.io, etc.)

### Steps

1. **Setup Supabase**
   - Create project on supabase.com
   - Run all migrations manually or via SQL editor:
     - supabase/migrations/001_initial_schema.sql
     - supabase/migrations/002_add_insert_policies.sql
     - supabase/migrations/003_fix_postal_cache_perms.sql
     - supabase/migrations/004_add_diaper_amenities.sql
     - supabase/migrations/005_fix_submissions_perms.sql

2. **Get credentials**
   - Settings → API Keys
   - Copy `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `SUPABASE_SERVICE_ROLE_KEY`

3. **Setup environment**
```bash
cp .env.production.example .env.production
# Edit .env.production with your Supabase credentials
```

4. **Build Docker image**
```bash
docker build -t nursing-room-finder:latest .
```

5. **Run container**
```bash
docker run \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-key \
  nursing-room-finder:latest
```

---

## Option 3: Deploy to Render (1-Click Easy)

1. Push code to GitHub
2. Create account on render.com
3. New → Web Service
4. Connect GitHub repo
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Deploy!

---

## Option 4: Deploy to Railway

1. Push code to GitHub
2. Create account on railway.app
3. New Project → GitHub Repo
4. Add environment variables
5. Deploy!

---

## Option 5: Deploy to Fly.io

```bash
# Install flyctl
brew install flyctl

# Login
flyctl auth login

# Launch
flyctl launch

# Deploy
flyctl deploy
```

---

## Database Setup (for any hosting)

### Option A: Hosted Supabase (Recommended)
- No setup needed - Supabase handles everything
- Includes backups, monitoring, scaling
- Free tier available

### Option B: Self-Hosted PostgreSQL
Run migrations against your PostgreSQL instance:

```bash
psql postgresql://user:password@host:5432/dbname < supabase/migrations/001_initial_schema.sql
psql postgresql://user:password@host:5432/dbname < supabase/migrations/002_add_insert_policies.sql
# ... (run all migration files in order)
```

---

## Production Checklist

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] RLS policies enabled in Supabase
- [ ] PostGIS extension enabled
- [ ] Admin panel password/auth configured (optional - add later)
- [ ] CORS settings configured if needed
- [ ] Backup strategy in place
- [ ] Monitoring/logging setup
- [ ] SSL certificate configured
- [ ] DNS configured

---

## Monitoring & Logs

### Docker Compose
```bash
# View logs
docker-compose logs -f app

# Check container health
docker-compose ps
```

### Supabase Dashboard
- Monitor database performance
- View API usage
- Check error logs
- Manage users/auth

---

## Troubleshooting

### Container won't start
```bash
docker-compose logs app
# Check for error messages
```

### Database connection error
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is valid
- Check if database is running

### PostGIS extension missing
```sql
-- Run in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS postgis;
```

### RLS policy errors
- Check migrations 002 and 005 were applied
- Verify `anon` role has correct permissions

---

## Performance Tips

1. **Enable caching** - Set appropriate Cache-Control headers
2. **Use CDN** - Deploy Supabase in same region as app
3. **Optimize images** - Use Next.js Image component
4. **Monitor queries** - Check Supabase query logs
5. **Scale horizontally** - Run multiple containers behind load balancer

---

## Security

- ✅ RLS policies enabled (database-level security)
- ✅ CORS restricted (Supabase settings)
- ✅ Admin panel public (add authentication layer later)
- ✅ No hardcoded secrets
- ✅ Environment variables for all credentials
- ✅ HTTPS enforced (configure in your hosting platform)

---

## Support

For issues:
1. Check Docker logs
2. Verify environment variables
3. Check Supabase dashboard
4. Review error messages in browser console
