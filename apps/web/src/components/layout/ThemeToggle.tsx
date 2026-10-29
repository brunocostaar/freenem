import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={cn(
        'grid size-10 place-items-center rounded-xl border-2 border-line bg-surface shadow-hard-sm transition-transform hover:-translate-y-0.5',
        className,
      )}
    >
      {resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
