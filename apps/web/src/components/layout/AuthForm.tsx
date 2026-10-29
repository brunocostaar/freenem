import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { configQuery } from '@/lib/queries';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  USER_ALREADY_EXISTS: 'Este e-mail já está cadastrado.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Este e-mail já está cadastrado.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de entrar. Enviamos um link para você.',
  PASSWORD_TOO_SHORT: 'A senha precisa ter ao menos 8 caracteres.',
  INVALID_EMAIL: 'E-mail inválido.',
};

export function AuthForm({ mode, redirect }: { mode: 'signin' | 'signup'; redirect?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: config } = useQuery(configQuery);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';
  const target = redirect && redirect.startsWith('/') ? redirect : '/questoes';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = isSignup
        ? await authClient.signUp.email({ name: name.trim(), email, password })
        : await authClient.signIn.email({ email, password });
      if (res.error) {
        setError(
          (res.error.code && ERRORS[res.error.code]) ||
            res.error.message ||
            'Não foi possível concluir. Tente novamente.',
        );
        return;
      }
      await qc.invalidateQueries({ queryKey: ['me'] });
      if (isSignup && config?.features.emailVerification) {
        setNotice('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
        return;
      }
      router.history.push(target);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin + target,
    });
  }

  return (
    <div className="dotgrid grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <Card>
          <h1 className="text-3xl">
            <span className="marker">{isSignup ? 'Crie sua conta' : 'Bem-vindo de volta'}</span>
          </h1>
          <p className="mt-2 text-muted">
            {isSignup ? 'Grátis, sem pegadinha e sem cartão.' : 'Entre para continuar estudando.'}
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {isSignup && (
              <Input
                label="Nome"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={8}
              hint={isSignup ? 'Mínimo de 8 caracteres.' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p
                role="alert"
                className="rounded-lg border-2 border-danger px-3 py-2 text-sm font-medium text-danger"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-lg border-2 border-success px-3 py-2 text-sm font-medium text-success"
              >
                {notice}
              </p>
            )}
            <Button type="submit" size="lg" loading={loading}>
              {isSignup ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          {config?.features.googleLogin && (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-muted">
                <span className="h-0.5 flex-1 bg-line-soft" />
                ou
                <span className="h-0.5 flex-1 bg-line-soft" />
              </div>
              <Button variant="secondary" size="lg" className="w-full" onClick={google}>
                Continuar com Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm">
            {isSignup ? (
              <>
                Já tem conta?{' '}
                <Link to="/entrar" className="font-bold underline">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Novo por aqui?{' '}
                <Link to="/cadastro" className="font-bold underline">
                  Criar conta
                </Link>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
