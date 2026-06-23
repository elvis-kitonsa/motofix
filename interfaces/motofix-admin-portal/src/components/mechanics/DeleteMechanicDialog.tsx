// DeleteMechanicDialog.tsx — the confirmation popup before removing a mechanic. Requires
// a reason and asks the admin to confirm, so deletions are deliberate and recorded.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface DeleteMechanicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanicName: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteMechanicDialog({
  open,
  onOpenChange,
  mechanicName,
  reason,
  onReasonChange,
  onConfirm,
  isLoading,
}: DeleteMechanicDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Provider Account</DialogTitle>
          <DialogDescription>
            You are about to permanently delete <strong>{mechanicName}</strong>'s account. This cannot be undone.
            Their application record will also be updated to reflect this deletion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
            Reason for deletion <span className="text-destructive">*</span>
          </label>
          <Textarea
            placeholder="e.g. Provider requested account removal, repeated violations, inactive account…"
            value={reason}
            onChange={e => onReasonChange(e.target.value)}
            rows={4}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            This reason will be recorded in the activity log and the provider will be notified if they re-check their application status.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
