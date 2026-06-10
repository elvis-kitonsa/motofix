# 🔧 CORS Debugging Guide for motofix-service-requests

**Status:** Production Debug Mode Active  
**Last Updated:** Jan 23, 2026  
**Issue:** CORS blocks requests from https://motofix-driver-assist.onrender.com

---

## 📋 What Was Changed

Added comprehensive CORS debugging to `app/main.py`:

### 1. **Startup Logging** (Lines 59-62)
```python
logger.info("═" * 70)
logger.info("🔧 MOTOFIX Service Requests API Starting...")
logger.info("CORS middleware registered for: https://motofix-driver-assist.onrender.com")
logger.info("═" * 70)
```
✅ Watch Render logs on startup to confirm middleware loads

### 2. **Debug Endpoints** (Lines 181-213)

#### `/debug-cors` (GET)
```bash
curl https://motofix-service-requests.onrender.com/debug-cors
```
**Response:**
```json
{
  "origin": "https://motofix-driver-assist.onrender.com",
  "method": "GET",
  "status": "CORS debug endpoint responding",
  "message": "If you see this, server is reachable. Check Access-Control-Allow-Origin header in Response."
}
```
✅ Logs the origin it received
✅ Confirms server is responding

#### `/test-cors` (OPTIONS + GET)
```bash
# Preflight request (what browser does automatically)
curl -X OPTIONS https://motofix-service-requests.onrender.com/test-cors \
  -H "Origin: https://motofix-driver-assist.onrender.com" \
  -v

# Actual GET request
curl https://motofix-service-requests.onrender.com/test-cors
```
✅ Tests the CORS preflight flow
✅ Should see `Access-Control-Allow-Origin` header in response

### 3. **Global Exception Handler** (Lines 215-227)
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"🔴 UNHANDLED EXCEPTION: {type(exc).__name__}")
    logger.error(f"   Path: {request.method} {request.url.path}")
    logger.error(f"   Origin: {request.headers.get('origin', 'NO ORIGIN')}")
```
✅ Logs any unhandled exceptions with full context
✅ Won't crash on middleware errors

---

## 🔍 Step-by-Step Debugging

### Step 1: Verify Server is Running
```bash
curl https://motofix-service-requests.onrender.com/health
# Expected: {"status": "healthy"}
```
If 502/503: Server hasn't started or crashed

### Step 2: Check if Server Receives Origin Header
Open browser DevTools and go to:
```
https://motofix-service-requests.onrender.com/debug-cors
```

**Check Response:**
- ✅ `"origin": "https://motofix-driver-assist.onrender.com"` → Origin received correctly
- ❌ `"origin": "NO ORIGIN HEADER"` → Browser not sending origin (unusual)

**Check Response Headers (DevTools → Network tab):**
- ✅ `Access-Control-Allow-Origin: https://motofix-driver-assist.onrender.com` → CORS header present!
- ❌ No `Access-Control-Allow-Origin` → **Middleware not running!**

### Step 3: Test CORS Preflight
In browser console on driver app:
```javascript
// This mimics what browser does automatically
fetch('https://motofix-service-requests.onrender.com/test-cors', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  mode: 'cors', // ← Important: tells browser to check CORS
})
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('CORS error:', e.message));
```

**Watch DevTools Network tab:**
1. **OPTIONS /test-cors** request appears first (preflight)
   - Status should be `200 OK`
   - Response headers should include `Access-Control-Allow-Origin`
2. **GET /test-cors** request appears next (actual request)
   - Status should be `200 OK`
   - Same CORS headers

**If preflight fails:**
- ❌ Status = `401, 403, 404` → Middleware issue (should be 200 for OPTIONS)
- ❌ No `Access-Control-Allow-Origin` header → **Core issue!**

### Step 4: Check Server Logs
On Render dashboard → Service → Logs:

**Look for:**
```
═══════════════════════════════════════════════════════════════════
🔧 MOTOFIX Service Requests API Starting...
CORS middleware registered for: https://motofix-driver-assist.onrender.com
═══════════════════════════════════════════════════════════════════
```

If **NOT present**: Middleware failed to register → Check for Python syntax errors

**When requests come in, look for:**
```
🔍 DEBUG CORS endpoint called
   Origin: https://motofix-driver-assist.onrender.com
   Method: GET
```

If **NOT present**: Server not receiving requests (check firewall/proxy)

### Step 5: Test from Frontend
In browser console on `https://motofix-driver-assist.onrender.com`:
```javascript
fetch('https://motofix-service-requests.onrender.com/requests/', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('Error:', e));
```

