'use client';

import { useFrameworkSync } from '@/hooks/use-framework-sync';
import { useFrameworkUpdatePreview } from '@/hooks/use-framework-update-preview';
import { usePermissions } from '@/hooks/use-permissions';
import type { UpdatePreview } from '@/types/framework-versioning';
import {
  Badge,
  Button,
  HStack,
  Heading,
  PageHeader,
  PageHeaderDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SyncConfirmDialog } from '../../components/SyncConfirmDialog';

interface Props {
  orgId: string;
  frameworkInstanceId: string;
  frameworkName: string;
  initialPreview: UpdatePreview;
}

type FilterKey = 'all' | 'added' | 'removed' | 'modified';

type ChangeKind = 'added' | 'removed' | 'modified' | 'preserved';

interface ChangeRow {
  key: string;
  identifier?: string;
  name: string;
  description?: string | null;
  changeSummary?: string | null;
  kind: ChangeKind;
}

interface ChangeGroup {
  title: string;
  kind: ChangeKind;
  rows: ChangeRow[];
}

export type FrameworkTranslator = ReturnType<typeof useTranslations<'frameworks'>>;

export function ReviewUpdateContent({
  orgId,
  frameworkInstanceId,
  frameworkName,
  initialPreview,
}: Props) {
  const router = useRouter();
  const t = useTranslations('frameworks');
  const { hasPermission } = usePermissions();
  const { sync, isSyncing } = useFrameworkSync(frameworkInstanceId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data } = useFrameworkUpdatePreview(frameworkInstanceId, {
    fallbackData: initialPreview,
  });
  const preview = data ?? initialPreview;

  const canApply = hasPermission('framework', 'update');
  const frameworkHref = `/${orgId}/frameworks/${frameworkInstanceId}`;

  const groups = useMemo<ChangeGroup[]>(() => buildGroups(preview, t), [preview, t]);

  // Summary counts: link removals/adds fold into the Removed / New totals.
  const edges = preview.edges ?? {
    controlPolicy: { added: [], removed: [] },
    controlTask: { added: [], removed: [] },
    controlRequirement: { added: [], removed: [] },
    controlDocumentType: { added: [], removed: [] },
  };
  const linksAdded =
    edges.controlPolicy.added.length +
    edges.controlTask.added.length +
    edges.controlRequirement.added.length +
    (edges.controlDocumentType?.added.length ?? 0);
  const linksRemoved =
    edges.controlPolicy.removed.length +
    edges.controlTask.removed.length +
    edges.controlRequirement.removed.length +
    (edges.controlDocumentType?.removed.length ?? 0);

  const entitiesAdded =
    preview.controls.added.length +
    preview.policies.added.length +
    preview.tasks.added.length +
    preview.requirements.added.length;
  const entitiesRemoved =
    preview.controls.archived.length +
    preview.policies.archived.length +
    preview.tasks.archived.length +
    preview.requirements.removed.length;
  const modifiedCount =
    preview.controls.updatedApplied.length +
    preview.policies.updatedApplied.length +
    preview.tasks.updatedApplied.length +
    preview.requirements.updated.length;
  const preservedCount =
    preview.controls.updatedPreserved.length +
    preview.tasks.updatedPreserved.length +
    preview.policies.updatedPreserved.length +
    preview.policies.draftAddedForPublished.length;

  const addedTotal = entitiesAdded + linksAdded;
  const removedTotal = entitiesRemoved + linksRemoved;
  const linksTotal = linksAdded + linksRemoved;

  const totalChanges = addedTotal + removedTotal + modifiedCount + preservedCount;

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groups;
    if (filter === 'added') return groups.filter((g) => g.kind === 'added');
    if (filter === 'removed') return groups.filter((g) => g.kind === 'removed');
    return groups.filter((g) => g.kind === 'modified' || g.kind === 'preserved');
  }, [groups, filter]);

  async function handleApply() {
    if (!preview.toVersion.id) return;
    try {
      await sync(preview.toVersion.id);
      toast.success(t('reviewUpdate.syncedToVersion', { version: preview.toVersion.version }));
      router.push(frameworkHref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reviewUpdate.applyFailed'));
    } finally {
      setConfirmOpen(false);
    }
  }

  const showLinkChanges =
    linksTotal > 0 &&
    filter !== 'modified' &&
    (filter === 'all' ||
      (filter === 'added' && linksAdded > 0) ||
      (filter === 'removed' && linksRemoved > 0));

  const showEmpty = visibleGroups.length === 0 && !showLinkChanges;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <div className="shrink-0">
        <PageHeader
          title={`${frameworkName} v${preview.toVersion.version}`}
          backHref={frameworkHref}
          backLabel={t('reviewUpdate.backToFramework', { name: frameworkName })}
        >
          <PageHeaderDescription>
            {t('reviewUpdate.reviewingUpdate', {
              fromVersion: preview.fromVersion.version,
              toVersion: preview.toVersion.version,
            })}
            {preview.releaseNotes ? ` — ${preview.releaseNotes}` : ''}
          </PageHeaderDescription>
        </PageHeader>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t('reviewUpdate.statNew')} value={addedTotal} tone="positive" />
        <StatCard label={t('reviewUpdate.statRemoved')} value={removedTotal} tone="danger" />
        <StatCard label={t('reviewUpdate.statModified')} value={modifiedCount + preservedCount} />
        <StatCard label={t('reviewUpdate.statLinksAffected')} value={linksTotal} />
      </div>

      <div className="shrink-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList variant="underline">
            <TabsTrigger value="all">
              {t('reviewUpdate.tabAll')} <TabBadge count={totalChanges} />
            </TabsTrigger>
            <TabsTrigger value="added">
              {t('reviewUpdate.tabAdded')} <TabBadge count={addedTotal} />
            </TabsTrigger>
            <TabsTrigger value="removed">
              {t('reviewUpdate.tabRemoved')} <TabBadge count={removedTotal} />
            </TabsTrigger>
            <TabsTrigger value="modified">
              {t('reviewUpdate.tabModified')} <TabBadge count={modifiedCount + preservedCount} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        {showEmpty ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <Text variant="muted">{t('reviewUpdate.noChangesInCategory')}</Text>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {visibleGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <HStack justify="between" align="center">
                  <Text size="sm" weight="medium" variant="muted">
                    {group.title}
                  </Text>
                  <Badge variant="outline">{group.rows.length}</Badge>
                </HStack>
                <div className="flex flex-col gap-2">
                  {group.rows.map((row) => (
                    <ItemRow key={row.key} row={row} />
                  ))}
                </div>
              </div>
            ))}
            {showLinkChanges && (
              <LinkChangesBlock
                edges={edges}
                show={filter === 'all' ? 'both' : filter === 'added' ? 'added' : 'removed'}
              />
            )}
          </div>
        )}
      </div>

      <div className="-mx-4 shrink-0 border-t bg-background px-4 py-4 md:-mx-6 md:px-6">
        <HStack justify="between" align="center">
          <Text size="sm" variant="muted">
            {t('reviewUpdate.applyNotice')}
          </Text>
          <HStack gap="sm">
            <Button variant="outline" size="lg" onClick={() => router.push(frameworkHref)}>
              {t('reviewUpdate.cancel')}
            </Button>
            <Button
              variant="default"
              size="lg"
              disabled={!canApply || isSyncing || !preview.toVersion.id || totalChanges === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {isSyncing
                ? t('reviewUpdate.applying')
                : t('reviewUpdate.applyChanges', { count: totalChanges })}
            </Button>
          </HStack>
        </HStack>
      </div>

      <SyncConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        preview={preview}
        isSyncing={isSyncing}
        onConfirm={handleApply}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'positive' | 'danger';
}) {
  const valueClass =
    tone === 'positive' && value > 0
      ? 'text-emerald-600 dark:text-emerald-500'
      : tone === 'danger' && value > 0
        ? 'text-destructive'
        : '';
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card p-4">
      <div className={valueClass}>
        <Heading level="2">{value}</Heading>
      </div>
      <Text size="sm" variant="muted" weight="medium">
        {label}
      </Text>
    </div>
  );
}

