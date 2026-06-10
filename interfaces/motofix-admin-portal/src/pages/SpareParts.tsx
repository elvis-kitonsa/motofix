import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  fetchPartsCatalog, upsertPartsCatalog, deletePartsCatalog,
  PartsCatalogEntry, CatalogPart,
} from '@/lib/api';
import { formatUGX } from '@/config/api';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Pencil, Sparkles, Wrench, Loader2 } from 'lucide-react';

/* The diagnosis engine's parts-relevant fault categories. The AI suggests parts
   and fees for these; an admin entry here overrides what drivers are shown. */
const FAULT_CATEGORIES: { key: string; label: string }[] = [
  { key: 'tyre_puncture',     label: 'Tyre Puncture / Burst' },
  { key: 'battery_dead',      label: 'Dead Battery' },
  { key: 'brake_failure',     label: 'Brake Problem' },
  { key: 'electrical_fault',  label: 'Electrical Fault' },
  { key: 'overheating',       label: 'Overheating / Cooling System' },
  { key: 'fuel_issue',        label: 'Fuel System Issue' },
  { key: 'suspension_damage', label: 'Suspension Damage' },
  { key: 'engine_failure',    label: 'Engine Failure' },
  { key: 'transmission_fault',label: 'Transmission Fault' },
];

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

export default function SpareParts() {
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Package className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Spare Parts Catalog</h1>
            <p className="text-sm text-muted-foreground">
              Set the parts, price ranges, and typical service fees drivers see for each fault type.
              An entry here overrides the AI's suggestion.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={18} /> Loading catalog…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FAULT_CATEGORIES.map(({ key, label }) => {
              const entry = byCategory.get(key);
              const custom = !!entry;
              const feeText = entry && entry.service_fee_min != null && entry.service_fee_max != null
                ? `${formatUGX(entry.service_fee_min)}–${formatUGX(entry.service_fee_max)}`
                : null;
              return (
                <div key={key} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench size={15} className="text-muted-foreground flex-shrink-0" />
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
      </div>

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
    </DashboardLayout>
  );
}
