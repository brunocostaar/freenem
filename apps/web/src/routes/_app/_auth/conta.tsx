import { useState, type FormEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { DELETE_ACCOUNT_CONFIRMATION } from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardTitle, Input, Skeleton, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { meQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/_auth/conta')({
  head: () => ({ meta: [{ title: 'Minha conta · freenem' }] }),
  component: Conta,
});

function Conta() {
  const me = useQuery(meQuery);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Minha conta" description="Seus dados, senha e exclusão da conta." />
      {me.isPending || !me.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-6">
          <ProfileCard name={me.data.name} email={me.data.email} />
          <PasswordCard />
          <DeleteCard />
        </div>
      )}
    </div>
  );
}

function ProfileCard({ name: initial, email }: { name: string; email: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await authClient.updateUser({ name: trimmed });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message ?? 'Não foi possível salvar o nome.');
      return;
    }
    toast.success('Nome atualizado.');
    await qc.invalidateQueries({ queryKey: ['me'] });
  }

  return (
    <Card>
      <CardTitle className="mb-4">Perfil</CardTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input
          label="E-mail"
          value={email}
          readOnly
          disabled
          hint="O e-mail não pode ser alterado."
        />
        <Button type="submit" loading={busy} disabled={!name.trim() || name.trim() === initial}>
          Salvar nome
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.code === 'INVALID_PASSWORD'
          ? 'Senha atual incorreta.'
          : (res.error.message ?? 'Não foi possível alterar a senha.'),
      );
      return;
    }
    setCurrent('');
    setNext('');
    toast.success('Senha alterada.');
  }

  return (
    <Card>
      <CardTitle className="mb-4">Alterar senha</CardTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="Mínimo de 8 caracteres."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={error ?? undefined}
          required
        />
        <Button type="submit" loading={busy} disabled={!current || next.length < 8}>
          Alterar senha
        </Button>
      </form>
    </Card>
  );
}

function DeleteCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const del = useMutation({
    mutationFn: () =>
      api('/api/v1/me', { method: 'DELETE', body: { confirmation: DELETE_ACCOUNT_CONFIRMATION } }),
    onSuccess: async () => {
      await navigate({ to: '/' });
      qc.clear();
      toast.success('Sua conta foi excluída.');
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir a conta.'),
  });

  return (
    <Card className="border-danger">
      <CardTitle className="mb-2 text-danger">Excluir conta</CardTitle>
      <p className="mb-4 text-sm text-muted">
        Apaga permanentemente sua conta, respostas, simulados, plano de estudos e redações. Não há
        como desfazer.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text === DELETE_ACCOUNT_CONFIRMATION) del.mutate();
        }}
        className="space-y-4"
      >
        <Input
          label={`Digite ${DELETE_ACCOUNT_CONFIRMATION} para confirmar`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="danger"
          loading={del.isPending}
          disabled={text !== DELETE_ACCOUNT_CONFIRMATION}
        >
          <Trash2 className="size-4" aria-hidden /> Excluir minha conta
        </Button>
      </form>
    </Card>
  );
}
