// Requests.tsx — the admin view of all service requests: a searchable, filterable table
// of every breakdown request and its status, with readable locations and drill-in detail.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import ReadableLocation from '@/components/ReadableLocation';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { fetchPublicRequests, fetchMechanics, fetchTowingProviders, ServiceRequest } from '@/lib/api';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { MapPin, User, Wrench, FileAudio, Image as ImageIcon, FileText, Search, X, CalendarRange, ChevronDown, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────
interface MediaFile {
  url: string; file_type: string; size_kb: number; uploaded_at: string;
}
interface RequestWithMedia extends ServiceRequest {
  media_files?: MediaFile[];
  description?: string;
}

// ── Filter options ─────────────────────────────────────────────────
const TIME_OPTIONS = [
  { value: 'all',       label: 'All hours' },
  { value: 'morning',   label: 'Morning  (6 am – 12 pm)' },
  { value: 'afternoon', label: 'Afternoon  (12 pm – 6 pm)' },
  { value: 'evening',   label: 'Evening  (6 pm – 12 am)' },
  { value: 'night',     label: 'Night  (12 am – 6 am)' },
] as const;
type TimeFilter = typeof TIME_OPTIONS[number]['value'];

const TIME_HOURS: Record<TimeFilter, [number, number]> = {
  all: [0, 24], morning: [6, 12], afternoon: [12, 18], evening: [18, 24], night: [0, 6],
};

const getStatusBadge = (s: string): 'pending' | 'warning' | 'completed' | 'failed' | 'secondary' => (
  ({ pending: 'pending', accepted: 'warning', en_route: 'warning', arrived: 'warning', service_started: 'warning', in_progress: 'warning', completed: 'completed', cancelled: 'failed' } as any)[s] ?? 'secondary'
);

