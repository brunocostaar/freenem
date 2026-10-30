import { defineConfig, devices } from '@playwright/test';

// Por padrão o Playwright sobe API (3350) e web (5183) próprios, num banco descartável
// (`freenem_e2e`, recriado a cada execução), sem tocar no ambiente de dev (3340/5173).
// Com E2E_BASE_URL definido, roda contra servidores já existentes.
const external = Boolean(process.env.E2E_BASE_URL);
const API_PORT = 3350;
const WEB_PORT = 5183;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;
const apiURL = process.env.E2E_API_URL ?? `http://localhost:${API_PORT}`;
const databaseURL =
  process.env.E2E_DATABASE_URL ?? 'postgres://freenem:freenem@127.0.0.1:5442/freenem_e2e';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: './test-results',
  use: {
    baseURL,
    locale: 'pt-BR',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: external
    ? undefined
    : [
        {
          command: './scripts/start-api.sh',
          url: `${apiURL}/health`,
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            DATABASE_URL: databaseURL,
            PORT: String(API_PORT),
            WEB_ORIGIN: baseURL,
            BETTER_AUTH_URL: apiURL,
            BETTER_AUTH_SECRET:
              process.env.BETTER_AUTH_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-e2e',
            ADMIN_EMAIL: 'admin@freenem.local',
            ADMIN_PASSWORD: 'freenem-admin',
            RATE_LIMIT_ENABLED: 'false',
            STORAGE_DRIVER: 'local',
            // os testes esperam login só por e-mail, sem verificação e correção de redação mock
            GOOGLE_CLIENT_ID: '',
            GOOGLE_CLIENT_SECRET: '',
            RESEND_API_KEY: '',
            ANTHROPIC_API_KEY: '',
            DEEPSEEK_API_KEY: '',
          },
        },
        {
          command: `pnpm --filter @freenem/web exec vite --port ${WEB_PORT} --strictPort`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            VITE_API_URL: apiURL,
            // valores fictícios para a página /apoiar renderizar completa
            VITE_PIX_KEY: 'apoie@freenem.local',
            VITE_PIX_NAME: 'FREENEM',
            VITE_PIX_CITY: 'PORTO ALEGRE',
          },
        },
      ],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
