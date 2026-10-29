import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthForm } from '@/components/layout/AuthForm';

export const Route = createFileRoute('/entrar')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: function Entrar() {
    const { redirect } = Route.useSearch();
    return <AuthForm mode="signin" redirect={redirect} />;
  },
});
