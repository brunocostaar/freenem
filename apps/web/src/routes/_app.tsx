import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';

/** Layout com sidebar (desktop) / bottom nav (mobile). Rotas públicas e protegidas moram aqui. */
export const Route = createFileRoute('/_app')({ component: AppShell });
