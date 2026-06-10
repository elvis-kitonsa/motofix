import React, { useState, useEffect } from 'react';
import { useJob } from '@/contexts/JobContext';
import { useNavigate } from 'react-router-dom';
import { Car, MapPin, ArrowRight, Check, Loader2, Phone, DollarSign, AlertTriangle, LogOut } from 'lucide-react';
import type { JobStatus } from '@/types/mechanic';
import AttachmentList from '@/components/attachments/AttachmentList';
import { getCallPartner, getQuote, type QuoteRecord } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

/** Split "Nansana (0.369382, 32.513763)" into { name, coords } for display. */
function parseLocationDisplay(loc: string): { name: string; coords: string | null } {
  const match = loc.match(/^(.+?)\s*\((-?\d+\.?\d*,\s*-?\d+\.?\d*)\)\s*$/);
  if (match) return { name: match[1].trim(), coords: match[2].trim() };
  return { name: loc, coords: null };
}

const STATUS_FLOW: { status: JobStatus; label: string; nextLabel: string }[] = [
  { status: 'accepted', label: 'Job Accepted', nextLabel: 'Start Driving' },
  { status: 'en_route', label: 'On the Way', nextLabel: 'I\'ve Arrived' },
  { status: 'arrived', label: 'At Location', nextLabel: 'Start Service' },
  { status: 'service_started', label: 'Service Started', nextLabel: 'Mark Complete' },
  { status: 'completed', label: 'Completed', nextLabel: '' },
];

const ActiveJobScreen: React.FC = () => {
  const { currentJob, updateStatus, abandonJob, isProcessing } = useJob();
  const navigate = useNavigate();
  const toast = useToast();
  const [isCalling, setIsCalling] = useState(false);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    if (!currentJob) navigate('/', { replace: true });
  }, [currentJob, navigate]);

  // Load the quote that was submitted during job acceptance
  useEffect(() => {
    if (!currentJob) return;
    getQuote(currentJob.id).then(setQuote).catch(() => {/* no quote */});
  }, [currentJob?.id]);

  if (!currentJob) return null;

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.status === currentJob.status);
  const currentStatusInfo = STATUS_FLOW[currentStatusIndex];
  const nextStatus = STATUS_FLOW[currentStatusIndex + 1]?.status;
  const canCallDriver = currentJob.status === 'accepted' || currentJob.status === 'en_route' || currentJob.status === 'arrived' || currentJob.status === 'service_started';

  const handleCallDriver = async () => {
    setIsCalling(true);
    try {
      const response = await getCallPartner(currentJob.id);
      if (response.phone) window.location.href = `tel:${response.phone}`;
    } catch (error: any) {
      toast.toast({ title: 'Call failed', description: error?.message || 'Unable to call driver', duration: 4000 });
    } finally {
      setIsCalling(false);
    }
  };

  const handleAbandon = async () => {
    if (!confirmAbandon) {
      setConfirmAbandon(true);
      // Auto-reset confirmation after 4 s if mechanic doesn't follow through
      setTimeout(() => setConfirmAbandon(false), 4000);
      return;
    }
    await abandonJob();
    navigate('/', { replace: true });
  };

  const handleNextStatus = async () => {
    if (nextStatus) {
      const jobSnapshot = currentJob;
      const completedAt = new Date().toISOString();
      const xpBreakdown = await updateStatus(nextStatus);
      if (nextStatus === 'completed') {
        navigate('/completion', { replace: true, state: { job: jobSnapshot, completedAt, xpBreakdown } });
      }
    }
  };

  const getStatusClass = (status: JobStatus) => {
    switch (status) {
      case 'accepted': return 'job-status-accepted';
      case 'en_route': return 'job-status-onway';
      case 'arrived': return 'job-status-arrived';
      case 'service_started': return 'job-status-accepted';
      case 'completed': return 'job-status-completed';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Active Job</h1>
          <span className={getStatusClass(currentJob.status)}>{currentStatusInfo?.label}</span>
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
                <h2 className="text-lg font-bold text-foreground">{currentJob.vehicle_type}</h2>
              </div>
            </div>
          </div>

          {/* Problem */}
          <div className="card-industrial p-5">
            <p className="text-sm text-muted-foreground mb-2">Problem</p>
            <p className="text-foreground font-medium">{currentJob.problem_description}</p>
            {currentJob.attachments && currentJob.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <AttachmentList attachments={currentJob.attachments} />
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
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                {(() => {
                  const { name, coords } = parseLocationDisplay(currentJob.customer_location);
                  return (
                    <>
                      <p className="text-foreground font-medium">{name}</p>
                      {coords && <p className="text-xs text-muted-foreground mt-0.5">{coords}</p>}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Quote summary — read-only, submitted at job acceptance */}
          {quote && (
            <div className="card-industrial p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Your Quote</p>
                {quote.quote_approved && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-success">
                    <Check className="w-3.5 h-3.5" /> Driver approved
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quoted to driver</span>
                  <span className="font-bold text-foreground">UGX {quote.quoted_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Commission</span>
                  <span className="text-muted-foreground">– UGX {quote.commission.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5">
                  <span className="text-muted-foreground">Your payout</span>
                  <span className="text-success">UGX {quote.mechanic_payout.toLocaleString()}</span>
                </div>
                {quote.collection_status === 'success' || quote.collection_status === 'successful' ? (
                  <p className="mt-1 text-xs text-success font-semibold">
                    ✓ Driver has paid — your payout is being processed
                  </p>
                ) : quote.collection_status === 'failed' ? (
                  <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive font-medium">
                      Driver's payment failed. You can abandon this job below.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Progress Tracker */}
          <div className="card-industrial p-5">
            <p className="text-sm text-muted-foreground mb-4">Progress</p>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.slice(0, -1).map((step, index) => {
                const isCompleted = currentStatusIndex > index;
                const isCurrent = currentStatusIndex === index;
                return (
                  <React.Fragment key={step.status}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted ? 'bg-success text-success-foreground' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                      </div>
                      <span className="text-[10px] text-muted-foreground text-center max-w-[60px]">{step.label}</span>
                    </div>
                    {index < STATUS_FLOW.length - 2 && (
                      <div className={`h-0.5 flex-1 mx-1 ${isCompleted ? 'bg-success' : 'bg-muted'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Call Driver */}
        {canCallDriver && (
          <button
            type="button"
            onClick={handleCallDriver}
            disabled={isCalling || isProcessing}
            className="mt-4 btn-touch flex items-center justify-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCalling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
            {isCalling ? 'Calling...' : 'Call Driver'}
          </button>
        )}

        {/* Next status */}
        {nextStatus && (
          <button
            type="button"
            onClick={handleNextStatus}
            disabled={isProcessing}
            className={`mt-6 btn-touch flex items-center justify-center gap-2 disabled:opacity-50 ${
              nextStatus === 'completed' ? 'bg-success text-success-foreground hover:bg-success/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {nextStatus === 'completed' ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                {currentStatusInfo?.nextLabel}
              </>
            )}
          </button>
        )}
        {/* Abandon job */}
        <button
          type="button"
          onClick={handleAbandon}
          disabled={isProcessing}
          className={`mt-3 btn-touch flex items-center justify-center gap-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            confirmAbandon
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : 'bg-transparent text-destructive border-destructive/40 hover:border-destructive hover:bg-destructive/5'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {confirmAbandon ? 'Tap again to confirm abandon' : 'Abandon Job'}
        </button>
      </main>
    </div>
  );
};

export default ActiveJobScreen;
