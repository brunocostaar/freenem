import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';
import { ZoomableImage } from '@/components/question/ZoomableImage';

// Mapas de componentes estáveis (fora do render): um objeto novo a cada render faria o
// react-markdown remontar as imagens, zerando o estado de carregamento (imagens piscando).
const ZOOMABLE: Components = {
  img: ({ src, alt }) => (
    <ZoomableImage src={typeof src === 'string' ? src : undefined} alt={alt} />
  ),
};
const PLAIN: Components = {
  img: ({ src, alt }) => (
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
      className="mx-auto max-h-64 w-auto max-w-full rounded-lg border-2 border-line bg-white object-contain"
    />
  ),
};

/**
 * Implementação (pesada: react-markdown + KaTeX). Importe `RichText`, que a carrega sob demanda.
 *
 * Renderiza Markdown + LaTeX (KaTeX). Use `$...$` para fórmulas inline e `$$...$$` em bloco.
 * Usado em enunciados, alternativas e resoluções de questões. Imagens carregam sob demanda
 * e ampliam ao toque.
 */
export default memo(function RichTextImpl({
  children,
  className,
  zoomable = true,
}: {
  children: string;
  className?: string;
  /** false = imagens sem botão de zoom (para uso dentro de controles interativos, ex.: alternativas) */
  zoomable?: boolean;
}) {
  return (
    <div
      className={cn(
        'prose-richtext space-y-3 leading-relaxed [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border-2 [&_img]:border-line [&_table]:border-collapse [&_td]:border [&_td]:border-line-soft [&_td]:px-2 [&_th]:border [&_th]:border-line-soft [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line-soft [&_blockquote]:pl-4 [&_blockquote]:text-muted',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        components={zoomable ? ZOOMABLE : PLAIN}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
