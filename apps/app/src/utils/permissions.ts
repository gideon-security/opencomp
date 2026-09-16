/**
 * Re-export all permissions from the shared @gideon-defender/auth package.
 * This ensures a single source of truth for role definitions.
 */
export {
  PRIVILEGED_ROLES,
  RESTRICTED_ROLES,
  ROLE_HIERARCHY,
  ac,
  admin,
  allRoles,
  auditor,
  contractor,
  employee,
  owner,
  type RoleName,
} from '@gideon-defender/auth';
