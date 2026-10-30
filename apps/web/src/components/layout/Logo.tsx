import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight',
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-lg border-2 border-line bg-highlight text-lg text-[#14213d] shadow-hard-sm">
        f
      </span>
      <span>
        free<span className="text-accent-strong">nem</span>
      </span>
    </Link>
  );
}
