# Frontend Integration Action Plan

**Status:** Backend READY for integration  
**Target:** https://motofix-service-requests.onrender.com/requests/  
**Origin:** https://customer.motofix.org  

---

## Pre-Integration Verification Checklist

Before touching the frontend, verify the backend is working:

### Step 1: Backend Health Check
```bash
curl https://motofix-service-requests.onrender.com/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "motofix-service-requests",
  "timestamp": "2026-01-28T...",
  "database": "connected"
}
```

### Step 2: CORS Preflight Test
```bash
curl -i -X OPTIONS \
  -H "Origin: https://customer.motofix.org" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://motofix-service-requests.onrender.com/requests/
```
Expected response headers:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://customer.motofix.org
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 3600
```

### Step 3: POST Request Test
```bash
curl -i -X POST \
  -H "Origin: https://customer.motofix.org" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Backend Test",
    "service_type": "breakdown",
    "location": "Test Location",
    "description": "Testing backend",
    "phone": "+256701234567"
  }' \
  https://motofix-service-requests.onrender.com/requests/
```
Expected response:
```json
{
  "id": "1001",
  "customer_name": "Backend Test",
  "service_type": "breakdown",
  "location": "Test Location",
  "description": "Testing backend",
  "phone": "+256701234567",
  "status": "pending",
  "media_files": [],
  "created_at": "2026-01-28T12:34:56.789Z"
}
```

### Step 4: Check Render Logs
Go to Render dashboard → Logs tab
Should see:
```
🟢 POST /requests/ hit
   Payload received: customer_name=Backend Test, service_type=breakdown, phone=+256701234567
📝 Before database insertion
✅ Request created successfully: id=1001
```

---

## Frontend Code Implementation

Once backend is verified working, implement in `customer-frontend/`:

### 1. Configure API Base URL

**File:** `src/config.js` (or similar)

```javascript
// ✅ CORRECT: Use absolute URL
export const API_BASE_URL = "https://motofix-service-requests.onrender.com"

// Development override (optional)
if (process.env.NODE_ENV === "development") {
  // For local testing: uncomment and run backend locally
  // export const API_BASE_URL = "http://localhost:8000"
}
```

### 2. Create API Service

**File:** `src/api/requests.js`

```javascript
import axios from "axios"
import { API_BASE_URL } from "../config"

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,  // 10 second timeout (not 30)
  headers: {
    "Content-Type": "application/json"
  }
})

export const submitServiceRequest = async (formData) => {
  try {
    console.log("📤 Sending request to:", `${API_BASE_URL}/requests/`)
    console.log("   Payload:", formData)
    
    const response = await API.post("/requests/", {
      customer_name: formData.customerName,
      service_type: formData.serviceType,
      location: formData.location,
      description: formData.description,
      phone: formData.phone
    })
    
    console.log("✅ Request successful!")
    console.log("   Response:", response.data)
    console.log("   Request ID:", response.data.id)
    console.log("   Status:", response.data.status)
    
    return {
      success: true,
      data: response.data,
      requestId: response.data.id
    }
  } catch (error) {
    console.error("❌ Request failed!")
    
    if (error.response) {
      // Backend returned error
      console.error("   HTTP Status:", error.response.status)
      console.error("   Error detail:", error.response.data.detail)
      return {
        success: false,
        error: error.response.data.detail || "Request failed",
        status: error.response.status
      }
    } else if (error.request) {
      // Request sent but no response
      console.error("   No response from server")
      console.error("   CORS may be blocked - check browser console")
      return {
        success: false,
        error: "No response from server. Check CORS and network.",
        status: null
      }
    } else {
      // Request setup error
      console.error("   Error:", error.message)
      return {
        success: false,
        error: error.message,
        status: null
      }
    }
  }
}

export const getRequestStatus = async (requestId) => {
  try {
    const response = await API.get(`/requests/${requestId}`)
    return response.data
  } catch (error) {
    console.error("Failed to fetch request:", error)
    throw error
  }
}
```

### 3. Form Component

**File:** `src/components/RequestForm.jsx` (or similar)

```jsx
import React, { useState } from "react"
import { submitServiceRequest } from "../api/requests"

