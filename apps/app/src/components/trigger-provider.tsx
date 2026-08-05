'use client';

import { TriggerAuthContext } from '@gideon-defender/trigger-react';

export function TriggerProvider({
  accessToken,
  children,
}: {
  accessToken: string;
  children: React.ReactNode;
}) {
  return (
    <TriggerAuthContext.Provider
      value={{
        accessToken,
      }}
    >
      {children}
    </TriggerAuthContext.Provider>
  );
}
