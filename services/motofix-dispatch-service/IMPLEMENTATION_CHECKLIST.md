# ✅ Implementation Checklist - Media Files Support

## Database Setup

- [ ] Create `media_files` table (SQL provided in migration guide)
- [ ] Create indexes on `request_id`, `file_type`, `uploaded_at`
- [ ] Add `created_at` to `service_requests` if missing
- [ ] Test foreign key constraints work
- [ ] Verify cascade delete works

## Backend Setup (motofix-service-requests)

- [ ] Install new dependencies:
  ```bash
  pip install python-multipart boto3 cloudinary
  ```
- [ ] Copy `app/storage.py` to your app folder
- [ ] Update `app/main.py` with new endpoints
- [ ] Add cloud storage credentials to `.env`

## Cloud Storage Configuration

### Choose One Option:

#### Option A: Cloudinary (Recommended - Easiest)
- [ ] Create Cloudinary account at https://cloudinary.com
- [ ] Get `CLOUD_NAME`, `API_KEY`, `API_SECRET`
- [ ] Add to `.env`:
  ```
  STORAGE_PROVIDER=cloudinary
  CLOUDINARY_CLOUD_NAME=your_value
  CLOUDINARY_API_KEY=your_value
  CLOUDINARY_API_SECRET=your_value
  ```

#### Option B: AWS S3
- [ ] Create S3 bucket in AWS
- [ ] Create IAM user with S3 permissions
- [ ] Get `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`
- [ ] Add to `.env`:
  ```
  STORAGE_PROVIDER=s3
  AWS_ACCESS_KEY_ID=your_value
  AWS_SECRET_ACCESS_KEY=your_value
  AWS_BUCKET_NAME=motofix-media
  AWS_REGION=us-east-1
  ```

## Backend Testing

- [ ] Test `/requests/` endpoint (JSON only)
- [ ] Test `/requests-with-media/` endpoint (FormData with files)
- [ ] Verify media files saved to database
- [ ] Verify files uploaded to cloud storage
- [ ] Test GET `/requests/` returns media_files array
- [ ] Test GET `/requests/{id}` returns media_files
- [ ] Verify error handling for upload failures

### Test Commands
```bash
# JSON request
curl -X POST http://localhost:8000/requests/ \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","phone":"+256700000000",...}'

# FormData with files
curl -X POST http://localhost:8000/requests-with-media/ \
  -F "customer_name=Test" \
  -F "phone=+256700000000" \
  -F "media_files=@voice.webm" \
  -F "media_files=@photo.jpg"
```

## Driver App Updates

- [ ] Update API endpoint from `/requests/` to `/requests-with-media/`
- [ ] Test FormData submission with media files
- [ ] Verify response includes media_files array
- [ ] Test error handling

**File to update**: `src/config/api.ts` (already done ✅)

## Admin Frontend Updates

- [ ] Verify media column displays in requests table
- [ ] Verify detail modal shows media files
- [ ] Verify download links work
- [ ] Test with actual backend response

**File to update**: `src/pages/Requests.tsx` (already done ✅)

## Admin Backend Updates

- [ ] Verify `/admin/requests` returns media_files
- [ ] Test media filtering and search
- [ ] Verify pagination with media joins

**File to update**: `app/routers/admin.py` (already done ✅)

## Integration Testing

- [ ] Driver app creates request with media
- [ ] Media uploaded to cloud storage
- [ ] Media record saved to database
- [ ] Admin sees media in requests table
- [ ] Admin can download media files
- [ ] Admin backend shows media in response

### End-to-End Flow
1. Driver records voice note
2. Driver captures photo
3. Driver submits request
4. Backend receives FormData
5. Files uploaded to cloud storage
6. Media records created in DB
7. Response includes media URLs
8. Admin sees media in dashboard
9. Admin downloads file from cloud

## Deployment

### Local Development
- [ ] Set up `.env` with credentials
- [ ] Database migrations run
- [ ] Dependencies installed
- [ ] Backend starts without errors
- [ ] All endpoints accessible

### Production (Render.com)
- [ ] Add environment variables to Render dashboard
- [ ] Database migrations applied
- [ ] Deploy new code
- [ ] Test production endpoints
- [ ] Verify media uploads work
- [ ] Monitor logs for errors

## Monitoring & Logs

- [ ] Check backend logs for upload errors
- [ ] Monitor database queries
- [ ] Track storage usage
- [ ] Monitor API response times
- [ ] Alert on upload failures

## Documentation

- [ ] API documentation updated
- [ ] Migration guide completed ✅
- [ ] Setup guide written ✅
- [ ] Troubleshooting guide created ✅
- [ ] Example queries provided ✅

## Performance

- [ ] Database indexes created
- [ ] Query response times acceptable
- [ ] File upload speed acceptable
- [ ] Cloud storage pricing reasonable
- [ ] Database size monitored

## Security

- [ ] Cloud storage credentials not in git
- [ ] CORS origins properly configured
- [ ] File upload size limits set
- [ ] File type validation working
- [ ] Request validation working

## Rollback Plan

- [ ] Know how to drop media_files table
- [ ] Know how to revert to text-only requests
- [ ] Backup database before deployment
- [ ] Have database restore procedure ready

---

## By Phase

### Phase 1: Database & Backend (Current)
- [ ] Database setup
- [ ] Backend file upload handler
- [ ] Cloud storage integration
- [ ] Test endpoints

### Phase 2: Frontend Integration
- [ ] Driver app uses new endpoint
- [ ] Admin shows media in table
- [ ] Admin can download files
- [ ] End-to-end testing

### Phase 3: Production Deployment
- [ ] Environment setup
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Optimize performance

### Phase 4: Mechanic Dashboard (Next)
- [ ] Show requests with media to mechanics
- [ ] Allow mechanics to preview media
- [ ] Track completion photos
- [ ] Real-time updates

---

## Estimated Time

- Database setup: 5 minutes
- Backend implementation: 30 minutes (mostly done)
- Cloud storage setup: 15 minutes
- Testing: 30 minutes
- Debugging: 30 minutes
- Deployment: 10 minutes
- **Total: ~2 hours**

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Cloudinary credentials wrong | Check dashboard, copy exact values |
| Database table missing | Run migration SQL from guide |
| File upload fails | Check storage provider, verify credentials |
| CORS error | Add origin to allowed_origins |
| Media not showing | Verify admin backend fetches media_files |
| Slow uploads | Reduce file size or use compression |
| Storage costs high | Use Cloudinary free tier first |

---

## Support

If you get stuck:
1. Check logs: `docker logs motofix-service-requests` or local terminal
2. Check database: `SELECT * FROM media_files;`
3. Check environment: `echo $CLOUDINARY_CLOUD_NAME`
4. Check cloud provider dashboard for upload history
5. Review migration guide for step-by-step instructions

---

## Next Up

After completing this:
1. Build mechanic dashboard to receive requests with media
2. Add real-time notifications
3. Implement payment system
4. Add ratings and reviews

---

**Created**: January 27, 2026  
**Last Updated**: January 27, 2026  
**Progress**: ▰▰▰▰▰░░░░░ 50%  
**Status**: Backend implementation phase
