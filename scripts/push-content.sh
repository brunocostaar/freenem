#!/usr/bin/env bash
# Copia o conteúdo do banco de dev (instituições, matérias, assuntos, temas de redação, provas,
# questões, alternativas e assuntos das questões) para outro banco, preservando os ids.
# Destino: já migrado e SEM conteúdo (rode o seed só depois, para criar o admin).
# Uso: ./scripts/push-content.sh 'postgres://user:senha@host:porta/banco'
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=${1:?informe a DATABASE_URL de destino}
SOURCE=${SOURCE_DATABASE_URL:-postgres://freenem:freenem@127.0.0.1:5442/freenem}
TABLES=(institutions subjects topics essay_themes exams questions alternatives question_topics)

args=()
for t in "${TABLES[@]}"; do args+=(--table "public.$t"); done

# pg_dump/psql da mesma versão do servidor, via imagem oficial (rede do host para alcançar o dev)
pg() { docker run --rm -i --network host postgres:16 "$@"; }

echo "▸ conferindo destino"
existing=$(pg psql "$TARGET" -At -c 'select count(*) from questions')
if [[ $existing != 0 ]]; then
  echo "✗ o destino já tem $existing questões; abortando para não duplicar/sobrescrever" >&2
  exit 1
fi
pg psql "$TARGET" -At -c 'select count(*) from institutions' | grep -qx 0 || {
  echo "✗ o destino já tem instituições (seed rodou antes?). Esvazie as tabelas de conteúdo ou use um banco novo." >&2
  exit 1
}

echo "▸ copiando ${TABLES[*]}"
pg pg_dump "$SOURCE" --data-only --no-owner --no-privileges "${args[@]}" |
  pg psql "$TARGET" -v ON_ERROR_STOP=1 --single-transaction -q

pg psql "$TARGET" -At -c "select 'questões: ' || count(*) || ' (' || count(*) filter (where status = 'published') || ' publicadas)' from questions"
echo "▸ pronto. Agora: DATABASE_URL=… pnpm --filter @freenem/api db:seed (cria o admin) e storage:sync para as imagens."
