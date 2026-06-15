import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MechanicFormDialog } from '@/components/mechanics/MechanicFormDialog';
import { DeleteMechanicDialog } from '@/components/mechanics/DeleteMechanicDialog';
import {
  fetchMechanics, updateMechanic, deleteMechanic, Mechanic,
  fetchTowingProviders, updateTowingProvider, deleteTowingProvider, TowingProvider,
  banProvider, unbanProvider, resetProviderCredentials, ResetCredsResult,
  createProvider, CreateProviderResult,
  reinstateMechanic, fetchMechanicStrikes,
} from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Phone, MapPin, Star, Pencil, Trash2, Wrench, Truck, BadgeCheck, Search, X, Ban, CheckCircle, KeyRound, Copy, UserPlus, ClipboardList } from 'lucide-react';

// ── Unified row type ─────────────────────────────────────────────
interface ProviderRow {
  id: string;
  type: 'mechanic' | 'towing';
  name: string;
  phone: string;
  location: string;
  verified: boolean;
  joinedAt: string;
  isBanned: boolean;
  banReason: string | null;
  rating?: number;
  jobsCompleted?: number;
  spn?: string;
  available?: boolean;
  _raw: Mechanic | TowingProvider;
}

function toRow(m: Mechanic): ProviderRow {
  return { id: m.id, type: 'mechanic', name: m.name, phone: m.phone, location: m.location, verified: m.verified, joinedAt: m.joinedAt, isBanned: m.isBanned, banReason: m.banReason, rating: m.rating, jobsCompleted: m.jobsCompleted, _raw: m };
}
function toTowingRow(t: TowingProvider): ProviderRow {
  return { id: t.id, type: 'towing', name: t.name, phone: t.phone, location: t.location, verified: t.verified, joinedAt: t.joinedAt, isBanned: t.isBanned, banReason: t.banReason, spn: t.spn, available: t.available, _raw: t };
}

