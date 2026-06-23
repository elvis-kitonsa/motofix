// Applications.tsx — the list of provider applications waiting for admin review (people
// applying to join as mechanics/tow providers), each linking to its detail page to approve
// or reject.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchProviderApplications, ProviderApplication } from '@/lib/api';
import { format } from 'date-fns';
import { Eye, Wrench, Truck, Clock, CheckCircle, XCircle, Search, X, FileCheck, Trash2 } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved')
    return (
      <Badge className="gap-1 bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/15">
        <CheckCircle size={11} /> Approved
      </Badge>
    );
  if (status === 'rejected')
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle size={11} /> Rejected
      </Badge>
    );
  if (status === 'revoked')
    return (
      <Badge className="gap-1 bg-gray-500/15 text-gray-400 border border-gray-500/25 hover:bg-gray-500/15">
        <Trash2 size={11} /> Revoked
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/15">
      <Clock size={11} /> Pending
    </Badge>
  );
}

export default function Applications() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [status, setStatus] = useState('all');
  const [providerType, setProviderType] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['provider-applications', status],
    queryFn:  () => fetchProviderApplications(status),
    staleTime: 15000,
  });

  const displayData = (data ?? []).filter(a => {
    if (providerType !== 'all' && a.provider_type !== providerType) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.phone.includes(q) ||
      (a.business_name ?? '').toLowerCase().includes(q)
    );
  });

  const pendingCount = (data ?? []).filter(a => a.verification_status === 'pending').length;

  const columns: ColumnDef<ProviderApplication>[] = [
    {
      accessorKey: 'full_name',
      header: 'Applicant',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-amber-400">
              {row.original.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold">{row.original.full_name}</p>
            <p className="text-xs text-muted-foreground">{row.original.phone}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'provider_type',
      header: 'Type',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.provider_type === 'mechanic'
            ? <Wrench size={14} className="text-amber-400" />
            : <Truck  size={14} className="text-blue-400"  />}
          <span className="text-sm">
            {row.original.provider_type === 'towing_provider' ? 'Towing Provider' : 'Mechanic'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'service_area',
      header: 'Service Area',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.service_area || '—'}</span>
      ),
    },
    {
      accessorKey: 'verification_status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.verification_status} />,
    },
    {
      accessorKey: 'submitted_at',
      header: 'Submitted',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.submitted_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm" variant="outline" className="gap-1.5"
          onClick={() => navigate(`/applications/${row.original.id}`)}>
          <Eye size={14} /> Review
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <FileCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              Provider Applications
              {pendingCount > 0 && (
                <span className="text-base font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  {pendingCount} pending
                </span>
              )}
            </h1>
            <p className="text-sm text-foreground/70 mt-1">
              Review submitted applications and approve or reject service providers.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone or business…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none"
              style={{
                border: searchFocused ? '1.5px solid rgba(255,179,0,0.80)' : '1.5px solid rgba(0,0,0,0.75)',
                boxShadow: searchFocused ? '0 0 0 3px rgba(255,179,0,0.13)' : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px] text-sm bg-background" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Pending Review
                </span>
              </SelectItem>
              <SelectItem value="approved">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Approved
                </span>
              </SelectItem>
              <SelectItem value="rejected">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  Rejected
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={providerType} onValueChange={setProviderType}>
            <SelectTrigger className="w-[170px] text-sm bg-background" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
              <SelectValue placeholder="Provider type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="mechanic">
                <span className="flex items-center gap-2">
                  <Wrench size={13} className="text-amber-400" /> Mechanics
                </span>
              </SelectItem>
              <SelectItem value="towing_provider">
                <span className="flex items-center gap-2">
                  <Truck size={13} className="text-blue-400" /> Towing Providers
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={displayData}
          isLoading={isLoading}
        />
      </div>
    </DashboardLayout>
  );
}
