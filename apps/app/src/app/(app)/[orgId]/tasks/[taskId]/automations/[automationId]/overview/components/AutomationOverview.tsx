'use client';

import { RecentAuditLogs } from '@/components/RecentAuditLogs';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { Button } from '@gideon-defender/ui/button';
import type {
  EvidenceAutomation,
  EvidenceAutomationRun,
  EvidenceAutomationVersion,
  Task,
  TaskFrequency,
} from '@db';
import {
  Breadcrumb,
  HStack,
  PageLayout,
  Section,
  Stack,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@trycompai/design-system';
import { Code2, Loader2, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  executeAutomationScript,
  toggleAutomationEnabled,
} from '../../../../automation/[automationId]/actions/task-automation-actions';
import { DeleteAutomationDialog } from '../../../../automation/[automationId]/components/AutomationSettingsDialogs';
import { SchedulePicker } from '@/components/schedule-picker';
import { useTaskAutomation } from '../../../../automation/[automationId]/hooks/use-task-automation';
import { AutomationRunsCard } from '../../../../components/AutomationRunsCard';
import { useAutomationRuns } from '../hooks/use-automation-runs';
import { MetricsSection } from './MetricsSection';

type RunWithAutomationName = EvidenceAutomationRun & {
  evidenceAutomation: { name: string };
};

interface AutomationOverviewProps {
  task: Task;
  automation: EvidenceAutomation;
  initialRuns: RunWithAutomationName[];
  initialVersions: EvidenceAutomationVersion[];
}

export function AutomationOverview({
  task,
  automation: initialAutomation,
  initialRuns,
  initialVersions,
}: AutomationOverviewProps) {
  const { orgId, taskId, automationId } = useParams<{
    orgId: string;
    taskId: string;
    automationId: string;
  }>();
  const t = useTranslations('tasks');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isTestingVersion, setIsTestingVersion] = useState(false);

  const {
    automation: liveAutomation,
    mutate: mutateAutomation,
    updateAutomation,
  } = useTaskAutomation();

  const { runs: liveRuns, mutate: mutateRuns } = useAutomationRuns();

  const automation = liveAutomation || initialAutomation;
  const runs = liveRuns || initialRuns;

  const latestVersion = initialVersions.length > 0 ? initialVersions[0].version : null;
  if (selectedVersion === null && latestVersion !== null) {
    setSelectedVersion(latestVersion);
  }

  const startEditingName = () => {
    setNameValue(automation.name);
    setIsEditingName(true);
  };

  const saveNameEdit = async () => {
    if (!nameValue.trim() || nameValue === automation.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateAutomation({ name: nameValue.trim() });
      toast.success(t('automationOverview.nameUpdated'));
      setIsEditingName(false);
      await mutateAutomation();
    } catch {
      toast.error(t('automationOverview.nameUpdateFailed'));
    }
  };

  const startEditingDescription = () => {
    setDescriptionValue(automation.description || '');
    setIsEditingDescription(true);
  };

  const saveDescriptionEdit = async () => {
    if (descriptionValue === (automation.description || '')) {
      setIsEditingDescription(false);
      return;
    }
    try {
      await updateAutomation({ description: descriptionValue.trim() });
      toast.success(t('automationOverview.descriptionUpdated'));
      setIsEditingDescription(false);
      await mutateAutomation();
    } catch {
      toast.error(t('automationOverview.descriptionUpdateFailed'));
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!automation?.id) return;
    setIsTogglingEnabled(true);
    try {
      const result = await toggleAutomationEnabled(taskId, automation.id, enabled);
      if (!result.success) throw new Error(result.error || t('automationOverview.toggleFailed'));
      toast.success(
        enabled ? t('automationOverview.enabledToast') : t('automationOverview.disabledToast'),
      );
      await mutateAutomation();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('automationOverview.toggleFailed'),
      );
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleScheduleChange = async (value: TaskFrequency) => {
    setIsUpdatingSchedule(true);
    try {
      await updateAutomation({ scheduleFrequency: value });
      toast.success(t('automationOverview.scheduleUpdated'));
      await mutateAutomation();
    } catch {
      toast.error(t('automationOverview.scheduleUpdateFailed'));
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const handleTestVersion = async () => {
    if (!selectedVersion) return;
    setIsTestingVersion(true);
    try {
      const result = await executeAutomationScript({
        orgId,
        taskId,
        automationId: automation.id,
        version: selectedVersion,
      });

      if (result.success) {
        toast.success(t('automationOverview.testStartedToast', { version: selectedVersion }), {
          description: t('automationOverview.testStartedDescription'),
        });
        const runId = result.data?.runId || `pending-${Date.now()}`;
        const now = new Date();
        mutateRuns(
          (currentRuns) => {
            const pendingRun: RunWithAutomationName = {
              id: runId,
              evidenceAutomationId: automation.id,
              taskId,
              status: 'pending',
              success: null,
              output: null,
              error: null,
              version: selectedVersion,
              evaluationStatus: null,
              evaluationReason: null,
              createdAt: now,
              updatedAt: now,
              completedAt: null,
              startedAt: now,
              logs: null,
              runDuration: null,
              triggeredBy: 'manual',
              evidenceAutomation: { name: automation.name },
            };
            const existing = Array.isArray(currentRuns) ? currentRuns : [];
            return [pendingRun, ...existing];
          },
          false,
        );
      } else {
        toast.error(result.error || t('automationOverview.startTestFailed'));
      }
    } catch {
      toast.error(t('automationOverview.startTestFailed'));
    } finally {
      setIsTestingVersion(false);
    }
  };

  const runsWithName: RunWithAutomationName[] = (runs || []).map((run) => ({
    ...run,
    evidenceAutomation: (run as RunWithAutomationName).evidenceAutomation || {
      name: automation.name,
    },
  }));

  return (
    <PageLayout>
      <Breadcrumb
        items={[
          {
            label: t('automationOverview.evidenceBreadcrumb'),
            href: `/${orgId}/tasks`,
            props: { render: <Link href={`/${orgId}/tasks`} /> },
          },
          {
            label: task.title,
            href: `/${orgId}/tasks/${taskId}`,
            props: { render: <Link href={`/${orgId}/tasks/${taskId}`} /> },
          },
          { label: automation.name, isCurrent: true },
        ]}
      />

      <Stack gap="xs">
        <HStack justify="between" align="center">
          {isEditingName ? (
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNameEdit();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              className="text-2xl font-semibold tracking-tight bg-transparent border-b border-primary outline-none flex-1"
              autoFocus
            />
          ) : (
            <h1
              onClick={startEditingName}
              className="text-2xl font-semibold tracking-tight cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
            >
              {automation.name}
            </h1>
          )}
          <Link href={`/${orgId}/tasks/${taskId}/automation/${automationId}`}>
            <Button size="sm">
              <Code2 className="h-4 w-4 mr-2" />
              {t('automationOverview.editScript')}
            </Button>
          </Link>
        </HStack>
        {isEditingDescription ? (
          <textarea
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={saveDescriptionEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsEditingDescription(false);
            }}
            className="text-sm text-muted-foreground bg-transparent border-b border-primary outline-none resize-none w-full"
            rows={5}
            autoFocus
          />
        ) : (
          <Text
            size="sm"
            variant="muted"
            as="p"
            onClick={startEditingDescription}
            style={{ cursor: 'pointer' }}
          >
            {automation.description || t('automationOverview.addDescriptionPlaceholder')}
          </Text>
        )}
      </Stack>

      <MetricsSection
        initialVersions={initialVersions}
        initialRuns={runs}
        scheduleFrequency={automation.scheduleFrequency ?? 'daily'}
        lastRunAt={automation.lastRunAt ?? null}
      />

      <Tabs defaultValue="history">
        <Stack gap="lg">
          <TabsList variant="underline">
            <TabsTrigger value="history">{t('automationOverview.runHistoryTab')}</TabsTrigger>
            <TabsTrigger value="versions">{t('automationOverview.versionsTab')}</TabsTrigger>
            <TabsTrigger value="activity">{t('automationOverview.activityTab')}</TabsTrigger>
            <TabsTrigger value="settings">{t('automationOverview.settingsTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <AutomationRunsCard runs={runsWithName} />
          </TabsContent>

          <TabsContent value="versions">
            {initialVersions.length > 0 ? (
              <Stack gap="sm">
                {initialVersions.map((v) => {
                  const isLatest = v.version === latestVersion;
                  const isTesting = isTestingVersion && selectedVersion === v.version;
                  return (
                    <div
                      key={v.version}
                      className={`flex items-center justify-between rounded-lg border py-3 px-4 ${isLatest ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                    >
                      <HStack gap="md" align="center">
                        <div>
                          <HStack gap="sm" align="center">
                            <Text size="sm" weight="medium">v{v.version}</Text>
                            {isLatest && (
                              <span className="text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary font-medium">
                                {t('automationOverview.latestBadge')}
                              </span>
                            )}
                          </HStack>
                          {v.changelog && (
                            <Text size="xs" variant="muted">{v.changelog}</Text>
                          )}
                          <Text size="xs" variant="muted">
                            {new Date(v.createdAt).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </Text>
                        </div>
                      </HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVersion(v.version);
                          handleTestVersion();
                        }}
                        disabled={isTestingVersion}
                      >
                        {isTesting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1.5" />
                            {t('automationOverview.testButton')}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </Stack>
            ) : (
              <div className="py-8">
                <Stack gap="sm" align="center">
                  <Text size="sm" variant="muted">
                    {t('automationOverview.noVersionsYet')}
                  </Text>
                </Stack>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <AutomationActivity taskId={taskId} automationId={automationId} />
          </TabsContent>

          <TabsContent value="settings">
            <Section title={t('automationOverview.settingsSectionTitle')}>
              <Stack gap="lg">
                <HStack justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="medium">
                      {t('automationOverview.enableAutomation')}
                    </Text>
                    <Text size="xs" variant="muted">
                      {t('automationOverview.enableAutomationDescription')}
                    </Text>
                  </Stack>
                  <Switch
                    checked={automation.isEnabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={isTogglingEnabled}
                  />
                </HStack>

                <div className="border-t" />

                <HStack justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="medium">
                      {t('automationOverview.scheduleLabel')}
                    </Text>
                    <Text size="xs" variant="muted">
                      {t('automationOverview.scheduleDescription')}
                    </Text>
                  </Stack>
                  <div className="w-40">
                    <SchedulePicker
                      value={automation.scheduleFrequency ?? 'daily'}
                      onChange={handleScheduleChange}
                      disabled={isUpdatingSchedule}
                    />
                  </div>
                </HStack>

                <div className="border-t" />

                <HStack justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="medium">
                      {t('automationOverview.deleteAutomation')}
                    </Text>
                    <Text size="xs" variant="muted">
                      {t('automationOverview.deleteAutomationDescription')}
                    </Text>
                  </Stack>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('automationOverview.deleteButton')}
                  </Button>
                </HStack>
              </Stack>
            </Section>
          </TabsContent>
        </Stack>
      </Tabs>

      <DeleteAutomationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={mutateAutomation}
      />

    </PageLayout>
  );
}

function AutomationActivity({ taskId, automationId }: { taskId: string; automationId: string }) {
  const { logs } = useAuditLogs({
    entityType: 'task',
    entityId: taskId,
    pathContains: automationId,
  });
  return <RecentAuditLogs logs={logs} />;
}
