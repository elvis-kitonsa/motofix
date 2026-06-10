import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const NetworkBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-destructive text-destructive-foreground flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium shadow-md">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      No internet connection — actions will fail until you're back online
    </div>
  );
};
