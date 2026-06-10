import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { TableFilters } from '@/components/table/TableFilters';
import { FilterSelect } from '@/components/table/FilterSelect';
import { Badge } from '@/components/ui/badge';
import { fetchMechanics, Mechanic } from '@/lib/api';
import { format } from 'date-fns';
import { Phone, MapPin, Star, CheckCircle, Wrench } from 'lucide-react';

const verifiedOptions = [
  { value: 'all', label: 'All Mechanics' },
  { value: 'verified', label: 'Verified Only' },
];

const columns: ColumnDef<Mechanic>[] = [
  {
    accessorKey: 'name',
    header: 'Mechanic',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {row.original.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone size={10} />
            {row.original.phone}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-muted-foreground" />
        <span className="text-sm">{row.original.location}</span>
      </div>
    ),
  },
  {
    accessorKey: 'rating',
    header: 'Rating',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Star size={14} className="text-yellow-400 fill-yellow-400" />
        <span className="font-medium">{row.original.rating.toFixed(1)}</span>
      </div>
    ),
  },
  {
    accessorKey: 'jobsCompleted',
    header: 'Jobs',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Wrench size={14} className="text-muted-foreground" />
        <span className="font-mono">{row.original.jobsCompleted}</span>
      </div>
    ),
  },
  {
    accessorKey: 'verified',
    header: 'Verified',
    cell: ({ row }) => (
      row.original.verified ? (
        <Badge variant="success" className="gap-1">
          <CheckCircle size={12} />
          Verified
        </Badge>
      ) : (
        <Badge variant="secondary">Pending</Badge>
      )
    ),
  },
  {
    accessorKey: 'joinedAt',
    header: 'Joined',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(row.original.joinedAt), 'MMM d, yyyy')}
      </span>
    ),
  },
];

export default function Mechanics() {
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['mechanics', { search, verified, page }],
    queryFn: () => fetchMechanics({ search, verifiedOnly: verified === 'verified', page, pageSize: 10 }),
    retry: 2,
    staleTime: 30000,
  });

  const displayData = data?.data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Mechanics</h1>
          <p className="text-muted-foreground mt-1">
            Manage your fleet of motorcycle mechanics
          </p>
        </div>

        {/* Filters */}
        <TableFilters
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by phone..."
        >
          <FilterSelect
            value={verified}
            onValueChange={setVerified}
            options={verifiedOptions}
            placeholder="Filter"
          />
        </TableFilters>

        {/* Table */}
        <DataTable
          columns={columns}
          data={displayData}
          isLoading={isLoading}
          pagination={data ? {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages,
            onPageChange: setPage,
          } : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
