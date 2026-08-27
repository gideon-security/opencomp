import type { AuthContext } from '../auth/types';

export function authEnvelope(authContext: AuthContext) {
  return {
    authType: authContext.authType,
    ...(authContext.userId &&
      authContext.userEmail && {
        authenticatedUser: {
          id: authContext.userId,
          email: authContext.userEmail,
        },
      }),
  } as const;
}

export function withAuthContext<T extends object>(
  data: T,
  authContext: AuthContext,
): T & ReturnType<typeof authEnvelope> {
  return {
    ...data,
    ...authEnvelope(authContext),
  };
}
