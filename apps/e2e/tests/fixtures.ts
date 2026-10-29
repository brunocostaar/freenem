import { mkdirSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

const API = 'http://localhost:3340';
export const SCREENSHOT_DIR = new URL('../screenshots/', import.meta.url).pathname;

export interface Guard {
  /** Permite respostas de erro esperadas (ex.: /\/check$/ com 429). */
  allow: (pattern: RegExp, status?: number) => void;
  errors: string[];
}

/**
 * Falha o teste em qualquer console.error, erro de página ou resposta 4xx/5xx
 * da API que não tenha sido explicitamente permitida.
 */
export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: { pattern: RegExp; status?: number }[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        // "Failed to load resource" é coberto pela checagem de respostas abaixo.
        if (/Failed to load resource/.test(m.text())) return;
        errors.push(`console.error: ${m.text()}`);
      });
      page.on('response', (r) => {
        const url = r.url();
        if (r.status() < 400) return;
        if (!url.startsWith(API) && !url.includes('localhost:5173')) return;
        if (allowed.some((a) => a.pattern.test(url) && (!a.status || a.status === r.status())))
          return;
        errors.push(`HTTP ${r.status()} ${r.request().method()} ${url}`);
      });
      page.on('requestfailed', (r) => {
        const f = r.failure()?.errorText ?? '';
        if (f.includes('ERR_ABORTED')) return;
        errors.push(`requestfailed: ${r.url()} ${f}`);
      });
      const guard: Guard = {
        errors,
        allow: (pattern, status) => allowed.push({ pattern, status }),
      };
      await use(guard);
      expect(errors, 'erros de console/rede').toEqual([]);
    },
    { auto: true },
  ],
});

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1e5)}@example.com`;
}

export async function signUp(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill(opts.name ?? 'Estudante E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/inicio/);
  return { email, password: 'senha-e2e-123' };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function signInAdmin(page: Page) {
  await signIn(page, 'admin@freenem.local', 'freenem-admin');
  await page.waitForURL(/\/inicio/);
}

export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('freenem-theme', t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

/** Falha se houver rolagem horizontal na página. */
export async function expectNoHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(o.sw, `scrollWidth ${o.sw} > clientWidth ${o.cw}`).toBeLessThanOrEqual(o.cw + 1);
}

/** Captura de tela cheia em screenshots/<projeto>/<nome>-<tema>.png. */
export async function shot(page: Page, project: string, name: string) {
  mkdirSync(`${SCREENSHOT_DIR}${project}`, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SCREENSHOT_DIR}${project}/${name}.png`, fullPage: true });
}
