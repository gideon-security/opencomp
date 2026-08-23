'use client';

import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trycompai/design-system';
import { Close, Filter } from '@trycompai/design-system/icons';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

import { DateRangeFilter } from './DateRangeFilter';

function rangeLabel(
  t: ReturnType<typeof useTranslations<'people'>>,
  from: Date | undefined,
  to: Date | undefined,
): string {
  if (from && to) {
    return t('dateRange.range', { from: format(from, 'MMM d'), to: format(to, 'MMM d') });
  }
  if (from) return t('dateRange.from', { date: format(from, 'MMM d') });
  return t('dateRange.until', { date: format(to as Date, 'MMM d') });
}

/** Removable chip for one applied filter — clearable without opening the popover. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const t = useTranslations('people');
  return (
    <span className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-muted/40 px-2 text-xs">
      {label}
      <button
        type="button"
        aria-label={t('filters.removeAriaLabel', { filter: label })}
        onClick={onRemove}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <Close size={12} />
      </button>
    </span>
  );
}

interface PeopleFiltersProps {
  statusFilter: string;
  hasOffboardFilter: boolean;
  onStatusChange: (value: string | null) => void;
  roleFilter: string;
  onRoleChange: (value: string | null) => void;
  onboardFrom: Date | undefined;
  onboardTo: Date | undefined;
  onOnboardApply: (from: Date | undefined, to: Date | undefined) => void;
  onOnboardClear: () => void;
  offboardFrom: Date | undefined;
  offboardTo: Date | undefined;
  onOffboardApply: (from: Date | undefined, to: Date | undefined) => void;
  onOffboardClear: () => void;
}

/**
 * All People-list filters behind one funnel button: Status, Role, and the
 * Onboarded/Offboarded date ranges. The trigger shows how many filters are
 * active so a filtered list is never a mystery.
 */
export function PeopleFilters({
  statusFilter,
  hasOffboardFilter,
  onStatusChange,
  roleFilter,
  onRoleChange,
  onboardFrom,
  onboardTo,
  onOnboardApply,
  onOnboardClear,
  offboardFrom,
  offboardTo,
  onOffboardApply,
  onOffboardClear,
}: PeopleFiltersProps) {
  const t = useTranslations('people');
  const statusLabels: Record<string, string> = {
    all: t('filters.allPeople'),
    active: t('filters.active'),
    pending: t('filters.pending'),
    deactivated: t('filters.deactivated'),
  };
  const roleLabels: Record<string, string> = {
    all: t('filters.allRoles'),
    owner: t('filters.owner'),
    admin: t('filters.admin'),
    auditor: t('filters.auditor'),
    employee: t('filters.employee'),
    contractor: t('filters.contractor'),
  };

  const activeCount = [
    statusFilter,
    roleFilter,
    onboardFrom || onboardTo,
    offboardFrom || offboardTo,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
      {/* PopoverTrigger renders its own <button>; a styled div inside (same
          pattern as the date chips) avoids invalid nested buttons. */}
      <PopoverTrigger>
        <div className="border-border bg-background hover:bg-muted flex h-8 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm transition-colors">
          <Filter size={16} className="text-muted-foreground" />
          {t('filters.title')}
          {activeCount > 0 && <Badge variant="accent">{activeCount}</Badge>}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 'auto' }}>
        <div className="flex w-[280px] flex-col gap-4 p-1.5">
          <div className="flex flex-col gap-1">
            <span id="people-status-filter-label" className="text-xs text-muted-foreground">
              {t('filters.status')}
            </span>
            <Select value={statusFilter || undefined} onValueChange={onStatusChange}>
              <SelectTrigger aria-labelledby="people-status-filter-label">
                <SelectValue placeholder={t('filters.active')}>
                  {hasOffboardFilter && !statusFilter
                    ? t('filters.allPeople')
                    : (statusLabels[statusFilter] ?? t('filters.active'))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{statusLabels.all}</SelectItem>
                <SelectItem value="active">{statusLabels.active}</SelectItem>
                <SelectItem value="pending">{statusLabels.pending}</SelectItem>
                <SelectItem value="deactivated">{statusLabels.deactivated}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span id="people-role-filter-label" className="text-xs text-muted-foreground">
              {t('filters.role')}
            </span>
            <Select value={roleFilter || undefined} onValueChange={onRoleChange}>
              <SelectTrigger aria-labelledby="people-role-filter-label">
                <SelectValue placeholder={t('filters.allRoles')}>
                  {roleLabels[roleFilter] ?? t('filters.allRoles')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{roleLabels.all}</SelectItem>
                <SelectItem value="owner">{roleLabels.owner}</SelectItem>
                <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                <SelectItem value="auditor">{roleLabels.auditor}</SelectItem>
                <SelectItem value="employee">{roleLabels.employee}</SelectItem>
                <SelectItem value="contractor">{roleLabels.contractor}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DateRangeFilter
            label={t('filters.onboarded')}
            from={onboardFrom}
            to={onboardTo}
            onApply={onOnboardApply}
            onClear={onOnboardClear}
          />
          <DateRangeFilter
            label={t('filters.offboarded')}
            from={offboardFrom}
            to={offboardTo}
            onApply={onOffboardApply}
            onClear={onOffboardClear}
          />
        </div>
      </PopoverContent>
      </Popover>

      {/* Applied filters as removable chips — visible + one-click clearable
          without reopening the popover. */}
      {statusFilter && (
        <FilterChip
          label={t('filters.chipStatus', {
            value: statusLabels[statusFilter] ?? statusFilter,
          })}
          onRemove={() => onStatusChange(null)}
        />
      )}
      {roleFilter && (
        <FilterChip
          label={t('filters.chipRole', { value: roleLabels[roleFilter] ?? roleFilter })}
          onRemove={() => onRoleChange('all')}
        />
      )}
      {(onboardFrom || onboardTo) && (
        <FilterChip
          label={t('filters.chipOnboarded', {
            range: rangeLabel(t, onboardFrom, onboardTo),
          })}
          onRemove={onOnboardClear}
        />
      )}
      {(offboardFrom || offboardTo) && (
        <FilterChip
          label={t('filters.chipOffboarded', {
            range: rangeLabel(t, offboardFrom, offboardTo),
          })}
          onRemove={onOffboardClear}
        />
      )}
    </div>
  );
}
