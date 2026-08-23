import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

mockNextIntl();

import { toast } from 'sonner';
import { OffboardingChecklist } from './OffboardingChecklist';

type ChecklistItem = {
  templateItemId: string;
  completed: boolean;
  evidence: unknown[];
};

const h = vi.hoisted(() => ({
  completeItem: vi.fn(),
  uncompleteItem: vi.fn(),
  uploadEvidence: vi.fn(),
  getDownloadUrl: vi.fn(),
  refreshChecklist: vi.fn(),
  checklist: null as {
    totalItems: number;
    completedItems: number;
    items: ChecklistItem[];
  } | null,
}));

vi.mock('@/hooks/use-offboarding-checklist', () => ({
  useOffboardingChecklist: () => ({
    checklist: h.checklist,
    isLoading: false,
    completeItem: h.completeItem,
    uncompleteItem: h.uncompleteItem,
    uploadEvidence: h.uploadEvidence,
    getDownloadUrl: h.getDownloadUrl,
    refreshChecklist: h.refreshChecklist,
  }),
}));

vi.mock('./OffboardingChecklistItem', () => ({
  OffboardingChecklistItem: ({
    item,
    onComplete,
    onUncomplete,
    onDownload,
  }: {
    item: { templateItemId: string };
    onComplete: (args: { templateItemId: string }) => void;
    onUncomplete: (templateItemId: string) => void;
    onDownload: (attachmentId: string) => void;
  }) => (
    <div data-testid={`item-${item.templateItemId}`}>
      <button onClick={() => onComplete({ templateItemId: item.templateItemId })}>
        complete-{item.templateItemId}
      </button>
      <button onClick={() => onUncomplete(item.templateItemId)}>
        uncomplete-{item.templateItemId}
      </button>
      <button onClick={() => onDownload(`att-${item.templateItemId}`)}>
        download-{item.templateItemId}
      </button>
    </div>
  ),
}));

vi.mock('./OffboardingSummaryCard', () => ({
  OffboardingSummaryCard: () => <div data-testid="summary-card" />,
}));

function setChecklist(items: ChecklistItem[]) {
  h.checklist = {
    totalItems: items.length,
    completedItems: items.filter((i) => i.completed).length,
    items,
  };
}

describe('OffboardingChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setChecklist([
      { templateItemId: 'tpl_1', completed: true, evidence: [] },
      { templateItemId: 'tpl_2', completed: false, evidence: [] },
    ]);
  });

  it('renders the localized heading, description, and toggle label', () => {
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    expect(screen.getByText('offboardingChecklist.title')).toBeInTheDocument();
    expect(screen.getByText('offboardingChecklist.description')).toBeInTheDocument();
    expect(screen.getByText('offboardingChecklist.showOnlyRemaining')).toBeInTheDocument();
    expect(screen.getByTestId('item-tpl_1')).toBeInTheDocument();
    expect(screen.getByTestId('item-tpl_2')).toBeInTheDocument();
  });

  it('renders the summary card when an offboard date is set', () => {
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate="2026-09-01"
      />,
    );

    expect(screen.getByTestId('summary-card')).toBeInTheDocument();
  });

  it('toasts success when an item is completed', async () => {
    const user = userEvent.setup();
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    await user.click(screen.getByText('complete-tpl_2'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('offboardingChecklist.itemCompleted');
    });
  });

  it('toasts the failure message when completing rejects', async () => {
    const user = userEvent.setup();
    h.completeItem.mockRejectedValueOnce(new Error('boom'));
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    await user.click(screen.getByText('complete-tpl_2'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('offboardingChecklist.completeFailed');
    });
  });

  it('toasts success when an item is uncompleted', async () => {
    const user = userEvent.setup();
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    await user.click(screen.getByText('uncomplete-tpl_1'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('offboardingChecklist.itemUncompleted');
    });
  });

  it('toasts the download-failure message when opening an attachment fails', async () => {
    const user = userEvent.setup();
    h.getDownloadUrl.mockRejectedValueOnce(new Error('boom'));
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    await user.click(screen.getByText('download-tpl_1'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('offboardingChecklist.downloadFailed');
    });
  });

  it('shows only remaining items and the all-completed message when toggled', async () => {
    const user = userEvent.setup();
    setChecklist([
      { templateItemId: 'tpl_1', completed: true, evidence: [] },
      { templateItemId: 'tpl_2', completed: true, evidence: [] },
    ]);
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    await user.click(screen.getByRole('switch'));

    expect(screen.queryByTestId('item-tpl_1')).not.toBeInTheDocument();
    expect(screen.getByText('offboardingChecklist.allCompleted')).toBeInTheDocument();
  });

  it('shows the empty state when no checklist items are configured', () => {
    setChecklist([]);
    render(
      <OffboardingChecklist
        memberId="mem_1"
        canEdit={true}
        offboardDate=""
      />,
    );

    expect(screen.getByText('offboardingChecklist.empty')).toBeInTheDocument();
  });
});
