// Changelog markers that distinguish org-setup seed policy versions from
// AI-tailored versions. Shared by the seed writer (initialize-organization),
// the tailoring writer (update-policies-helpers), and the resume check
// (onboard-organization-helpers) so the three can never drift apart.
export const SEED_POLICY_CHANGELOG = 'Initial version from template' as const;
export const TAILORED_POLICY_CHANGELOG = 'Regenerated policy content' as const;
