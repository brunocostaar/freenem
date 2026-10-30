import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectNoHorizontalOverflow, setTheme, shot } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('/apoiar: Pix com valor, copia-e-cola', async ({ page }, info) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Institucional' })
    .getByRole('link', { name: 'Apoiar' })
    .click();
  await expect(page).toHaveURL(/\/apoiar$/);
  await expect(page).toHaveTitle('Apoie o freenem · freenem');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Apoie o freenem');
  await expect(page.getByText('apoie@freenem.local')).toBeVisible();

  await page.getByRole('button', { name: 'R$ 10' }).click();
  const qr = page.getByRole('img', { name: /QR code Pix para doar R\$\s10,00/ });
  await expect(qr).toBeVisible();
  await expect(qr.locator('svg')).toBeVisible();

  await page.getByRole('button', { name: 'Copiar código Pix' }).click();
  await expect(page.getByText('Código Pix copiado')).toBeVisible();
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith('000201')).toBe(true);
  expect(code).toContain('540510.00');
  expect(code).toContain('br.gov.bcb.pix0119apoie@freenem.local');

  // outro valor: QR sem valor (campo 54), escolhido no app do banco
  await page.getByRole('button', { name: 'Outro valor' }).click();
  await expect(page.getByText('Você digita o valor no app do seu banco')).toBeVisible();
  await page.getByRole('button', { name: 'Copiar código Pix' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('53039865802BR');

  await expect(page.getByText('Doar com cartão')).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'apoiar');
});

test('/apoiar: link no menu e a11y (claro e escuro)', async ({ page }) => {
  await page.goto('/apoiar');
  await expect(page.getByRole('navigation', { name: 'Principal' }).first()).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const blocking = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help}`);
    expect(blocking, `axe em /apoiar (${theme})`).toEqual([]);
  }
  await setTheme(page, 'light');
});
