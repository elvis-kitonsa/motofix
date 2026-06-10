import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-medium py-2 px-4">
      <WifiOff className="w-4 h-4 shrink-0" />
      No internet connection
    </div>
  );
}
