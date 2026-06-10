import React, { useState } from 'react';
import { useJob } from '@/contexts/JobContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Car, MapPin, AlertTriangle, Check, X, Loader2, Navigation, DollarSign } from 'lucide-react';
import AttachmentList from '@/components/attachments/AttachmentList';

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(km: number): number {
  return Math.ceil((km / 30) * 60);
}

const IncomingJobScreen: React.FC = () => {
  const { incomingJob, acceptJob, rejectJob, isProcessing } = useJob();
  const { mechanic } = useAuth();
  const navigate = useNavigate();
  const [quoteInput, setQuoteInput] = useState('');

  React.useEffect(() => {
    if (!incomingJob) navigate('/', { replace: true });
  }, [incomingJob, navigate]);

  const parsedAmount = parseInt(quoteInput.replace(/,/g, ''), 10);
  const isValidQuote = !isNaN(parsedAmount) && parsedAmount > 10000;

  const handleAcceptAndQuote = async () => {
    if (!isValidQuote) return;
    await acceptJob(parsedAmount);
    navigate('/job', { replace: true });
  };

  const handleReject = async () => {
    await rejectJob();
    navigate('/', { replace: true });
  };

  if (!incomingJob) return null;

  const distanceInfo = (() => {
    const mLat = mechanic?.latitude;
    const mLon = mechanic?.longitude;
    const cLat = incomingJob.customer_latitude;
    const cLon = incomingJob.customer_longitude;
    if (!mLat || !mLon || !cLat || !cLon) return null;
    const km = haversineKm(mLat, mLon, cLat, cLon);
    return { km: km.toFixed(1), mins: etaMinutes(km) };
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Urgent Header */}
      <header className="px-4 py-4 bg-accent animate-urgent">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-foreground" />
          <span className="font-bold text-accent-foreground uppercase tracking-wide">New Job Request</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4">
        <div className="flex-1 space-y-4">

          {/* Vehicle */}
          <div className="card-industrial p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">Vehicle</p>
                <h2 className="text-lg font-bold text-foreground">{incomingJob.vehicle_type}</h2>
              </div>
            </div>
          </div>

          {/* Problem */}
          <div className="card-industrial p-5">
            <p className="text-sm text-muted-foreground mb-2">Problem</p>
            <p className="text-foreground font-medium leading-relaxed">{incomingJob.problem_description}</p>
            {incomingJob.attachments && incomingJob.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <AttachmentList attachments={incomingJob.attachments} />
              </div>
            )}
          </div>

          {/* Location */}
          <div className="card-industrial p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">Customer Location</p>
                <p className="text-foreground font-medium">{incomingJob.customer_location}</p>
                {distanceInfo && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-primary font-semibold">
                    <Navigation className="w-4 h-4" />
                    {distanceInfo.km} km away · ~{distanceInfo.mins} min drive
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Quote input ─────────────────────────────────────────────────── */}
          <div className="card-industrial p-5 border-2 border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-primary" />
              <p className="text-sm font-bold text-foreground">Your Quote (UGX)</p>
              <span className="ml-auto text-xs font-semibold text-destructive">Required</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Enter the total repair cost. UGX 10,000 platform commission is deducted from your payout.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                UGX
              </span>
              <input
                type="number"
                value={quoteInput}
                onChange={(e) => setQuoteInput(e.target.value)}
                placeholder="e.g. 50000"
                min={10001}
                className="w-full pl-14 pr-4 py-3.5 bg-muted border border-border rounded-xl text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {quoteInput !== '' && !isValidQuote && (
              <p className="text-xs text-destructive mt-1.5">Must be greater than UGX 10,000</p>
            )}

            {isValidQuote && (
              <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-success/10 border border-success/20">
                <span className="text-xs text-muted-foreground">Your payout</span>
                <span className="text-sm font-bold text-success">
                  UGX {(parsedAmount - 10000).toLocaleString()}
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={handleReject}
            disabled={isProcessing}
            className="btn-reject flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><X className="w-6 h-6" />Reject</>}
          </button>
          <button
            type="button"
            onClick={handleAcceptAndQuote}
            disabled={isProcessing || !isValidQuote}
            className="btn-accept flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-6 h-6" />Accept &amp; Quote</>}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {isValidQuote
            ? `Quote UGX ${parsedAmount.toLocaleString()} · Payout UGX ${(parsedAmount - 10000).toLocaleString()}`
            : 'Set your price to accept this job'}
        </p>
      </main>
    </div>
  );
};

export default IncomingJobScreen;
