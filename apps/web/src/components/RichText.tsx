import { lazy, Suspense } from 'react';
import { cn } from '@/lib/cn';

// react-markdown + KaTeX pesam ~120 kB gzip: ficam fora do bundle inicial (só carregam
// quando algum texto rico é renderizado).
const RichTextImpl = lazy(() => import('./RichTextImpl'));

interface RichTextProps {
  children: string;
  className?: string;
  /** false = imagens sem botão de zoom (para uso dentro de controles interativos, ex.: alternativas) */
  zoomable?: boolean;
}

/**
 * Markdown + LaTeX (KaTeX) para enunciados, alternativas e resoluções. Enquanto o renderizador
 * carrega, mostra o texto puro (sem salto de layout relevante).
 */
export function RichText(props: RichTextProps) {
  return (
    <Suspense
      fallback={
        <div className={cn('space-y-3 leading-relaxed whitespace-pre-wrap', props.className)}>
          {props.children.replace(/!\[[^\]]*\]\([^)]*\)/g, '')}
        </div>
      }
    >
      <RichTextImpl {...props} />
    </Suspense>
  );
}
