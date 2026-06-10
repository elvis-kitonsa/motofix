# 📊 Database Migration Guide - Media Files Support

## Overview

This guide provides the SQL migrations needed to support media files in the MOTOFIX service request system.

---

## Step 1: Create `media_files` Table

Run this SQL in your PostgreSQL database:

```sql
CREATE TABLE media_files (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- 'voice', 'photo', 'document'
    file_name VARCHAR(255),
    size_kb FLOAT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
);

-- Create index for faster queries by request_id
CREATE INDEX idx_media_files_request_id ON media_files(request_id);
CREATE INDEX idx_media_files_file_type ON media_files(file_type);
CREATE INDEX idx_media_files_uploaded_at ON media_files(uploaded_at DESC);
```

---

## Step 2: Update `service_requests` Table (if needed)

If your `service_requests` table doesn't have `created_at`, add it:

```sql
-- Check if created_at exists
SELECT column_name FROM information_schema.columns 
WHERE table_name='service_requests' AND column_name='created_at';

-- If it doesn't exist, add it:
ALTER TABLE service_requests 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

---

## Step 3: Verify Table Structure

After creating the tables, verify the structure:

```sql
-- Check media_files table
\d media_files

-- Expected output:
--                             Table "public.media_files"
--    Column   |            Type             | Collation | Nullable | Default
-- -----------+-----------------------------+-----------+----------+--------
--  id         | integer                     |           | not null | nextval('media_files_id_seq'::regclass)
--  request_id | integer                     |           | not null |
--  file_url   | character varying(1000)     |           | not null |
--  file_type  | character varying(50)       |           | not null |
--  file_name  | character varying(255)      |           |          |
--  size_kb    | double precision            |           | not null |
--  uploaded_at| timestamp without time zone |           |          | CURRENT_TIMESTAMP
--  created_at | timestamp without time zone |           |          | CURRENT_TIMESTAMP
```

---

## Step 4: Verify Foreign Key Relationship

```sql
-- Check constraints
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'media_files';

-- Expected output shows foreign key constraint pointing to service_requests(id)
```

---

## Step 5: Test Basic Operations

```sql
-- Test INSERT
INSERT INTO media_files 
(request_id, file_url, file_type, file_name, size_kb)
VALUES 
(1, 'https://example.com/voice.webm', 'voice', 'voice.webm', 45.2);

-- Test SELECT
SELECT * FROM media_files WHERE request_id = 1;

-- Test DELETE (cascade should work)
DELETE FROM service_requests WHERE id = 1;
-- This should also delete related media files
```

---

## Environment Variables Required

Add these to your `.env` file in `motofix-service-requests`:

### For Cloudinary (Recommended - easiest setup)
```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from: https://cloudinary.com/console/

### For AWS S3 (Alternative)
```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=motofix-media
AWS_REGION=us-east-1
```

---

## Step 6: Install Python Dependencies

```bash
cd motofix-service-requests
pip install -r requirements.txt
```

This installs:
- `python-multipart==0.0.6` - FormData parsing
- `boto3==1.35.35` - AWS S3 support
- `cloudinary==1.37.0` - Cloudinary support

---

## Step 7: Update CORS Settings (if needed)

The `motofix-service-requests` already has CORS configured for:
- `https://motofix-driver-assist.onrender.com`
- `http://localhost:5173` (local development)

If you need to add more origins, update `app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://motofix-driver-assist.onrender.com",
        "http://localhost:3000",  # Add your origin here
        "http://localhost:5173",
    ],
    ...
)
```

---

## Step 8: Test the Endpoints

### Test JSON Request (without media)

```bash
curl -X POST http://localhost:8000/requests/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "phone": "+256700123456",
    "location": "0.4500, 32.5800",
    "description": "Flat tire",
    "service_type": "Other"
  }'
```

### Test FormData Request (with media)

```bash
# Create test files
echo "test audio" > voice.webm
echo "test image" > photo.jpg

# Upload with media
curl -X POST http://localhost:8000/requests-with-media/ \
  -F "customer_name=John Doe" \
  -F "phone=+256700123456" \
  -F "location=0.4500, 32.5800" \
  -F "description=Flat tire" \
  -F "service_type=Other" \
  -F "media_files=@voice.webm" \
  -F "media_files=@photo.jpg"
```

### Expected Response

