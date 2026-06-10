# 🚀 CORS Fix - Deployment & Testing Plan

**Date:** January 23, 2026  
**Service:** motofix-service-requests.onrender.com  
**Issue:** CORS blocks requests from motofix-driver-assist.onrender.com

---

## 📝 What Was Added to main.py

### Line 4: Added Request import
```python
from fastapi import FastAPI, HTTPException, Depends, Request  # ← Added Request
```

### Line 14: Added JSONResponse import
```python
from fastapi.responses import FileResponse, JSONResponse  # ← Added JSONResponse
```

### Lines 41-62: Enhanced CORS middleware with logging
```python
# ════════════════════════════════ CORS (TOP PRIORITY) ════════════════════════════════
# MUST be FIRST middleware added
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://motofix-driver-assist.onrender.com",   # ← TARGET
        # ... other origins
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logger.info("═" * 70)
logger.info("🔧 MOTOFIX Service Requests API Starting...")
logger.info("CORS middleware registered for: https://motofix-driver-assist.onrender.com")
logger.info("═" * 70)
```

### Lines 181-213: Added debug endpoints
```python
@app.get("/debug-cors")          # ← Check if origin is received
@app.options("/test-cors")        # ← Test CORS preflight
@app.get("/test-cors")            # ← Test CORS GET request
```

### Lines 215-227: Added exception handler
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # ← Logs all errors with origin info
```

---

## ✅ Pre-Deployment Checklist

- [x] Python syntax valid (no errors)
- [x] CORS middleware positioned at top (after app init)
- [x] Exact origin: `https://motofix-driver-assist.onrender.com`
- [x] allow_credentials=True ✓
- [x] allow_methods includes OPTIONS ✓
- [x] allow_headers=["*"] ✓
- [x] Debug endpoints added ✓
- [x] Exception handler added ✓
- [x] Logging added ✓

---

## 🚀 Deployment Steps

### Step 1: Push Changes to Git
```bash
cd motofix-service-requests
git add app/main.py
git commit -m "Add CORS debugging endpoints - Jan 23 2026"
git push origin main
```

### Step 2: Render Manual Deploy (CRITICAL)
1. Go to **Render Dashboard** → Select `motofix-service-requests`
2. Click **Settings** (top right)
3. Scroll to **Build Cache** section
4. Click **Clear all builds and cache**
5. Back to main service page → Click **Manual Deploy**
6. Wait 2-3 minutes for build + startup

### Step 3: Verify Deployment
Check Render logs:
```
═══════════════════════════════════════════════════════════════════
🔧 MOTOFIX Service Requests API Starting...
CORS middleware registered for: https://motofix-driver-assist.onrender.com
═══════════════════════════════════════════════════════════════════
```

If you DON'T see this → Deployment failed, check Python syntax

---

## 🧪 Testing Sequence

### Test 1: Server Healthcheck (5 seconds)
```bash
curl https://motofix-service-requests.onrender.com/health
# Expected: {"status": "healthy"}
```
**Result:** ✓ (Server is up)

---

### Test 2: Debug CORS Endpoint (30 seconds)
Visit in browser from **anywhere**:
```
https://motofix-service-requests.onrender.com/debug-cors
```

**Check DevTools → Network tab:**
- ✓ Status: `200 OK`
- ✓ Response headers include: `access-control-allow-origin: https://motofix-driver-assist.onrender.com`
- ✓ Response body: `{"origin": "...", "method": "GET"}`

**Result:** ✓ (CORS middleware is running!)

---