**Expected:**
- ✅ Status `200 OK`
- ✅ Response contains array of requests
- ✅ Console shows data (no CORS error)

**If CORS error:**
- ❌ Error message in console: "...has been blocked by CORS policy..."
- ❌ DevTools → Network → `/requests/` → Response shows empty headers
- → Middleware is definitely not working

---

## 🚨 Possible Root Causes

### Issue 1: Middleware Not Registering
**Symptom:** `Access-Control-Allow-Origin` header missing from ALL responses

**Check:**
1. ✅ Is CORS middleware added right after `app = FastAPI(...)`?
2. ✅ Is import `from fastapi.middleware.cors import CORSMiddleware` present?
3. ✅ Render logs show startup message?
4. → If no, redeploy with cache cleared

### Issue 2: Middleware Registered But Not Running
**Symptom:** Header missing only from specific endpoints

**Check:**
1. ✅ Are there early `return` statements before response is sent?
2. ✅ Are there other middlewares that might interfere?
3. ✅ Is there custom exception handling that drops CORS headers?
4. → Add logging to `/requests/` endpoint:
```python
@app.get("/requests/")
async def get_requests(db=Depends(get_db)):
    logger.info("🟢 GET /requests/ called - middleware should add CORS header")
    # ... rest of function
```

### Issue 3: Wrong Origin in allow_origins List
**Symptom:** CORS header present but says `Access-Control-Allow-Origin: null`

**Check:**
```python
# In main.py, verify exact origin:
allow_origins=[
    "https://motofix-driver-assist.onrender.com",  # ← Check for typos
    # ...
]
```
- ❌ `"https://motofix-driver-assist.onrender.com/"` (extra slash)
- ❌ `"https://motofix-driver-assist.onrender.com:443"` (explicit port)
- ❌ `"http://..."` (http instead of https)

### Issue 4: Render Caching Old Build
**Symptom:** Code looks right but changes don't apply

**Fix:**
1. Go to Render Dashboard → Service → Settings
2. Scroll down → **Clear all builds and cache**
3. Trigger manual deploy
4. Wait 2-3 minutes for new build to start
5. Check logs for startup message

### Issue 5: Environment Variable Issue
**Symptom:** Server fails to start (502 Bad Gateway)

**Check:**
- ✅ DATABASE_URL is set in Render environment
- ✅ No syntax errors in main.py
- → Check Render logs for Python errors

---

## ✅ Success Indicators

When CORS is **working correctly**, you should see:

1. **Browser Console:** No CORS errors
2. **DevTools Network:**
   - OPTIONS request → Status `200 OK`
   - Access-Control-Allow-Origin header present
   - GET request → Status `200 OK`
3. **Render Logs:**
   ```
   🔧 MOTOFIX Service Requests API Starting...
   CORS middleware registered for: https://motofix-driver-assist.onrender.com
   ```
4. **Actual Data:** `/requests/` returns actual requests array

---

## 🧹 Cleanup After Debugging

Once CORS is working:

1. **Remove excessive logging** (optional - can stay for monitoring):
```python
# BEFORE (lines 59-62):
logger.info("═" * 70)
logger.info("🔧 MOTOFIX Service Requests API Starting...")
logger.info("CORS middleware registered for: https://motofix-driver-assist.onrender.com")
logger.info("═" * 70)

# AFTER (simpler):
logger.info("Service Requests API started - CORS enabled for driver app")
```

2. **Keep debug endpoints** for future troubleshooting:
   - `/health` - Always useful
   - `/debug-cors` - Keep for monitoring
   - `/test-cors` - Can remove if never needed again

3. **Update this guide** if you find other issues

---

## 📞 Quick Reference

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Healthcheck | `{"status": "healthy"}` |
| `/debug-cors` | See origin + method | `{"origin": "...", "method": "GET"}` |
| `/test-cors` | Test preflight | `{"message": "CORS test..."}` |
| `/requests/` | Get actual requests | `[{id, customer_name, ...}]` |

---

## 🔐 Security Notes

⚠️ **After debugging, remove or restrict these endpoints if:**
- You're concerned about exposing internal structure
- You have strict security policies

✅ **Safe to keep because:**
- `/debug-cors` only returns request headers (already visible to client)
- `/test-cors` is a dummy endpoint with no real data
- `/health` is standard practice

---

**Next Steps:**
1. Deploy this updated main.py to Render
2. Clear cache and trigger manual deploy
3. Wait 2-3 minutes
4. Visit `/debug-cors` from browser
5. Check Render logs for startup message
6. Try `/requests/` from driver app → should work! ✅

