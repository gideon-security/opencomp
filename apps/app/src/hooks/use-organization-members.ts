import { Member, User } from '@db';
import { createSimpleListHook } from './create-entity-hooks';

interface MemberData extends Member {
  user: User;
}

interface UseOrganizationMembersReturn {
  members: MemberData[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  mutate: () => Promise<unknown>;
}

interface UseOrganizationMembersOptions {
  initialData?: MemberData[];
}

interface PeopleResponse {
  data: MemberData[];
}

const usePeopleList = createSimpleListHook<MemberData, PeopleResponse>('/v1/people');

export function useOrganizationMembers({
  initialData,
}: UseOrganizationMembersOptions = {}): UseOrganizationMembersReturn {
  const { data, error, isLoading, mutate } = usePeopleList({ initialData });
  return {
    members: data,
    isLoading,
    isError: !!error,
    error: error as Error | undefined,
    mutate,
  };
}

/**
 * Like useOrganizationMembers but returns only active organization members.
 * Use this for assignee dropdowns and anywhere users should select a member.
 */
export function useAssignableMembers(
  options: UseOrganizationMembersOptions = {},
): UseOrganizationMembersReturn {
  return useOrganizationMembers(options);
}
