import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

/**
 * Link interno a partir de um href textual ("/questoes?topicId=...").
 * O contrato da API entrega as ações do plano como href; aqui viram navegação do roteador.
 */
export function AppLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [path = '/', query] = href.split('?');
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
  return (
    <Link to={path as never} search={search as never} className={className}>
      {children}
    </Link>
  );
}

/** Treino de um tópico no banco de questões. */
export function practiceHref(topicId: string) {
  return `/questoes?topicId=${topicId}`;
}
