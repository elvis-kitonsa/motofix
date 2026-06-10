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
