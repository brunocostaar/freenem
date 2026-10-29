import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/cn';

/**
 * Renderiza Markdown + LaTeX (KaTeX). Use `$...$` para fórmulas inline e `$$...$$` em bloco.
 * Usado em enunciados, alternativas e resoluções de questões.
 */
export function RichText({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose-richtext space-y-3 leading-relaxed [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border-2 [&_img]:border-line [&_table]:border-collapse [&_td]:border [&_td]:border-line-soft [&_td]:px-2 [&_th]:border [&_th]:border-line-soft [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line-soft [&_blockquote]:pl-4 [&_blockquote]:text-muted',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
