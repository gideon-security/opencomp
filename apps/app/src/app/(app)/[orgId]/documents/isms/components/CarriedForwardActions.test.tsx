import { render, screen } from '@testing-library/react';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { IsmsManagementReview, IsmsReviewAction } from '../isms-types';
import { ismsDesignSystemMock } from './__test-helpers__/dsMocks';

vi.mock('@trycompai/design-system', () => ismsDesignSystemMock());

import { CarriedForwardActions } from './CarriedForwardActions';

mockNextIntl();

const MEMBER_OPTIONS = [
  { id: 'm1', name: 'Ada Owner' },
  { id: 'm2', name: 'Grace Hopper' },
];

function makeReview(
  reference: string,
  overrides: Partial<IsmsManagementReview> = {},
): IsmsManagementReview {
  return {
    id: `rev-${reference}`,
    reference,
    meetingDate: null,
    recordedAt: '2026-01-01T00:00:00.000Z',
    chairName: null,
    attendees: [],
    status: 'in_progress',
    conclusionVerdict: null,
    conclusionNotes: null,
    decisionsText: null,
    changesText: null,
    signoffChairName: null,
    signoffChairDate: null,
    position: 0,
    inputs: [],
    actions: [],
    ...overrides,
  };
}

function makeAction(overrides: Partial<IsmsReviewAction> = {}): IsmsReviewAction {
  return {
    id: 'act-1',
    reviewId: 'rev-MR-2025-01',
    reference: 'A01',
    description: 'Refresh the asset register',
    ownerMemberId: 'm1',
    dueDate: '2026-03-01T00:00:00.000Z',
    status: 'open',
    position: 0,
    ...overrides,
  };
}

describe('CarriedForwardActions', () => {
  it('renders the carried-forward heading and description keys', () => {
    const review = makeReview('MR-2025-01');
    render(
      <CarriedForwardActions
        entries={[{ review, action: makeAction() }]}
        memberOptions={MEMBER_OPTIONS}
      />,
    );

    expect(screen.getByText('carriedForward.title')).toBeInTheDocument();
    expect(screen.getByText('carriedForward.description')).toBeInTheDocument();
  });

  it('renders the full action reference, owner name and truncated due date', () => {
    const review = makeReview('MR-2025-01');
    render(
      <CarriedForwardActions
        entries={[{ review, action: makeAction() }]}
        memberOptions={MEMBER_OPTIONS}
      />,
    );

    expect(screen.getByText('MR-2025-01-A01')).toBeInTheDocument();
    expect(screen.getByText('Ada Owner')).toBeInTheDocument();
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
    expect(screen.getByText('Refresh the asset register')).toBeInTheDocument();
  });

  it('shows "Former member" when the owner is not in the current roster', () => {
    const review = makeReview('MR-2025-01');
    render(
      <CarriedForwardActions
        entries={[{ review, action: makeAction({ ownerMemberId: 'gone' }) }]}
        memberOptions={MEMBER_OPTIONS}
      />,
    );

    expect(screen.getByText('carriedForward.formerMember')).toBeInTheDocument();
  });

  it('shows "Unknown member" instead of guessing when the roster failed to load', () => {
    const review = makeReview('MR-2025-01');
    render(
      <CarriedForwardActions
        entries={[{ review, action: makeAction() }]}
        memberOptions={[]}
      />,
    );

    expect(screen.getByText('carriedForward.unknownMember')).toBeInTheDocument();
  });

  it('renders an em dash for an unassigned owner or missing due date', () => {
    const review = makeReview('MR-2025-01');
    render(
      <CarriedForwardActions
        entries={[{ review, action: makeAction({ ownerMemberId: null, dueDate: null }) }]}
        memberOptions={MEMBER_OPTIONS}
      />,
    );

    expect(screen.getAllByText('—').length).toBe(2);
  });
});
