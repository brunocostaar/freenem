#!/usr/bin/env bash
# Usado pelo webServer do Playwright: recria o banco e2e (migrate + seed + fixtures) e sobe a API.
# As variáveis (DATABASE_URL, PORT...) vêm do playwright.config.ts e têm precedência sobre apps/api/.env.
set -euo pipefail
cd "$(dirname "$0")/../../api"
pnpm db:reset:e2e
pnpm db:migrate
pnpm db:seed
pnpm db:seed:fixtures
exec pnpm exec tsx --env-file-if-exists=.env src/server.ts
