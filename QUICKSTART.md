# ⚡ Quick Start Guide

Get **Nursing Room Finder** running in 5 minutes!

---

## 🐳 Option 1: Docker Compose (Recommended)

**Perfect for**: Local development, testing, demo

### Setup
```bash
# 1. Clone or download
git clone <repo>
cd nursing-room-finder

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.local.example .env.local

# 4. Start everything
docker-compose up -d

# 5. Wait 10 seconds for database to start, then open:
# http://localhost:3000
```

### That's it! 🎉

**Map**: http://localhost:3000  
**Admin**: http://localhost:3000/admin

### Stop
```bash
docker-compose down
```

---

## 🖥️ Option 2: Local Development

**Perfect for**: Development, debugging

### Setup
```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Start Supabase locally
supabase start

# 3. Install dependencies
npm install

# 4. Setup environment
cp .env.local.example .env.local

# 5. Start dev server
npm run dev

# 6. Open http://localhost:3000
```

### That's it! 🎉

---

## ☁️ Option 3: Production (5-minute deploy)

### A. Render.com (Easiest)

```bash
# 1. Push code to GitHub
git push

# 2. Go to render.com
# 3. Click "New +" → Web Service
# 4. Connect your GitHub repo
# 5. Add environment variables:
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - SUPABASE_SERVICE_ROLE_KEY
# 6. Click Deploy!
```

### B. Railway.app

Same as Render - connect GitHub, add env vars, deploy!

### C. Fly.io

```bash
flyctl launch
flyctl deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for more details.

---

## 📖 What You Get

✅ **Map** with 85+ nursing rooms  
✅ **Search** by GPS or postal code  
✅ **Filters** by amenities  
✅ **Add Room** crowdsourcing form  
✅ **Admin Dashboard** to review submissions  
✅ **Directions** via Google Maps  
✅ **Verification** system  

---

## 🧪 Test It Out

### User Flow
1. Open http://localhost:3000
2. Search by GPS or postal code
3. Click a nursing room to see details
4. Click "Get Directions" to open Google Maps
5. Click "+ Add Room" to submit a new venue

### Admin Flow
1. Open http://localhost:3000/admin
2. See pending submissions
3. Click "Edit Details" to modify
4. Click "Approve" to create venue
5. Venue appears on map!

---

## 🛠️ Common Tasks

### Import Seed Data
```bash
npm run import-venues -- path/to/your/data.csv
```

### View Database
```bash
# With Docker Compose
docker-compose exec postgres psql -U postgres -d postgres

# With Supabase CLI
supabase db pull
```

### View Logs
```bash
# Docker Compose
docker-compose logs -f app

# Dev server
npm run dev
```

### Reset Database
```bash
# Docker Compose
docker-compose down -v
docker-compose up -d

# Supabase CLI
supabase db reset
```

---

## ❓ Troubleshooting

### Map not loading?
- Check browser console (F12)
- Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- Refresh the page

### No nursing rooms showing?
- Click a search button (GPS or postal code)
- Check database: `docker-compose exec postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM venues;"`

### Can't access admin panel?
- Admin is at `/admin` - not password protected by default
- To add auth, update middleware

### Docker won't start?
- Check Docker is running
- Check port 3000/5432 not in use
- Run `docker-compose logs` to see errors

### Database connection error?
- Wait 30 seconds for database to start
- Check PostgreSQL is running: `docker-compose ps`
- Verify `.env.local` is correct

---

## 📚 Learn More

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture**: [README.md](./README.md)
- **API Docs**: See each endpoint in `app/api/`
- **Database Schema**: `supabase/migrations/001_initial_schema.sql`

---

## 🚀 Deploy to Production

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Render.com (1-click)
- Railway
- Fly.io
- Vercel
- Self-hosted Docker

---

## 💡 Pro Tips

1. **Use postal code search on desktop** - GPS doesn't work well without hardware GPS
2. **Mobile is better** - PWA works great on mobile with GPS
3. **Admin dashboard edits** - Admins can edit details before approving
4. **Crowdsourcing** - Users can submit new rooms without login
5. **Real-time updates** - Approved rooms appear on map instantly

---

## 🤔 Questions?

1. Check [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Check [README.md](./README.md)
3. Check browser console (F12)
4. Check Docker logs: `docker-compose logs app`
5. Report issues on GitHub

---

**Happy nursing room hunting! 🏥**
