'use client';

import type {
  Control,
  FrameworkEditorFramework,
  FrameworkEditorRequirement,
  FrameworkInstance,
  Policy,
  RequirementMap,
  Task,
} from '@db';
import {
  Stack,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@trycompai/design-system';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ControlProgressResponse } from '../data/getOrganizationControlProgress';
import { PoliciesTable } from './PoliciesTable';
import { RequirementsTable } from './RequirementsTable';
import { SingleControlSkeleton } from './SingleControlSkeleton';
import { TasksTable } from './TasksTable';

interface SingleControlProps {
  control: Control & {
    requirementsMapped: (RequirementMap & {
      frameworkInstance: FrameworkInstance & {
        framework: FrameworkEditorFramework;
      };
      requirement: FrameworkEditorRequirement;
    })[];
  };
  controlProgress: ControlProgressResponse;
  relatedPolicies: Policy[];
  relatedTasks: Task[];
}

export function SingleControl({
  control,
  controlProgress,
  relatedPolicies,
  relatedTasks,
}: SingleControlProps) {
  const params = useParams<{ orgId: string; controlId: string }>();
  const orgIdFromParams = params.orgId;
  const t = useTranslations('controls');

  if (!control || !controlProgress) {
    return <SingleControlSkeleton />;
  }

  return (
    <Tabs defaultValue="policies">
      <Stack gap="lg">
        <TabsList variant="underline">
          <TabsTrigger value="policies">{t('tabPolicies', { count: relatedPolicies.length })}</TabsTrigger>
          <TabsTrigger value="tasks">{t('tabTasks', { count: relatedTasks.length })}</TabsTrigger>
          <TabsTrigger value="requirements">
            {t('tabRequirements', { count: control.requirementsMapped.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <PoliciesTable policies={relatedPolicies} orgId={orgIdFromParams} />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTable tasks={relatedTasks} orgId={orgIdFromParams} />
        </TabsContent>

        <TabsContent value="requirements">
          <RequirementsTable requirements={control.requirementsMapped} orgId={orgIdFromParams} />
        </TabsContent>
      </Stack>
    </Tabs>
  );
}
