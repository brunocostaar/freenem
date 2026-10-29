import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** sombra dura estilo adesivo */
  raised?: boolean;
}

export function Card({ className, raised = true, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-line bg-surface p-5 sm:p-6',
        raised && 'shadow-hard',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-xl', className)} {...rest} />;
}
