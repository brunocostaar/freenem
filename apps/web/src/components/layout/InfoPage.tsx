import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

/** Página de texto (sobre, privacidade): coluna de leitura com títulos de seção. */
export function InfoPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl">
      <PageHeader title={title} description={description} />
      <div className="space-y-8 text-base leading-relaxed">{children}</div>
    </article>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}
