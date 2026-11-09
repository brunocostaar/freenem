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

## 3. Deploy (Railway) — feito em 09/11/2026

Tudo roda no projeto `freenem` do Railway, em **https://freenem.up.railway.app**:

- `Postgres`
- `api`: `apps/api/Dockerfile`, pre-deploy `node dist/migrate.js`, healthcheck `/health`, volume `api-volume` em `/app/storage` com as imagens (`STORAGE_DRIVER=local`)
- `web`: `apps/web/Dockerfile` (build do Vite + Caddy). O Caddy serve a SPA e repassa `/api`, `/files` e `/health` para `API_UPSTREAM=http://api.railway.internal:3340`.

Front e API ficam na **mesma origem** de propósito: `*.up.railway.app` está na Public Suffix List, e com subdomínios separados o cookie de sessão não funcionaria. As configurações de build/deploy ficam nos próprios serviços (o Railway não aceita mais `railway.json` em serviços novos). Cada push na `main` publica sozinho via GitHub.

- [ ] **Domínio próprio** (opcional): `railway domain SEU-DOMINIO --service web`. Depois atualize `BETTER_AUTH_URL` e `WEB_ORIGIN` (api) e `VITE_API_URL` (web).
- [ ] Trocar a senha do admin depois do primeiro login.

Operações (exigem uma chave SSH registrada: `railway ssh keys add`):

```bash
railway ssh -s api -- node dist/seed.js                     # seed (idempotente)
railway volume files --volume api-volume upload <dir> /<dir>  # novas imagens
pg_dump … | railway ssh -s Postgres -- psql -U postgres -d railway   # copiar dados sem expor o banco
```

## 6. Chaves externas (opcionais, mas recomendadas)

- [ ] **Anthropic** (console.anthropic.com) → `ANTHROPIC_API_KEY`. Defina um limite de gasto mensal no console.
- [ ] **Resend** (resend.com) → verificar domínio, `RESEND_API_KEY` e `EMAIL_FROM=freenem <nao-responda@SEU-DOMINIO>`. Com ela, a verificação de e-mail passa a ser exigida.
- [ ] **Google OAuth** (console.cloud.google.com → Credentials → OAuth client "Web"):
  - Authorized JavaScript origins: `https://SEU-DOMINIO`
  - Redirect URI: `https://api.SEU-DOMINIO/api/auth/callback/google`

- [x] **Doações (`/apoiar`)**: no serviço `web` do Railway defina `VITE_PIX_KEY` (sua chave Pix), `VITE_PIX_NAME` (nome do recebedor, até 25 caracteres) e `VITE_PIX_CITY` (cidade, até 15). Sem `VITE_PIX_KEY`, a página mostra "doações em breve". O Pix usa QR estático direto na sua chave (doação por cartão/Stripe foi removida por ora).

## 7. Depois do deploy

- [ ] Entrar como admin e revisar a fila de rascunhos em `/admin/revisao` (~180 que a auto-revisão (`pnpm ingest:review`) não publicou; motivos em `packages/ingest/.cache/auto-review-report.csv`).
- [ ] Opcional: com a chave da Anthropic, rodar `pnpm --filter @freenem/ingest run classify:llm` para melhorar a classificação por assunto (gera sugestões, ainda passam por revisão).

## Extras (PWA, SEO)

- [ ] Em produção, troque `/og.png` por URL absoluta (`https://SEU-DOMINIO/og.png`) nas tags `og:image`/`twitter:image` de `apps/web/index.html`; os ícones e o OG são regenerados com `pnpm --filter @freenem/e2e exec node scripts/brand-assets.mjs`.
- [ ] Confirme o texto da política de privacidade (`/privacidade`) e um contato para pedidos LGPD.