function TabBadge({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
      {count}
    </span>
  );
}

function ItemRow({ row }: { row: ChangeRow }) {
  const t = useTranslations('frameworks');
  const badge =
    row.kind === 'added'
      ? { label: t('reviewUpdate.itemAdded'), variant: 'default' as const }
      : row.kind === 'removed'
        ? { label: t('reviewUpdate.itemRemoved'), variant: 'destructive' as const }
        : row.kind === 'modified'
          ? { label: t('reviewUpdate.itemModified'), variant: 'secondary' as const }
          : { label: t('reviewUpdate.itemPreserved'), variant: 'outline' as const };

  const markerTone =
    row.kind === 'added'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : row.kind === 'removed'
        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
        : 'bg-muted text-muted-foreground';
  const marker = row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : '~';

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card px-4 py-3">
      <HStack gap="3" align="start">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-xs font-semibold ${markerTone}`}
        >
          {marker}
        </span>
        <div className="flex flex-col gap-1">
          <HStack gap="2" align="center">
            {row.identifier && (
              <span className="font-mono">
                <Text size="sm" weight="medium" variant="muted">
                  {row.identifier}
                </Text>
              </span>
            )}
            <Text size="sm" weight="medium">
              {row.name}
            </Text>
          </HStack>
          {row.changeSummary && (
            <Text size="sm" variant="muted">
              {row.changeSummary}
            </Text>
          )}
          {row.description && (
            <Text size="sm" variant="muted">
              {row.description}
            </Text>
          )}
        </div>
      </HStack>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </div>
  );
}

interface LinkRow {
  key: string;
  left: string;
  arrow: '→';
  right: string;
  kind: 'added' | 'removed';
  label: string;
}

function LinkChangesBlock({
  edges,
  show,
}: {
  edges: UpdatePreview['edges'];
  show: 'both' | 'added' | 'removed';
}) {
  const t = useTranslations('frameworks');
  const rows: LinkRow[] = [];
  const wantAdded = show === 'both' || show === 'added';
  const wantRemoved = show === 'both' || show === 'removed';

  if (wantAdded) {
    edges.controlRequirement.added.forEach((e, i) =>
      rows.push({
        key: `cr-add-${i}`,
        left: e.controlName,
        arrow: '→',
        right: `${e.requirementIdentifier ? `${e.requirementIdentifier} — ` : ''}${e.requirementName}`,
        kind: 'added',
        label: t('reviewUpdate.linkRequirementAdded'),
      }),
    );
    edges.controlPolicy.added.forEach((e, i) =>
      rows.push({
        key: `cp-add-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.policyName,
        kind: 'added',
        label: t('reviewUpdate.linkPolicyAdded'),
      }),
    );
    edges.controlTask.added.forEach((e, i) =>
      rows.push({
        key: `ct-add-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.taskName,
        kind: 'added',
        label: t('reviewUpdate.linkTaskAdded'),
      }),
    );
    (edges.controlDocumentType?.added ?? []).forEach((e, i) =>
      rows.push({
        key: `cd-add-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.formType.replace(/_/g, ' '),
        kind: 'added',
        label: t('reviewUpdate.linkDocumentTypeAdded'),
      }),
    );
  }

  if (wantRemoved) {
    edges.controlRequirement.removed.forEach((e, i) =>
      rows.push({
        key: `cr-rem-${i}`,
        left: e.controlName,
        arrow: '→',
        right: `${e.requirementIdentifier ? `${e.requirementIdentifier} — ` : ''}${e.requirementName}`,
        kind: 'removed',
        label: t('reviewUpdate.linkRequirementRemoved'),
      }),
    );
    edges.controlPolicy.removed.forEach((e, i) =>
      rows.push({
        key: `cp-rem-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.policyName,
        kind: 'removed',
        label: t('reviewUpdate.linkPolicyRemoved'),
      }),
    );
    edges.controlTask.removed.forEach((e, i) =>
      rows.push({
        key: `ct-rem-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.taskName,
        kind: 'removed',
        label: t('reviewUpdate.linkTaskRemoved'),
      }),
    );
    (edges.controlDocumentType?.removed ?? []).forEach((e, i) =>
      rows.push({
        key: `cd-rem-${i}`,
        left: e.controlName,
        arrow: '→',
        right: e.formType.replace(/_/g, ' '),
        kind: 'removed',
        label: t('reviewUpdate.linkDocumentTypeRemoved'),
      }),
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <HStack justify="between" align="center">
        <Text size="sm" weight="medium" variant="muted">
          {t('reviewUpdate.linkChangesTitle')}
        </Text>
        <Badge variant="outline">{rows.length}</Badge>
      </HStack>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <LinkRowItem key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function LinkRowItem({ row }: { row: LinkRow }) {
  const t = useTranslations('frameworks');
  const markerTone =
    row.kind === 'added'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
  const marker = row.kind === 'added' ? '+' : '−';
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card px-4 py-3">
      <HStack gap="3" align="start">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-xs font-semibold ${markerTone}`}
        >
          {marker}
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <HStack gap="2" align="center" wrap="wrap">
            <span className="truncate">
              <Text size="sm" weight="medium">
                {row.left}
              </Text>
            </span>
            <Text size="sm" variant="muted">
              {row.arrow}
            </Text>
            <span className="truncate">
              <Text size="sm" weight="medium">
                {row.right}
              </Text>
            </span>
          </HStack>
          <Text size="xs" variant="muted">
            {row.label}
          </Text>
        </div>
      </HStack>
      <Badge variant={row.kind === 'added' ? 'default' : 'destructive'}>
        {row.kind === 'added' ? t('reviewUpdate.itemAdded') : t('reviewUpdate.itemRemoved')}
      </Badge>
    </div>
  );
}

function describeRequirementChanges(
  from: UpdatePreview['requirements']['updated'][number]['from'],
  to: UpdatePreview['requirements']['updated'][number]['to'],
  t: FrameworkTranslator,
): string {
  const changes: string[] = [];
  if (from.name !== to.name) changes.push(t('reviewUpdate.nameUpdated'));
  if (from.identifier !== to.identifier) changes.push(t('reviewUpdate.identifierUpdated'));
  if (from.description !== to.description) changes.push(t('reviewUpdate.descriptionUpdated'));
  const fromFamily = from.requirementFamily ?? null;
  const toFamily = to.requirementFamily ?? null;
  if (fromFamily !== toFamily) {
    if (!fromFamily && toFamily) {
      changes.push(t('reviewUpdate.familySetTo', { family: toFamily }));
    } else if (fromFamily && !toFamily) {
      changes.push(t('reviewUpdate.familyRemoved'));
    } else {
      changes.push(t('reviewUpdate.familyChanged', { from: fromFamily ?? '', to: toFamily ?? '' }));
    }
  }
  return changes.join('. ') || t('reviewUpdate.modifiedFallback');
}

export function describeControlChanges(
  from: UpdatePreview['controls']['updatedApplied'][number]['manifestFrom'],
  to: UpdatePreview['controls']['updatedApplied'][number]['manifestTo'],
  t: FrameworkTranslator,
): string {
  const changes: string[] = [];
  if (from.name !== to.name) changes.push(t('reviewUpdate.nameUpdated'));
  if (from.description !== to.description) changes.push(t('reviewUpdate.descriptionUpdated'));
  const fromFamily = from.controlFamily ?? null;
  const toFamily = to.controlFamily ?? null;
  if (fromFamily !== toFamily) {
    if (!fromFamily && toFamily) {
      changes.push(t('reviewUpdate.controlFamilySetTo', { family: toFamily }));
    } else if (fromFamily && !toFamily) {
      changes.push(t('reviewUpdate.controlFamilyRemoved'));
    } else {
      changes.push(
        t('reviewUpdate.controlFamilyChanged', { from: fromFamily ?? '', to: toFamily ?? '' }),
      );
    }
  }
  return changes.join('. ') || t('reviewUpdate.modifiedFallback');
}

function buildGroups(preview: UpdatePreview, t: FrameworkTranslator): ChangeGroup[] {
  const out: ChangeGroup[] = [];

  // Removed
  if (preview.requirements.removed.length) {
    out.push({
      title: t('reviewUpdate.groupRemovedRequirements'),
      kind: 'removed',
      rows: preview.requirements.removed.map((r) => ({
        key: `req-rem-${r.id}`,
        identifier: r.identifier,
        name: r.name,
        description: r.description,
        kind: 'removed' as const,
      })),
    });
  }
  if (preview.controls.archived.length) {
    out.push({
      title: t('reviewUpdate.groupRemovedControls'),
      kind: 'removed',
      rows: preview.controls.archived.map(({ instanceId, manifest }) => ({
        key: `ctl-rem-${instanceId}`,
        name: manifest.name,
        description: manifest.description,
        kind: 'removed' as const,
      })),
    });
  }
  if (preview.policies.archived.length) {
    out.push({
      title: t('reviewUpdate.groupRemovedPolicies'),
      kind: 'removed',
      rows: preview.policies.archived.map(({ instanceId, manifest }) => ({
        key: `pol-rem-${instanceId}`,
        name: manifest.name,
        description: manifest.description ?? null,
        kind: 'removed' as const,
      })),
    });
  }
  if (preview.tasks.archived.length) {
    out.push({
      title: t('reviewUpdate.groupRemovedTasks'),
      kind: 'removed',
      rows: preview.tasks.archived.map(({ instanceId, manifest }) => ({
        key: `tsk-rem-${instanceId}`,
        name: manifest.name,
        description: manifest.description,
        kind: 'removed' as const,
      })),
    });
  }

  // Added
  if (preview.requirements.added.length) {
    out.push({
      title: t('reviewUpdate.groupNewRequirements'),
      kind: 'added',
      rows: preview.requirements.added.map((r) => ({
        key: `req-add-${r.id}`,
        identifier: r.identifier,
        name: r.name,
        description: r.description,
        kind: 'added' as const,
      })),
    });
  }
  if (preview.controls.added.length) {
    out.push({
      title: t('reviewUpdate.groupNewControls'),
      kind: 'added',
      rows: preview.controls.added.map((c) => ({
        key: `ctl-add-${c.id}`,
        name: c.name,
        description: c.description,
        kind: 'added' as const,
      })),
    });
  }
  if (preview.policies.added.length) {
    out.push({
      title: t('reviewUpdate.groupNewPolicies'),
      kind: 'added',
      rows: preview.policies.added.map((p) => ({
        key: `pol-add-${p.id}`,
        name: p.name,
        description: p.description ?? null,
        kind: 'added' as const,
      })),
    });
  }
  if (preview.tasks.added.length) {
    out.push({
      title: t('reviewUpdate.groupNewTasks'),
      kind: 'added',
      rows: preview.tasks.added.map((task) => ({
        key: `tsk-add-${task.id}`,
        name: task.name,
        description: task.description,
        kind: 'added' as const,
      })),
    });
  }

  // Modified
  if (preview.requirements.updated.length) {
    out.push({
      title: t('reviewUpdate.groupModifiedRequirements'),
      kind: 'modified',
      rows: preview.requirements.updated.map(({ from, to }) => ({
        key: `req-mod-${to.id}`,
        identifier: to.identifier,
        name: to.name,
        description: to.description,
        changeSummary: describeRequirementChanges(from, to, t),
        kind: 'modified' as const,
      })),
    });
  }
  if (preview.controls.updatedApplied.length) {
    out.push({
      title: t('reviewUpdate.groupModifiedControls'),
      kind: 'modified',
      rows: preview.controls.updatedApplied.map(({ instance, manifestFrom, manifestTo }) => ({
        key: `ctl-mod-${instance.id}`,
        name: manifestTo.name,
        description: manifestTo.description,
        changeSummary: describeControlChanges(manifestFrom, manifestTo, t),
        kind: 'modified' as const,
      })),
    });
  }
  if (preview.policies.updatedApplied.length) {
    out.push({
      title: t('reviewUpdate.groupModifiedPolicies'),
      kind: 'modified',
      rows: preview.policies.updatedApplied.map(({ instance, manifestTo }) => ({
        key: `pol-mod-${instance.id}`,
        name: manifestTo.name,
        description: manifestTo.description ?? null,
        kind: 'modified' as const,
      })),
    });
  }
  if (preview.tasks.updatedApplied.length) {
    out.push({
      title: t('reviewUpdate.groupModifiedTasks'),
      kind: 'modified',
      rows: preview.tasks.updatedApplied.map(({ instance, manifestTo }) => ({
        key: `tsk-mod-${instance.id}`,
        name: manifestTo.name,
        description: manifestTo.description,
        kind: 'modified' as const,
      })),
    });
  }

  // Preserved
  const preservedRows: ChangeRow[] = [];
  for (const { instance } of preview.controls.updatedPreserved) {
    preservedRows.push({
      key: `ctl-pres-${instance.id}`,
      name: instance.name,
      description: t('reviewUpdate.preservedEditsKept'),
      kind: 'preserved',
    });
  }
  for (const { instance } of preview.tasks.updatedPreserved) {
    preservedRows.push({
      key: `tsk-pres-${instance.id}`,
      name: instance.title,
      description: t('reviewUpdate.preservedEditsKept'),
      kind: 'preserved',
    });
  }
  for (const { instance } of preview.policies.updatedPreserved) {
    preservedRows.push({
      key: `pol-pres-${instance.id}`,
      name: instance.name,
      description: t('reviewUpdate.preservedEditsKept'),
      kind: 'preserved',
    });
  }
  for (const { instance } of preview.policies.draftAddedForPublished) {
    preservedRows.push({
      key: `pol-draft-${instance.id}`,
      name: instance.name,
      description: t('reviewUpdate.preservedDraftAdded'),
      kind: 'preserved',
    });
  }
  if (preservedRows.length) {
    out.push({
      title: t('reviewUpdate.groupPreservedEdits'),
      kind: 'preserved',
      rows: preservedRows,
    });
  }

  return out;
}
