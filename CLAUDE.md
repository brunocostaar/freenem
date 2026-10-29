# freenem — convenções

Plataforma de estudos ENEM/vestibulares. UI em português do Brasil; código e identificadores em inglês.

## Estrutura

- `apps/api` Fastify 5 + Drizzle + Better Auth. `apps/web` React 19 + Vite + TanStack Router/Query + Tailwind v4.
- `packages/shared` (`@freenem/shared`): schemas Zod + tipos do contrato da API. Exporta TS puro (`exports` aponta para `src/`); a API embute no bundle via tsup (`noExternal`), o web usa via Vite.
- `packages/ingest`: importadores de provas (interface `Source`).

## Comandos

`pnpm dev | build | typecheck | lint | test | db:generate | db:migrate | db:seed`. Postgres: `docker compose up -d` (porta 5442; bancos `freenem` e `freenem_test`).

## API: adicionar um módulo

1. Crie `apps/api/src/modules/<nome>/routes.ts` (plugin `FastifyPluginAsyncZod`) e `service.ts` (lógica + queries Drizzle, sem Fastify).
2. Registre com UMA linha em `src/modules/index.ts` (`v1Modules` = sob `/api/v1`; `rootModules` = na raiz).
3. Defina request/response como schemas Zod em `packages/shared/src/` e importe-os nas rotas (`schema: { body, querystring, params, response }`). Nunca duplique tipos no web.
4. Proteja com `preHandler: app.authenticate` ou `app.requireRole('admin', 'reviewer')`; o usuário fica em `req.sessionUser`.
5. Erros: lance `app.httpErrors.notFound(...)` etc.; o handler global responde `{ error: { code, message } }`.
6. Teste de integração em `apps/api/test/*.test.ts` usando `buildTestApp()` e `createAuthedUser(app, { role })` de `test/helpers.ts` (banco real `freenem_test`, migrado automaticamente no globalSetup).

## Banco

- Schema em `apps/api/src/db/schema/*.ts` (reexportado em `index.ts`). Após alterar: `pnpm db:generate` e comitar a migration em `apps/api/drizzle/`. Nunca edite migrations já aplicadas.
- Tabelas do Better Auth usam id `text`; as demais usam `uuid`.
- Seed (`src/db/seed.ts`, dados em `seed-data/`) deve ser idempotente (upsert por slug).

## Web

- Rotas file-based em `apps/web/src/routes/` (`routeTree.gen.ts` é gerado pelo Vite e fica versionado). Layout com navegação: `_app.tsx`; rotas que exigem login: `_app/_auth/`.
- Use `api()` de `src/lib/api.ts` com o schema de resposta de `@freenem/shared` e TanStack Query. Auth: `src/lib/auth-client.ts`.
- Componentes reutilizáveis em `src/components/ui/` (Button, Input, Select, Card, Badge, Dialog/Sheet, Skeleton, EmptyState, Toast) e `RichText` (Markdown + KaTeX). Cores/tipografia só por tokens (`bg-surface`, `text-ink`, `border-line`, `bg-primary`, `bg-accent`, `bg-highlight`...), nunca hex. Suporte a modo escuro é obrigatório; mobile-first.

## Qualidade

- TypeScript strict; sem `any`. ESLint (flat) + Prettier (`pnpm exec prettier --write .`). CI roda lint, prettier, typecheck, test e build.
- Redação com IA: texto do aluno nunca no system prompt; saída validada por Zod; ver plano do projeto.
