import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeleteEntry = vi.fn();

vi.mock('../hooks/useContextEntries', () => ({
  useContextEntries: (options?: { initialData?: unknown[] }) => ({
    entries: options?.initialData ?? [],
    isLoading: false,
    error: null,
    mutate: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: mockDeleteEntry,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { ContextList } from './context-list';

const makeEntry = (overrides = {}) => ({
  id: 'ctx_1',
  question: 'What is X?',
  answer: 'X is Y',
  tags: [],
  organizationId: 'org_123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ContextList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no entries', () => {
    render(<ContextList entries={[]} locale="en" />);
    expect(screen.getByText('No context entries yet')).toBeInTheDocument();
  });

  it('renders entries with question and answer', () => {
    const entries = [
      makeEntry({ id: 'ctx_1', question: 'What is X?', answer: 'X is Y' }),
      makeEntry({ id: 'ctx_2', question: 'What is Z?', answer: 'Z is W' }),
    ];

    render(<ContextList entries={entries as any} locale="en" />);
    expect(screen.getByText('What is X?')).toBeInTheDocument();
    expect(screen.getByText('X is Y')).toBeInTheDocument();
    expect(screen.getByText('What is Z?')).toBeInTheDocument();
    expect(screen.getByText('Z is W')).toBeInTheDocument();
  });

  it('renders Add Entry button', () => {
    render(<ContextList entries={[]} locale="en" />);
    expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument();
  });

  it('calls deleteEntry and shows success toast on delete', async () => {
    mockDeleteEntry.mockResolvedValue(undefined);
    const entries = [makeEntry()];

    render(<ContextList entries={entries as any} locale="en" />);

    // Click Delete button on the card
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    // Confirm in alert dialog
    const confirmButtons = screen.getAllByRole('button', { name: /delete/i });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteEntry).toHaveBeenCalledWith('ctx_1');
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Context entry deleted');
    });
  });

  it('shows error toast when delete fails', async () => {
    mockDeleteEntry.mockRejectedValue(new Error('Server error'));
    const entries = [makeEntry()];

    render(<ContextList entries={entries as any} locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    const confirmButtons = screen.getAllByRole('button', { name: /delete/i });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Something went wrong');
    });
  });
});
