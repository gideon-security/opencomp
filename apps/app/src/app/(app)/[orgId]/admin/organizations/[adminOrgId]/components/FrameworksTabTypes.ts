export interface FrameworkDetails {
  id: string;
  name: string;
  description: string | null;
  version: string;
  visible: boolean;
}

export interface ActiveFramework {
  id: string;
  framework: FrameworkDetails | null;
  customFramework: FrameworkDetails | null;
}

export type PendingAction =
  | { type: 'add'; framework: FrameworkDetails }
  | { type: 'delete'; framework: ActiveFramework };

export function getActiveFrameworkDetails(framework: ActiveFramework) {
  return framework.framework ?? framework.customFramework;
}
