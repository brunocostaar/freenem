import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ?? 'postgres://freenem:freenem@127.0.0.1:5442/freenem_test',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123456',
      BETTER_AUTH_URL: 'http://localhost:3340',
      WEB_ORIGIN: 'http://localhost:5173',
      RATE_LIMIT_ENABLED: 'false',
      RESEND_API_KEY: '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Testes de integração compartilham um banco: roda um arquivo por vez.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
