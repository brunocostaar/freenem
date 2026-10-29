import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate.ts' },
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado exporta TS puro: embutimos no bundle da API.
  noExternal: ['@freenem/shared'],
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
});
