// MechanicsManagement.tsx — SUPERSEDED / not currently routed. An older mechanics CRUD
// screen (add/edit/delete); the live equivalent is Providers.tsx. Kept for reference —
// safe to remove once confirmed nothing depends on it.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { TableFilters } from '@/components/table/TableFilters';
import { FilterSelect } from '@/components/table/FilterSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MechanicFormDialog } from '@/components/mechanics/MechanicFormDialog';
import { DeleteMechanicDialog } from '@/components/mechanics/DeleteMechanicDialog';
import {
  fetchMechanics,
  createMechanic,
  updateMechanic,
  deleteMechanic,
  Mechanic,
} from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Phone,
  MapPin,
  Star,
  Plus,
  Pencil,
  Trash2,
  Wrench,
  Settings,
} from 'lucide-react';

const verifiedOptions = [
  { value: 'all', label: 'All Mechanics' },
  { value: 'verified', label: 'Verified Only' },
];

export default function MechanicsManagement() {
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('all');
  const [page, setPage] = useState(1);
  
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mechanics-management', { search, verified, page }],
    queryFn: () => fetchMechanics({ search, verifiedOnly: verified === 'verified', page, pageSize: 10 }),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createMechanic,
    onSuccess: () => {
      toast.success('Mechanic added successfully');
      // Invalidate all mechanic-related queries to update all pages
      queryClient.invalidateQueries({ queryKey: ['mechanics-management'] });
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setFormDialogOpen(false);
      setSelectedMechanic(null);
    },
    onError: () => toast.error('Failed to add mechanic'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMechanic(id, data),
    onSuccess: () => {
      toast.success('Mechanic updated successfully');
      // Invalidate all mechanic-related queries to update all pages
      queryClient.invalidateQueries({ queryKey: ['mechanics-management'] });
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setFormDialogOpen(false);
      setSelectedMechanic(null);
    },
    onError: () => toast.error('Failed to update mechanic'),
  });

  // Toggle verification using updateMechanic
  const toggleVerificationMutation = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      updateMechanic(id, { is_verified: verified }),
    onSuccess: (_, variables) => {
      toast.success(variables.verified ? 'Mechanic verified' : 'Verification removed');
      // Invalidate all mechanic-related queries to update all pages
      queryClient.invalidateQueries({ queryKey: ['mechanics-management'] });
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Failed to update verification status'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMechanic,
    onSuccess: () => {
      toast.success('Mechanic deleted');
      // Invalidate all mechanic-related queries to update all pages
      queryClient.invalidateQueries({ queryKey: ['mechanics-management'] });
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteDialogOpen(false);
      setSelectedMechanic(null);
    },
    onError: () => toast.error('Failed to delete mechanic'),
  });

  const handleAddNew = () => {
    setSelectedMechanic(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (mechanic: Mechanic) => {
    setSelectedMechanic(mechanic);
    setFormDialogOpen(true);
  };

  const handleDelete = (mechanic: Mechanic) => {
    setSelectedMechanic(mechanic);
    setDeleteDialogOpen(true);
  };

  const handleToggleVerified = (mechanic: Mechanic) => {
    toggleVerificationMutation.mutate({
      id: mechanic.id,
      verified: !mechanic.verified,
    });
  };

  const handleFormSubmit = (formData: any) => {
    if (selectedMechanic) {
      // Edit mode — only send changed fields to PATCH /mechanics/{id}
      const updates: any = {};
      if (formData.name !== selectedMechanic.name) updates.name = formData.name;
      if (formData.phone !== selectedMechanic.phone) updates.phone = formData.phone;
      if ((formData.location || '') !== selectedMechanic.location) updates.location = formData.location || '';
      if ((formData.is_verified ?? false) !== selectedMechanic.verified) updates.is_verified = formData.is_verified ?? false;

      updateMutation.mutate({ id: selectedMechanic.id, data: updates });
    } else {
      // Create mode — POST to /auth/register
      createMutation.mutate({
        full_name: formData.full_name,
        phone: formData.phone,
        location: formData.location || '',
        specialty: formData.specialty || 'General Repair',
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedMechanic) deleteMutation.mutate(selectedMechanic.id);
  };

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
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.verified}
            onCheckedChange={() => handleToggleVerified(row.original)}
            disabled={toggleVerificationMutation.isPending}
          />
          {row.original.verified ? (
            <Badge variant="success">Yes</Badge>
          ) : (
            <Badge variant="secondary">No</Badge>
          )}
        </div>
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
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
            className="h-8 w-8"
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original)}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const displayData = data?.data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
              <Settings className="text-primary" />
              Mechanics Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Add, edit, and manage your mechanics fleet
            </p>
          </div>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus size={18} />
            Add New Mechanic
          </Button>
        </div>

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

        <MechanicFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          mechanic={selectedMechanic}
          onSubmit={handleFormSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />

        <DeleteMechanicDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          mechanicName={selectedMechanic?.name || ''}
          onConfirm={handleDeleteConfirm}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}