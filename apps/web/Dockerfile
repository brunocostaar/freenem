# Contexto de build: raiz do monorepo (docker build -f apps/web/Dockerfile .)
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ingest/package.json packages/ingest/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @freenem/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
# Variáveis do serviço no Railway chegam como build args (o Vite as embute no bundle)
ARG VITE_API_URL
ARG VITE_PIX_KEY
ARG VITE_PIX_NAME
ARG VITE_PIX_CITY
RUN pnpm --filter @freenem/web build

# Estático + proxy de /api, /files e /health para a API (mesma origem: o cookie de sessão funciona
# mesmo em *.up.railway.app, que está na Public Suffix List)
FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
