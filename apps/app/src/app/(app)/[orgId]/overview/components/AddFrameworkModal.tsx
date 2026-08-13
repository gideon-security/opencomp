'use client';

import { FrameworkCard } from '@/components/framework-card';
import { Alert, Button, Spinner } from '@trycompai/design-system';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gideon-defender/ui/dialog';
import type { FrameworkEditorFramework } from '@db';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFrameworks } from '@/hooks/use-frameworks';
import { usePermissions } from '@/hooks/use-permissions';

type Props = {
  onOpenChange: (isOpen: boolean) => void;
  availableFrameworks: Pick<
    FrameworkEditorFramework,
    'id' | 'name' | 'description' | 'version' | 'visible'
  >[];
  organizationId?: string;
};

export function AddFrameworkModal({
  onOpenChange,
  availableFrameworks,
}: Props) {
  const { addFrameworks } = useFrameworks();
  const t = useTranslations('overview');
  const { hasPermission } = usePermissions();
  const canAddFramework = hasPermission('framework', 'create');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showContactMessage, setShowContactMessage] = useState(false);

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    if (!canAddFramework) {
      setShowContactMessage(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addFrameworks(selectedIds);
      const count = result?.frameworksAdded ?? 0;
      toast.success(t('frameworks.addedSuccess', { count }));
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('frameworks.addFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting && !open) return;
    onOpenChange(open);
  };

  const toggleFramework = (id: string, checked: boolean) => {
    setShowContactMessage(false);
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((fid) => fid !== id),
    );
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader className="space-y-2">
        <DialogTitle className="text-base font-medium">
          {t('frameworks.addTitle')}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          {availableFrameworks.length > 0
            ? t('frameworks.addDescription')
            : t('frameworks.noNewAvailable')}
        </DialogDescription>
      </DialogHeader>

      {!isSubmitting && availableFrameworks.length > 0 && (
        <div className="space-y-4">
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {availableFrameworks
              .filter((framework) => framework.visible)
              .map((framework) => (
                <FrameworkCard
                  key={framework.id}
                  framework={framework}
                  isSelected={selectedIds.includes(framework.id)}
                  onSelectionChange={(checked) =>
                    toggleFramework(framework.id, checked)
                  }
                />
              ))}
          </div>

          {showContactMessage && (
            <Alert
              variant="info"
              title={t('frameworks.contactManagerTitle')}
              description={t('frameworks.contactManagerDescription')}
            />
          )}

          <DialogFooter className="gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting || selectedIds.length === 0}
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              {t('frameworks.addSelected')}
            </Button>
          </DialogFooter>
        </div>
      )}

      {!isSubmitting && availableFrameworks.length === 0 && (
        <div className="py-6 text-center">
          <div className="text-muted-foreground text-sm">
            {t('frameworks.allEnabled')}
          </div>
          <DialogFooter className="mt-6 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.close')}
            </Button>
          </DialogFooter>
        </div>
      )}

      {isSubmitting && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="text-muted-foreground ml-3 text-sm">
            {t('frameworks.adding')}
          </span>
        </div>
      )}
    </DialogContent>
  );
}
