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

## ENEM PPL (2ª aplicação) — PDFs oficiais do INEP

```bash
pnpm ingest:ppl                                                  # 2020–2024
pnpm --filter @freenem/ingest run import:enem-ppl --years 2022 --dry-run
```

- **Fonte:** `download.inep.gov.br/enem/provas_e_gabaritos/<ano>_PV_reaplicacao_PPL_D1_CD1.pdf` (dia 1) e `..._D2_CD7.pdf`
  (dia 2) + `<ano>_GB_...` (gabarito); caderno azul. Download com a cadeia TLS completa (`downloadInep` em
  `remote-zip.ts`, mesmo intermediário do TRI). Os PDFs de 2016–2019 não estão neste padrão de URL e **não foram
  importados**; o de **2021 tem fonte sem mapeamento Unicode** (texto ilegível, sem OCR) e é ignorado.
- Parser em `src/sources/enem-ppl.ts` (reusa `pdf/flow.ts`): marcador `QUESTÃO NN` em negrito, letra da alternativa
  como elemento solto (duplicado no PDF), marca d'água/rodapé descartados; inglês/espanhol (1–5) separados por
  cabeçalho. `external_id`: `enem-ppl-2022-50`, `enem-ppl-2022-1-ingles`. Exam `ENEM PPL <ano> · Dia N` na instituição `enem`.
- Classificação pelo classificador do ENEM (área pela posição). Status `published` sem problemas de
  parser/qualidade e com gabarito; fórmulas/alternativas-figura ficam `draft` (veja `.cache/enem-ppl-report.csv`).
  Anuladas não entram; reimportar não mexe em questões revisadas.
- **TRI:** não mapeado para PPL (os `CO_PROVA` dos cadernos PPL não são tratados em `tri.ts`).

## Vestibulares (FUVEST, UFRGS, UNICAMP) — sempre rascunho

```bash
pnpm ingest:vestibulares                                        # todos os anos conhecidos das 3 instituições
pnpm --filter @freenem/ingest run import:fuvest  -- --year 2025 # 1ª fase, 90 questões (A–E)
pnpm --filter @freenem/ingest run import:ufrgs   -- --year 2025 # dias 1 e 2 (A–E)
pnpm --filter @freenem/ingest run import:unicamp -- --year 2025 # 1ª fase, 72 questões (a–d)
# arquivos manuais (site bloqueou o download etc.):
pnpm --filter @freenem/ingest run import:fuvest  -- --year 2026 --pdf prova.pdf --gabarito gab.pdf --version V1
pnpm --filter @freenem/ingest run import:ufrgs   -- --year 2027 --pdf dia1.pdf --pdf2 dia2-ingles.pdf --gabarito gabaritos.html
pnpm --filter @freenem/ingest run import:unicamp -- --year 2026 --pdf prova-Q.pdf --gabarito gab.pdf
```

Flags: `--dry-run` (extrai e gera o relatório sem gravar no banco/storage), `--years 2023,2024`.
Para compartilhar PDFs/relatório e imagens entre worktrees: `INGEST_CACHE_DIR=<.../packages/ingest/.cache>`
e `STORAGE_DIR=<.../apps/api/storage>`.

- **Fontes** (`src/sources/`): FUVEST — `fuvest.br/wp-content/uploads/fuvest<ano>_primeira_fase_prova_V*.pdf` +
  `fuvest<ano>_gabarito_primeira_fase.pdf` (2023–2025); UFRGS — cadernos de prova em
  `ufrgs.br/coperse/wp-content/uploads/…` + gabarito (HTML, por matéria) em `vestibular.ufrgs.br/cv<ano>/gabaritos/`
  (2024–2026); UNICAMP — `comvest.unicamp.br/vest<ano>/F1/f1<ano>Q_*.pdf` (caderno Q) + gabarito Q/Z em
  `comvest.unicamp.br/wp-content/uploads/…` (2024–2025). O "ano" é o do vestibular (FUVEST 2025 = prova de nov/2024).
- **Parser** (`src/pdf/`): `pdftohtml -xml` devolve cada linha com posição, fonte e negrito (e as imagens
  embutidas). `flow.ts` descobre as colunas (a esquerda e a direita, com linhas de largura total e tabelas
  de alternativas), lê na ordem certa, e separa questões pelos marcadores de cada prova (FUVEST: número em
  negrito; UNICAMP: `QUESTÃO N`; UFRGS: `NN.` em negrito). Textos-base compartilhados ("TEXTO PARA AS
  QUESTÕES 04 E 05", "Instrução: as questões de 01 a 08…") entram no enunciado de todas as questões do intervalo.
  Cabeçalhos/rodapés, marcadores brancos (`{ 02}`, `#####`) e a numeração de linhas do UFRGS são descartados.
- **Gabarito oficial** é lido do PDF/HTML (FUVEST por versão do caderno; UNICAMP `*` = anulada; UFRGS
  `ANULADA`) e marca a alternativa correta. **Questões anuladas não são importadas.**
- **Figuras**: imagens embutidas viram recortes PNG (`pdftoppm -x -y -W -H`); gráficos vetoriais (rótulos de
  eixo), fórmulas (glifos matemáticos/sobrescritos) e alternativas que são figuras geram o recorte da
  questão inteira; na dúvida (palavra "figura/gráfico/tabela/mapa/charge…" no enunciado) anexa o recorte do
  enunciado. Os PNG vão para o storage (`vestibulares/<inst>/<ano>/<hash>.png`, deduplicados) e para
  `questions.image_urls`.
- **Matéria/assunto** (`classify-vestibular.ts`): UFRGS usa a posição (banner de cada matéria no caderno);
  as demais usam palavras-chave entre todas as matérias (`classify.ts` aceita `subjects` no lugar das áreas
  do ENEM) e detecção de inglês/espanhol; evidência fraca deixa a matéria em branco.
- **Idempotência**: `external_id` = `fuvest-2025-1f-12`, `unicamp-2025-1f-12`, `ufrgs-2025-d1-01`,
  `ufrgs-2025-d2-ingles-01`. Reimportar atualiza texto/alternativas/imagens, **nunca muda `status`** e pula
  questões já revisadas (`reviewed_by`).
- **Atribuição**: `source_name` = "FUVEST 2025 · 1ª fase — prova oficial (fuvest.br)", `source_url` = PDF da prova,
  `source_license` = direitos da instituição, uso educacional, remoção a pedido.
- **Qualidade**: `quality.ts` com nº de alternativas por instituição (`EXPECTED_ALTERNATIVES`: UNICAMP = 4).
  Problemas e avisos do parser (figura incerta, fórmula, alternativa vazia, sem gabarito…) vão para
  `.cache/vestibulares-report.csv` (coluna `motivos`); como tudo é `draft`, a revisão em `/admin/revisao` decide.
- **Limitações conhecidas**: fórmulas e quadros (tabelas) saem como texto bagunçado — por isso a questão
  inteira vai como imagem; alternativas em tabela cruzando colunas (UFRGS) dependem de heurística; só
  Inglês/Espanhol do UFRGS são importados (Francês/Italiano/Alemão não têm matéria na taxonomia); o caderno
  importado é o V1/V (FUVEST) e Q (UNICAMP).
- Testes: `src/vestibulares.test.ts` (fixtures XML mínimas, sem PDFs reais).

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
