import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  fetchDriver, updateDriverStatus, fetchDriverRequests, fetchDriverPayments,
  Driver, DriverRequest,
} from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, Phone, Car, Calendar, Shield, AlertTriangle, Ban,
  CheckCircle, Wrench, Receipt, Clock, TrendingUp, MapPin,
} from 'lucide-react';

function StatusBadge({ status }: { status: Driver['status'] }) {
  if (status === 'suspended')
    return <Badge className="gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/25"><AlertTriangle size={12} /> Suspended</Badge>;
  if (status === 'banned')
    return <Badge variant="destructive" className="gap-1.5"><Ban size={12} /> Banned</Badge>;
  return <Badge className="gap-1.5 bg-green-500/15 text-green-400 border border-green-500/25"><CheckCircle size={12} /> Active</Badge>;
}

function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-500/15 text-green-400 border-green-500/25',
    pending:   'bg-amber-500/15 text-amber-400 border-amber-500/25',
    accepted:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
    in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <Badge className={`capitalize border ${map[status] ?? 'bg-muted/30 text-muted-foreground border-border'}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-medium">{value || '—'}</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

const requestColumns: ColumnDef<DriverRequest>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>,
  },
  {
    accessorKey: 'service_type',
    header: 'Service',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Wrench size={13} className="text-primary" />
        <span className="text-sm">{row.original.service_type}</span>
      </div>
    ),
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin size={12} />
        <span className="truncate max-w-[180px]">{row.original.location || '—'}</span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => {
      try {
        return <span className="text-sm text-muted-foreground">{format(new Date(row.original.created_at), 'MMM d, yyyy · h:mm a')}</span>;
      } catch {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
    },
  },
];

function formatUGX(n: number) {
  return `UGX ${Number(n).toLocaleString()}`;
}

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [actionOpen, setActionOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'suspended' | 'banned' | 'active' | null>(null);
  const [reason, setReason] = useState('');

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => fetchDriver(id!),
    enabled: !!id,
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['driver-requests', id],
    queryFn: () => fetchDriverRequests(id!),
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ['driver-payments', id],
    queryFn: () => fetchDriverPayments(id!),
    enabled: !!id,
  });

  const statusMut = useMutation({
    mutationFn: () => updateDriverStatus(id!, pendingStatus!, reason || undefined),
    onSuccess: () => {
      toast.success(
        pendingStatus === 'active' ? 'Account reinstated.' :
        pendingStatus === 'suspended' ? 'Driver suspended.' : 'Driver banned.'
      );
      setActionOpen(false);
      setReason('');
      setPendingStatus(null);
      qc.invalidateQueries({ queryKey: ['driver', id] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: () => toast.error('Failed to update driver status.'),
  });

  const openAction = (s: 'suspended' | 'banned' | 'active') => {
    setPendingStatus(s);
    setReason('');
    setActionOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!driver) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Driver not found.</p>
      </DashboardLayout>
    );
  }

  const completedCount = requests.filter(r => r.status === 'completed').length;
  const cancelledCount = requests.filter(r => r.status === 'cancelled').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/drivers')} className="shrink-0 mt-0.5">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{driver.full_name || 'Unknown Driver'}</h1>
              <StatusBadge status={driver.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Joined {format(new Date(driver.created_at), 'MMMM d, yyyy')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="hidden sm:flex gap-2 shrink-0">
            {driver.status === 'active' && (
              <>
                <Button variant="outline" className="gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400" onClick={() => openAction('suspended')}>
                  <AlertTriangle size={15} /> Suspend
                </Button>
                <Button variant="outline" className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400" onClick={() => openAction('banned')}>
                  <Ban size={15} /> Ban
                </Button>
              </>
            )}
            {(driver.status === 'suspended' || driver.status === 'banned') && (
              <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => openAction('active')}>
                <CheckCircle size={15} /> Reinstate
              </Button>
            )}
          </div>
        </div>

        {/* Suspension reason banner */}
        {driver.status_reason && driver.status !== 'active' && (
          <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/25">
            <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive mb-1">
                {driver.status === 'banned' ? 'Reason for ban' : 'Reason for suspension'}
              </p>
              <p className="text-sm text-muted-foreground">{driver.status_reason}</p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Receipt}    label="Total Requests"   value={String(requests.length)}        color="var(--adm-muted)" />
          <StatCard icon={CheckCircle} label="Completed"       value={String(completedCount)}          color="var(--adm-green)" />
          <StatCard icon={TrendingUp} label="Total Paid"       value={formatUGX(payments?.total_paid ?? 0)} color="var(--adm-cyan)" />
          <StatCard icon={Clock}      label="Pending Payment"  value={formatUGX(payments?.pending_amount ?? 0)} color="var(--adm-amber)" />
        </div>

        {/* Profile + Request History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: profile */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact</h3>
              <InfoRow icon={Phone}    label="Phone"        value={driver.phone} />
              <InfoRow icon={Shield}   label="Account ID"   value={`#${driver.id}`} />
              <InfoRow icon={Calendar} label="Date Joined"  value={format(new Date(driver.created_at), 'MMM d, yyyy')} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Vehicle</h3>
              <InfoRow icon={Car}   label="Number Plate"  value={driver.number_plate} />
            </div>

            {/* Mobile action buttons */}
            <div className="flex flex-col gap-2 sm:hidden">
              {driver.status === 'active' && (
                <>
                  <Button variant="outline" className="gap-2 text-amber-400 border-amber-500/30" onClick={() => openAction('suspended')}>
                    <AlertTriangle size={15} /> Suspend Account
                  </Button>
                  <Button variant="outline" className="gap-2 text-red-400 border-red-500/30" onClick={() => openAction('banned')}>
                    <Ban size={15} /> Ban Account
                  </Button>
                </>
              )}
              {(driver.status === 'suspended' || driver.status === 'banned') && (
                <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => openAction('active')}>
                  <CheckCircle size={15} /> Reinstate Account
                </Button>
              )}
            </div>
          </div>

          {/* Right: request history */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Wrench size={13} /> Request History
                <span className="ml-auto text-xs font-normal normal-case text-muted-foreground">
                  {completedCount} completed · {cancelledCount} cancelled
                </span>
              </h3>
              <DataTable columns={requestColumns} data={requests} isLoading={loadingRequests} />
            </div>
          </div>
        </div>
      </div>

      {/* Status change dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === 'active'    ? 'Reinstate Driver' :
               pendingStatus === 'suspended' ? 'Suspend Driver'   : 'Ban Driver'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              {pendingStatus === 'active'
                ? 'This will restore the driver\'s access to the platform.'
                : 'Provide a reason. The driver will be notified.'}
            </p>
            {pendingStatus !== 'active' && (
              <Textarea
                placeholder={pendingStatus === 'suspended'
                  ? 'e.g. Multiple complaints from mechanics…'
                  : 'e.g. Fraudulent activity, repeat policy violations…'}
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button
              disabled={(pendingStatus !== 'active' && !reason.trim()) || statusMut.isPending}
              className={
                pendingStatus === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' :
                pendingStatus === 'banned' ? 'bg-destructive hover:bg-destructive/90 text-white' :
                'bg-amber-500 hover:bg-amber-600 text-black'
              }
              onClick={() => statusMut.mutate()}
            >
              {statusMut.isPending ? 'Saving…' :
               pendingStatus === 'active'    ? 'Confirm Reinstatement' :
               pendingStatus === 'suspended' ? 'Confirm Suspension'    : 'Confirm Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
