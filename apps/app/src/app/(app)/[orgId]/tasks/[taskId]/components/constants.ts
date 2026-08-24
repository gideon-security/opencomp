import { TaskFrequency, TaskStatus } from '@db';

// Define possible statuses based on the Prisma schema
export const taskStatuses: TaskStatus[] = Object.values(TaskStatus);

// Define possible frequencies
export const taskFrequencies: TaskFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];
