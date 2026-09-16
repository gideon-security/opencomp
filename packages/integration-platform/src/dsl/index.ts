// DSL Engine — Declarative check and sync definitions
export { evaluateCondition, evaluateOperator, resolvePath } from './expression-evaluator';
export {
  interpretDeclarativeCheck,
  interpretDeclarativeDeviceSync,
  interpretDeclarativeSync,
} from './interpreter';
export { interpolate, interpolateTemplate } from './template-engine';
export { validateIntegrationDefinition, type ValidationResult } from './validate';

// Types
export type {
  AggregateStep,
  BranchStep,
  CheckDefinition,
  CodeStep,
  ComparisonOperator,
  Condition,
  DSLStep,
  DynamicIntegrationDefinition,
  EmitStep,
  FetchPagesStep,
  FetchStep,
  FieldCondition,
  ForEachStep,
  LogicalCondition,
  PaginationConfig,
  ResultTemplate,
  SyncDefinition,
  SyncDevice,
  SyncEmployee,
} from './types';

// Zod schemas
export {
  CheckDefinitionSchema,
  CodeStepSchema,
  ConditionSchema,
  DSLStepSchema,
  DynamicIntegrationDefinitionSchema,
  PaginationConfigSchema,
  ResultTemplateSchema,
  SyncDefinitionSchema,
  SyncDeviceSchema,
  SyncEmployeeSchema,
} from './types';
