import { useState, useEffect, useRef } from 'react';
import {
  DollarSign, Check, X, Loader2, Smartphone,
  AlertCircle, Clock, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { paymentsService } from '@/config/api';
import { useRequests } from '@/contexts/RequestContext';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS  = 2 * 60 * 1000; // 2 minutes

function normalisePhone(raw: string): string {
  // Strip spaces, dashes, leading +
  return raw.replace(/[\s\-]/g, '').replace(/^\+/, '');
}

function phoneValid(phone: string): boolean {
  const clean = normalisePhone(phone);
  return /^256\d{9}$/.test(clean); // 256 + 9 digits = 12 total
}

export function QuoteModal() {
  const { pendingQuote, pendingQuoteRequestId, setPendingQuote, clearPendingQuote, paymentsEnabled } = useRequests();

  const [isDismissed,        setIsDismissed]        = useState(false);
  const [isApproving,        setIsApproving]        = useState(false);
  const [isPaying,           setIsPaying]           = useState(false);
  const [momoPhone,          setMomoPhone]          = useState('');
  const [isTimedOut,         setIsTimedOut]         = useState(false);
  // When true, show the phone-entry screen even if collection_status is 'initiated'/'failed'
  const [retryMode,          setRetryMode]          = useState(false);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ── Reset local state whenever a genuinely new quote/status lands ──────────
  const quoteFingerprint = `${pendingQuote?.id}|${pendingQuote?.collection_status}|${pendingQuote?.quote_approved}`;
  useEffect(() => {
    setIsDismissed(false);
    setIsTimedOut(false);
    setRetryMode(false);
  }, [quoteFingerprint]);

  // ── Pre-fill phone from stored profile ────────────────────────────────────
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('motofix_user') || '{}');
      if (user?.phone) setMomoPhone(user.phone.replace(/^\+/, ''));
    } catch {}
  }, []);

  // ── Payment status polling ─────────────────────────────────────────────────
  const shouldPoll = (
    paymentsEnabled &&
    !!pendingQuote &&
    !!pendingQuoteRequestId &&
    pendingQuote.collection_status === 'initiated' &&
    !retryMode
  );

  useEffect(() => {
    if (!shouldPoll) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollStartRef.current = Date.now();

    const tick = async () => {
      // Timeout check first
      if (Date.now() - pollStartRef.current >= POLL_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setIsTimedOut(true);
        return;
      }

      try {
        const res = await paymentsService.getStatus(pendingQuoteRequestId!);
        const updated = res.data;
        setPendingQuote({ ...pendingQuote!, ...updated });

        const status: string = updated.collection_status ?? '';
        if (status === 'success' || status === 'successful') {
          if (pollRef.current) clearInterval(pollRef.current);
          // Show success screen in modal for 3 s, then close
          setTimeout(clearPendingQuote, 3000);
        } else if (status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    };

    tick();
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [shouldPoll, pendingQuoteRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDismiss = () => setIsDismissed(true);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await paymentsService.approveQuote(pendingQuoteRequestId!);
      setPendingQuote({ ...pendingQuote!, quote_approved: true });
      toast.success('Quote approved!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve quote');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = () => {
    toast.info('Quote rejected. The mechanic will be notified.');
    clearPendingQuote();
  };

  const handlePay = async () => {
    const clean = normalisePhone(momoPhone);
    setIsPaying(true);
    setIsTimedOut(false);
    try {
      await paymentsService.collect(pendingQuoteRequestId!, clean);
      setPendingQuote({ ...pendingQuote!, collection_status: 'initiated' });
      setRetryMode(false);
      toast.success('Payment initiated — approve the prompt on your phone');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Payment failed. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleRetry = () => {
    setIsTimedOut(false);
    setRetryMode(true);
    // Locally reset status so the pay screen is shown
    if (pendingQuote) setPendingQuote({ ...pendingQuote, collection_status: 'pending' });
  };

  // ── Visibility guards ─────────────────────────────────────────────────────
  if (!paymentsEnabled) return null;
  if (!pendingQuote || !pendingQuoteRequestId) return null;
  if (isDismissed) return null;

  // ── Screen derivation ─────────────────────────────────────────────────────
  const collectionStatus = pendingQuote.collection_status;
  const quoteApproved    = pendingQuote.quote_approved;
  const isSuccess  = collectionStatus === 'success' || collectionStatus === 'successful';
  const isAwaiting = collectionStatus === 'initiated' && !retryMode && !isTimedOut && !isSuccess;
  const isFailed   = collectionStatus === 'failed'    && !retryMode;

  const showSuccessScreen = isSuccess;
  const showApproveScreen = !quoteApproved && !isAwaiting && !isSuccess;
  const showPayScreen     = quoteApproved && !isAwaiting && !isFailed && !isTimedOut && !isSuccess;
  const showAwaitScreen   = isAwaiting;
  const showFailedScreen  = isFailed;
  const showTimeoutScreen = isTimedOut && !isSuccess;

  const isPayDisabled = isPaying || !phoneValid(momoPhone);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    /* Backdrop — tap to dismiss */
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6"
      onClick={handleDismiss}
    >
      {/* Card — stop propagation so tapping the card itself doesn't dismiss */}
      <div
        className="w-full max-w-md bg-card rounded-3xl p-6 shadow-2xl border border-border animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header row ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your mechanic quoted</p>
              <p className="text-2xl font-bold text-foreground">
                UGX {pendingQuote.quoted_amount.toLocaleString()}
              </p>
            </div>
          </div>
          {/* X dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Approve / Reject ──────────────────────────────────────── */}
        {showApproveScreen && (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Approve the price to continue. The mechanic is waiting.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-destructive/10 text-destructive font-bold text-sm border border-destructive/20"
              >
                <X className="w-4 h-4" /> Reject
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-success text-success-foreground font-bold text-sm disabled:opacity-60"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve
              </button>
            </div>
          </>
        )}

        {/* ── Phone entry + Pay ──────────────────────────────────────── */}
        {showPayScreen && (
          <>
            <p className="text-xs text-success flex items-center gap-1.5 mb-4">
              <Check className="w-3.5 h-3.5" /> Quote approved — pay to get started
            </p>
            <input
              type="tel"
              value={momoPhone}
              onChange={(e) => setMomoPhone(e.target.value)}
              placeholder="256771234567"
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-1"
            />
            <p className="text-xs text-muted-foreground mb-4">
              You can pay with a different MoMo number
            </p>
            <button
              type="button"
              onClick={handlePay}
              disabled={isPayDisabled}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 shadow-sm"
            >
              {isPaying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
              {isPaying ? 'Processing…' : `Pay UGX ${pendingQuote.quoted_amount.toLocaleString()}`}
            </button>
          </>
        )}

        {/* ── Payment successful ────────────────────────────────────── */}
        {showSuccessScreen && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-success/10 border border-success/20">
            <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Payment confirmed!</p>
              <p className="text-xs text-muted-foreground">The mechanic is on their way</p>
            </div>
          </div>
        )}

        {/* ── Awaiting MoMo approval ─────────────────────────────────── */}
        {showAwaitScreen && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Awaiting payment</p>
              <p className="text-xs text-muted-foreground">Approve the MoMo prompt on your phone</p>
            </div>
          </div>
        )}

        {/* ── Payment failed ────────────────────────────────────────── */}
        {showFailedScreen && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Payment failed</p>
                <p className="text-xs text-muted-foreground">The MoMo transaction was not successful</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {/* ── Timed out ─────────────────────────────────────────────── */}
        {showTimeoutScreen && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-warning/10 border border-warning/20">
              <Clock className="w-6 h-6 text-warning shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Payment timed out</p>
                <p className="text-xs text-muted-foreground">No response from MoMo after 2 minutes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Tap to try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