```json
{
  "id": "1",
  "customer_name": "John Doe",
  "phone": "+256700123456",
  "location": "0.4500, 32.5800",
  "description": "Flat tire",
  "service_type": "Other",
  "status": "pending",
  "created_at": "2026-01-27T10:30:00Z",
  "media_files": [
    {
      "url": "https://storage.example.com/voice.webm",
      "file_type": "voice",
      "size_kb": 45.2,
      "uploaded_at": "2026-01-27T10:30:01Z"
    },
    {
      "url": "https://storage.example.com/photo.jpg",
      "file_type": "photo",
      "size_kb": 256.8,
      "uploaded_at": "2026-01-27T10:30:02Z"
    }
  ]
}
```

---

## Step 9: Deploy

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://..."
export CLOUDINARY_CLOUD_NAME="..."
export CLOUDINARY_API_KEY="..."
export CLOUDINARY_API_SECRET="..."

# Run development server
uvicorn app.main:app --reload
```

### Production (Render.com)

1. Add environment variables to Render:
   - `DATABASE_URL` - Your PostgreSQL URL
   - `CLOUDINARY_CLOUD_NAME` - Cloudinary credentials
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `STORAGE_PROVIDER=cloudinary`

2. Deploy:
   ```bash
   git push origin main
   ```

---

## Troubleshooting

### "Table media_files does not exist"
- Run the CREATE TABLE SQL in Step 1
- Verify with: `\dt media_files`

### "FOREIGN KEY constraint failed"
- Ensure `service_requests` table exists and has an `id` primary key
- Check: `\d service_requests`

### "File upload fails"
- Check storage provider credentials in `.env`
- Check logs: `docker logs motofix-service-requests` (if using Docker)
- Verify cloud storage is accessible

### "CORS error on driver app"
- Add the driver app origin to `allow_origins` in `app/main.py`
- Make sure the backend is restarted

### "Media files not showing in admin"
- Verify media_files table has data: `SELECT COUNT(*) FROM media_files;`
- Check admin backend can query: `SELECT * FROM media_files LIMIT 1;`
- Ensure admin frontend is fetching `/admin/requests`

---

## Rollback Plan

If you need to remove media support:

```sql
-- Drop media_files table
DROP TABLE media_files;

-- Remove related columns from service_requests if needed
-- (none added in this migration)
```

---

## Query Examples

### Get all requests with their media

```sql
SELECT 
    sr.id,
    sr.customer_name,
    sr.phone,
    sr.location,
    sr.description,
    sr.status,
    COUNT(mf.id) as media_count,
    ARRAY_AGG(
        json_build_object(
            'url', mf.file_url,
            'type', mf.file_type,
            'size_kb', mf.size_kb
        )
    ) as media_files
FROM service_requests sr
LEFT JOIN media_files mf ON sr.id = mf.request_id
GROUP BY sr.id
ORDER BY sr.created_at DESC;
```

### Get requests with voice notes

```sql
SELECT DISTINCT sr.*
FROM service_requests sr
INNER JOIN media_files mf ON sr.id = mf.request_id
WHERE mf.file_type = 'voice'
ORDER BY sr.created_at DESC;
```

### Get total storage used

```sql
SELECT 
    COUNT(*) as total_files,
    SUM(size_kb) / 1024.0 as total_size_mb,
    file_type,
    COUNT(*) as count_by_type
FROM media_files
GROUP BY file_type;
```

---

## Monitoring

### Check Storage Usage

```sql
SELECT 
    DATE(uploaded_at) as upload_date,
    COUNT(*) as files_uploaded,
    SUM(size_kb) / 1024.0 as size_mb
FROM media_files
GROUP BY upload_date
ORDER BY upload_date DESC
LIMIT 30;
```

### Check Failed Uploads

Monitor application logs for errors containing:
- "StorageError"
- "Failed to upload"
- "Cloudinary upload failed"

---

## Performance Optimization

For large number of media files, consider adding:

```sql
-- Archive old media files to separate table
CREATE TABLE media_files_archive AS
SELECT * FROM media_files WHERE uploaded_at < NOW() - INTERVAL '1 year';

-- Delete archived files from main table
DELETE FROM media_files WHERE uploaded_at < NOW() - INTERVAL '1 year';

-- Vacuum to reclaim space
VACUUM ANALYZE media_files;
```

---

## Next Steps

1. ✅ Run database migrations (Step 1-2)
2. ✅ Install Python dependencies (Step 6)
3. ✅ Set up cloud storage credentials (Step 7)
4. ✅ Test endpoints locally (Step 8)
5. ✅ Deploy to production (Step 9)
6. ✅ Monitor in dashboard

---

**Created**: January 27, 2026  
**Version**: 1.0  
**Status**: Ready for implementation
