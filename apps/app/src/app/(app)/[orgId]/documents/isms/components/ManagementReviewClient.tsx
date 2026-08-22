'use client';

import { Stack } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type {
  IsmsDocument as IsmsDocumentData,
  IsmsReviewAttendee,
} from '../isms-types';
import type { ApproverOption } from './IsmsApprovalSection';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import { ProcedureCard } from './ProcedureCard';
import type { ReviewHandlers } from './ReviewCard';
import { ReviewsList } from './ReviewsList';
import {
  parseProcedure,
  reviewValidationMessages,
} from './management-review-constants';
import {
  toActionPayload,
  toInputPayload,
  toOutputsPayload,
  toReviewPayload,
  toReviewSignoffPayload,
} from './management-review-schema';

interface ManagementReviewClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
  memberOptions: ApproverOption[];
  /** Top Management holder(s) from ISMS > Roles (5.3) — the chair dropdown. */
  chairOptions?: string[];
}

const REVIEWS = 'reviews' as const;
const INPUTS = 'review-inputs' as const;
const ACTIONS = 'review-actions' as const;

async function run(action: Promise<void>, successMessage: string, failMessage: string) {
  try {
    await action;
    toast.success(successMessage);
  } catch (caught) {
    toast.error(caught instanceof Error ? caught.message : failMessage);
    // Re-throw so the calling form/row keeps its state on failure.
    throw caught;
  }
}

export function ManagementReviewClient({
  memberOptions,
  chairOptions = [],
  ...props
}: ManagementReviewClientProps) {
  const t = useTranslations('isms.managementReview');
  return (
    <IsmsDocumentShell
      {...props}
      clause="9.3"
      title={t('title')}
      description={t('description')}
      sectionTitle={t('sectionTitle')}
      sectionDescription={t('sectionDescription')}
      generateSuccessMessage={t('generateRestored')}
      getSubmitBlockedReason={(document) => {
        const messages = reviewValidationMessages({
          procedure: parseProcedure(document.draftNarrative),
          reviews: Array.isArray(document.reviews) ? document.reviews : [],
        });
        return messages.length > 0
          ? t('submitBlocked', { messages: messages.join(' ') })
          : null;
      }}
    >
      {({ document, canManage, hook }) => {
        const reviews = Array.isArray(document.reviews) ? document.reviews : [];
        const validationMessages = reviewValidationMessages({
          procedure: parseProcedure(document.draftNarrative),
          reviews,
        });

        const handlers: ReviewHandlers = {
          onUpdateReview: (reviewId, values) =>
            run(
              hook.updateRow({ register: REVIEWS, id: reviewId, data: toReviewPayload(values) }),
              t('reviewUpdated'),
              t('reviewUpdateFailed'),
            ),
          onDeleteReview: (reviewId) =>
            run(
              hook.deleteRow({ register: REVIEWS, id: reviewId }),
              t('reviewDeleted'),
              t('reviewDeleteFailed'),
            ),
          onSaveAttendees: (reviewId, attendees: IsmsReviewAttendee[]) =>
            run(
              hook.updateRow({ register: REVIEWS, id: reviewId, data: { attendees } }),
              t('attendeesUpdated'),
              t('attendeesUpdateFailed'),
            ),
          onSaveOutputs: (reviewId, values) =>
            run(
              hook.updateRow({ register: REVIEWS, id: reviewId, data: toOutputsPayload(values) }),
              t('outputsSaved'),
              t('outputsSaveFailed'),
            ),
          onSaveSignoff: (reviewId, values) =>
            run(
              hook.updateRow({
                register: REVIEWS,
                id: reviewId,
                data: toReviewSignoffPayload(values),
              }),
              t('signoffSaved'),
              t('signoffSaveFailed'),
            ),
          onCreateInput: (reviewId, values) =>
            run(
              hook.createRow({ register: INPUTS, data: { reviewId, ...toInputPayload(values) } }),
              t('inputAdded'),
              t('inputAddFailed'),
            ),
          onUpdateInput: (inputId, payload) =>
            run(
              hook.updateRow({ register: INPUTS, id: inputId, data: payload }),
              t('inputUpdated'),
              t('inputUpdateFailed'),
            ),
          onDeleteInput: (inputId) =>
            run(
              hook.deleteRow({ register: INPUTS, id: inputId }),
              t('inputDeleted'),
              t('inputDeleteFailed'),
            ),
          onCreateAction: (reviewId, values) =>
            run(
              hook.createRow({
                register: ACTIONS,
                data: { reviewId, ...toActionPayload(values) },
              }),
              t('actionAdded'),
              t('actionAddFailed'),
            ),
          onUpdateAction: (actionId, payload) =>
            run(
              hook.updateRow({ register: ACTIONS, id: actionId, data: payload }),
              t('actionUpdated'),
              t('actionUpdateFailed'),
            ),
          onDeleteAction: (actionId) =>
            run(
              hook.deleteRow({ register: ACTIONS, id: actionId }),
              t('actionDeleted'),
              t('actionDeleteFailed'),
            ),
        };

        return (
          <Stack gap="6">
            <ProcedureCard
              narrative={document.draftNarrative}
              canEdit={canManage}
              onSave={(procedure) =>
                run(
                  hook.saveNarrative({ procedure }),
                  t('procedureSaved'),
                  t('procedureSaveFailed'),
                )
              }
            />
            <ReviewsList
              reviews={reviews}
              canEdit={canManage}
              memberOptions={memberOptions}
              chairOptions={chairOptions}
              validationMessages={validationMessages}
              onCreateReview={() =>
                run(
                  hook.createRow({ register: REVIEWS, data: {} }),
                  t('reviewCreated'),
                  t('reviewCreateFailed'),
                )
              }
              {...handlers}
            />
          </Stack>
        );
      }}
    </IsmsDocumentShell>
  );
}
