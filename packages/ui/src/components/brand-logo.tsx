import { ListCheck } from 'lucide-react';
import { cn } from '../utils/cn';

export function BrandLogo({
  showText = true,
  iconSize = 24,
  className,
}: {
  showText?: boolean;
  iconSize?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ListCheck size={iconSize} className="shrink-0" />
      {showText && <span className="text-lg font-semibold tracking-tight">OpenComp</span>}
    </div>
  );
}
