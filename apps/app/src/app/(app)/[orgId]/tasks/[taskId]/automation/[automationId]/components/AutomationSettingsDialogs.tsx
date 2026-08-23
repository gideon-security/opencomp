'use client';

import { Button } from '@gideon-defender/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gideon-defender/ui/dialog';
import { Input } from '@gideon-defender/ui/input';
import { Label } from '@gideon-defender/ui/label';
import { Textarea } from '@gideon-defender/ui/textarea';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTaskAutomation } from '../hooks/use-task-automation';

interface EditNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface EditDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditNameDialog({ open, onOpenChange, onSuccess }: EditNameDialogProps) {
  const t = useTranslations('tasks');
  const { automation, updateAutomation } = useTaskAutomation();

  const [name, setName] = useState(automation?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when automation data changes
  useEffect(() => {
    setName(automation?.name || '');
  }, [automation?.name]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('settingsDialogs.nameRequiredToast'));
      return;
    }

    setIsSaving(true);
    try {
      await updateAutomation({ name: name.trim() });
      await onSuccess?.();
      onOpenChange(false);
      toast.success(t('settingsDialogs.nameUpdatedToast'));
    } catch {
      toast.error(t('settingsDialogs.nameUpdateFailedToast'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settingsDialogs.editNameTitle')}</DialogTitle>
          <DialogDescription>{t('settingsDialogs.editNameDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="automation-name">{t('settingsDialogs.nameLabel')}</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settingsDialogs.namePlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settingsDialogs.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? t('settingsDialogs.saving') : t('settingsDialogs.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditDescriptionDialog({
  open,
  onOpenChange,
  onSuccess,
}: EditDescriptionDialogProps) {
  const t = useTranslations('tasks');
  const { automation, updateAutomation } = useTaskAutomation();
  const [description, setDescription] = useState(automation?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when automation data changes
  useEffect(() => {
    setDescription(automation?.description || '');
  }, [automation?.description]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAutomation({ description: description.trim() });
      await onSuccess?.();
      onOpenChange(false);
      toast.success(t('settingsDialogs.descriptionUpdatedToast'));
    } catch {
      toast.error(t('settingsDialogs.descriptionUpdateFailedToast'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settingsDialogs.editDescriptionTitle')}</DialogTitle>
          <DialogDescription>
            {t('settingsDialogs.editDescriptionDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="automation-description">{t('settingsDialogs.descriptionLabel')}</Label>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('settingsDialogs.descriptionPlaceholder')}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settingsDialogs.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('settingsDialogs.saving') : t('settingsDialogs.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAutomationDialog({ open, onOpenChange, onSuccess }: DeleteDialogProps) {
  const t = useTranslations('tasks');
  const { automation, deleteAutomation } = useTaskAutomation();
  const { orgId, taskId } = useParams<{
    orgId: string;
    taskId: string;
    automationId: string;
  }>();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAutomation();
      onOpenChange(false);
      toast.success(t('settingsDialogs.deletedToast'));

      // Redirect back to task page after successful deletion
      window.location.href = `/${orgId}/tasks/${taskId}`;
    } catch {
      toast.error(t('settingsDialogs.deleteFailedToast'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settingsDialogs.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('settingsDialogs.deleteDescription', { name: automation?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settingsDialogs.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? t('settingsDialogs.deleting') : t('settingsDialogs.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
