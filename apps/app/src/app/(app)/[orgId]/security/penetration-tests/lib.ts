import { type PentestReportStatus, type PentestRun } from '@/lib/security/penetration-tests-client';

export const isReportInProgress = (status: PentestReportStatus): boolean => {
  return status === 'provisioning' || status === 'cloning' || status === 'running';
};

export const sortReportsByUpdatedAtDesc = (reports: PentestRun[]): PentestRun[] => {
  return [...reports].sort((left, right) => {
    const rightTime = new Date(right.updatedAt).getTime();
    const leftTime = new Date(left.updatedAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return 0;
    }
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });
};

export const formatReportDate = (value: string): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};
