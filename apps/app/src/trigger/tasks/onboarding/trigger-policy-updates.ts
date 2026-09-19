import { TAILORED_POLICY_CHANGELOG } from '@/lib/policy-changelog';
import type { FrameworkEditorFramework } from '@db';
import { db } from '@db/server';
import { logger, metadata, tasks } from '@gideon-defender/trigger-local';
import type { ContextItem } from './onboard-organization-helpers';
import { updatePolicy } from './update-policy';

export type TriggerPolicyUpdatesParams = {
  organizationId: string;
  questionsAndAnswers: ContextItem[];
  frameworks: FrameworkEditorFramework[];
};

const POLICY_UPDATE_IDEMPOTENCY_TTL = '24h';

export async function triggerPolicyUpdates({
  organizationId,
  questionsAndAnswers,
  frameworks,
}: TriggerPolicyUpdatesParams): Promise<void> {
  const policies = await db.policy.findMany({ where: { organizationId } });
  if (policies.length === 0) return;

  const versions = await db.policyVersion.findMany({
    where: { policyId: { in: policies.map((policy) => policy.id) } },
    select: { policyId: true, changelog: true },
  });
  const tailoredIds = new Set(
    versions
      .filter((version) => version.changelog === TAILORED_POLICY_CHANGELOG)
      .map((version) => version.policyId),
  );
  const pendingPolicies = policies.filter((policy) => !tailoredIds.has(policy.id));

  metadata.set('policiesTotal', policies.length);
  metadata.set('policiesCompleted', policies.length - pendingPolicies.length);
  metadata.set('policiesRemaining', pendingPolicies.length);
  metadata.set(
    'policiesInfo',
    policies.map((policy) => ({ id: policy.id, name: policy.name })),
  );
  policies.forEach((policy) => {
    metadata.set(`policy_${policy.id}_status`, tailoredIds.has(policy.id) ? 'completed' : 'queued');
  });

  if (pendingPolicies.length === 0) {
    logger.info(`All ${policies.length} policies already tailored — skipping`, {
      organizationId,
    });
    return;
  }

  const contextHub = questionsAndAnswers
    .map((context) => `${context.question}\n${context.answer}`)
    .join('\n');

  for (const policy of pendingPolicies) {
    await tasks.trigger<typeof updatePolicy>(
      'update-policy',
      {
        organizationId,
        policyId: policy.id,
        contextHub,
        frameworks,
      },
      {
        concurrencyKey: organizationId,
        idempotencyKey: `onboarding-policy-update:${organizationId}:${policy.id}`,
        idempotencyKeyTTL: POLICY_UPDATE_IDEMPOTENCY_TTL,
      },
    );
  }
}
