import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Mechanic } from '@/lib/api';

// ── Create schema — matches POST /auth/register exactly ──────────────────────
const createSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().regex(/^(\+256|0)[0-9]{9}$/, 'Valid Uganda phone required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  location: z.string().trim().max(100).optional().or(z.literal('')),
  specialty: z.string().optional(),
});

// ── Edit schema — matches PATCH /mechanics/{id} ───────────────────────────────
const editSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().regex(/^(\+256|0)[0-9]{9}$/, 'Valid Uganda phone required'),
  location: z.string().trim().max(100).optional().or(z.literal('')),
  is_verified: z.boolean().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

const SPECIALTY_OPTIONS = [
  'General Repair',
  'Engine Specialist',
  'Electrical',
  'Tires & Brakes',
  'Body Work',
];

interface MechanicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanic?: Mechanic | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export function MechanicFormDialog({
  open,
  onOpenChange,
  mechanic,
  onSubmit,
  isLoading,
}: MechanicFormDialogProps) {
  const isEditing = !!mechanic;

  // ── Create form ──────────────────────────────────────────────────────────
  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      location: '',
      specialty: 'General Repair',
    },
  });

  // ── Edit form ────────────────────────────────────────────────────────────
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: '',
      phone: '',
      location: '',
      is_verified: false,
    },
  });

  // Sync edit form when dialog opens
  useEffect(() => {
    if (open && mechanic) {
      editForm.reset({
        name: mechanic.name,
        phone: mechanic.phone,
        location: mechanic.location,
        is_verified: mechanic.verified,
      });
    } else if (open && !mechanic) {
      createForm.reset({
        full_name: '',
        phone: '',
        location: '',
        specialty: 'General Repair',
      });
    }
  }, [open, mechanic]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? 'Edit Mechanic' : 'Add New Mechanic'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the mechanic details below. Save when you are done.'
              : 'Fill in the details to register a new mechanic account.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          /* ── EDIT FORM ─────────────────────────────────────────────────── */
          <form
            onSubmit={editForm.handleSubmit((data: EditFormData) => onSubmit(data))}
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" placeholder="John Okello" {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input id="edit-phone" placeholder="+256701234567" {...editForm.register('phone')} />
              {editForm.formState.errors.phone && (
                <p className="text-xs text-destructive">{editForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" placeholder="Kampala Central" {...editForm.register('location')} />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_verified"
                aria-label="Verified Mechanic"
                checked={editForm.watch('is_verified') || false}
                onChange={(e) => editForm.setValue('is_verified', e.target.checked)}
                className="w-4 h-4 text-primary rounded border-gray-300"
              />
              <Label htmlFor="edit-is_verified" className="cursor-pointer">
                Verified Mechanic
              </Label>
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                ) : (
                  'Update Mechanic'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* ── CREATE FORM ───────────────────────────────────────────────── */
          <form
            onSubmit={createForm.handleSubmit((data: CreateFormData) => onSubmit(data))}
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" placeholder="John Okello" {...createForm.register('full_name')} />
              {createForm.formState.errors.full_name && (
                <p className="text-xs text-destructive">{createForm.formState.errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone Number</Label>
              <Input id="create-phone" placeholder="+256701234567" {...createForm.register('phone')} />
              {createForm.formState.errors.phone && (
                <p className="text-xs text-destructive">{createForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-location">Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="create-location" placeholder="Kampala Central" {...createForm.register('location')} />
            </div>

            <div className="space-y-2">
              <Label>Specialty <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select
                defaultValue="General Repair"
                onValueChange={(val) => createForm.setValue('specialty', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  'Add Mechanic'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
