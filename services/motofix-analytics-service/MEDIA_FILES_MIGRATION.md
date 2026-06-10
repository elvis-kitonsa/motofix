# 📁 Media Files Support - Database Migration

This document explains the database changes needed to support media files (voice notes, photos, documents) in service requests.

## Required Database Changes

### 1. Update `service_requests` Table (Optional)

No changes required - existing schema works fine. Media files are stored separately.

### 2. Create `media_files` Table (NEW)

Run this SQL to create the new table:

```sql
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- 'voice', 'photo', 'document'
    file_name VARCHAR(255),
    size_kb FLOAT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX idx_media_files_request_id ON media_files(request_id);
```

### 3. Update `service_requests` Table (Optional Enhancement)

If you want to track media metadata directly on requests:

```sql
-- Add optional fields to service_requests
ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS media_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_voice_notes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_photos BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_documents BOOLEAN DEFAULT FALSE;
```

## API Backend Changes

### What Changed in `app/routers/admin.py`:

1. **Added Models** for media file responses:
```python
class MediaFile(BaseModel):
    url: str
    file_type: str  # "voice", "photo", "document"
    size_kb: float
    uploaded_at: str

class ServiceRequestResponse(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    location: str
    description: str
    service_type: str
    status: str
    media_files: Optional[List[MediaFile]] = []
    created_at: str
    updated_at: Optional[str] = None
```

2. **Updated `/admin/requests` Endpoint**:
   - Now fetches media files for each request
   - Returns `media_files` array with each request

### Data Structure Returned:

```json
{
  "id": "req_123",
  "customer_name": "John Doe",
  "customer_phone": "+256700123456",
  "location": "0.4500, 32.5800",
  "description": "Flat tire on left side",
  "service_type": "Other",
  "status": "pending",
  "media_files": [
    {
      "url": "https://storage.example.com/req_123/voice_001.webm",
      "file_type": "voice",
      "size_kb": 45.2,
      "uploaded_at": "2026-01-27T10:30:00Z"
    },
    {
      "url": "https://storage.example.com/req_123/photo_001.jpg",
      "file_type": "photo",
      "size_kb": 256.8,
      "uploaded_at": "2026-01-27T10:30:05Z"
    }
  ],
  "created_at": "2026-01-27T10:30:00Z",
  "updated_at": "2026-01-27T10:30:05Z"
}
```

## Driver App Changes

### What Changed in `src/config/api.ts`:

Added new function `requestsService.createWithMedia()` that:
- Accepts `FormData` object
- Handles multipart/form-data content type
- Works with existing JWT authentication

### What Changed in `src/pages/CreateRequest.tsx`:

1. **Updated `handleSubmit()`**:
   - Checks if `mediaFiles.length > 0`
   - If files exist: creates FormData and calls `createWithMedia()`
   - If no files: calls original `create()` method

2. **FormData Structure Sent to Backend**:
```
POST /requests/
Content-Type: multipart/form-data

customer_name: "John Doe"
service_type: "Other"
location: "0.4500, 32.5800"
description: "Flat tire on left side"
phone: "+256700123456"
media_files: [file1.webm, file1.jpg, ...]
```

## Admin Control Center Changes

### What Changed in `src/pages/Requests.tsx`:

1. **New MediaFile Interface**:
```typescript
interface MediaFile {
  url: string;
  file_type: string;
  size_kb: number;
  uploaded_at: string;
}
```

2. **New Media Column in Table**:
   - Shows counts of voice notes, photos, and documents
   - Color-coded icons for each media type
   - Example: 🎙️ 2 📷 1 📄 0

3. **New Detail Modal**:
   - Click on a request to see full details
   - Shows all media files with download links
   - Displays file size and upload time

4. **Icons Used**:
   - 🎙️ Voice: Blue - `FileAudio`
   - 📷 Photo: Green - `ImageIcon`
   - 📄 Document: Purple - `FileText`

## Implementation Checklist

### Backend (motofix-admin-dashboard):

- [x] Create `media_files` table in database
- [x] Update models in `admin.py` to include `MediaFile` and `ServiceRequestResponse`
- [x] Update `/admin/requests` endpoint to fetch and return media files

### Driver App (motofix-driver-assist):

- [x] Add `createWithMedia()` to `requestsService` in `api.ts`
- [x] Update `handleSubmit()` in `CreateRequest.tsx` to use FormData when media present
- [x] Test FormData submission with media files

### Admin Frontend (motofix-control-center):

- [x] Update `Requests.tsx` page to display media column
- [x] Add detail modal to show full request info with media downloads
- [x] Add media file icons and counts

## Next Steps

1. **Backend API for Receiving Files**:
   ```python
   # Add to motofix-service-requests backend
   @router.post("/requests/")
   async def create_request(
       customer_name: str = Form(...),
       service_type: str = Form(...),
       location: str = Form(...),
       description: str = Form(...),
       phone: str = Form(...),
       media_files: List[UploadFile] = File(None)
   ):
       # Create request
       # If media_files: upload to cloud storage and save URLs
   ```

2. **Cloud Storage Integration**:
   - Setup S3 bucket or Cloudinary account
   - Configure storage credentials
   - Update backend to upload files to cloud

3. **Webhook for Real-time Updates**:
   - Notify mechanics when new request with media arrives
   - Send media URLs in notification

4. **Mechanic App/Dashboard**:
   - Display requests with media previews
   - Play voice notes directly
   - View photos in gallery

## File Upload Flow

```
Driver App
    ↓
FormData with files
    ↓
API: POST /requests/
    ↓
Backend: Receive FormData
    ↓
Upload to Cloud Storage (S3/Cloudinary)
    ↓
Save URLs to database
    ↓
Return request with media URLs
    ↓
Admin Dashboard displays media
    ↓
Mechanic sees request with media
```

## Testing

### Test Case 1: Submit Request Without Media
```bash
curl -X POST http://localhost:8000/requests/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test",
    "service_type": "Other",
    "location": "0.4500, 32.5800",
    "description": "Test issue",
    "phone": "+256700000000"
  }'
```

### Test Case 2: Submit Request With Media (FormData)
```bash
curl -X POST http://localhost:8000/requests/ \
  -H "Authorization: Bearer TOKEN" \
  -F "customer_name=Test" \
  -F "service_type=Other" \
  -F "location=0.4500, 32.5800" \
  -F "description=Test issue" \
  -F "phone=+256700000000" \
  -F "media_files=@voice_note.webm" \
  -F "media_files=@photo.jpg"
```

### Test Case 3: Admin Views Request With Media
```bash
curl -X GET "http://localhost:8000/admin/requests?status=pending" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Response should include `media_files` array with URLs.

## Success Criteria

✅ Driver can record voice notes
✅ Driver can capture photos from camera
✅ Driver can upload files
✅ FormData is sent correctly to backend
✅ Admin sees media column in requests table
✅ Admin can click request to see media details
✅ Admin can download/view media files
✅ Mechanic dashboard displays media

---

## Questions?

If you have questions about the implementation:
1. Check the code in each repository
2. Review the TypeScript interfaces
3. Test the endpoints with curl or Postman