export default function Providers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetResult, setResetResult] = useState<ResetCredsResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addResult, setAddResult] = useState<CreateProviderResult | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<'mechanic' | 'towing_provider'>('mechanic');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [selected, setSelected] = useState<ProviderRow | null>(null);
  const qc = useQueryClient();

  const { data: mechanics = [], isLoading: loadingM } = useQuery({
    queryKey: ['mechanics', { search: '', verified: 'all', page: 1 }],
    queryFn: () => fetchMechanics({ search: '', verifiedOnly: false, page: 1, pageSize: 200 }),
    select: r => r.data.map(toRow),
    retry: false,
  });

  const { data: towing = [], isLoading: loadingT } = useQuery({
    queryKey: ['towing-providers', { search: '', verified: 'all', page: 1 }],
    queryFn: () => fetchTowingProviders({ search: '', verifiedOnly: false, page: 1, pageSize: 200 }),
    select: r => r.data.map(toTowingRow),
    retry: false,
  });

  const isLoading = loadingM || loadingT;

  const allProviders: ProviderRow[] = [...mechanics, ...towing];

  const displayData = allProviders.filter(p => {
    if (typeFilter === 'mechanic' && p.type !== 'mechanic') return false;
    if (typeFilter === 'towing' && p.type !== 'towing') return false;
    if (verifiedFilter === 'verified' && !p.verified) return false;
    if (verifiedFilter === 'unverified' && p.verified) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.phone.includes(q)) return false;
    }
    return true;
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['mechanics'] });
    qc.invalidateQueries({ queryKey: ['towing-providers'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const updateMechanicMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMechanic(id, data),
    onSuccess: () => { toast.success('Mechanic updated'); invalidateAll(); setEditOpen(false); setSelected(null); },
    onError: () => toast.error('Failed to update mechanic'),
  });

  const toggleMechanicMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => updateMechanic(id, { is_verified: v }),
    onSuccess: (_, { v }) => { toast.success(v ? 'Mechanic verified' : 'Verification removed'); invalidateAll(); },
    onError: () => toast.error('Failed to update verification'),
  });

  const deleteMechanicMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => deleteMechanic(id, reason),
    onSuccess: () => { toast.success('Mechanic deleted'); invalidateAll(); setDeleteOpen(false); setSelected(null); setDeleteReason(''); },
    onError: () => toast.error('Failed to delete mechanic'),
  });

  const toggleTowingMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => updateTowingProvider(id, { is_verified: v }),
    onSuccess: (_, { v }) => { toast.success(v ? 'Provider verified' : 'Verification removed'); invalidateAll(); },
    onError: () => toast.error('Failed to update verification'),
  });

  const deleteTowingMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => deleteTowingProvider(id, reason),
    onSuccess: () => { toast.success('Provider deleted'); invalidateAll(); setDeleteOpen(false); setSelected(null); setDeleteReason(''); },
    onError: () => toast.error('Failed to delete provider'),
  });

  const banMut = useMutation({
    mutationFn: () => banProvider(selected!.id, selected!.type === 'mechanic' ? 'mechanic' : 'towing_provider', banReason),
    onSuccess: () => { toast.success('Provider banned and notified via SMS.'); invalidateAll(); setBanOpen(false); setBanReason(''); setSelected(null); },
    onError: () => toast.error('Failed to ban provider'),
  });

  const unbanMut = useMutation({
    mutationFn: (row: ProviderRow) => unbanProvider(row.id, row.type === 'mechanic' ? 'mechanic' : 'towing_provider'),
    onSuccess: () => { toast.success('Ban lifted. Provider notified via SMS.'); invalidateAll(); },
    onError: () => toast.error('Failed to lift ban'),
  });

  const resetCredsMut = useMutation({
    mutationFn: () => resetProviderCredentials(selected!.id, selected!.type === 'mechanic' ? 'mechanic' : 'towing_provider'),
    onSuccess: (result) => { setResetResult(result); invalidateAll(); },
    onError: () => toast.error('Failed to reset credentials'),
  });

  const createProviderMut = useMutation({
    mutationFn: () => createProvider({ full_name: newName.trim(), phone: newPhone.trim(), location: newLocation.trim(), provider_type: newType, specialty: newSpecialty.trim() || undefined }),
    onSuccess: (result) => { setAddResult(result); invalidateAll(); },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create provider'),
  });

  const handleAddProvider = () => {
    if (!newName.trim()) return toast.error('Full name is required.');
    if (!newPhone.trim()) return toast.error('Phone number is required.');
    if (!newLocation.trim()) return toast.error('Location is required.');
    createProviderMut.mutate();
  };

  const handleEditSubmit = (formData: any) => {
    if (!selected || selected.type !== 'mechanic') return;
    const m = selected._raw as Mechanic;
    const updates: any = {};
    if (formData.name !== m.name) updates.name = formData.name;
    if (formData.phone !== m.phone) updates.phone = formData.phone;
    if ((formData.location || '') !== m.location) updates.location = formData.location || '';
    if ((formData.is_verified ?? false) !== m.verified) updates.is_verified = formData.is_verified ?? false;
    updateMechanicMut.mutate({ id: m.id, data: updates });
  };

  const handleDelete = () => {
    if (!selected || !deleteReason.trim()) return;
    if (selected.type === 'mechanic') deleteMechanicMut.mutate({ id: selected.id, reason: deleteReason });
    else deleteTowingMut.mutate({ id: selected.id, reason: deleteReason });
  };

  const toggleVerified = (row: ProviderRow) => {
    if (row.type === 'mechanic') toggleMechanicMut.mutate({ id: row.id, v: !row.verified });
    else toggleTowingMut.mutate({ id: row.id, v: !row.verified });
  };

  const columns: ColumnDef<ProviderRow>[] = [
    {
      accessorKey: 'name',
      header: 'Provider',
      cell: ({ row }) => {
        const initials = row.original.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">{initials}</span>
            </div>
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone size={10} /> {row.original.phone}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Service Type',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.type === 'mechanic'
            ? <><Wrench size={14} className="text-amber-400" /><span className="text-sm">Mechanic</span></>
            : <><Truck  size={14} className="text-blue-400"  /><span className="text-sm">Towing Provider</span></>}
        </div>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-muted-foreground" />
          <span className="text-sm">{row.original.location || '—'}</span>
        </div>
      ),
    },
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => {
        if (row.original.type === 'mechanic') {
          return (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                {row.original.rating?.toFixed(1) ?? '—'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{row.original.jobsCompleted ?? 0} jobs</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-sm">
            {row.original.spn
              ? <span className="font-mono text-primary">{row.original.spn}</span>
              : <span className="text-muted-foreground">No SPN</span>}
            <Badge variant={row.original.available ? 'success' : 'secondary'} className="text-xs">
              {row.original.available ? 'Online' : 'Offline'}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'verified',
      header: 'Status',
      cell: ({ row }) => {
        if (row.original.isBanned) {
          return <Badge variant="destructive" className="gap-1"><Ban size={11} /> Banned</Badge>;
        }
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.verified}
              onCheckedChange={() => toggleVerified(row.original)}
              disabled={toggleMechanicMut.isPending || toggleTowingMut.isPending}
            />
            <Badge variant={row.original.verified ? 'success' : 'secondary'}>
              {row.original.verified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'joinedAt',
      header: 'Joined',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{format(new Date(row.original.joinedAt), 'MMM d, yyyy')}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.type === 'mechanic' && !row.original.isBanned && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(row.original); setEditOpen(true); }}>
              <Pencil size={14} />
            </Button>
          )}
          {row.original.verified && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
              title="Reset login credentials"
              onClick={() => { setSelected(row.original); setResetResult(null); setResetOpen(true); }}
            >
              <KeyRound size={14} />
            </Button>
          )}
          {row.original.isBanned ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-green-500 hover:text-green-500 hover:bg-green-500/10"
              onClick={() => unbanMut.mutate(row.original)} disabled={unbanMut.isPending}>
              <CheckCircle size={13} /> Unban
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setSelected(row.original); setBanReason(''); setBanOpen(true); }}>
              <Ban size={14} />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => { setSelected(row.original); setDeleteReason(''); setDeleteOpen(true); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <BadgeCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold">Service Providers</h1>
            <p className="text-sm text-foreground/70 mt-1">All mechanics and towing providers currently registered on the platform.</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => navigate('/activity-log')}
          >
            <ClipboardList size={16} /> Activity Log
          </Button>
          <Button
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0"
            onClick={() => { setAddResult(null); setNewName(''); setNewPhone(''); setNewLocation(''); setNewType('mechanic'); setNewSpecialty(''); setAddOpen(true); }}
          >
            <UserPlus size={16} /> Add Provider
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
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

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[185px] text-sm bg-background" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
              <SelectValue placeholder="Service type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="mechanic">
                <span className="flex items-center gap-2"><Wrench size={13} className="text-amber-400" /> Mechanics</span>
              </SelectItem>
              <SelectItem value="towing">
                <span className="flex items-center gap-2"><Truck size={13} className="text-blue-400" /> Towing Providers</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
            <SelectTrigger className="w-[165px] text-sm bg-background" style={{ border: '1.5px solid rgba(0,0,0,0.75)' }}>
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="verified">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Verified Only</span>
              </SelectItem>
              <SelectItem value="unverified">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Unverified Only</span>
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

      {/* Add Provider dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setAddResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={16} className="text-amber-500" /> Add Service Provider
            </DialogTitle>
          </DialogHeader>

          {addResult ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-green-600 font-medium">Provider created and verified successfully.</p>
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">SPN</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{addResult.spn}</span>
                    <button onClick={() => { navigator.clipboard.writeText(addResult.spn); toast.success('SPN copied'); }} className="text-muted-foreground hover:text-foreground"><Copy size={13} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Temp Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{addResult.temp_password}</span>
                    <button onClick={() => { navigator.clipboard.writeText(addResult.temp_password); toast.success('Password copied'); }} className="text-muted-foreground hover:text-foreground"><Copy size={13} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Name</span>
                  <span className="text-sm font-medium">{addResult.name}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Phone</span>
                  <span className="text-sm font-medium">{addResult.phone}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share these credentials with the provider. They will be prompted to change their password on first login.</p>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              {[
                { label: 'Full Name', value: newName, set: setNewName, placeholder: 'e.g. John Mukasa', type: 'text' },
                { label: 'Phone Number', value: newPhone, set: setNewPhone, placeholder: 'e.g. +256700000000', type: 'tel' },
                { label: 'Location / Service Area', value: newLocation, set: setNewLocation, placeholder: 'e.g. Kampala, Nakawa', type: 'text' },
              ].map(({ label, value, set, placeholder, type }) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none"
                    style={{ border: '1.5px solid rgba(0,0,0,0.65)' }}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Provider Type</label>
                <div className="flex gap-2">
                  {(['mechanic', 'towing_provider'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewType(t)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        border: newType === t ? '1.5px solid var(--adm-amber)' : '1.5px solid rgba(0,0,0,0.65)',
                        background: newType === t ? 'rgba(255,179,0,0.10)' : 'transparent',
                        color: newType === t ? 'var(--adm-amber)' : 'var(--adm-text)',
                      }}
                    >
                      {t === 'mechanic' ? <><Wrench size={13} /> Mechanic</> : <><Truck size={13} /> Towing</>}
                    </button>
                  ))}
                </div>
              </div>
              {newType === 'mechanic' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Specialty <span className="normal-case font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={newSpecialty}
                    onChange={e => setNewSpecialty(e.target.value)}
                    placeholder="e.g. Engine Repairs, Electrical"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none"
                    style={{ border: '1.5px solid rgba(0,0,0,0.65)' }}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {addResult ? (
              <Button onClick={() => { setAddOpen(false); setAddResult(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                  disabled={createProviderMut.isPending}
                  onClick={handleAddProvider}
                >
                  {createProviderMut.isPending ? 'Creating…' : 'Create Provider'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected?.type === 'mechanic' && (
        <MechanicFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mechanic={selected._raw as Mechanic}
          onSubmit={handleEditSubmit}
          isLoading={updateMechanicMut.isPending}
        />
      )}

      <DeleteMechanicDialog
        open={deleteOpen}
        onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteReason(''); }}
        mechanicName={selected?.name || ''}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        onConfirm={handleDelete}
        isLoading={deleteMechanicMut.isPending || deleteTowingMut.isPending}
      />

      {/* Reset credentials dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) setResetResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={16} className="text-amber-500" />
              Reset Login Credentials
            </DialogTitle>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-green-600 font-medium">Credentials reset successfully. An SMS was sent to {resetResult.phone}.</p>
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">SPN</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{resetResult.spn}</span>
                    <button onClick={() => { navigator.clipboard.writeText(resetResult.spn); toast.success('SPN copied'); }} className="text-muted-foreground hover:text-foreground">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Temp Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{resetResult.temp_password}</span>
                    <button onClick={() => { navigator.clipboard.writeText(resetResult.temp_password); toast.success('Password copied'); }} className="text-muted-foreground hover:text-foreground">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share these credentials with the provider. They will be prompted to change their password on first login.</p>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                This will generate a new temporary password for{' '}
                <span className="font-medium text-foreground">{selected?.name}</span>{' '}
                and send it to <span className="font-medium text-foreground">{selected?.phone}</span> via SMS.
              </p>
              <p className="text-xs text-amber-600 font-medium">Their current password will be invalidated immediately.</p>
            </div>
          )}

          <DialogFooter>
            {resetResult ? (
              <Button onClick={() => { setResetOpen(false); setResetResult(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                  disabled={resetCredsMut.isPending}
                  onClick={() => resetCredsMut.mutate()}
                >
                  {resetCredsMut.isPending ? 'Resetting…' : 'Reset & Send SMS'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Provide a clear reason for the ban. The provider will receive an SMS on{' '}
              <span className="font-medium text-foreground">{selected?.phone}</span> explaining why
              they were banned and how to contact MOTOFIX for clarification.
            </p>
            <Textarea
              placeholder="e.g. Repeated complaints from customers, fraudulent activity…"
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!banReason.trim() || banMut.isPending}
              onClick={() => banMut.mutate()}
            >
              {banMut.isPending ? 'Banning…' : 'Confirm Ban & Send SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
