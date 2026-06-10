import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useJob } from '@/contexts/JobContext';
import { updateAvailability, updateLocation } from '@/services/api';
import { useNavigate } from 'react-router-dom'; // still needed for job redirects
import { User, Bell, BellOff, Loader2, MapPin, RefreshCw, Wallet } from 'lucide-react';
import { StreakBadge } from '@/components/StreakBadge';
import { loadStats, getLevelInfo } from '@/services/gamification';

const PULL_THRESHOLD = 80; // px needed to trigger refresh

const HomeScreen: React.FC = () => {
  const { mechanic } = useAuth();
  const { currentJob, incomingJob } = useJob();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(mechanic?.is_available ?? false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);

  const { title: levelTitle } = getLevelInfo(loadStats().xp);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  // Navigate to active job if exists
  useEffect(() => {
    if (currentJob) navigate('/job');
  }, [currentJob, navigate]);

  // Navigate to incoming job modal
  useEffect(() => {
    if (incomingJob) navigate('/incoming');
  }, [incomingJob, navigate]);

  // Location tracking when online
  useEffect(() => {
    if (!isOnline) return;

    const sendLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
          (err) => console.warn('Location error:', err.message),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    sendLocation();
    const interval = setInterval(sendLocation, 30000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleToggleAvailability = async () => {
    setIsToggling(true);
    try {
      const newStatus = !isOnline;
      await updateAvailability(newStatus);
      setIsOnline(newStatus);
    } catch {
      // availability toggle failed silently
    } finally {
      setIsToggling(false);
    }
  };

  // Pull-to-refresh
  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await updateAvailability(isOnline); // re-sync availability state
    } catch {}
    setIsRefreshing(false);
  }, [isOnline]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = window.scrollY === 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta, PULL_THRESHOLD * 1.5));
  };

  const onTouchEnd = () => {
    if (pullY >= PULL_THRESHOLD) doRefresh();
    setPullY(0);
    isPulling.current = false;
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullY >= PULL_THRESHOLD || isRefreshing) && (
        <div className="flex items-center justify-center gap-2 py-2 bg-primary/5 text-primary text-sm">
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isRefreshing ? 'Refreshing…' : 'Release to refresh'}
        </div>
      )}

      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{mechanic?.name}</h1>
            <p className="text-xs text-muted-foreground">{levelTitle}</p>
          </div>
          <StreakBadge />
          <button
            type="button"
            onClick={() => navigate('/earnings')}
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            aria-label="Earnings"
          >
            <Wallet className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 gap-4 pb-20">
        {/* Status Card */}
        <div className="card-industrial p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                  isOnline ? 'bg-success/15' : 'bg-muted'
                }`}
              >
                {isOnline ? (
                  <div className="relative">
                    <Bell className="w-10 h-10 text-success" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full status-pulse" />
                  </div>
                ) : (
                  <BellOff className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">
                {isOnline ? 'Online' : 'Offline'}
              </h2>
              <p className="text-muted-foreground">
                {isOnline ? 'Waiting for job requests...' : 'Go online to receive jobs'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={isToggling}
              className={`w-full btn-touch flex items-center justify-center gap-2 ${
                isOnline
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'bg-success text-success-foreground hover:bg-success/90'
              }`}
            >
              {isToggling ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isOnline ? (
                <>
                  <BellOff className="w-5 h-5" />
                  Go Offline
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Go Online
                </>
              )}
            </button>
          </div>
        </div>

        {/* Location Card */}
        {isOnline && (
          <div className="card-industrial p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Location Active</p>
                <p className="text-xs text-muted-foreground">
                  Sharing your location with the system
                </p>
              </div>
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomeScreen;
