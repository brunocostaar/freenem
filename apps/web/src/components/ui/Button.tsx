import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-ink border-2 border-line shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none',
  accent:
    'bg-accent text-accent-ink border-2 border-line shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none',
  secondary:
    'bg-surface text-ink border-2 border-line shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none',
  ghost: 'bg-transparent text-ink border-2 border-transparent hover:bg-surface-2',
  danger:
    'bg-danger text-white border-2 border-line shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-14 px-7 text-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/** Classes de botão reutilizáveis para <Link>/<a> estilizados como botão. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
