/**
 * Integration definitions for the integrations directory
 *
 * SCALING STRATEGY:
 * - Integrations organized by category in separate files
 * - Each category file stays < 500 lines for LLM-friendliness
 * - Import and merge here for single source of truth
 * - Easy to add new integrations category-by-category
 */

export interface Integration {
  id: string;
  name: string;
  domain: string;
  description: string;
  category: IntegrationCategory;
  examplePrompts: string[];
  setupHint?: string;
  popular?: boolean;
}

export type IntegrationCategory =
  | 'Identity & Access'
  | 'HR & People'
  | 'Cloud Security'
  | 'Development'
  | 'Communication'
  | 'Monitoring'
  | 'Infrastructure';

export const CATEGORIES: IntegrationCategory[] = [
  'Identity & Access',
  'HR & People',
  'Cloud Security',
  'Development',
  'Communication',
  'Monitoring',
  'Infrastructure',
];