export const RequestForm = () => {
  const [formData, setFormData] = useState({
    customerName: "",
    serviceType: "breakdown",
    location: "",
    description: "",
    phone: ""
  })
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [requestId, setRequestId] = useState(null)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const result = await submitServiceRequest(formData)
      
      if (result.success) {
        setSuccess(true)
        setRequestId(result.requestId)
        setFormData({
          customerName: "",
          serviceType: "breakdown",
          location: "",
          description: "",
          phone: ""
        })
        // Show success message
        alert(`✅ Request created! ID: ${result.requestId}\nStatus: ${result.data.status}`)
      } else {
        setError(result.error)
        // Show error message
        alert(`❌ Failed: ${result.error}`)
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error("Submit error:", err)
      alert("❌ An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="customerName">Name *</label>
        <input
          id="customerName"
          type="text"
          required
          value={formData.customerName}
          onChange={(e) => setFormData({...formData, customerName: e.target.value})}
          disabled={loading}
        />
      </div>
      
      <div>
        <label htmlFor="serviceType">Service Type *</label>
        <select
          id="serviceType"
          value={formData.serviceType}
          onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
          disabled={loading}
        >
          <option value="breakdown">Breakdown</option>
          <option value="repair">Repair</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="location">Location *</label>
        <input
          id="location"
          type="text"
          required
          value={formData.location}
          onChange={(e) => setFormData({...formData, location: e.target.value})}
          disabled={loading}
          placeholder="e.g., Kampala, Makindye"
        />
      </div>
      
      <div>
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          required
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          disabled={loading}
          placeholder="Describe the issue..."
        />
      </div>
      
      <div>
        <label htmlFor="phone">Phone Number *</label>
        <input
          id="phone"
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          disabled={loading}
          placeholder="+256..."
        />
      </div>
      
      {error && <div style={{color: "red"}}>Error: {error}</div>}
      {success && <div style={{color: "green"}}>✅ Request submitted! ID: {requestId}</div>}
      
      <button type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Submit Request"}
      </button>
    </form>
  )
}
```

---

## Testing in Development

### Step 1: Run Both Services Locally

**Terminal 1 - Backend:**
```bash
cd motofix-service-requests
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd customer-frontend
npm start  # or yarn dev
```

### Step 2: Update Frontend Config for Local Testing

**File:** `src/config.js`

```javascript
export const API_BASE_URL = process.env.NODE_ENV === "development" 
  ? "http://localhost:8000"
  : "https://motofix-service-requests.onrender.com"
```

### Step 3: Test Form Submission

1. Open http://localhost:3000 (or 5173)
2. Fill out form:
   - Name: "Test User"
   - Service Type: "breakdown"
   - Location: "Kampala"
   - Description: "Test"
   - Phone: "+256701234567"
3. Click "Submit Request"
4. Should see response: `✅ Request submitted! ID: 1`
5. Check browser console: Should see logs with full request/response

### Step 4: Check Backend Logs

```bash
# Terminal should show:
# 🟢 POST /requests/ hit
#    Payload received: customer_name=Test User, ...
# 📝 Before database insertion
# ✅ Request created successfully: id=1
```

---

## Common Issues & Solutions

### Issue 1: CORS Error in Browser Console
```
Access to XMLHttpRequest blocked by CORS policy:
No 'Access-Control-Allow-Origin' header
```

**Solutions:**
1. Verify backend is running
2. Verify Origin header is exactly "https://customer.motofix.org"
3. Check CORS is configured in [app/core/cors.py](../app/core/cors.py)
4. Check OPTIONS preflight works: `curl -i -X OPTIONS ...`

### Issue 2: 502 Bad Gateway / Timeout
```
Error: Request failed with status 502
```

**Solutions:**
1. Check backend is running on Render: https://motofix-service-requests.onrender.com/health
2. Check database is connected: `curl .../health-db`
3. Check logs on Render dashboard for errors
4. Verify DATABASE_URL is set in Render environment

### Issue 3: No Response / Hangs
```
Error: Network request timed out
```

**Solutions:**
1. Verify timeout is 10s (not 30s)
2. Check backend is responsive: `curl .../health`
3. Check if hanging on database: Look for `📝 Before database insertion` in logs
4. Check if it's CORS preflight hang: Try curl test first

### Issue 4: Response Missing Fields
```javascript
console.log(result.media_files)  // undefined (WRONG)
```

**Solution:**
- This should not happen - backend now always includes `media_files: []`
- If it happens, verify backend was redeployed

### Issue 5: status: undefined
```javascript
console.log(result.status)  // undefined (WRONG)
```

**Solution:**
- Backend sets `status: "pending"` in response
- If undefined, verify response is valid JSON

---

## Response Format Documentation

### Success Response (200 OK)

```json
{
  "id": "1",                    // String of numeric ID
  "customer_name": "John Doe",  // From form
  "service_type": "breakdown",  // From form
  "location": "Kampala",        // From form
  "description": "Car won't start",  // From form
  "phone": "+256701234567",     // From form
  "status": "pending",          // Always "pending" for new requests
  "media_files": [],            // Empty array for JSON requests
  "created_at": "2026-01-28T12:34:56.789Z"  // ISO timestamp
}
```

### Error Response

**422 Validation Error:**
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "customer_name"],
      "msg": "Field required",
      "input": {...}
    }
  ]
}
```

**500 Server Error:**
```json
{
  "detail": "Request creation failed"
}
```

**503 Service Unavailable:**
```json
{
  "detail": "Database service unavailable: ..."
}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Backend tested locally and on Render
- [ ] CORS preflight works with curl
- [ ] POST request returns valid response
- [ ] Response includes all required fields
- [ ] No CORS errors in browser
- [ ] No undefined fields in response
- [ ] Timeout is 10 seconds (not 30)
- [ ] Error messages are clear and actionable
- [ ] Logs show request ID on success
- [ ] Frontend shows success/error UI

---

## Monitoring in Production

Once deployed, monitor:

1. **Render Logs** - Check for 🟢, ✅, ❌ markers
2. **Browser Console** - Verify no CORS errors
3. **Network Tab** - Verify response is 200 with full JSON
4. **Response Fields** - Verify no undefined values

---

## Rollback Plan

If something breaks:

1. **Frontend Issue** - Revert to previous version
2. **Backend Issue** - Render has automatic rollback, or redeploy previous version
3. **CORS Issue** - Verify [app/core/cors.py](../app/core/cors.py) still has customer.motofix.org
4. **Database Issue** - Check DATABASE_URL in Render environment

---

**Status:** Ready for frontend integration ✅

Next step: Implement frontend form following the code examples above.

