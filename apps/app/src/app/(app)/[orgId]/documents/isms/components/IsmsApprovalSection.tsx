'use client';

import { formatDateShort } from '@/lib/format';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  ApprovalBanner,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trycompai/design-system';
import { Time } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { IsmsDocument } from '../isms-types';

export interface ApproverOption {
  id: string;
  name: string;
}

interface IsmsApprovalSectionProps {
  document: IsmsDocument;
  canManage: boolean;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
  /**
   * When set, "Submit for approval" is disabled and this reason is shown — used
   * by documents with generate-time validation (e.g. Roles, clause 5.3).
   */
  submitBlockedReason?: string | null;
  onSubmitForApproval: (approverId: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onDecline: () => Promise<void>;
}

/** Format an ISO timestamp as a short human date, or null when unparseable. */
function formatDate(value: string | null): string | null {
  return formatDateShort(value) || null;
}

export function IsmsApprovalSection({
  document,
  canManage,
  currentMemberId,
  approverOptions,
  submitBlockedReason,
  onSubmitForApproval,
  onApprove,
  onDecline,
}: IsmsApprovalSectionProps) {
  const t = useTranslations('isms');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status } = document;
  const isPending = status === 'needs_review';
  const isApproved = status === 'approved';
  const isDeclined = status === 'declined';
  const isResolved = isApproved || isDeclined;
  const canCurrentUserApprove =
    isPending && !!document.approverId && document.approverId === currentMemberId;
  const approverName =
    approverOptions.find((option) => option.id === document.approverId)?.name ??
    t('approval.defaultApprover');
  const approvedDate = formatDate(document.approvedAt);
  const declinedDate = formatDate(document.declinedAt);

  // Versioning context (CS-701): a published version can stay live while the
  // draft is edited. `hasDraftChanges` = a published version exists but the
  // working draft is no longer approved (edits in progress).
  const publishedVersion = document.currentVersion?.version ?? null;
  const hasPublishedVersion = publishedVersion != null;
  const nextDraftVersion = (publishedVersion ?? 0) + 1;
  const hasDraftChanges =
    hasPublishedVersion && (isDeclined || (!isApproved && !isPending));

  // The plain submit button is only offered on un-submitted drafts. Pending and
  // resolved (approved / declined) documents render their own state instead.
  const showSubmitButton = canManage && !isPending && !isResolved;
  // A declined document can be re-submitted, but via an explicit action that
  // sits inside the declined state — never the bare "Submit for approval".
  const showResubmitButton = canManage && isDeclined;

  const handleSubmit = async () => {
    if (!selectedApproverId) return;
    setIsSubmitting(true);
    try {
      await onSubmitForApproval(selectedApproverId);
      setIsDialogOpen(false);
      setSelectedApproverId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isApproved && (
        <Alert variant="success">
          <AlertTitle>
            {publishedVersion
              ? t('approval.approvedPublishedTitle', { version: publishedVersion })
              : t('approval.approvedTitle')}
          </AlertTitle>
          <AlertDescription>
            {approvedDate
              ? t('approval.approvedByDated', { approver: approverName, date: approvedDate })
              : t('approval.approvedBy', { approver: approverName })}
          </AlertDescription>
        </Alert>
      )}

      {hasDraftChanges && (
        <Alert>
          <AlertTitle>{t('approval.draftChangesTitle')}</AlertTitle>
          <AlertDescription>
            {t('approval.draftChangesDescription', {
              version: publishedVersion ?? 0,
              nextVersion: nextDraftVersion,
            })}
          </AlertDescription>
        </Alert>
      )}

      {isDeclined && (
        <Alert variant="destructive">
          <AlertTitle>{t('approval.declinedTitle')}</AlertTitle>
          <AlertDescription>
            {declinedDate
              ? t('approval.declinedByDated', { approver: approverName, date: declinedDate })
              : t('approval.declinedBy', { approver: approverName })}
            {showResubmitButton ? ` ${t('approval.resubmitHint')}` : ''}
          </AlertDescription>
        </Alert>
      )}

      {canCurrentUserApprove && (
        <ApprovalBanner
          variant="warning"
          title={t('approval.actionRequiredTitle')}
          description={t('approval.actionRequiredDescription')}
          approveText={t('approval.approve')}
          rejectText={t('approval.decline')}
          onApprove={onApprove}
          onReject={onDecline}
        />
      )}

      {isPending && !canCurrentUserApprove && (
        <Alert variant="warning" icon={<Time />}>
          <AlertTitle>{t('approval.pendingTitle')}</AlertTitle>
          <AlertDescription>
            {t('approval.pendingApprover', { approver: approverName })}
          </AlertDescription>
        </Alert>
      )}

      {(showSubmitButton || showResubmitButton) && (
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsDialogOpen(true)}
            disabled={!!submitBlockedReason}
          >
            {showResubmitButton
              ? t('approval.resubmitForApproval')
              : t('approval.submitForApproval')}
          </Button>
          {submitBlockedReason ? (
            <p className="text-sm text-muted-foreground">{submitBlockedReason}</p>
          ) : null}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('approval.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('approval.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <Select
            value={selectedApproverId ?? undefined}
            onValueChange={(value) => setSelectedApproverId(value)}
          >
            <SelectTrigger aria-label={t('approval.approverAria')}>
              <SelectValue placeholder={t('approval.approverPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {approverOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('approval.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedApproverId}
              loading={isSubmitting}
            >
              {isSubmitting ? t('approval.submitting') : t('approval.confirmSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
