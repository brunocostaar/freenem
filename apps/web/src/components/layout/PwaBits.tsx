import { Download, WifiOff } from 'lucide-react';
import { useInstallPrompt, useOnline } from '@/lib/pwa';
import { buttonClasses } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Botão "Instalar app": só aparece quando o navegador oferece a instalação. */
export function InstallAppButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return compact ? (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Instalar app"
      title="Instalar app"
      className={cn(
        'grid size-9 place-items-center rounded-xl border-2 border-line bg-surface shadow-hard-sm',
        className,
      )}
    >
      <Download className="size-4" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void install()}
      className={cn(buttonClasses('secondary', 'sm'), className)}
    >
      <Download className="size-4" aria-hidden /> Instalar app
    </button>
  );
}

/** Faixa fixa no topo quando o navegador está sem conexão. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b-2 border-line bg-highlight px-4 py-2 text-center text-sm font-semibold text-[#14213d]"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Você está offline. Algumas funções ficam indisponíveis até a conexão voltar.
    </div>
  );
}
