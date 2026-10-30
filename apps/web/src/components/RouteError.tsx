import { useEffect } from 'react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { isChunkLoadError, reloadOnChunkError } from '@/lib/chunk-reload';

/** Erro de rota (padrão do roteador): recarrega sozinho se for chunk desatualizado. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const stale = isChunkLoadError(error);
  useEffect(() => {
    reloadOnChunkError(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={<AlertTriangle />}
        title={stale ? 'Uma nova versão do freenem está disponível' : 'Algo deu errado'}
        description={
          stale
            ? 'Recarregue a página para continuar de onde parou.'
            : 'Tente de novo. Se o problema continuar, recarregue a página.'
        }
        action={
          <Button onClick={() => (stale ? window.location.reload() : reset())}>
            <RefreshCw className="size-4" aria-hidden />
            {stale ? 'Recarregar' : 'Tentar de novo'}
          </Button>
        }
      />
    </div>
  );
}
