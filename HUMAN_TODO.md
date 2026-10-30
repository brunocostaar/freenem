# O que precisa de intervenção humana

Tudo abaixo depende de contas, chaves ou decisões suas. O app roda 100% localmente sem nada disso (e-mails no console, correção de redação em modo demonstração, imagens no disco).

## 1. Decisões a confirmar

- [x] **Correção de redação**: DeepSeek (`DEEPSEEK_API_KEY`, modelo `deepseek-chat`), 1 correção/dia/usuário (admins sem limite). Defina um limite de gasto no painel do DeepSeek. Alternativa: Claude (`ANTHROPIC_API_KEY`). Custo estimado com `claude-sonnet-5-5` em esforço `low`: ~US$ 0,01–0,03 por redação. Se preferir que cada usuário use a própria chave (BYOK), é uma mudança pequena — peça.
- [ ] **Licença**: está AGPL-3.0. O dataset de questões (enem-api) é GPL-2.0; os dados ficam no banco (não são distribuídos com o código), mas vale uma leitura jurídica rápida.
- [ ] **Provas de vestibulares (FUVEST, UFRGS, UNICAMP)**: têm direitos das instituições. Os importadores funcionam (`pnpm ingest:vestibulares`, veja `packages/ingest/README.md`) e gravam tudo como **rascunho** (nunca publicam sozinhos), com fonte/URL/licença em cada questão e relatório de problemas em `packages/ingest/.cache/vestibulares-report.csv`. **Atenção: a auto-revisão (30/10) publicou 701 delas** (cada uma cita fonte e URL). Decida a política (citar fonte + remoção a pedido, ou pedir autorização às bancas); para despublicar todas: `update questions set status = 'draft' where external_id ~ '^(fuvest|ufrgs|unicamp)-'`.
  - **Se um site bloquear o download** (o fuvest.br devolve 403 a clientes sem `User-Agent` de navegador; a UNICAMP/UFRGS mudam as URLs a cada edição): baixe os arquivos à mão e rode com `--pdf`:
    - FUVEST: página "Acervo" em <https://www.fuvest.br/acervo-vestibular-2025/> → prova V1 (ou V) da 1ª fase + "gabarito". `pnpm --filter @freenem/ingest run import:fuvest -- --year 2026 --pdf prova.pdf --gabarito gabarito.pdf --version V1`
    - UFRGS: <https://www.ufrgs.br/coperse/> → "Concurso Vestibular <ano>" → cadernos do 1º dia e do 2º dia (Inglês); gabarito em `https://vestibular.ufrgs.br/cv<ano>/gabaritos/` (salve a página como `.html`). `... run import:ufrgs -- --year 2027 --pdf dia1.pdf --pdf2 dia2-ingles.pdf --gabarito gabaritos.html`
    - UNICAMP: <https://www.comvest.unicamp.br/vestibulares-anteriores/> → "Vestibular <ano>" → 1ª fase caderno **Q** e o gabarito "Q e Z" (ou "Q e Y"). `... run import:unicamp -- --year 2026 --pdf prova-Q.pdf --gabarito gabarito.pdf`
  - **Novas edições**: acrescente a URL em `FUVEST_EDITIONS` / `UFRGS_EDITIONS` / `UNICAMP_EDITIONS` (`packages/ingest/src/sources/*.ts`). FUVEST/UNICAMP 2026 ainda não foram encontrados nos sites oficiais.
  - **Revisão obrigatória** (`/admin/revisao`): fórmulas/quadros saem como texto confuso (a questão inteira vai como imagem anexada), a matéria da FUVEST/UNICAMP é inferida por palavras-chave (pode ficar em branco), e alternativas que são figuras ficam vazias no texto.
- [ ] **Regra de direitos humanos na redação**: o prompt aplica "zera só a C5" (regra recente). Confira com a cartilha do participante mais atual em `apps/api/src/modules/essays/prompt.ts`.

## 2. GitHub

- [x] Repositório criado (privado): https://github.com/brunocostaar/freenem. Torne público quando quiser (`gh repo edit --visibility public --accept-visibility-change-consequences`); o link no rodapé aponta para ele.

## 3. Banco + API no Railway

1. Novo projeto → **Add Postgres**.
2. **New service → GitHub repo** (este repositório). Em _Settings_:
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
   DEEPSEEK_API_KEY=…             # correção de redação (prioridade); sem ela, usa ANTHROPIC_API_KEY ou o modo demonstração
   RESEND_API_KEY=… EMAIL_FROM=…  # opcional (sem ela: sem verificação de e-mail)
   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=…  # opcional
   ```
4. Domínio customizado `api.SEU-DOMINIO`.
5. Popular o banco de produção (da sua máquina; copia o conteúdo já importado e revisado do banco de dev):
   ```bash
   # 1) migrations no banco novo (o pre-deploy do Railway já faz isso no primeiro deploy)
   # 2) conteúdo (instituições, matérias, questões...) preservando os ids; aborta se o destino já tiver conteúdo
   ./scripts/push-content.sh '<url pública do Postgres do Railway>'
   # 3) seed depois da cópia (cria o admin com ADMIN_PASSWORD; não duplica nada)
   DATABASE_URL='<…>' NODE_ENV=production ADMIN_PASSWORD='<senha forte>' pnpm --filter @freenem/api db:seed
   # 4) imagens (apps/api/storage, ~126 MB) para o R2, mesmas chaves
   cd apps/api && STORAGE_DRIVER=r2 R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… R2_PUBLIC_URL=… pnpm storage:sync
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

- [ ] **Doações (`/apoiar`)**: no Cloudflare Pages (variáveis do web) defina `VITE_PIX_KEY` (sua chave Pix), `VITE_PIX_NAME` (nome do recebedor, até 25 caracteres) e `VITE_PIX_CITY` (cidade, até 15). Para cartão: crie conta no Stripe e um Payment Link "cliente escolhe o valor" em BRL, e coloque a URL em `VITE_DONATION_CARD_URL`. Sem nenhuma das duas, a página mostra "doações em breve". Obs.: o Pix pelo Stripe é só por convite (após ~60 dias de processamento), por isso o Pix usa QR estático direto na sua chave.

## 7. Depois do deploy

- [ ] Entrar como admin e revisar a fila de rascunhos em `/admin/revisao` (~180 que a auto-revisão (`pnpm ingest:review`) não publicou; motivos em `packages/ingest/.cache/auto-review-report.csv`).
- [ ] Opcional: com a chave da Anthropic, rodar `pnpm --filter @freenem/ingest run classify:llm` para melhorar a classificação por assunto (gera sugestões, ainda passam por revisão).

## Extras (PWA, SEO)

- [ ] Em produção, troque `/og.png` por URL absoluta (`https://SEU-DOMINIO/og.png`) nas tags `og:image`/`twitter:image` de `apps/web/index.html`; os ícones e o OG são regenerados com `pnpm --filter @freenem/e2e exec node scripts/brand-assets.mjs`.
- [ ] Confirme o texto da política de privacidade (`/privacidade`) e um contato para pedidos LGPD.
