# ✅ Production Checklist

Use this checklist to ensure your deployment is production-ready.

---

## 🗄️ Database

- [ ] PostgreSQL 16+ with PostGIS extension enabled
- [ ] All migrations applied (001-005)
- [ ] RLS policies enabled
- [ ] Anon role has correct permissions
- [ ] Service role key configured
- [ ] Database backups configured
- [ ] Connection pooling enabled (if using Supabase)
- [ ] Database is in same region as app

### Verify
```sql
-- Check PostGIS
SELECT postgis_version();

-- Check migrations
SELECT * FROM _prisma_migrations;

-- Check RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables WHERE schemaname = 'public';

-- Check venues count
SELECT COUNT(*) FROM venues;
```

---

## 🔐 Security

- [ ] No hardcoded secrets in code
- [ ] All credentials in environment variables
- [ ] HTTPS enabled (SSL certificate configured)
- [ ] CORS settings configured
- [ ] Admin panel has authentication (recommended)
- [ ] Service role key kept secret
- [ ] Environment files not in git (check .gitignore)
- [ ] No sensitive data in logs
- [ ] Rate limiting configured (optional)
- [ ] API keys rotated regularly

### Verify
```bash
# Check no secrets in code
grep -r "supabase_key\|service_role_key" app/ --exclude-dir=node_modules

# Check .gitignore
cat .gitignore | grep "\.env"
```

---

## 🌐 Deployment

- [ ] Docker image builds successfully
- [ ] Dockerfile optimized for production
- [ ] docker-compose.yml not used in production (dev only)
- [ ] Environment variables set correctly
- [ ] Hostname/domain configured
- [ ] Reverse proxy configured (if needed)
- [ ] Health checks configured
- [ ] Auto-restart enabled
- [ ] Resource limits set (memory, CPU)
- [ ] Log aggregation configured

### Verify
```bash
# Build Docker image
docker build -t nursing-room-finder:latest .

# Test image
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  nursing-room-finder:latest
```

---

## 🚀 Performance

- [ ] Next.js optimized (standalone output enabled)
- [ ] Image optimization configured
- [ ] Caching headers configured
- [ ] CDN configured (recommended)
- [ ] Database query performance checked
- [ ] Indexes created on frequently queried columns
- [ ] PostGIS queries optimized
- [ ] API response times < 500ms
- [ ] Map loads in < 2 seconds
- [ ] Mobile performance tested

### Verify
```bash
# Check Next.js config
grep "output.*standalone" next.config.ts

# Check database indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';

# Load test
curl -w "Time: %{time_total}s\n" http://localhost:3000
```

---

## 📡 API & Endpoints

- [ ] All API endpoints tested
- [ ] Error handling working correctly
- [ ] Error messages don't expose secrets
- [ ] Request validation working
- [ ] Response formatting consistent
- [ ] Rate limiting working (if configured)
- [ ] CORS headers correct
- [ ] POST/PUT validation working
- [ ] File upload size limits set
- [ ] API documentation updated

### Endpoints to Test
- `GET /api/nearest-venues` - Test with sample lat/lng
- `GET /api/postal-code-to-coords` - Test with valid postal code
- `GET /api/reverse-geocode` - Test with sample coordinates
- `POST /api/submit-venue` - Test submission
- `GET /api/admin/submissions` - Check pending submissions
- `POST /api/admin/approve-submission` - Test approval

---

## 📱 Frontend

- [ ] Map loads without errors
- [ ] Search functionality works
- [ ] Filters work correctly
- [ ] Mobile responsive on iPhone/Android
- [ ] Touch targets >= 44px
- [ ] Tap feedback working
- [ ] Loading states showing
- [ ] Error messages user-friendly
- [ ] No console errors
- [ ] PWA manifest correct

### Test on Devices
- [ ] iPhone 12/14 (Safari)
- [ ] Android (Chrome)
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Tablet (iPad)
- [ ] Low bandwidth (throttle to 3G)

