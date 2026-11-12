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
      FEATHERLESS_API_KEY: 'test-key',
      FEATHERLESS_BASE_URL: 'https://featherless.test/v1',
      FEATHERLESS_MODEL: 'Qwen/Qwen3-VL-32B-Instruct',
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Testes de integração compartilham um banco: roda um arquivo por vez.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
