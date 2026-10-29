import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/layout/AuthForm';

export const Route = createFileRoute('/cadastro')({
  component: () => <AuthForm mode="signup" />,
});
