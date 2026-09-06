'use client';

import type {
  TaskItemEntityType,
  TaskItemFilters,
  TaskItemSortBy,
  TaskItemSortOrder,
} from '@/hooks/use-task-items';
import { TaskSmartForm } from './TaskSmartForm';

interface TaskItemFormProps {
  entityId: string;
  entityType: TaskItemEntityType;
  page?: number;
  limit?: number;
  sortBy?: TaskItemSortBy;
  sortOrder?: TaskItemSortOrder;
  filters?: TaskItemFilters;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaskItemForm(props: TaskItemFormProps) {
  return <TaskSmartForm {...props} />;
}
