# 🏥 Nursing Room Finder - Singapore

Find breastfeeding and nursing rooms near you in Singapore. A crowdsourced PWA (Progressive Web App) that helps parents locate nursing facilities with amenities like changing tables, power outlets, and more.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

---

## ✨ Features

### User Features
- 📍 **Location Search** - Find nursing rooms near you by GPS, place name, or postal code
- 🗺️ **Interactive Map** - View all rooms on a Leaflet + OpenStreetMap
- 🧭 **GPS Tracking** - Real-time location following (mobile)
- 📱 **Mobile Friendly** - Fully responsive PWA design
- 🛣️ **Directions** - One-click directions via Google Maps
- 🔍 **Filters** - Filter by amenities (lockable, changing table, sink, power, etc.)
- ⭐ **Verification** - Confirm if nursing rooms are still accurate
- 👥 **Crowdsourcing** - Submit new nursing rooms to help others
- 🏪 **8 Amenities** - Lockable, changing table, sink, power, stroller-friendly, dad-friendly, diaper mat, diaper shop

### Admin Features
- 📋 **Admin Dashboard** - Review all crowdsourced submissions
- ✏️ **Edit Details** - Modify submission data before approval
- ✅ **Approve/Reject** - One-click approval creates venues automatically
- 📊 **Full Control** - Edit and manage all nursing room data

---

## 🚀 Quick Start (5 minutes)

### Option 1: Docker Compose (Easiest)

```bash
# Clone
git clone <repo>
cd nursing-room-finder

# Setup
cp .env.local.example .env.local
npm install

# Start everything with one command
docker-compose up -d

# Open browser
# Map: http://localhost:3000
# Admin: http://localhost:3000/admin
```

### Option 2: Local Development

```bash
# Start Supabase
supabase start
supabase db push

# Setup
cp .env.local.example .env.local
npm install
npm run dev

# Open http://localhost:3000
```

### Option 3: Production (Render, Railway, Fly.io)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step guides for each platform.

---

## 📦 Deployment

| Platform | Complexity | Time | Cost |
|----------|-----------|------|------|
| Docker Compose (Local) | ⭐ Easy | 5 min | Free |
| Render | ⭐ Very Easy | 5 min | $5-7/mo |
| Railway | ⭐ Very Easy | 5 min | $5-10/mo |
| Fly.io | ⭐ Easy | 10 min | $3-5/mo |
| Vercel + Supabase | ⭐⭐ Moderate | 15 min | Free-$20 |

**Full deployment guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🏗️ Architecture

```
nursing-room-finder/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Home page (map + search)
│   ├── admin/page.tsx       # Admin dashboard
│   └── api/                 # API endpoints
│       ├── nearest-venues/
│       ├── submit-venue/
│       ├── location-search/
│       ├── reverse-geocode/
│       └── admin/
├── components/              # React components
│   ├── Map.tsx             # Leaflet map
│   ├── LocationSearch.tsx  # GPS + postal code search
│   ├── VenueCard.tsx       # Nursing room details
│   └── AddVenueModal.tsx   # Crowdsourcing form
├── lib/                     # Utilities
│   └── supabase.ts         # Supabase client + types
├── supabase/               # Database config
│   └── migrations/         # SQL migrations
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Local development stack
└── DEPLOYMENT.md           # Full deployment guide
```

---

## 🗄️ Database

**PostgreSQL 16 + PostGIS**

### Tables
- `venues` - Nursing room locations
- `room_details` - Amenities & details
- `submissions` - User submissions (pending/approved/rejected)
- `confirmations` - Verification records
- `photos` - User-uploaded images
- `location_cache` - OneMap lookup cache (place names and postal codes)

### Features
- ✅ PostGIS geospatial queries
- ✅ Row-level security (RLS)
- ✅ Anonymous submissions
- ✅ Automatic distance calculations

---

## 🔑 Environment Variables

### Development
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=local-dev-password
```

### Production
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=<long random string>
NODE_ENV=production
```

`ADMIN_PASSWORD` is required. `/admin` and `/api/admin/*` return 503 without it — the gate fails
closed on purpose, so a missing variable can never leave the admin surface open.

---

## 🧪 Testing

### Unit & Integration Tests
```bash
npm run test
```

### Manual Checklist
- [ ] GPS location works
- [ ] Postal code search works
- [ ] Map shows 85+ venues
- [ ] Filters work
- [ ] Directions open Google Maps
- [ ] Add room form submits
- [ ] Admin dashboard shows submissions
- [ ] Admin can edit/approve rooms
- [ ] Approved rooms appear on map

---

## 📡 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/nearest-venues` | GET | Find rooms near coordinates |
| `/api/location-search` | GET | Convert a place name or postal code to lat/lng |
| `/api/reverse-geocode` | GET | Convert lat/lng to postal code |
| `/api/submit-venue` | POST | Submit new nursing room |
| `/api/admin/submissions` | GET | Get pending submissions |
| `/api/admin/approve-submission` | POST | Approve/reject submission |

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet + OpenStreetMap
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: PostgreSQL 16 + PostGIS
- **Client**: Supabase JS

### DevOps
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL + PostGIS
- **Hosting**: Render, Railway, Fly.io, etc.

---

## 🔒 Security

- ✅ RLS policies (database-level access control)
- ✅ Anonymous submissions enabled
- ✅ No hardcoded secrets
- ✅ Environment variables for all credentials
- ✅ HTTPS ready
- ✅ CORS protected

---

## 📊 Data

- **85+ verified nursing rooms** across Singapore
- **Real-time updates** when rooms are added
- **Mobile location tracking** for users
- **Postal code caching** for performance

---

## 🎯 Roadmap

### Phase 2
- [ ] User authentication
- [ ] Save favorites
- [ ] Reviews & ratings
- [ ] Photo uploads
- [ ] Real-time notifications
- [ ] Multi-language

### Phase 3
- [ ] Offline maps
- [ ] Advanced filters
- [ ] Operating hours
- [ ] Admin dashboard
- [ ] Analytics

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Submit a PR

---

## 📝 License

MIT

---

## 📞 Support

- 📖 [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- 🐛 Report issues on GitHub
- 💬 Discussions welcome

---

**Built with ❤️ for parents in Singapore**
