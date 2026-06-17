import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { requestsService, paymentsService } from '@/config/api';
import { createRequestsWs, WsPayload } from '@/services/driverWs';
import { addNotification } from '@/lib/notifications';
import { toast } from 'sonner';

export interface QuoteRecord {
  id: number;
  request_id: number;
  quoted_amount: number;
  commission: number;
  mechanic_payout: number;
  quote_approved: boolean;
  collection_status: string;
  disbursement_status: string;
}

export interface Request {
  id: number | string;
  service_type: string;
  location: string;
  description: string;
  status: string;
  created_at?: string;
  user_id?: number;
  mechanic_id?: number | string;
  mechanic_name?: string;
  mechanic_lat?: number;
  mechanic_lon?: number;
  dispatched_at?: string;
  accepted_at?: string;
  en_route_at?: string;
  arrived_at?: string;
  service_started_at?: string;
  completed_at?: string;
  eta_minutes?: number;
  completion_by?: 'mechanic' | 'driver' | 'system' | null;
  actual_fee?: number | null;       // final charge the mechanic entered
  service_note?: string | null;     // what was fixed (the ticked AI fixes, joined)
}

interface RequestContextValue {
  requests: Request[];
  isLoading: boolean;
  error: string | null;
  isWsConnected: boolean;
  refresh: () => Promise<void>;
  markCancelled: (id: string) => void;
  revertCancelled: (id: string) => void;
  sendWsMessage: (data: object) => void;
  featureFlagsLoaded: boolean;
  paymentsEnabled: boolean;
  pendingQuote: QuoteRecord | null;
  pendingQuoteRequestId: string | null;
  setPendingQuote: (q: QuoteRecord | null) => void;
  clearPendingQuote: () => void;
}

const RequestContext = createContext<RequestContextValue | null>(null);

const STATUS_MESSAGES: Record<string, string> = {
  accepted: '🔧 A mechanic has accepted your request!',
  en_route: '🚗 Your mechanic is on the way!',
  arrived: '📍 Your mechanic has arrived!',
  service_started: '🛠️ Service has started!',
  completed: '✅ Your request has been completed!',
  cancelled: '❌ Your request was cancelled',
};

