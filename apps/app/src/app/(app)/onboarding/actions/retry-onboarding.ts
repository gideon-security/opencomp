'use server';

import { authActionClientWithoutOrg } from '@/actions/safe-action';
import { onboardOrganization as onboardOrganizationTask } from '@/trigger/tasks/onboarding/onboard-organization';
import { auth } from '@/utils/auth';
import { db } from '@db/server';
import { tasks } from '@gideon-defender/trigger-local';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';

const retryOnboardingSchema = z.object({
  organizationId: z.string(),
});

/**
 * "Retry setup" from the onboarding tracker. The tracker's button used to
 * navigate to `/onboarding/[orgId]?retry=1`, but nothing ever handled that
 * param — and handling it in the page is impossible anyway: minting the new
 * run's tracking cookie requires `cookies().set()`, which throws outside a
 * Server Action / Route Handler ("Cookies can only be modified in a Server
 * Action or Route Handler").
 *
 * Skipped when the onboarding row already reports completion: retrying a
 * healthy org would duplicate all AI-generated content.
 */
export const retryOnboarding = authActionClientWithoutOrg
  .inputSchema(retryOnboardingSchema)
  .metadata({
    name: 'retry-onboarding',
    track: {
      event: 'retry-onboarding',
      channel: 'server',
    },
  })
  .action(async ({ parsedInput, ctx }) => {
    try {
      const member = await db.member.findFirst({
        where: {
          userId: ctx.user!.id,
          organizationId: parsedInput.organizationId,
          deactivated: false,
        },
      });

      if (!member) {
        return {
          success: false,
          error: 'Access denied',
        };
      }

      // Keep the session on the retried org (mirrors completeOnboarding).
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: {
          organizationId: parsedInput.organizationId,
        },
      });

      // Ensure the row exists (it may be missing if minimal creation failed
      // before writing it) so the tracker has a run to follow.
      const onboardingRow = await db.onboarding.upsert({
        where: { organizationId: parsedInput.organizationId },
        create: {
          organizationId: parsedInput.organizationId,
          triggerJobCompleted: false,
        },
        update: {},
        select: { triggerJobCompleted: true },
      });

      if (onboardingRow.triggerJobCompleted) {
        return {
          success: true,
          redirectUrl: `/${parsedInput.organizationId}/`,
        };
      }

      const handle = await tasks.trigger<typeof onboardOrganizationTask>('onboard-organization', {
        organizationId: parsedInput.organizationId,
      });

      await db.onboarding.update({
        where: { organizationId: parsedInput.organizationId },
        data: { triggerJobId: handle.id, triggerJobCompleted: false },
      });

      (await cookies()).set('publicAccessToken', handle.publicAccessToken);

      return {
        success: true,
        triggerJobId: handle.id,
        redirectUrl: `/${parsedInput.organizationId}/`,
      };
    } catch (error) {
      console.error('Error retrying onboarding:', error);

      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Failed to retry onboarding',
      };
    }
  });
