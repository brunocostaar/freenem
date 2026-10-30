# freenem

Plataforma de estudos **gratuita e open-source** para o ENEM e vestibulares: banco de questões, simulados com nota TRI, correção de redação com IA e plano de estudos personalizado. Uma alternativa livre a serviços pagos como Estuda.com e Evolucional.

> Status: fundação (fase 1). Banco de questões, simulados, redação e plano de estudos chegam nas próximas fases.

## Stack

- **Monorepo** pnpm workspaces
- **`apps/web`**: React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Better Auth (cliente)
- **`apps/api`**: Fastify 5, Drizzle ORM, Postgres, Zod (`fastify-type-provider-zod`), Better Auth
- **`packages/shared`**: schemas Zod e tipos do contrato da API (usados por web e api)
- **`packages/ingest`**: scripts de importação de provas (INEP, FUVEST, UFRGS...)
- Deploy: front na Cloudflare Pages, API e banco no Railway

## Rodando localmente

Requisitos: Node 22+ (veja `.nvmrc`), pnpm, Docker (ou Podman).

```bash
./dev.sh                      # faz tudo abaixo de uma vez (--no-seed pula o seed)
```

Ou passo a passo:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d          # Postgres em 127.0.0.1:5442
pnpm db:migrate
pnpm db:seed                  # instituições, matérias, assuntos, temas de redação, admin
pnpm dev                      # API em :3340 e web em :5173
```

Acesse http://localhost:5173. Usuário admin do seed: `admin@freenem.local` / `freenem-admin` (apenas em desenvolvimento; defina `ADMIN_PASSWORD` em produção).

Sem chaves externas tudo funciona: e-mails são impressos no console da API, o login com Google fica escondido e a IA de redação usa modo mock.

## Comandos

| Comando            | O que faz                                                                         |
| ------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev`         | API + web em paralelo                                                             |
| `pnpm build`       | build de todos os pacotes                                                         |
| `pnpm typecheck`   | checagem de tipos                                                                 |
| `pnpm lint`        | ESLint                                                                            |
| `pnpm test`        | Vitest (os testes da API usam o banco `freenem_test`, criado pelo docker compose) |
| `pnpm db:generate` | gera migration a partir do schema Drizzle                                         |
| `pnpm db:migrate`  | aplica migrations                                                                 |
| `pnpm db:seed`     | popula dados iniciais (idempotente)                                               |
| `pnpm ingest:enem` | importa as questões do ENEM 2009–2023 (veja `packages/ingest/README.md`)          |
| `pnpm ingest:tri`  | importa os parâmetros TRI (a, b, c) dos microdados do INEP                        |

## Contribuindo

Leia o `CLAUDE.md` para as convenções do projeto (estrutura de módulos, como adicionar rotas, schemas compartilhados). Questões importadas devem sempre citar a fonte; atendemos pedidos de remoção.

## Licença

[AGPL-3.0](./LICENSE). Forks hospedados também precisam manter o código aberto.
