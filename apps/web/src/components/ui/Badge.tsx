import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'danger' | 'highlight';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink',
  primary: 'bg-primary text-primary-ink',
  accent: 'bg-accent text-accent-ink',
  success: 'bg-success text-bg',
  danger: 'bg-danger text-danger-ink',
  highlight: 'bg-highlight text-[#14213d]',
};

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
