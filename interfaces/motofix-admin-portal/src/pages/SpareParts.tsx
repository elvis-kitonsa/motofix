// SpareParts.tsx — where admins manage the spare-parts catalog: the parts, price ranges
// and service fees keyed to each fault category, which override the AI's estimates in the
// driver app. (Dealers themselves come from Google Places, not from here.)

import { useState, useMemo, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  fetchPartsCatalog, upsertPartsCatalog, deletePartsCatalog,
  PartsCatalogEntry, CatalogPart,
  fetchDealers, createDealer, updateDealer, deleteDealer, Dealer,
} from '@/lib/api';
import { formatUGX } from '@/config/api';
import { toast } from 'sonner';
import {
  Package, Plus, Trash2, Pencil, Sparkles, Wrench, Loader2,
  Store, MapPin, Phone, BadgeCheck, Search,
  CircleDot, BatteryCharging, Disc3, Zap, Thermometer, Fuel, Car, Cog, Settings2,
} from 'lucide-react';

/* The diagnosis engine's parts-relevant fault categories. The AI suggests parts
   and fees for these; an admin entry here overrides what drivers are shown. */
const FAULT_CATEGORIES: { key: string; label: string; Icon: ElementType; color: string }[] = [
  { key: 'tyre_puncture',     label: 'Tyre Puncture / Burst',        Icon: CircleDot,       color: '#60A5FA' },
  { key: 'battery_dead',      label: 'Dead Battery',                 Icon: BatteryCharging, color: '#34D399' },
  { key: 'brake_failure',     label: 'Brake Problem',                Icon: Disc3,           color: '#F87171' },
  { key: 'electrical_fault',  label: 'Electrical Fault',             Icon: Zap,             color: '#FBBF24' },
  { key: 'overheating',       label: 'Overheating / Cooling System', Icon: Thermometer,     color: '#FB923C' },
  { key: 'fuel_issue',        label: 'Fuel System Issue',            Icon: Fuel,            color: '#38BDF8' },
  { key: 'suspension_damage', label: 'Suspension Damage',            Icon: Car,             color: '#A78BFA' },
  { key: 'engine_failure',    label: 'Engine Failure',               Icon: Cog,             color: '#F59E0B' },
  { key: 'transmission_fault',label: 'Transmission Fault',           Icon: Settings2,       color: '#22D3EE' },
];

// Coarse grouping for the dealer directory, derived from the dealer's specialty.
function dealerCategory(specialty: string): string {
  const s = (specialty || '').toLowerCase();
  if (/tyre|tire|batter|belt|wheel/.test(s))            return 'Tyres, Batteries & Belts';
  if (/engine|transmission|gearbox/.test(s))            return 'Engine & Transmission';
  if (/electric|light|accessor|electronic/.test(s))     return 'Electrical & Accessories';
  if (/body|suspension|steering|panel/.test(s))         return 'Body & Suspension';
  if (/filter|fluid|oil|service/.test(s))               return 'Filters & Fluids';
  if (/tool|equipment/.test(s))                         return 'Tools & Equipment';
  if (/genuine|oem/.test(s))                            return 'Genuine / OEM Parts';
  return 'General Spares';
}

interface EditorState {
  fault_category: string;
  label: string;
  parts: CatalogPart[];
  service_fee_min: string;
  service_fee_max: string;
  notes: string;
  exists: boolean;
}

const blankEditor = (fault_category: string, label: string): EditorState => ({
  fault_category, label, parts: [], service_fee_min: '', service_fee_max: '', notes: '', exists: false,
});

interface DealerEditor {
  id: number | null;
  name: string;
  phone: string;
  address: string;
  location: string;
  latitude: string;
  longitude: string;
  specialty: string;
  description: string;
  verified: boolean;
}

const blankDealer = (): DealerEditor => ({
  id: null, name: '', phone: '', address: '', location: '',
  latitude: '', longitude: '', specialty: '', description: '', verified: true,
});