---

## 🔄 Admin Features

- [ ] Admin dashboard loads
- [ ] Can view pending submissions
- [ ] Can edit submission details
- [ ] Can approve submissions
- [ ] Can reject submissions
- [ ] Approved venues appear on map
- [ ] Edit mode saves correctly
- [ ] Loading states working
- [ ] Error handling working
- [ ] Permissions correct

### Test Admin Flow
1. Submit venue via form
2. Go to admin panel
3. Edit a detail
4. Click approve
5. Verify venue appears on map

---

## 📊 Monitoring

- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured
- [ ] Log aggregation configured
- [ ] Database performance monitoring
- [ ] Disk space monitoring
- [ ] Memory monitoring
- [ ] CPU monitoring
- [ ] Alerts configured
- [ ] Incident response plan

### Recommended Tools
- **Error Tracking**: Sentry, Rollbar, or Datadog
- **Performance**: New Relic, Datadog, or Vercel Analytics
- **Uptime**: Uptime Robot, Cronitor
- **Logs**: ELK Stack, Datadog, Splunk

---

## 🔄 Backup & Recovery

- [ ] Database backups automated
- [ ] Backups tested (restore tested)
- [ ] Backup retention policy set
- [ ] Backup location secure
- [ ] Disaster recovery plan documented
- [ ] RTO/RPO defined
- [ ] Failover process documented
- [ ] Team trained on recovery

### Supabase Backups
```
# Supabase handles backups automatically
# Check: Project Settings → Backups
```

---

## 📝 Documentation

- [ ] Deployment guide written
- [ ] Environment variables documented
- [ ] API documentation complete
- [ ] Database schema documented
- [ ] Admin guide written
- [ ] Troubleshooting guide complete
- [ ] Runbooks created
- [ ] Change log updated

---

## 🧪 Testing

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (if exists)
- [ ] Performance tests passing
- [ ] Security tests passing
- [ ] Load test completed
- [ ] Manual QA complete
- [ ] Beta testing completed
- [ ] User acceptance testing passed

---

## 📋 Pre-Launch

- [ ] Team informed of deployment
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan ready
- [ ] Status page updated
- [ ] Support team trained
- [ ] Monitoring alerts tested
- [ ] DNS updated (if changing)
- [ ] SSL certificate valid
- [ ] Stakeholders notified

---

## 🚀 Launch Day

- [ ] Final database backup taken
- [ ] Monitoring all active
- [ ] Team on standby
- [ ] Deployment log created
- [ ] Rollback commands ready
- [ ] Status page monitored
- [ ] No changes during deployment
- [ ] Post-deployment testing
- [ ] Performance baseline checked

---

## ✅ Post-Launch

- [ ] Monitor error rates (first 30 min)
- [ ] Monitor performance metrics
- [ ] Check database connections
- [ ] Verify admin panel working
- [ ] Spot-check user submissions
- [ ] Review logs for errors
- [ ] Confirm backups created
- [ ] Update status page
- [ ] Send success notification
- [ ] Schedule post-mortem

---

## 🎯 Success Criteria

- ✅ Application loads without errors
- ✅ All pages accessible
- ✅ Map displays correctly
- ✅ Search functionality works
- ✅ Admin panel accessible
- ✅ No console errors
- ✅ No error logs in Sentry
- ✅ Page load time < 3 seconds
- ✅ Database queries < 500ms
- ✅ All endpoints responding

---

## 📞 Support Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps | TBD | TBD |
| Backend | TBD | TBD |
| Frontend | TBD | TBD |
| DBA | TBD | TBD |

---

## 📌 Notes

Use this space for deployment-specific notes:

```
[Notes go here]
```

---

**Deployment Date**: ________________  
**Deployed By**: ________________  
**Approved By**: ________________

---

✅ **Ready to Launch!**
