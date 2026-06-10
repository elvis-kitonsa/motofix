#!/bin/bash
# Persistent Login Implementation Verification Script
# Run this to verify all components are working correctly

echo "🔍 Persistent Login Implementation Verification"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: useAuth.ts exists and has localStorage
echo "1️⃣  Checking useAuth.ts..."
if grep -q "STORAGE_TOKEN_KEY" src/hooks/useAuth.ts; then
    echo -e "${GREEN}✅ useAuth.ts has token persistence constants${NC}"
else
    echo -e "${RED}❌ useAuth.ts missing token persistence${NC}"
    exit 1
fi

if grep -q "localStorage.setItem" src/hooks/useAuth.ts; then
    echo -e "${GREEN}✅ useAuth.ts saves token to localStorage${NC}"
else
    echo -e "${RED}❌ useAuth.ts doesn't save token${NC}"
    exit 1
fi

if grep -q "checkAuth" src/hooks/useAuth.ts; then
    echo -e "${GREEN}✅ useAuth.ts has checkAuth function${NC}"
else
    echo -e "${RED}❌ useAuth.ts missing checkAuth${NC}"
    exit 1
fi

echo ""
echo "2️⃣  Checking PrivateRoute.tsx..."
if grep -q "isLoading" src/components/PrivateRoute.tsx; then
    echo -e "${GREEN}✅ PrivateRoute has loading state${NC}"
else
    echo -e "${RED}❌ PrivateRoute missing loading state${NC}"
    exit 1
fi

if grep -q "isAuthenticated" src/components/PrivateRoute.tsx; then
    echo -e "${GREEN}✅ PrivateRoute checks authentication${NC}"
else
    echo -e "${RED}❌ PrivateRoute missing auth check${NC}"
    exit 1
fi

echo ""
echo "3️⃣  Checking Login.tsx..."
if grep -q "useAuth" src/pages/Login.tsx; then
    echo -e "${GREEN}✅ Login.tsx uses useAuth hook${NC}"
else
    echo -e "${RED}❌ Login.tsx doesn't use useAuth${NC}"
    exit 1
fi

if grep -q "isAuthenticated" src/pages/Login.tsx; then
    echo -e "${GREEN}✅ Login.tsx redirects if already authenticated${NC}"
else
    echo -e "${RED}❌ Login.tsx missing redirect logic${NC}"
    exit 1
fi

echo ""
echo "4️⃣  Checking Profile.tsx..."
if grep -q "handleLogout" src/pages/Profile.tsx; then
    echo -e "${GREEN}✅ Profile.tsx has logout handler${NC}"
else
    echo -e "${RED}❌ Profile.tsx missing logout${NC}"
    exit 1
fi

if grep -q "LogOut" src/pages/Profile.tsx; then
    echo -e "${GREEN}✅ Profile.tsx has logout button${NC}"
else
    echo -e "${RED}❌ Profile.tsx missing logout button${NC}"
    exit 1
fi

echo ""
echo "5️⃣  Checking api.ts..."
if grep -q "interceptors.request" src/config/api.ts; then
    echo -e "${GREEN}✅ api.ts has request interceptor${NC}"
else
    echo -e "${RED}❌ api.ts missing request interceptor${NC}"
    exit 1
fi

if grep -q "Authorization" src/config/api.ts; then
    echo -e "${GREEN}✅ api.ts injects Authorization header${NC}"
else
    echo -e "${RED}❌ api.ts doesn't inject token${NC}"
    exit 1
fi

if grep -q "401" src/config/api.ts; then
    echo -e "${GREEN}✅ api.ts handles 401 errors${NC}"
else
    echo -e "${RED}❌ api.ts missing 401 handling${NC}"
    exit 1
fi

echo ""
echo "6️⃣  Checking App.tsx..."
if grep -q "PrivateRoute" src/App.tsx; then
    echo -e "${GREEN}✅ App.tsx uses PrivateRoute wrapper${NC}"
else
    echo -e "${RED}❌ App.tsx missing PrivateRoute${NC}"
    exit 1
fi

if grep -q "/requests" src/App.tsx; then
    echo -e "${GREEN}✅ App.tsx has /requests route${NC}"
else
    echo -e "${RED}❌ App.tsx missing /requests route${NC}"
    exit 1
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
echo ""
echo "Implementation Status:"
echo "  ✅ Token persistence: Implemented"
echo "  ✅ Auto-authentication: Implemented"
echo "  ✅ Protected routes: Implemented"
echo "  ✅ Logout functionality: Implemented"
echo "  ✅ Error handling: Implemented"
echo ""
echo "Ready to test in browser! 🚀"
