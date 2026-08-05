import {
  vectorIndex as pgVectorIndex,
  deleteVectorsByOrganization,
  findVectorsByFilter,
  listVectorsByOrganization,
  listVectorsByOrganizationAndType,
  countVectorsByOrganization,
} from '@gideon-defender/db';

export const vectorIndex = pgVectorIndex;
export {
  deleteVectorsByOrganization,
  findVectorsByFilter,
  listVectorsByOrganization,
  listVectorsByOrganizationAndType,
  countVectorsByOrganization,
};
