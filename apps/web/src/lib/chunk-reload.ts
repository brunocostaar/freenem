/**
 * Arquivos JS desatualizados: após um deploy (ou quando o Vite reotimiza dependências em dev),
 * a aba aberta pede chunks com hash antigo e o import dinâmico falha. Nesses casos recarregamos a
 * página uma vez (com trava para não entrar em laço se o erro persistir).
 */
const KEY = 'freenem:chunk-reload-at';
const COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(
    message,
  );
}

/** Recarrega se for erro de chunk e não recarregou há pouco. Retorna true se vai recarregar. */
export function reloadOnChunkError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim (no pior caso, uma vez por erro)
  }
  window.location.reload();
  return true;
}

/** Falhas de preload do Vite (build de produção) disparam este evento antes do erro. */
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnChunkError((event as Event & { payload?: unknown }).payload)) event.preventDefault();
});