export function RequestProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [featureFlagsLoaded, setFeatureFlagsLoaded] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<QuoteRecord | null>(null);
  const [pendingQuoteRequestId, setPendingQuoteRequestId] = useState<string | null>(null);

  const previousStatusesRef  = useRef<Map<string, string>>(new Map());
  const localCancelledRef    = useRef(new Set<string>());
  const wsEverConnected = useRef(false);
  const quoteCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsSendRef = useRef<((data: object) => void) | null>(null);

  const sendWsMessage = useCallback((data: object) => {
    wsSendRef.current?.(data);
  }, []);

  const clearPendingQuote = useCallback(() => {
    setPendingQuote(null);
    setPendingQuoteRequestId(null);
  }, []);

  const markCancelled = useCallback((id: string) => {
    localCancelledRef.current.add(id);
    setRequests(prev =>
      prev.map(r => String(r.id) === id ? { ...r, status: 'cancelled' } : r)
    );
    previousStatusesRef.current.set(id, 'cancelled');
  }, []);

  const revertCancelled = useCallback((id: string) => {
    localCancelledRef.current.delete(id);
  }, []);

  const applyUpdates = useCallback((incoming: Request[]) => {
    // Use functional form of setRequests so we can access current state and
    // preserve live mechanic positions (set via WS location_update) that the
    // REST API snapshot doesn't include.
    setRequests(prev => {
      // Build a lookup of current WS-sourced mechanic positions
      const mechPos = new Map(prev.map(r => [String(r.id), { lat: r.mechanic_lat, lon: r.mechanic_lon }]));

      const result = incoming.map(r => {
        const id = String(r.id);
        // If we optimistically cancelled a request, don't let a stale server
        // response (arriving via WS-triggered fetchAll) revert it back to active.
        if (localCancelledRef.current.has(id)) {
          if (r.status === 'cancelled') {
            localCancelledRef.current.delete(id); // server confirmed — clean up
          } else {
            r = { ...r, status: 'cancelled' }; // force cancelled until server confirms
          }
        }
        // Preserve live mechanic position from WS state — the REST API snapshot
        // never includes mechanic_lat/lon (they are in-memory only).
        const saved = mechPos.get(id);
        if (saved?.lat != null && r.mechanic_lat == null) {
          r = { ...r, mechanic_lat: saved.lat, mechanic_lon: saved.lon };
        }
        return r;
      });

      result.forEach((req) => {
        const prevStatus = previousStatusesRef.current.get(String(req.id));
        if (prevStatus && prevStatus !== req.status) {
          const msg = STATUS_MESSAGES[req.status];
          if (msg) {
            toast.success(msg, { duration: 5000 });
            addNotification({
              kind: 'job',
              title: msg,
              body: req.mechanic_name ? `Mechanic: ${req.mechanic_name}` : undefined,
              link: `/requests/${req.id}`,
              dedupeKey: `${req.id}:${req.status}`,
            });
          }
        }
        previousStatusesRef.current.set(String(req.id), req.status);
      });

      return result;
    });
  }, []);

  const fetchAll = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const res = await requestsService.getAll();
      applyUpdates(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, [applyUpdates]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Clear stale data and re-fetch whenever the logged-in user changes
  useEffect(() => {
    const handleAuthChange = () => {
      setRequests([]);
      previousStatusesRef.current.clear();
      fetchAll(true);
    };
    window.addEventListener('motofix:auth-changed', handleAuthChange);
    return () => window.removeEventListener('motofix:auth-changed', handleAuthChange);
  }, [fetchAll]);

  // Feature flags (DB-backed) - varies by deployment via `SERVICE_VARIANT`
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await requestsService.getFeatureFlags();
        if (!cancelled) setPaymentsEnabled(!!res.data?.payments);
      } catch {
        if (!cancelled) setPaymentsEnabled(false);
      } finally {
        if (!cancelled) setFeatureFlagsLoaded(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const { stop, send } = createRequestsWs(
      (payload: WsPayload) => {
        // Real-time mechanic location update — only apply updates from the mechanic side
        if (
          payload.type === 'location_update' &&
          payload.lat != null && payload.lng != null &&
          (payload.role === 'mechanic' || payload.role == null)  // accept untagged legacy messages too
        ) {
          // Ignore echoes of the driver's own broadcasts
          if (payload.role === 'driver') return;
          const rid = String(payload.service_request_id ?? payload.request_id ?? payload.job_id ?? '');
          if (rid) {
            setRequests((prev) =>
              prev.map((r) =>
                String(r.id) === rid
                  ? { ...r, mechanic_lat: payload.lat as number, mechanic_lon: payload.lng as number }
                  : r
              )
            );
          }
          return;
        }

        // Handle status-change events pushed by the backend
        if (payload.type === 'status_update' || payload.type === 'job_taken') {
          // Optimistically update the matching request in state
          setRequests((prev) =>
            prev.map((r) => {
              const rid = String(r.id);
              const pid = String(payload.request_id ?? payload.job_id ?? '');
              if (rid !== pid) return r;
              // Never override a request the user just cancelled — wait for applyUpdates
              if (localCancelledRef.current.has(rid)) return r;
              const updated: Request = {
                ...r,
                status: (payload.status as string) ?? r.status,
                mechanic_id: (payload.mechanic_id as string) ?? r.mechanic_id,
                mechanic_name: (payload.mechanic_name as string) ?? r.mechanic_name,
                mechanic_lat: (payload.mechanic_lat as number) ?? r.mechanic_lat,
                mechanic_lon: (payload.mechanic_lon as number) ?? r.mechanic_lon,
              };
              // Fire toast if status changed
              const prev = previousStatusesRef.current.get(rid);
              if (prev && prev !== updated.status) {
                const msg = STATUS_MESSAGES[updated.status];
                if (msg) {
                  toast.success(msg, { duration: 5000 });
                  addNotification({
                    kind: 'job',
                    title: msg,
                    body: updated.mechanic_name ? `Mechanic: ${updated.mechanic_name}` : undefined,
                    link: `/requests/${rid}`,
                    dedupeKey: `${rid}:${updated.status}`,
                  });
                }
              }
              previousStatusesRef.current.set(rid, updated.status);
              return updated;
            })
          );
        }
        // Re-fetch on any event to stay in sync
        fetchAll(false);
      },
      () => {
        setIsWsConnected(true);
        wsEverConnected.current = true;
      },
      () => {
        setIsWsConnected(false);
      },
    );

    wsSendRef.current = send;
    return () => {
      wsSendRef.current = null;
      stop();
    };
  }, [fetchAll]);

  // Polling fallback — only runs if WS never connected after 15s
  useEffect(() => {
    const check = setTimeout(() => {
      if (!wsEverConnected.current) {
        // Start 10-second polling as fallback
        const interval = setInterval(() => fetchAll(false), 10_000);
        return () => clearInterval(interval);
      }
    }, 15_000);
    return () => clearTimeout(check);
  }, [fetchAll]);

  const refresh = useCallback(() => fetchAll(false), [fetchAll]);

  // Poll for a pending quote whenever there are accepted/en_route requests
  useEffect(() => {
    if (!featureFlagsLoaded || !paymentsEnabled) return;

    const active = requests.filter(
      (r) => r.status === 'accepted' || r.status === 'en_route'
    );

    if (quoteCheckRef.current) clearInterval(quoteCheckRef.current);
    if (active.length === 0) return;

    const checkForQuote = async () => {
      for (const req of active) {
        try {
          const res = await paymentsService.getQuote(String(req.id));
          const q: QuoteRecord = res.data;
          if (q && q.collection_status !== 'success') {
            setPendingQuote(q);
            setPendingQuoteRequestId(String(req.id));
            return;
          }
        } catch {
          // No quote yet — keep polling
        }
      }
    };

    checkForQuote();
    quoteCheckRef.current = setInterval(checkForQuote, 5000);
    return () => { if (quoteCheckRef.current) clearInterval(quoteCheckRef.current); };
  }, [requests, featureFlagsLoaded, paymentsEnabled]);

  return (
    <RequestContext.Provider value={{
      requests,
      isLoading,
      error,
      isWsConnected,
      refresh,
      markCancelled,
      revertCancelled,
      sendWsMessage,
      featureFlagsLoaded,
      paymentsEnabled,
      pendingQuote, pendingQuoteRequestId, setPendingQuote, clearPendingQuote,
    }}>
      {children}
    </RequestContext.Provider>
  );
}

export function useRequests() {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error('useRequests must be used inside RequestProvider');
  return ctx;
}
