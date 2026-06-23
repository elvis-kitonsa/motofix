// Drivers.tsx — the admin list of all registered drivers (searchable table), each linking
// through to their detail page. The driver-management entry point.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchDrivers, Driver } from '@/lib/api';
import { format } from 'date-fns';
import { Phone, Car, Users, Search, X, Eye } from 'lucide-react';

function StatusBadge({ status }: { status: Driver['status'] }) {
  if (status === 'suspended')
    return <Badge className="gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/25">Suspended</Badge>;
  if (status === 'banned')
    return <Badge variant="destructive">Banned</Badge>;
  return <Badge className="gap-1 bg-green-500/15 text-green-400 border border-green-500/25">Active</Badge>;
}

export default function Drivers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => fetchDrivers(),
    staleTime: 60000,
    retry: false,
  });

  const displayData = data.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(d.full_name ?? '').toLowerCase().includes(q) &&
        !d.phone.includes(q) &&
        !(d.number_plate ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const columns: ColumnDef<Driver>[] = [
    {
      accessorKey: 'full_name',
      header: 'Driver',
      cell: ({ row }) => {
        const name = row.original.full_name || 'Unknown';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">{initials}</span>
            </div>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone size={10} /> {row.original.phone}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'number_plate',
      header: 'Number Plate',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Car size={14} className="text-muted-foreground" />
          <span className="font-mono text-sm">
            {row.original.number_plate || <span className="text-muted-foreground italic">Not set</span>}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'request_count',
      header: 'Requests',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.request_count}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ row }) => {
        try {
          return <span className="text-sm text-muted-foreground">{format(new Date(row.original.created_at), 'MMM d, yyyy')}</span>;
        } catch {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/drivers/${row.original.id}`)}>
          <Eye size={14} /> View
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Drivers</h1>
            <p className="text-sm text-foreground/70 mt-1">All registered drivers and their vehicle details.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone or plate…"
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] text-sm bg-background" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              <SelectItem value="active">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active</span>
              </SelectItem>
              <SelectItem value="suspended">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Suspended</span>
              </SelectItem>
              <SelectItem value="banned">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Banned</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground ml-auto">{displayData.length} driver{displayData.length !== 1 ? 's' : ''}</span>
        </div>

        <DataTable columns={columns} data={displayData} isLoading={isLoading} />
      </div>
    </DashboardLayout>
  );
}
