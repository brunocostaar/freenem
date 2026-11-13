import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthForm } from '@/components/layout/AuthForm';

export const Route = createFileRoute('/entrar')({
  head: () => ({ meta: [{ title: 'Entrar · freenem' }] }),
  // `error` chega quando o login com Google/Apple falha (errorCallbackURL do Better Auth)
  validateSearch: z.object({ redirect: z.string().optional(), error: z.string().optional() }),
  component: function Entrar() {
    const { redirect, error } = Route.useSearch();
    return <AuthForm mode="signin" redirect={redirect} socialError={error} />;
  },
});
