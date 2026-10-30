# @freenem/ingest

Importadores de provas. Rodam localmente (ou em CI) contra o banco apontado por `DATABASE_URL`
(lido de `apps/api/.env`; padrão: Postgres de desenvolvimento em `127.0.0.1:5442`). Antes de
importar, rode `pnpm db:migrate && pnpm db:seed` (instituições, matérias e assuntos).

## ENEM — questões (2009–2023)

```bash
pnpm ingest:enem                                  # todos os anos
pnpm --filter @freenem/ingest run import:enem --years 2022,2023
```

- **Fonte:** dataset aberto [yunger7/enem-api](https://github.com/yunger7/enem-api) (GPL-2.0). O script
  faz um clone raso/sparse de `public/` em `.cache/enem-api` (ignorado pelo git).
- Cria uma `exam` por ano/dia (caderno azul como referência) e uma `question` por item, com
  `external_id` (`enem-2023-1-ingles`) — reexecutar é idempotente e **não sobrescreve** questões já
  revisadas por humanos (`reviewed_by` preenchido).
- **Área e dia** vêm da posição da questão (os rótulos do dataset erram nas bordas).
- **Imagens:** sobem para o storage (`STORAGE_DRIVER=local` grava em `apps/api/storage/`, servido em `/files/*`;
  `r2` usa o bucket R2\_\*). O banco guarda `storage://<chave>`, convertido em URL pública pela API. Arquivos
  `.latex` viram fórmulas `$...$` (alguns são imagens com extensão errada e sobem como imagem).
  Imagens quebradas (`broken-image.svg`) são removidas e a questão fica em `draft`.
- **Classificação** (`src/classify.ts`): matéria (restrita à área do ENEM; inglês/espanhol vêm do dataset) e
  1–2 assuntos da taxonomia por palavras-chave (`src/keywords.ts`). Questões com evidência fraca, imagem
  quebrada, alternativas incompletas ou sem gabarito ficam `draft` (fila de revisão em `/admin/revisao`).
- `classify:llm` (opcional, exige `ANTHROPIC_API_KEY`) refina matéria/assuntos com a API da Anthropic,
  sem publicar nada.

## ENEM — parâmetros TRI

```bash
pnpm ingest:tri                                   # todos os anos
pnpm --filter @freenem/ingest run import:tri --years 2022,2023
```

Lê `ITENS_PROVA_<ano>.csv` dos microdados do INEP **direto de dentro do ZIP remoto** (HTTP Range: só o
diretório central e o CSV, alguns KB em vez de centenas de MB; cache em `.cache/tri/`). O servidor do INEP
não envia o certificado intermediário: o script busca o intermediário (RNP/GlobalSign) pela URL AIA e o
adiciona às CAs confiáveis — a verificação TLS **não** é desligada (use `INEP_CA_FILE` para apontar outro PEM).

Mapeamento: caderno AZUL, área (`SG_AREA`), posição (`CO_POSICAO`, com a numeração testada entre 3
variantes por ano) e língua (`TP_LINGUA`). Só gravamos `irt_a/b/c` quando `TX_GABARITO` coincide com o
gabarito da nossa questão; itens abandonados (sem parâmetros) ficam em branco.

## Vestibulares (rascunhos)

```bash
pnpm --filter @freenem/ingest run import:fuvest --year 2024 [--pdf prova.pdf|url]
pnpm --filter @freenem/ingest run import:ufrgs  --year 2024 [--pdf prova.pdf|url]
```

Baixam o PDF oficial, extraem o texto com `pdftotext -layout` (poppler-utils) e importam como `draft`
sem matéria/gabarito (parser de melhor esforço; provas com duas colunas/figuras exigem revisão).
Direitos das provas pertencem às instituições: sempre citamos a fonte e atendemos pedidos de remoção.

## Qualidade dos dados

```bash
pnpm --filter @freenem/ingest run quality:report            # relata e rebaixa suspeitas para draft
pnpm --filter @freenem/ingest run quality:report --dry-run  # só relata
```

`src/quality.ts` (função pura, também usada pelo importador) sinaliza: enunciado curto (< 60 caracteres
sem imagem), alternativas vazias/duplicadas/em número errado, gabarito ausente ou múltiplo, imagens
quebradas ou ausentes no storage (use `STORAGE_DIR` absoluto se não for o padrão), `$` de LaTeX
desbalanceado e artefatos de Markdown/HTML. Questões **publicadas e ainda não revisadas** com problemas
vão para `draft`; o motivo fica em `.cache/quality-report.csv` (não há coluna de motivo no banco).
O importador escapa `$` de moeda (`R$`, `US$`) para o KaTeX não tratá-los como fórmula.

## Relatório

`pnpm --filter @freenem/ingest run classify:report` — contagens por ano, status, matéria e cobertura TRI.
