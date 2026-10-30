#!/usr/bin/env bash
# Sobe o ambiente local: Postgres (docker/podman) → deps → migrations → seed → API (3340) + web (5173).
# Uso: ./dev.sh            (tudo)
#      ./dev.sh --no-seed  (pula o seed)
set -euo pipefail
cd "$(dirname "$0")"

SEED=1
for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=0 ;;
    -h | --help)
      sed -n '2,4p' "$0"
      exit 0
      ;;
    *)
      echo "opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf '\033[1;35m▸ %s\033[0m\n' "$*"; }
die() {
  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

command -v pnpm >/dev/null || die "pnpm não encontrado (corepack enable && corepack prepare pnpm@latest --activate)"

# docker compose ou podman compose, o que estiver funcionando
if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v podman >/dev/null && podman info >/dev/null 2>&1; then
  COMPOSE=(podman compose)
else
  die "nem docker nem podman estão disponíveis"
fi

# portas ocupadas (ex.: outro `pnpm dev` já rodando)
for port in 3340 5173; do
  if ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    die "porta $port já está em uso — pare o processo antes (ss -ltnp 'sport = :$port')"
  fi
done

for f in apps/api/.env apps/web/.env; do
  if [[ ! -f $f ]]; then
    log "criando $f a partir de $f.example"
    cp "$f.example" "$f"
  fi
done

log "subindo Postgres (${COMPOSE[*]})"
"${COMPOSE[@]}" up -d postgres

log "aguardando Postgres ficar pronto"
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U freenem -d freenem >/dev/null 2>&1; then
    break
  fi
  [[ $i == 60 ]] && die "Postgres não respondeu em 60s"
  sleep 1
done

log "instalando dependências"
pnpm install --frozen-lockfile

log "aplicando migrations"
pnpm db:migrate

if [[ $SEED == 1 ]]; then
  log "seed (idempotente)"
  pnpm db:seed
fi

log "API em http://localhost:3340 · web em http://localhost:5173 (admin@freenem.local / freenem-admin)"
exec pnpm dev
