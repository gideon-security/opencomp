import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

mockNextIntl();

import { PeopleFilters } from './PeopleFilters';

const noop = vi.fn();

function renderFilters(overrides: Partial<Parameters<typeof PeopleFilters>[0]> = {}) {
  return render(
    <PeopleFilters
      statusFilter=""
      hasOffboardFilter={false}
      onStatusChange={noop}
      roleFilter=""
      onRoleChange={noop}
      onboardFrom={undefined}
      onboardTo={undefined}
      onOnboardApply={noop}
      onOnboardClear={noop}
      offboardFrom={undefined}
      offboardTo={undefined}
      onOffboardApply={noop}
      onOffboardClear={noop}
      {...overrides}
    />,
  );
}

describe('PeopleFilters', () => {
  it('shows no count badge or chips when nothing is filtered', () => {
    renderFilters();
    expect(screen.getByText('filters.title')).toBeInTheDocument();
    expect(screen.queryByText('filters.chipStatus')).not.toBeInTheDocument();
  });

  it('shows the active count and a removable chip per applied filter', () => {
    const onStatusChange = vi.fn();
    renderFilters({
      statusFilter: 'deactivated',
      roleFilter: 'admin',
      onStatusChange,
    });

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('filters.chipStatus')).toBeInTheDocument();
    expect(screen.getByText('filters.chipRole')).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('filters.removeAriaLabel')[0]);
    expect(onStatusChange).toHaveBeenCalledWith(null);
  });

  it('shows a date chip that clears via its remove button', () => {
    const onOnboardClear = vi.fn();
    renderFilters({ onboardFrom: new Date('2026-06-01'), onOnboardClear });

    const chip = screen.getByText('filters.chipOnboarded');
    expect(chip).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('filters.removeAriaLabel'));
    expect(onOnboardClear).toHaveBeenCalled();
  });
});
