# O que precisa de intervenção humana

Tudo abaixo depende de contas, chaves ou decisões suas. O app roda 100% localmente sem nada disso (e-mails no console, correção de redação em modo demonstração, imagens no disco).

## 1. Decisões a confirmar

- [ ] **Quem paga a correção de redação?** Implementado: chave do projeto no servidor (`ANTHROPIC_API_KEY`), 1 correção/dia/usuário. Custo estimado com `claude-sonnet-5-5` em esforço `low`: ~US$ 0,01–0,03 por redação. Se preferir que cada usuário use a própria chave (BYOK), é uma mudança pequena — peça.
- [ ] **Licença**: está AGPL-3.0. O dataset de questões (enem-api) é GPL-2.0; os dados ficam no banco (não são distribuídos com o código), mas vale uma leitura jurídica rápida.
- [ ] **Provas de vestibulares (FUVEST, UFRGS…)**: têm direitos das instituições. Os importadores existem (`pnpm --filter @freenem/ingest run import:fuvest -- --pdf <arquivo>`), mas estão como rascunho. Decida a política (citar fonte + remoção a pedido) antes de publicar.
- [ ] **Regra de direitos humanos na redação**: o prompt aplica "zera só a C5" (regra recente). Confira com a cartilha do participante mais atual em `apps/api/src/modules/essays/prompt.ts`.

## 2. GitHub

- [ ] Criar o repositório e dar push (`git remote add origin … && git push -u origin main`).
- [ ] Trocar o placeholder `GITHUB_URL` em `apps/web/src/routes/index.tsx` (e onde mais aparecer `SEU-USUARIO`).

## 3. Banco + API no Railway

1. Novo projeto → **Add Postgres**.
2. **New service → GitHub repo** (este repositório). Em *Settings*:
   - Root directory: `/` (o Dockerfile usa a raiz como contexto)
   - Builder: Dockerfile, caminho `apps/api/Dockerfile` (o `railway.json` já configura isso, o pre-deploy `node dist/migrate.js` e o healthcheck `/health`).
3. Variáveis do serviço:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://api.SEU-DOMINIO
   WEB_ORIGIN=https://SEU-DOMINIO
   ADMIN_EMAIL=<seu e-mail>
   ADMIN_PASSWORD=<senha forte>
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… R2_PUBLIC_URL=https://…
   ANTHROPIC_API_KEY=…            # opcional (sem ela: modo demonstração)
   RESEND_API_KEY=… EMAIL_FROM=…  # opcional (sem ela: sem verificação de e-mail)
   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=…  # opcional
   ```
4. Domínio customizado `api.SEU-DOMINIO`.
5. Popular o banco de produção (da sua máquina, apontando para o banco do Railway):
   ```bash
   DATABASE_URL=<url pública do Postgres do Railway> pnpm --filter @freenem/api db:seed
   DATABASE_URL=<…> STORAGE_DRIVER=r2 R2_…=… pnpm ingest:enem   # importa questões + sobe imagens pro R2
   DATABASE_URL=<…> pnpm ingest:tri                              # parâmetros TRI do INEP
   ```

## 4. Imagens no Cloudflare R2

- [ ] Criar bucket (ex.: `freenem-files`), habilitar acesso público via domínio (ex.: `files.SEU-DOMINIO`) e criar um token S3 (Access Key/Secret) com escrita no bucket. Preencher as variáveis `R2_*` acima.
- O driver R2 foi implementado mas **nunca testado com chaves reais** — rode o `ingest:enem` com 1 ano primeiro e confira uma imagem.

## 5. Frontend no Cloudflare Pages

- [ ] **Create project → Connect to Git**:
  - Build command: `pnpm install --frozen-lockfile && pnpm --filter @freenem/web build`
  - Output directory: `apps/web/dist`
  - Variáveis: `VITE_API_URL=https://api.SEU-DOMINIO`, `NODE_VERSION=22`
- [ ] Domínio customizado `SEU-DOMINIO`. Mantenha front e API no **mesmo domínio raiz** (`x.com` e `api.x.com`) para os cookies de sessão funcionarem.

## 6. Chaves externas (opcionais, mas recomendadas)

- [ ] **Anthropic** (console.anthropic.com) → `ANTHROPIC_API_KEY`. Defina um limite de gasto mensal no console.
- [ ] **Resend** (resend.com) → verificar domínio, `RESEND_API_KEY` e `EMAIL_FROM=freenem <nao-responda@SEU-DOMINIO>`. Com ela, a verificação de e-mail passa a ser exigida.
- [ ] **Google OAuth** (console.cloud.google.com → Credentials → OAuth client "Web"):
  - Authorized JavaScript origins: `https://SEU-DOMINIO`
  - Redirect URI: `https://api.SEU-DOMINIO/api/auth/callback/google`

## 7. Depois do deploy

- [ ] Entrar como admin e revisar a fila de rascunhos em `/admin/revisao` (~680 questões com classificação de baixa confiança).
- [ ] Opcional: com a chave da Anthropic, rodar `pnpm --filter @freenem/ingest run classify:llm` para melhorar a classificação por assunto (gera sugestões, ainda passam por revisão).
