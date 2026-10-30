import { Link } from '@tanstack/react-router';
import { GITHUB_URL } from '@/lib/site';
import { cn } from '@/lib/cn';

/** Links institucionais (landing e app shell). */
export function SiteFooterLinks({ className }: { className?: string }) {
  const link = 'underline-offset-4 hover:text-ink hover:underline';
  return (
    <nav aria-label="Institucional" className={cn('flex flex-wrap gap-x-5 gap-y-1', className)}>
      <Link to="/sobre" className={link}>
        Sobre
      </Link>
      <Link to="/apoiar" className={link}>
        Apoiar
      </Link>
      <Link to="/privacidade" className={link}>
        Privacidade
      </Link>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className={link}>
        GitHub
      </a>
    </nav>
  );
}

/** Rodapé discreto no fim das páginas do app. */
export function AppFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-24 text-sm text-muted sm:px-6 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line-soft pt-4">
        <p>freenem · gratuito e open-source</p>
        <SiteFooterLinks />
      </div>
    </footer>
  );
}
