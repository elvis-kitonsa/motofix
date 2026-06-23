// Index.tsx — the landing route ("/"). It just decides where to send the admin:
// to the dashboard if they're logged in, or to the login page if not.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/api';

export default function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(isAuthenticated() ? '/dashboard' : '/login', { replace: true });
  }, [navigate]);
  return null;
}