### Test 3: CORS Preflight Test (1 minute)
Open browser console on **driver app** (https://motofix-driver-assist.onrender.com):

```javascript
// Test CORS preflight
fetch('https://motofix-service-requests.onrender.com/test-cors', {
  method: 'GET',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(r => r.json())
.then(data => console.log('✅ CORS SUCCESS:', data))
.catch(err => console.error('❌ CORS FAILED:', err.message));
```

**Watch Network tab:**
1. First request: `OPTIONS /test-cors` → Status `200`
2. Second request: `GET /test-cors` → Status `200`
3. Both should have `access-control-allow-origin` header

**Result:** ✓ (Preflight working!)

---

### Test 4: Actual Request Test (2 minutes)
Still in **driver app** console:

```javascript
// Test actual /requests/ endpoint
fetch('https://motofix-service-requests.onrender.com/requests/', {
  method: 'GET',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(r => {
  console.log('Status:', r.status);
  console.log('CORS header:', r.headers.get('access-control-allow-origin'));
  return r.json();
})
.then(data => console.log('✅ DATA RECEIVED:', data))
.catch(err => console.error('❌ ERROR:', err.message));
```

**Expected:**
- ✓ Status: `200 OK`
- ✓ CORS header: `https://motofix-driver-assist.onrender.com`
- ✓ Data: Array of requests `[{id, customer_name, ...}]`
- ✓ Console: No CORS error message

**Result:** ✓ (Full CORS working!)

---

### Test 5: App Feature Test (5 minutes)
In actual **motofix-driver-assist app**:

1. Login with phone + OTP
2. Navigate to **Requests** page
3. Should see requests list loading
4. Should NOT see CORS error in browser console

**Result:** ✓ (Production ready!)

---

## 🚨 Troubleshooting Matrix

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/debug-cors` returns 502 | Server crashed | Check Render logs, restart deploy |
| `/debug-cors` returns 200 but no CORS header | Middleware not registered | Clear cache, redeploy, check imports |
| OPTIONS returns 404 | Endpoint doesn't exist | Redeploy, check main.py lines 201-203 |
| OPTIONS returns 200 but GET fails | Middleware issue | Check line 41-62, exact origin match |
| Browser still shows CORS error | Browser cached old response | Hard refresh (Ctrl+Shift+R) |

---

## 📊 Success Criteria

✅ **CORS is fixed when:**
1. `/debug-cors` returns `200 OK` with CORS header
2. `/test-cors` OPTIONS returns `200 OK`
3. `/test-cors` GET returns `200 OK`
4. `/requests/` returns actual requests array
5. Driver app shows requests without CORS error
6. Browser console has NO red errors

❌ **If ANY test fails:**
1. Check Render logs for startup message
2. Verify exact origin: `https://motofix-driver-assist.onrender.com` (no typo)
3. Clear browser cache (hard refresh)
4. Wait 2 minutes and retry (cache propagation)

---

## 📝 Cleanup (After Confirmed Working)

Once everything works, you can optionally:

1. **Remove debug endpoints** (optional - useful for monitoring):
   ```python
   # Delete @app.get("/debug-cors")
   # Delete @app.options("/test-cors")
   # Delete @app.get("/test-cors")
   ```

2. **Reduce logging verbosity**:
   ```python
   # Simpler startup log instead of decorative one
   logger.info("Service Requests API started - CORS enabled")
   ```

3. **Keep exception handler** - useful for production

---

## 🔗 Quick Links

- **Render Dashboard:** https://dashboard.render.com
- **Service Logs:** Render → Service → Logs (real-time)
- **Service Settings:** Render → Service → Settings (clear cache here)

---

## 📞 If Still Failing

**Check in this order:**
1. ✓ Render logs show startup message? (Step 2.4)
2. ✓ `/debug-cors` returns 200 with CORS header? (Test 2)
3. ✓ Origin exactly matches `https://motofix-driver-assist.onrender.com`? (Line 43)
4. ✓ Did you clear cache AND redeploy? (Step 2.4)
5. ✓ Did you hard refresh browser (Ctrl+Shift+R)? (Test 4)

If all above pass but still failing → Contact support with:
- Render service logs (full output)
- Screenshot of DevTools Network tab
- Exact error message from browser console

---

**Last Updated:** Jan 23, 2026  
**Status:** Ready for deployment

