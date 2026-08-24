import type { FrameworkEditorControlTemplate } from '@/db';
// Import shared types from the common location

// Basic item with id and name
export interface ItemWithName {
  id: string;
  name: string;
}

// Define a more specific type for requirement items that can include framework info
export interface RequirementItemWithFramework extends ItemWithName {
  framework?: {
    name: string;
  };
}

export interface RequirementGridItem extends ItemWithName {
  frameworkName?: string;
  sublabel?: string;
}

export interface FrameworkEditorControlTemplateWithRelatedData extends FrameworkEditorControlTemplate {
  policyTemplates?: ItemWithName[];
  requirements?: RequirementItemWithFramework[];
  taskTemplates?: ItemWithName[];
}

export type ControlsPageGridData = {
  id: string;
  name: string | null;
  description: string | null;
  controlFamily: string | null;
  policyTemplates: ItemWithName[];
  requirements: RequirementGridItem[];
  taskTemplates: ItemWithName[];
  documentTypes: string[];
  policyTemplatesLength: number;
  requirementsLength: number;
  taskTemplatesLength: number;
  documentTypesLength: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};
