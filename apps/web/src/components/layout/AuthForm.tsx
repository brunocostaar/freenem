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

const SOCIAL_ERRORS: Record<string, string> = {
  access_denied: 'Login cancelado.',
  account_not_linked:
    'Já existe uma conta com este e-mail. Entre com e-mail e senha e tente de novo.',
};

type SocialProvider = 'google';

export function AuthForm({
  mode,
  redirect,
  socialError,
}: {
  mode: 'signin' | 'signup';
  redirect?: string;
  socialError?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: config } = useQuery(configQuery);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    socialError
      ? (SOCIAL_ERRORS[socialError] ?? 'Não foi possível entrar com essa conta. Tente novamente.')
      : null,
  );
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';
  const target = redirect && redirect.startsWith('/') ? redirect : '/inicio';

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

  async function social(provider: SocialProvider) {
    setError(null);
    setSocialLoading(provider);
    const res = await authClient.signIn.social({
      provider,
      callbackURL: window.location.origin + target,
      errorCallbackURL: `${window.location.origin}/entrar`,
    });
    // em caso de sucesso o navegador já foi redirecionado ao Google
    if (res.error) {
      setError('Não foi possível iniciar o login. Tente novamente.');
      setSocialLoading(null);
    }
  }

  const socialProviders: SocialProvider[] = config?.features.googleLogin ? ['google'] : [];

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

          {socialProviders.length > 0 && (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-muted">
                <span className="h-0.5 flex-1 bg-line-soft" />
                ou
                <span className="h-0.5 flex-1 bg-line-soft" />
              </div>
              <div className="space-y-2.5">
                {socialProviders.map((p) => (
                  <Button
                    key={p}
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    loading={socialLoading === p}
                    disabled={socialLoading !== null && socialLoading !== p}
                    onClick={() => void social(p)}
                  >
                    <GoogleIcon />
                    Continuar com Google
                  </Button>
                ))}
              </div>
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

/** Logo em `currentColor` (o projeto só usa cores por token, e assim funciona no modo escuro). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.38c-.24 1.38-1.6 4.04-5.38 4.04-3.24 0-5.88-2.68-5.88-5.98S8.76 6.16 12 6.16c1.84 0 3.08.78 3.78 1.46l2.58-2.48C16.7 3.6 14.56 2.6 12 2.6 6.82 2.6 2.62 6.8 2.62 12s4.2 9.4 9.38 9.4c5.42 0 9-3.8 9-9.16 0-.62-.06-1.08-.15-1.54z" />
    </svg>
  );
}
