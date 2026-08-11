import { BrandLogo } from '@gideon-defender/ui/brand-logo';
import { cn } from '@gideon-defender/ui/cn';
import Link from 'next/link';

export function SidebarLogo({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div className={cn('flex items-center transition-all duration-300')}>
      <Link href="/" suppressHydrationWarning className="flex items-center gap-2">
        <BrandLogo showText={!isCollapsed} iconSize={40} className="transition-all duration-300" />
      </Link>
    </div>
  );
}