// ── Columns ────────────────────────────────────────────────────────
const columns: ColumnDef<RequestWithMedia>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>,
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <User size={14} className="text-muted-foreground" />
        <span className="text-sm">{row.original.customerName || '—'}</span>
      </div>
    ),
  },
  {
    accessorKey: 'serviceType',
    header: 'Service',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Wrench size={14} className="text-primary" />
        <span>{row.original.serviceType}</span>
      </div>
    ),
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-muted-foreground" />
        <ReadableLocation value={row.original.location} className="text-sm" />
      </div>
    ),
  },
  {
    accessorKey: 'media_files',
    header: 'Media',
    cell: ({ row }) => {
      const media = row.original.media_files || [];
      const v = media.filter(m => m.file_type === 'voice').length;
      const p = media.filter(m => m.file_type === 'photo').length;
      const d = media.filter(m => m.file_type === 'document').length;
      if (!media.length) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-1 text-xs">
          {v > 0 && <div className="flex items-center gap-0.5 bg-blue-500/10 text-blue-600 px-2 py-1 rounded"><FileAudio size={12} /><span>{v}</span></div>}
          {p > 0 && <div className="flex items-center gap-0.5 bg-green-500/10 text-green-600 px-2 py-1 rounded"><ImageIcon size={12} /><span>{p}</span></div>}
          {d > 0 && <div className="flex items-center gap-0.5 bg-purple-500/10 text-purple-600 px-2 py-1 rounded"><FileText size={12} /><span>{d}</span></div>}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={getStatusBadge(row.original.status)}>
        {row.original.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    accessorKey: 'mechanicName',
    header: 'Mechanic',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.mechanicName || <span className="text-muted-foreground">—</span>}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{format(new Date(row.original.createdAt), 'MMM d, HH:mm')}</span>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────
export default function Requests() {
  const [search, setSearch]           = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [status, setStatus]           = useState('all');
  const [dateRange, setDateRange]     = useState<DateRange | undefined>(undefined);
  const [calOpen, setCalOpen]         = useState(false);
  const [timeFilter, setTimeFilter]   = useState<TimeFilter>('all');
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<RequestWithMedia | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['requests', { search, status, page }],
    queryFn: () => fetchPublicRequests({
      search,
      status: status !== 'all' ? status : undefined,
      page,
      pageSize: 10,
    }),
    retry: 2,
    staleTime: 30000,
  });

  // The request only carries the mechanic's id, so we load the provider directory once
  // and look up each id → name (mechanics and towing providers both), giving the table a
  // real "who worked on this" name instead of a bare number.
  const { data: mechData } = useQuery({
    queryKey: ['providers', 'mechanics-all'],
    queryFn: () => fetchMechanics({ page: 1, pageSize: 200 }),
    staleTime: 60000,
  });
  const { data: towData } = useQuery({
    queryKey: ['providers', 'towing-all'],
    queryFn: () => fetchTowingProviders({ page: 1, pageSize: 200 }),
    staleTime: 60000,
  });
  const providerNames = useMemo(() => {
    const m = new Map<string, string>();
    // Towing first, then mechanics, so a mechanic wins if an id ever appears in both.
    (towData?.data || []).forEach(p => m.set(String(p.id), p.name));
    (mechData?.data || []).forEach(p => m.set(String(p.id), p.name));
    return m;
  }, [mechData, towData]);

  // Client-side filters on top of server-side status/search
  const displayData = useMemo(() => {
    let rows = (data?.data || []).map(r => ({
      ...r,
      // Fill in the mechanic's name from the directory when the request only had an id.
      mechanicName: r.mechanicName || (r.mechanicId != null ? providerNames.get(String(r.mechanicId)) : undefined),
    })) as RequestWithMedia[];

    // Status filter — applied client-side so it works even if the backend hasn't filtered yet
    if (status !== 'all') {
      rows = rows.filter(r => r.status === status);
    }

    // Search filter — client-side fallback
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.serviceType || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q),
      );
    }

    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to   = endOfDay(dateRange.to ?? dateRange.from);
      rows = rows.filter(r => isWithinInterval(new Date(r.createdAt), { start: from, end: to }));
    }

    if (timeFilter !== 'all') {
      const [h0, h1] = TIME_HOURS[timeFilter];
      rows = rows.filter(r => {
        const h = new Date(r.createdAt).getHours();
        return h1 === 24 ? h >= h0 : h >= h0 && h < h1;
      });
    }

    return rows;
  }, [data, dateRange, timeFilter, status, search, providerNames]);

  const hasFilters = search !== '' || status !== 'all' || !!dateRange?.from || timeFilter !== 'all';

  const clearAll = () => {
    setSearch(''); setStatus('all'); setDateRange(undefined);
    setTimeFilter('all'); setPage(1);
  };

  // Date range label for the calendar trigger button
  const dateLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`
      : format(dateRange.from, 'MMM d, yyyy')
    : 'Pick a date range';

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Service Requests</h1>
          <p className="text-sm text-foreground/70 mt-1">Monitor and manage all customer roadside assistance requests in real time.</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by customer name, service type, location…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              border: searchFocused ? '1.5px solid rgba(255,179,0,0.80)' : '1.5px solid rgba(0,0,0,0.75)',
              boxShadow: searchFocused ? '0 0 0 3px rgba(255,179,0,0.13)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            className="w-full h-10 pl-10 pr-9 rounded-lg bg-background text-sm outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</span>
            <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px] text-sm" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Pending</span>
                </SelectItem>
                <SelectItem value="accepted">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Accepted</span>
                </SelectItem>
                <SelectItem value="en_route">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />On the Way</span>
                </SelectItem>
                <SelectItem value="arrived">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Arrived</span>
                </SelectItem>
                <SelectItem value="service_started">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Service Started</span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Completed</span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Cancelled</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date</span>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-lg text-sm transition-all",
                    dateRange?.from
                      ? "bg-primary/8 text-primary font-medium"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                  style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}
                >
                  <CalendarRange size={14} />
                  <span>{dateLabel}</span>
                  {dateRange?.from
                    ? <X size={13} onClick={e => { e.stopPropagation(); setDateRange(undefined); }} className="ml-1 opacity-60 hover:opacity-100" />
                    : <ChevronDown size={13} className="ml-1" />
                  }
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0 shadow-xl border">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold">Select date range</span>
                  {dateRange?.from && (
                    <button onClick={() => setDateRange(undefined)} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                  )}
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={val => { setDateRange(val); if (val?.from && val?.to) setCalOpen(false); }}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
                {dateRange?.from && (
                  <div className="px-4 py-2.5 border-t bg-muted/30 text-xs text-muted-foreground">
                    {dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
                      ? <>{format(dateRange.from, 'PPPP')} → {format(dateRange.to, 'PPPP')}</>
                      : <>{format(dateRange.from, 'PPPP')} — click another day to set end date</>
                    }
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Time of day */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Time</span>
            <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="h-9 w-[190px] text-sm" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
                <Clock size={13} className="mr-1 text-muted-foreground flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear all */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/60 hover:border-border px-3 h-9 rounded-lg transition-all ml-auto"
            >
              <X size={13} /> Clear all
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && !isLoading && (() => {
          const httpStatus = (error as any)?.response?.status;
          const isAuth = httpStatus === 401 || httpStatus === 403;
          return (
            <div style={{ background: 'var(--adm-surface-2)', border: '1px solid var(--adm-divider)', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, color: 'var(--adm-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ opacity: 0.5 }}>⚠</span>
                {isAuth
                  ? 'Your session has expired. Please log out and log back in to view requests.'
                  : 'Could not reach the requests service — it may be starting up; data will appear automatically once connected.'}
              </span>
              {isAuth && (
                <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: 'var(--adm-amber)', color: '#000', border: 'none', cursor: 'pointer' }}>
                  Log in again
                </button>
              )}
            </div>
          );
        })()}

        {/* Table */}
        <DataTable
          columns={columns}
          data={displayData}
          isLoading={isLoading}
          onRowClick={row => setSelected(row as RequestWithMedia)}
          pagination={data ? {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages,
            onPageChange: setPage,
          } : undefined}
        />
      </div>

      {/* Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
              <DialogDescription>{selected.id} • {format(new Date(selected.createdAt), 'PPpp')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">CUSTOMER</p>
                  <p className="text-sm">{selected.customerName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">STATUS</p>
                  <Badge variant={getStatusBadge(selected.status)} className="w-fit mt-1">
                    {selected.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">LOCATION</p>
                  <ReadableLocation value={selected.location} className="text-sm" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">SERVICE TYPE</p>
                  <p className="text-sm">{selected.serviceType}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">DESCRIPTION</p>
                <p className="text-sm bg-secondary/50 rounded-lg p-3">{selected.description || 'No description provided'}</p>
              </div>

              {selected.media_files && selected.media_files.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-3">ATTACHED MEDIA</p>
                  <div className="space-y-3">
                    {selected.media_files.map((media, idx) => (
                      <div key={idx} className="border rounded-lg p-3 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {media.file_type === 'voice'    && <FileAudio className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                          {media.file_type === 'photo'    && <ImageIcon  className="w-5 h-5 text-green-500 flex-shrink-0" />}
                          {media.file_type === 'document' && <FileText   className="w-5 h-5 text-purple-500 flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate capitalize">{media.file_type} Note</p>
                            <p className="text-xs text-muted-foreground">{media.size_kb.toFixed(1)} KB • {format(new Date(media.uploaded_at), 'PPp')}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="flex-shrink-0 ml-2">
                          <a href={media.url} target="_blank" rel="noopener noreferrer">View</a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.mechanicName && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">ASSIGNED MECHANIC</p>
                  <p className="text-sm">{selected.mechanicName}</p>
                </div>
              )}

              {(selected.actualFee != null || selected.serviceNote) && (
                <div className="grid grid-cols-2 gap-4">
                  {selected.actualFee != null && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">AGREED CHARGE</p>
                      <p className="text-sm font-semibold">UGX {Number(selected.actualFee).toLocaleString()}</p>
                    </div>
                  )}
                  {selected.serviceNote && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground font-medium mb-1">WORK DONE</p>
                      <p className="text-sm bg-secondary/50 rounded-lg p-3">{selected.serviceNote}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
