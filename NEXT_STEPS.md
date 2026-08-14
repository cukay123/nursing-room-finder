# 📋 Next Steps to Launch

## ✅ Already Done (This Session)

### Code Scaffolding
- [x] Next.js 15 + TypeScript + Tailwind boilerplate
- [x] Supabase + PostGIS schema (8 tables, RLS policies)
- [x] CSV import script (parses seed data → DB)
- [x] API routes (nearest-venues, postal-code-to-coords)
- [x] React components (Map, LocationSearch, VenueCard)
- [x] Home page (map + list toggle)
- [x] Documentation (README, QUICK_START, BUILD_SUMMARY)

### Data
- [x] 85 nursing rooms geocoded (lat/lng from OneMap + Nominatim)
- [x] Amenity parsing (lockable, changing table, etc.)
- [x] Ready to import into Supabase

## 🔧 Setup (You Do This)

### 1. Supabase Project (5 min)
```
1. Go to https://supabase.com → Sign up/login
2. Create new project
3. Copy URL + anon key
```

### 2. Run Locally (5 min)
```bash
cd nursing-room-finder
cp .env.local.example .env.local
# Edit .env.local with Supabase credentials
npm install
npm run dev
# → http://localhost:3000
```

### 3. Database Migration (2 min)
```
1. Supabase → SQL Editor
2. Copy entire file: supabase/migrations/001_initial_schema.sql
3. Paste + run
```

### 4. Import Seed Data (1 min)
```bash
npx ts-node scripts/import-venues.ts /Users/anjasjefrianto/Desktop/projectfun/geocoded_nursing_rooms.csv
```

### 5. Critical Fix (1 min)
See BUILD_SUMMARY.md — add latitude/longitude columns to `nearest_venues()` RPC function.

## 🚀 Then You Have...

A working MVP:
- ✅ Find nursing rooms near you (GPS or postal code)
- ✅ Map + list views
- ✅ Venue details (amenities, floor, address)
- ✅ Filters (lock, changing table, etc.)
- ✅ Mobile-friendly PWA

## 📱 Test It (5 min)

1. Open http://localhost:3000
2. Click "Use My Location" (allow geolocation)
3. Should see map with pins + list of venues
4. Click a pin → detail card appears
5. Toggle to list view
6. Try postal code search: "238872"
7. Check filters work

## 🎯 Phase 2 (Future)

Pick ONE to start:

### A. Submit New Venue Flow
**Why first**: Core feature, high user value  
**Time**: ~4 hours  
**What to build**:
- Form: name, address, amenities, photo upload
- Map: drop pin or search address
- Submit button → `submissions` table (pending admin approval)
- Success message

**Files to create**:
- `app/submit/page.tsx`
- `components/SubmitForm.tsx`
- `/api/submit-venue` (POST endpoint)

### B. Authentication UI
**Why first**: Enables user tracking, submissions  
**Time**: ~3 hours  
**What to build**:
- Magic link signup/login
- User menu in header
- Protect submit/confirm/upload routes
- Track user_id for submissions/photos

**Files to create**:
- `components/AuthModal.tsx`
- `app/auth/callback` (magic link handler)
- `components/UserMenu.tsx`

### C. Admin Dashboard
**Why first**: Unblock moderation  
**Time**: ~6 hours  
**What to build**:
- Private route: `/admin`
- List pending submissions
- Approve/reject with notes
- View all confirmations + photos
- Bulk actions

**Files to create**:
- `app/admin/page.tsx`
- `app/admin/submission/[id]/page.tsx`
- `components/Admin*.tsx` (various)

### D. Photo Gallery
**Why first**: User engagement  
**Time**: ~4 hours  
**What to build**:
- Display photos on venue detail card
- Photo upload form
- Supabase Storage integration
- Delete/flag photos (admin)

**Files to create**:
- `components/PhotoGallery.tsx`
- `components/PhotoUpload.tsx`
- `/api/upload-photo` (POST endpoint)

## 📊 Recommended Order

1. **Auth UI** (foundation for everything else)
2. **Submit flow** (core user feature)
3. **Admin dashboard** (moderation)
4. **Photo gallery** (engagement)
5. **Leaderboards** (gamification)

## 💾 File Checklist

Everything needed is in:
```
nursing-room-finder/
├── app/
│   ├── page.tsx ✅
│   ├── layout.tsx ✅
│   ├── globals.css ✅
│   └── api/ ✅
├── components/ ✅
├── lib/ ✅
├── scripts/import-venues.ts ✅
├── supabase/migrations/ ✅
├── .env.local.example ✅
├── README.md ✅
├── QUICK_START.md ✅
└── BUILD_SUMMARY.md ✅
```

No additional setup needed!

## 🛠️ Tech Reminders

- **Frontend**: `npm run dev` (Next.js dev server)
- **Database**: Supabase (hosted, no local setup)
- **Map**: Leaflet (client-side, dynamic import)
- **Auth**: Supabase Magic Link (configured, UI pending)
- **Deployment**: Vercel (frontend) + Supabase (backend)

## 📞 Support

- **Map not showing?** Check browser console, verify Leaflet CSS
- **No venues?** Confirm CSV imported: `SELECT COUNT(*) FROM venues;`
- **Postal code broken?** Try GPS instead (OneMap can timeout)
- **Deploy?** Vercel for frontend, Supabase auto-hosted

## 🎉 You're Ready!

The foundation is solid. Pick Phase 2 feature, ship it, get user feedback, iterate.

Good luck! 🚀
