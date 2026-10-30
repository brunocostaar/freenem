import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, signUp, setTheme } from './fixtures';

const THEMES = ['light', 'dark'] as const;

/** Roda o axe (WCAG 2.x A/AA + boas práticas) e falha com violações serious/critical. */
async function audit(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 4)
        .map((n) => `    ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`)
        .join('\n'),
  );
  expect(summary, `axe em ${label}`).toEqual([]);
}

async function auditBothThemes(page: Page, label: string) {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.waitForTimeout(500); // termina as transições de cor antes de medir contraste
    await audit(page, `${label} (${theme})`);
  }
  await setTheme(page, 'light');
}

test('a11y: <html lang="pt-BR"> e landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('main')).toHaveCount(1);
});

test('a11y: páginas públicas (axe, claro e escuro)', async ({ page }) => {
  for (const path of ['/', '/entrar', '/cadastro', '/questoes', '/rota-que-nao-existe']) {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
    await auditBothThemes(page, path);
  }
});

test('a11y: página de uma questão e modo lista', async ({ page }) => {
  await page.goto('/questoes');
  await page.getByRole('link', { name: 'Abrir página da questão' }).first().click();
  await expect(page).toHaveURL(/\/questoes\/[0-9a-f-]{36}/);
  await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();
  await auditBothThemes(page, 'questão');

  await page.goto('/questoes?view=list');
  await expect(page.getByRole('radio', { name: /^Alternativa A/ }).first()).toBeVisible();
  await auditBothThemes(page, 'questões (lista)');
});

test('a11y: área logada (axe, claro e escuro)', async ({ page }) => {
  await signUp(page);
  for (const path of [
    '/inicio',
    '/desempenho',
    '/plano',
    '/simulados',
    '/redacao',
    '/redacao/competencias',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await auditBothThemes(page, path);
  }
});

test('a11y: editor de redação e simulado em andamento', async ({ page }) => {
  await signUp(page);
  await page.goto('/redacao');
  await page.getByRole('link', { name: 'Escrever' }).first().click();
  await expect(page.getByRole('textbox')).toBeVisible();
  await auditBothThemes(page, 'editor de redação');

  await page.goto('/simulados');
  await page.getByRole('button', { name: 'Novo simulado' }).first().click();
  await page.getByRole('tab', { name: 'Personalizado' }).click();
  await page.getByRole('group', { name: 'Áreas' }).getByRole('button', { name: /Matem/ }).click();
  await page.getByLabel(/Quantidade de questões/).fill('5');
  await auditBothThemes(page, 'construtor de simulado');
  await page.getByRole('button', { name: 'Criar e começar' }).click();
  await page.waitForURL(/\/simulados\/[0-9a-f-]+\/fazer/);
  await expect(page.getByText(/Questão 1 de 5/)).toBeVisible();
  await auditBothThemes(page, 'simulado em andamento');
});

test('teclado: diálogo prende o foco, Esc fecha e devolve o foco', async ({ page }) => {
  await signUp(page);
  await page.goto('/simulados');
  await page.getByRole('button', { name: 'Novo simulado' }).first().click();
  await page.getByRole('tab', { name: 'Personalizado' }).click();
  await page.getByRole('group', { name: 'Áreas' }).getByRole('button', { name: /Matem/ }).click();
  await page.getByLabel(/Quantidade de questões/).fill('5');
  await page.getByRole('button', { name: 'Criar e começar' }).click();
  await page.waitForURL(/\/simulados\/[0-9a-f-]+\/fazer/);

  const finalizar = page.getByRole('button', { name: 'Finalizar', exact: true }).first();
  await finalizar.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Tab várias vezes: o foco nunca sai do diálogo
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    // dentro do diálogo, ou no <body> (o foco passou para a interface do navegador)
    const inside = await page.evaluate(
      () =>
        document.activeElement === document.body ||
        document.activeElement?.closest('dialog') != null,
    );
    expect(inside, `foco escapou do diálogo no Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(finalizar).toBeFocused();
});

test('teclado: responder uma questão só com o teclado', async ({ page }) => {
  await page.goto('/questoes');
  const alt = page.getByRole('radio', { name: /^Alternativa B/ });
  await expect(alt).toBeVisible();
  await alt.focus();
  await page.keyboard.press('Space');
  await expect(alt).toHaveAttribute('aria-checked', 'true');
  const responder = page.getByRole('button', { name: 'Responder' });
  await responder.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Você (acertou|errou)/)).toBeVisible();
});
