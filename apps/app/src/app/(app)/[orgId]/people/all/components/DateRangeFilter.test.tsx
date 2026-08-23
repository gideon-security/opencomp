import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

mockNextIntl();

import { DateRangeFilter } from './DateRangeFilter';

const noop = vi.fn();

function renderFilter(
  overrides: Partial<Parameters<typeof DateRangeFilter>[0]> = {},
) {
  return render(
    <DateRangeFilter
      label="Onboarded"
      from={undefined}
      to={undefined}
      onApply={noop}
      onClear={noop}
      {...overrides}
    />,
  );
}

describe('DateRangeFilter', () => {
  it('shows Any time when no range is applied', () => {
    renderFilter();
    expect(screen.getByText('dateRange.anyTime')).toBeInTheDocument();
  });

  it('shows the formatted range when from and to are set', () => {
    renderFilter({ from: new Date('2026-06-01'), to: new Date('2026-06-30') });
    expect(screen.getByText('dateRange.range')).toBeInTheDocument();
  });

  it('opens the popover with localized presets, placeholders, and actions', async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByText('dateRange.anyTime'));

    expect(screen.getByText('dateRange.between')).toBeInTheDocument();
    expect(screen.getByText('dateRange.last7Days')).toBeInTheDocument();
    expect(screen.getByText('dateRange.last30Days')).toBeInTheDocument();
    expect(screen.getByText('dateRange.thisQuarter')).toBeInTheDocument();
    expect(screen.getByText('dateRange.thisYear')).toBeInTheDocument();
    expect(screen.getByText('dateRange.allTime')).toBeInTheDocument();
    expect(screen.getByText('dateRange.startPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('dateRange.endPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dateRange.clear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dateRange.apply' })).toBeInTheDocument();
  });

  it('applies the selected preset range', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    renderFilter({ onApply });

    await user.click(screen.getByText('dateRange.anyTime'));
    await user.click(screen.getByText('dateRange.last7Days'));
    await user.click(screen.getByRole('button', { name: 'dateRange.apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [from, to] = onApply.mock.calls[0] as [Date, Date];
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
  });

  it('clears via the Clear button', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    renderFilter({ onClear });

    await user.click(screen.getByText('dateRange.anyTime'));
    await user.click(screen.getByRole('button', { name: 'dateRange.clear' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
