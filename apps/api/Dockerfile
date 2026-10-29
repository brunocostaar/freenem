# Contexto de build: raiz do monorepo (docker build -f apps/api/Dockerfile .)
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ingest/package.json packages/ingest/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @freenem/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @freenem/api build
RUN pnpm --filter @freenem/api deploy --prod --legacy /deploy

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 3340
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3340)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations rodam no preDeployCommand (railway.json); `node dist/migrate.js` também está disponível.
CMD ["node", "dist/server.js"]