export default function SpareParts() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Package className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Spare Parts</h1>
            <p className="text-sm text-muted-foreground">
              Manage the dealer directory drivers &amp; mechanics buy from, and the price
              catalog used for cost estimates.
            </p>
          </div>
        </div>

        <Tabs defaultValue="dealers">
          <TabsList>
            <TabsTrigger value="dealers" className="gap-1.5"><Store size={14} /> Dealer Directory</TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1.5"><Wrench size={14} /> Price Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="dealers" className="mt-5">
            <DealersTab />
          </TabsContent>

          <TabsContent value="catalog" className="mt-5">
            <CatalogTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ════════════════════════════ DEALER DIRECTORY ════════════════════════════ */

function DealersTab() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<DealerEditor | null>(null);
  const [search, setSearch] = useState('');

  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ['dealers'],
    queryFn: fetchDealers,
    retry: false,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(d =>
      [d.name, d.specialty, d.address, d.location].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [dealers, search]);

  const saveMut = useMutation({
    mutationFn: (e: DealerEditor) => {
      const payload = {
        name: e.name.trim(),
        phone: e.phone.trim(),
        address: e.address.trim(),
        location: e.location.trim(),
        specialty: e.specialty.trim(),
        description: e.description.trim(),
        verified: e.verified,
        latitude: e.latitude === '' ? null : Number(e.latitude),
        longitude: e.longitude === '' ? null : Number(e.longitude),
      };
      return e.id == null ? createDealer(payload) : updateDealer(e.id, payload);
    },
    onSuccess: () => {
      toast.success('Dealer saved');
      qc.invalidateQueries({ queryKey: ['dealers'] });
      setEditor(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to save dealer'),
  });

  const verifyMut = useMutation({
    mutationFn: ({ id, verified }: { id: number; verified: boolean }) => updateDealer(id, { verified }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
    onError: () => toast.error('Could not update verification'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteDealer(id),
    onSuccess: () => {
      toast.success('Dealer removed');
      qc.invalidateQueries({ queryKey: ['dealers'] });
      setEditor(null);
    },
    onError: () => toast.error('Failed to remove dealer'),
  });

  const openNew = () => setEditor(blankDealer());
  const openEdit = (d: Dealer) => setEditor({
    id: d.id,
    name: d.name, phone: d.phone, address: d.address, location: d.location,
    latitude: d.latitude != null ? String(d.latitude) : '',
    longitude: d.longitude != null ? String(d.longitude) : '',
    specialty: d.specialty, description: d.description, verified: d.verified,
  });
  const patch = (p: Partial<DealerEditor>) => setEditor(e => (e ? { ...e, ...p } : e));
  const canSave = !!editor && editor.name.trim() && editor.phone.trim();

  // Group the (filtered) dealers by their derived category for the directory.
  const grouped = useMemo(() => {
    const m = new Map<string, Dealer[]>();
    filtered.forEach(d => {
      const cat = dealerCategory(d.specialty);
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(d);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search dealers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button className="gap-1.5 ml-auto" onClick={openNew}>
          <Plus size={15} /> Add dealer
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading dealers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Store size={28} className="mx-auto mb-3 opacity-60" />
          {dealers.length === 0 ? 'No dealers yet — add your first spare-parts business.' : 'No dealers match your search.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-bold text-foreground">{cat}</h3>
                <span className="text-xs text-muted-foreground">· {list.length}</span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="space-y-2">
                {list.map(d => (
                  <div key={d.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Store size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{d.name}</span>
                        {d.verified ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 flex-shrink-0">
                            <BadgeCheck size={11} /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground flex-shrink-0">Unverified</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        {d.specialty && <span className="flex items-center gap-1.5"><Wrench size={12} className="flex-shrink-0" /> {d.specialty}</span>}
                        {(d.address || d.location) && <span className="flex items-center gap-1.5"><MapPin size={12} className="flex-shrink-0" /> {d.address || d.location}</span>}
                        {d.phone && <span className="flex items-center gap-1.5"><Phone size={12} className="flex-shrink-0" /> {d.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <label className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        Verified
                        <Switch
                          checked={d.verified}
                          onCheckedChange={(v) => verifyMut.mutate({ id: d.id, verified: v })}
                        />
                      </label>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(d)}>
                        <Pencil size={13} /> Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dealer editor dialog */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editor && (
            <>
              <DialogHeader>
                <DialogTitle>{editor.id == null ? 'Add dealer' : 'Edit dealer'}</DialogTitle>
                <DialogDescription>
                  These businesses appear to drivers and mechanics in the Spare Parts section.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label>Business name *</Label>
                  <Input value={editor.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Nakawa Motor Spares" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone *</Label>
                    <Input value={editor.phone} onChange={e => patch({ phone: e.target.value })} placeholder="+256 7…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Area / location</Label>
                    <Input value={editor.location} onChange={e => patch({ location: e.target.value })} placeholder="e.g. Nakawa" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={editor.address} onChange={e => patch({ address: e.target.value })} placeholder="e.g. Nakawa Motor Village, Kampala" />
                </div>
                <div className="space-y-1.5">
                  <Label>Specialty</Label>
                  <Input value={editor.specialty} onChange={e => patch({ specialty: e.target.value })} placeholder="e.g. Tyres, batteries & belts" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={editor.latitude} onChange={e => patch({ latitude: e.target.value })} placeholder="0.3289" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={editor.longitude} onChange={e => patch({ longitude: e.target.value })} placeholder="32.6186" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Coordinates let the dealer appear sorted by distance on the driver &amp; mechanic maps.
                </p>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={2} value={editor.description} onChange={e => patch({ description: e.target.value })} placeholder="Short note shown on the dealer card." />
                </div>
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 cursor-pointer">
                  <span className="text-sm font-medium">Verified dealer</span>
                  <Switch checked={editor.verified} onCheckedChange={(v) => patch({ verified: v })} />
                </label>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                {editor.id != null && (
                  <Button
                    variant="ghost" className="text-destructive mr-auto"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(editor.id!)}
                  >
                    {deleteMut.isPending ? <Loader2 className="animate-spin" size={15} /> : <><Trash2 size={14} className="mr-1.5" /> Remove</>}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                <Button disabled={!canSave || saveMut.isPending} onClick={() => editor && saveMut.mutate(editor)}>
                  {saveMut.isPending ? <Loader2 className="animate-spin mr-1.5" size={15} /> : null}
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ════════════════════════════ PRICE CATALOG ════════════════════════════ */

function CatalogTab() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['parts-catalog'],
    queryFn: fetchPartsCatalog,
    retry: false,
  });

  const byCategory = useMemo(() => {
    const m = new Map<string, PartsCatalogEntry>();
    entries.forEach(e => m.set(e.fault_category, e));
    return m;
  }, [entries]);

  const saveMut = useMutation({
    mutationFn: (e: EditorState) =>
      upsertPartsCatalog(e.fault_category, {
        label: e.label,
        parts: e.parts
          .filter(p => p.name.trim())
          .map(p => ({ name: p.name.trim(), price_min: Number(p.price_min) || 0, price_max: Number(p.price_max) || 0 })),
        service_fee_min: e.service_fee_min === '' ? null : Number(e.service_fee_min),
        service_fee_max: e.service_fee_max === '' ? null : Number(e.service_fee_max),
        notes: e.notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Catalog entry saved');
      qc.invalidateQueries({ queryKey: ['parts-catalog'] });
      setEditor(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to save entry'),
  });

  const deleteMut = useMutation({
    mutationFn: (faultCategory: string) => deletePartsCatalog(faultCategory),
    onSuccess: () => {
      toast.success('Reverted to AI defaults');
      qc.invalidateQueries({ queryKey: ['parts-catalog'] });
      setEditor(null);
    },
    onError: () => toast.error('Failed to remove entry'),
  });

  const openEditor = (fault_category: string, label: string) => {
    const existing = byCategory.get(fault_category);
    if (existing) {
      setEditor({
        fault_category,
        label: existing.label || label,
        parts: existing.parts.length ? existing.parts.map(p => ({ ...p })) : [],
        service_fee_min: existing.service_fee_min != null ? String(existing.service_fee_min) : '',
        service_fee_max: existing.service_fee_max != null ? String(existing.service_fee_max) : '',
        notes: existing.notes || '',
        exists: true,
      });
    } else {
      setEditor(blankEditor(fault_category, label));
    }
  };

  const updateEditor = (patch: Partial<EditorState>) => setEditor(e => (e ? { ...e, ...patch } : e));
  const updatePart = (i: number, patch: Partial<CatalogPart>) =>
    setEditor(e => e ? { ...e, parts: e.parts.map((p, idx) => idx === i ? { ...p, ...patch } : p) } : e);
  const addPart = () => setEditor(e => e ? { ...e, parts: [...e.parts, { name: '', price_min: 0, price_max: 0 }] } : e);
  const removePart = (i: number) => setEditor(e => e ? { ...e, parts: e.parts.filter((_, idx) => idx !== i) } : e);

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Set the parts, price ranges, and typical service fees drivers see for each fault type.
        An entry here overrides the AI's suggestion in the driver cost estimate.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading catalog…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FAULT_CATEGORIES.map(({ key, label, Icon, color }) => {
            const entry = byCategory.get(key);
            const custom = !!entry;
            const feeText = entry && entry.service_fee_min != null && entry.service_fee_max != null
              ? `${formatUGX(entry.service_fee_min)}–${formatUGX(entry.service_fee_max)}`
              : null;
            return (
              <div key={key} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1a` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <span className="font-semibold truncate">{entry?.label || label}</span>
                  </div>
                  {custom ? (
                    <Badge className="gap-1 bg-primary/15 text-primary border border-primary/25 flex-shrink-0">Custom</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground flex-shrink-0">
                      <Sparkles size={11} /> AI default
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-1 min-h-[34px]">
                  {custom ? (
                    <>
                      <div>{entry!.parts.length} part{entry!.parts.length === 1 ? '' : 's'} listed</div>
                      {feeText && <div>Service fee: {feeText}</div>}
                    </>
                  ) : (
                    <div className="italic">Drivers see AI-generated parts &amp; price estimates.</div>
                  )}
                </div>

                <Button size="sm" variant="outline" className="gap-1.5 mt-auto self-start" onClick={() => openEditor(key, label)}>
                  <Pencil size={13} /> {custom ? 'Edit' : 'Set override'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editor && (
            <>
              <DialogHeader>
                <DialogTitle>{editor.label}</DialogTitle>
                <DialogDescription>
                  Fault category: <span className="font-mono">{editor.fault_category}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label>Display label (shown to drivers)</Label>
                  <Input value={editor.label} onChange={e => updateEditor({ label: e.target.value })} placeholder="e.g. Tyre Puncture / Burst" />
                </div>

                {/* Parts list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Parts &amp; price ranges (UGX)</Label>
                    <Button type="button" size="sm" variant="ghost" className="gap-1 h-7 text-primary" onClick={addPart}>
                      <Plus size={13} /> Add part
                    </Button>
                  </div>
                  {editor.parts.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No parts added yet.</p>
                  )}
                  {editor.parts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-1" placeholder="Part name"
                        value={p.name} onChange={e => updatePart(i, { name: e.target.value })}
                      />
                      <Input
                        type="number" min={0} className="w-24" placeholder="Min"
                        value={p.price_min || ''} onChange={e => updatePart(i, { price_min: Number(e.target.value) || 0 })}
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="number" min={0} className="w-24" placeholder="Max"
                        value={p.price_max || ''} onChange={e => updatePart(i, { price_max: Number(e.target.value) || 0 })}
                      />
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => removePart(i)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Service fee */}
                <div className="space-y-1.5">
                  <Label>Typical service / fitting fee range (UGX)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0} placeholder="Low end"
                      value={editor.service_fee_min} onChange={e => updateEditor({ service_fee_min: e.target.value })}
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="number" min={0} placeholder="High end"
                      value={editor.service_fee_max} onChange={e => updateEditor({ service_fee_max: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes / advice (optional)</Label>
                  <Textarea
                    rows={2} placeholder="e.g. Bring the old part for size matching."
                    value={editor.notes} onChange={e => updateEditor({ notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                {editor.exists && (
                  <Button
                    variant="ghost" className="text-destructive mr-auto"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(editor.fault_category)}
                  >
                    {deleteMut.isPending ? <Loader2 className="animate-spin" size={15} /> : 'Revert to AI'}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate(editor)}>
                  {saveMut.isPending ? <Loader2 className="animate-spin mr-1.5" size={15} /> : null}
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
