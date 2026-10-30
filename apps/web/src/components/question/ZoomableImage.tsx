import { useState, type ImgHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Imagem de questão: carregamento preguiçoso e zoom em tela cheia ao tocar/clicar.
 * Usada pelo `RichText` (enunciados, alternativas e resoluções).
 */
export function ZoomableImage({ src, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <span className="inline-block rounded-lg border-2 border-dashed border-line-soft px-3 py-2 text-sm text-muted">
        Imagem indisponível
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative block max-w-full cursor-zoom-in rounded-lg',
          // reserva espaço até a imagem carregar (evita salto de layout)
          !loaded && 'min-h-40 w-full animate-pulse bg-surface-2',
        )}
        aria-label={`Ampliar imagem${alt ? `: ${alt}` : ''}`}
      >
        <img
          {...rest}
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="mx-auto max-h-96 w-auto max-w-full rounded-lg border-2 border-line bg-white object-contain"
        />
      </button>
      {open &&
        createPortal(
          <Dialog open onClose={() => setOpen(false)} title="Imagem" className="max-w-5xl">
            <img
              src={src}
              alt={alt ?? ''}
              className="mx-auto max-h-[75dvh] w-auto max-w-full rounded-lg bg-white object-contain"
            />
          </Dialog>,
          document.body,
        )}
    </>
  );
}
