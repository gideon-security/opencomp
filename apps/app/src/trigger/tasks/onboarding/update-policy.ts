import { logger, metadata, queue, schemaTask } from '@gideon-defender/trigger-local';
import { runOrDeferOnboardingWork } from '../../lib/onboarding-deferred';
import { z } from 'zod';
import { processPolicyUpdate } from './update-policies-helpers';

export const updatePolicyQueue = queue({ name: 'update-policy', concurrencyLimit: 15 });

export const updatePolicy = schemaTask({
  id: 'update-policy',
  maxDuration: 600, // 10 minutes.
  queue: updatePolicyQueue,
  retry: {
    maxAttempts: 5,
  },
  schema: z.object({
    organizationId: z.string(),
    policyId: z.string(),
    contextHub: z.string(),
    frameworks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        version: z.string(),
        description: z.string(),
        visible: z.boolean(),
        organizationId: z.string().nullable().default(null),
        // FRAME-20: frameworks now carry a family pointer; keep this payload
        // schema in step with the FrameworkEditorFramework shape it's typed as.
        familyId: z.string().nullable().default(null),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
      }),
    ),
    memberId: z.string().optional(),
  }),
  run: async (params) => {
    return runOrDeferOnboardingWork({
      organizationId: params.organizationId,
      taskId: 'update-policy',
      dedupeKey: `policy-update:${params.policyId}`,
      payload: params,
      run: async () => {
        logger.info(`Starting policy update for policy ${params.policyId}`);

        // Update parent metadata to mark this policy as processing
        // Use individual metadata keys since we can't read the parent object
        if (metadata.parent) {
          metadata.parent.set(`policy_${params.policyId}_status`, 'processing');
        }

        const result = await processPolicyUpdate(params);


      // Update parent metadata to track progress
      if (metadata.parent) {
        // Update this policy's status to completed using individual key
        metadata.parent.set(`policy_${params.policyId}_status`, 'completed');

        // Increment completed count
        metadata.parent.increment('policiesCompleted', 1);

        // Decrement remaining count
        metadata.parent.increment('policiesRemaining', -1);
      }

        logger.info(`Successfully updated policy ${params.policyId}`);
        return result;
      },
    });
  },
});
