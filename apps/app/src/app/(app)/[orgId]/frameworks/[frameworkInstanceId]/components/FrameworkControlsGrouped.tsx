'use client';

import type { EvidenceSubmissionInfo } from '@/lib/control-compliance';
import type { FrameworkInstanceWithControls } from '@/lib/types/framework';
import type { Control, FrameworkEditorRequirement, Task } from '@db';
import {
  Button,
  Heading,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { ChevronDown, ChevronRight, Search } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo, useState } from 'react';
import { FamilyFilterDropdown } from './FamilyFilterDropdown';
import {
  areAllFamiliesExpanded,
  isFamilyExpanded,
  toggleAllFamilyExpansion,
  toggleFamilyExpansion,
} from './family-expansion-state';
import {
  buildControlItems,
  buildRequirementMap,
  getFamilyDisplayLabel,
  groupByFamily,
  type FamilyGroup,
} from './framework-controls-shared';
import { GroupedControlRow } from './GroupedControlRow';

const COLUMN_COUNT = 7;

export function FrameworkControlsGrouped({
  frameworkInstanceWithControls,
  requirementDefinitions,
  tasks,
  evidenceSubmissions = [],
}: {
  frameworkInstanceWithControls: FrameworkInstanceWithControls;
  requirementDefinitions: FrameworkEditorRequirement[];
  tasks: (Task & { controls: Control[] })[];
  evidenceSubmissions?: EvidenceSubmissionInfo[];
}) {
  const { orgId, frameworkInstanceId } = useParams<{ orgId: string; frameworkInstanceId: string }>();
  const router = useRouter();
  const t = useTranslations('frameworks');

  const handleRowClick = useCallback(
    (controlId: string) => {
      router.push(`/${orgId}/frameworks/${frameworkInstanceId}/controls/${controlId}`);
    },
    [orgId, frameworkInstanceId, router],
  );

  const [searchTerm, setSearchTerm] = useQueryState('q', parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }));
  const [familyFilterParam, setFamilyFilterParam] = useQueryState('families', parseAsArrayOf(parseAsString, '|').withDefault([]).withOptions({ shallow: true }));
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  const selectedFamilyFilter = useMemo(() => new Set(familyFilterParam), [familyFilterParam]);

  const requirementMap = useMemo(
    () => buildRequirementMap(requirementDefinitions),
    [requirementDefinitions],
  );

  const allItems = useMemo(
    () => buildControlItems(frameworkInstanceWithControls.controls, requirementMap),
    [frameworkInstanceWithControls.controls, requirementMap],
  );

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return allItems;
    const lower = searchTerm.toLowerCase();
    return allItems.filter(
      (item) =>
        item.control.name.toLowerCase().includes(lower) ||
        item.control.description?.toLowerCase().includes(lower) ||
        item.requirements.some(
          (r) => r.name.toLowerCase().includes(lower) || r.identifier.toLowerCase().includes(lower),
        ),
    );
  }, [allItems, searchTerm]);

  const allGroups = useMemo(() => groupByFamily(filteredItems), [filteredItems]);

  const groups = useMemo(() => {
    if (selectedFamilyFilter.size === 0) return allGroups;
    return allGroups.filter((g) => selectedFamilyFilter.has(g.family));
  }, [allGroups, selectedFamilyFilter]);

  const allFamilyNames = useMemo(() => allGroups.map((g) => g.family), [allGroups]);
  const familyCounts = useMemo(() => new Map(allGroups.map((g) => [g.family, g.items.length])), [allGroups]);

  const isSearching = searchTerm.trim().length > 0;
  const visibleFamilyNames = useMemo(() => groups.map((g) => g.family), [groups]);
  const allExpanded = areAllFamiliesExpanded({
    expandedFamilies,
    familyNames: visibleFamilyNames,
  });

  const handleToggleFamily = (family: string) => {
    setExpandedFamilies((prev) =>
      toggleFamilyExpansion({ expandedFamilies: prev, family }),
    );
  };

  const handleToggleAll = () => {
    setExpandedFamilies((prev) =>
      toggleAllFamilyExpansion({
        expandedFamilies: prev,
        familyNames: visibleFamilyNames,
        shouldExpand: !allExpanded,
      }),
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value || null);
  };

  const handleToggleFamilyFilter = (family: string) => {
    const next = new Set(selectedFamilyFilter);
    if (next.has(family)) {
      next.delete(family);
    } else {
      next.add(family);
    }
    setFamilyFilterParam(next.size > 0 ? [...next].sort() : null);
  };

  const handleClearFamilyFilter = () => {
    setFamilyFilterParam(null);
  };

  const getIsFamilyExpanded = (family: string) =>
    isFamilyExpanded({ expandedFamilies, family, isSearching });

  return (
    <div className="space-y-4">
      <Heading level="2">
        {t('controlsTable.controlsCount', { count: filteredItems.length })}
      </Heading>
      <div className="flex items-center gap-3">
        <div className="w-full max-w-sm">
          <InputGroup>
            <InputGroupAddon>
              <Search size={16} />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('controlsTable.searchPlaceholder')}
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
        </div>
        <FamilyFilterDropdown
          allFamilyNames={allFamilyNames}
          familyCounts={familyCounts}
          selectedFamilies={selectedFamilyFilter}
          onToggleFamily={handleToggleFamilyFilter}
          onClear={handleClearFamilyFilter}
        />
        {!isSearching && (
          <Button variant="ghost" onClick={handleToggleAll}>
            {allExpanded ? t('controlsTable.collapseAll') : t('controlsTable.expandAll')}
          </Button>
        )}
      </div>
      <Table variant="bordered">
        <TableHeader>
          <TableRow>
            <TableHead>{t('controlsTable.columnName')}</TableHead>
            <TableHead>{t('controlsTable.columnRequirement')}</TableHead>
            <TableHead>{t('controlsTable.columnCompliance')}</TableHead>
            <TableHead>{t('controlsTable.columnStatus')}</TableHead>
            <TableHead>{t('controlsTable.columnPolicies')}</TableHead>
            <TableHead>{t('controlsTable.columnTasks')}</TableHead>
            <TableHead>{t('controlsTable.columnDocuments')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT}>
                <Text size="sm" variant="muted">
                  {t('controlsTable.noControls')}
                </Text>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <FamilySection
                key={group.family}
                group={group}
                expanded={getIsFamilyExpanded(group.family)}
                onToggle={() => handleToggleFamily(group.family)}
                tasks={tasks}
                evidenceSubmissions={evidenceSubmissions}
                orgId={orgId}
                frameworkInstanceId={frameworkInstanceId}
                onRowClick={handleRowClick}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function FamilySection({
  group,
  expanded,
  onToggle,
  tasks,
  evidenceSubmissions,
  orgId,
  frameworkInstanceId,
  onRowClick,
}: {
  group: FamilyGroup;
  expanded: boolean;
  onToggle: () => void;
  tasks: (Task & { controls: Control[] })[];
  evidenceSubmissions: EvidenceSubmissionInfo[];
  orgId: string;
  frameworkInstanceId: string;
  onRowClick: (controlId: string) => void;
}) {
  const t = useTranslations('frameworks');
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <>
      <TableRow data-state="selected">
        <TableCell colSpan={COLUMN_COUNT}>
          <button
            type="button"
            className="flex w-full items-center gap-2 py-1 text-left font-medium cursor-pointer"
            onClick={onToggle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }}
            aria-expanded={expanded}
          >
            <ChevronIcon size={16} />
            <span>{getFamilyDisplayLabel(group.family, t)}</span>
            <span className="text-muted-foreground text-sm font-normal">
              ({group.items.length})
            </span>
          </button>
        </TableCell>
      </TableRow>
      {expanded &&
        group.items.map(({ control, requirements }) => (
          <GroupedControlRow
            key={control.id}
            control={control}
            requirements={requirements}
            tasks={tasks}
            evidenceSubmissions={evidenceSubmissions}
            orgId={orgId}
            frameworkInstanceId={frameworkInstanceId}
            onRowClick={onRowClick}
          />
        ))}
    </>
  );
}
