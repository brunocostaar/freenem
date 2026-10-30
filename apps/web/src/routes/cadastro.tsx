import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/layout/AuthForm';

export const Route = createFileRoute('/cadastro')({
  head: () => ({ meta: [{ title: 'Criar conta · freenem' }] }),
  component: () => <AuthForm mode="signup" />,
});
