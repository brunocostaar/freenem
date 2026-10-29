import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'dotgrid flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-soft px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="grid size-14 place-items-center rounded-2xl border-2 border-line bg-highlight text-[#14213d] shadow-hard-sm [&_svg]:size-7">
          {icon}
        </div>
      )}
      <h3 className="text-xl">{title}</h3>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
