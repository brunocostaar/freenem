import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';

/** Guarda de rotas: exige sessão, senão redireciona para /entrar. */
export const Route = createFileRoute('/_app/_auth')({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();
    if (!data) throw redirect({ to: '/entrar', search: { redirect: location.href } });
  },
  component: Outlet,
});
