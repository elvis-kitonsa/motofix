import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getEarnings, type EarningsResponse, type EarningsRecord } from '@/services/api';
import { DollarSign, TrendingUp, Calendar, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PayoutBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (status === 'initiated') {
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <Clock className="w-3 h-3" /> Processing
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

const EarningsScreen: React.FC = () => {
  const { mechanic } = useAuth();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mechanic?.id) return;
    setIsLoading(true);
    getEarnings(mechanic.id as unknown as number)
      .then(setData)
      .catch((err) => setError(err?.message || 'Failed to load earnings'))
      .finally(() => setIsLoading(false));
  }, [mechanic?.id]);

  return (
    <div className="min-h-screen bg-background pb-24 safe-area-top">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <h1 className="text-lg font-bold text-foreground">Earnings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your payouts from completed jobs</p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && !isLoading && (
        <div className="m-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}

      {data && !isLoading && (
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card-industrial p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
              <p className="text-lg font-bold text-foreground">{formatUGX(data.total_earned)}</p>
            </div>

            <div className="card-industrial p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
              <p className="text-lg font-bold text-foreground">{formatUGX(data.this_month)}</p>
            </div>
          </div>

          {/* Earnings History */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
              Payment History
            </p>

            {data.earnings.length === 0 ? (
              <div className="card-industrial p-8 flex flex-col items-center gap-3 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No earnings yet.</p>
                <p className="text-xs text-muted-foreground/70">
                  Complete jobs and get paid via MTN MoMo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.earnings.map((item: EarningsRecord) => (
                  <div key={item.id} className="card-industrial p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {item.service_type || 'Roadside Assistance'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(String(item.created_at))}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">
                          {formatUGX(item.mechanic_payout)}
                        </p>
                        <p className="text-xs text-muted-foreground line-through">
                          {formatUGX(item.quoted_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">– {formatUGX(item.commission)} fee</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Payout</span>
                      <PayoutBadge status={item.disbursement_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsScreen;
