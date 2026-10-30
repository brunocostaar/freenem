import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  signIn,
  signInAdmin,
  signUp,
  setTheme,
  shot,
  expectNoHorizontalOverflow,
} from './fixtures';

const API = process.env.E2E_API_URL ?? 'http://localhost:3350';

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
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await page.waitForTimeout(500);
    await audit(page, `${label} (${theme})`);
  }
  await setTheme(page, 'light');
}

async function answer(page: Page) {
  const radio = page.getByRole('radio', { name: /^Alternativa A/ });
  await expect(radio).toBeVisible();
  const send = page.getByRole('button', { name: 'Responder' });
  if (await send.isVisible()) {
    await radio.click();
    await send.click();
  }
  await expect(page.getByText(/Gabarito: alternativa [A-E]/)).toBeVisible();
}

test('resoluções: escrever, moderar, votar e editar', async ({ page, context }, info) => {
  const tag = `e2e-res-${Date.now()}`;
  const body = `Isolamos a incógnita com $2x + 3 = 11$ e então $x = 4$. ${tag}`;

  const list = await page.request.get(`${API}/api/v1/questions?limit=1`);
  const qid = ((await list.json()) as { items: { id: string }[] }).items[0]!.id;

  // A responde e escreve: fica em análise (só ela vê)
  const a = await signUp(page, { name: 'Autora E2E' });
  await page.goto(`/questoes/${qid}`);
  await expect(page.getByRole('heading', { name: 'Resoluções da comunidade' })).toHaveCount(0);
  await answer(page);
  await expect(page.getByRole('heading', { name: 'Resoluções da comunidade' })).toBeVisible();
  await page.getByRole('button', { name: 'Escrever resolução' }).click();
  await page.getByLabel('Sua resolução').fill(body);
  await expect(page.getByText('Pré-visualização')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'resolucao-editor');
  await auditBothThemes(page, 'editor de resolução');
  await page.getByRole('button', { name: 'Enviar para análise' }).click();
  const mineCard = page.getByRole('article').filter({ hasText: tag });
  await expect(mineCard.getByText('Em análise')).toBeVisible();
  await auditBothThemes(page, 'resolução em análise');

  // admin aprova
  await context.clearCookies();
  await signInAdmin(page);
  await page.goto('/admin/revisao?tab=resolucoes');
  await expect(page.getByRole('tab', { name: /^Resoluções/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const card = page.locator('li', { hasText: tag }).last();
  await expect(card).toBeVisible();
  await expect(card.getByText(/Gabarito: [A-E]/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'admin-revisao-resolucoes');
  await auditBothThemes(page, '/admin/revisao resoluções');
  await card.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText('Resolução aprovada.')).toBeVisible();

  // B vê e vota
  await context.clearCookies();
  await signUp(page, { name: 'Colega E2E' });
  await page.goto(`/questoes/${qid}`);
  await answer(page);
  const shared = page.getByRole('article').filter({ hasText: tag });
  await expect(shared).toBeVisible();
  await expect(shared.getByText('Autora E2E')).toBeVisible();
  const up = shared.getByRole('button', { name: 'Voto positivo' });
  await expect(up).toHaveAttribute('aria-pressed', 'false');
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');
  await expect(shared.getByText(/^1\s*pontos$/)).toBeVisible();
  await shot(page, info.project.name, 'resolucao-votada');
  await auditBothThemes(page, 'questão com resoluções');
  // repetir o voto remove
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'false');
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');

  // A edita: volta para análise e sai da lista pública
  await context.clearCookies();
  await signIn(page, a.email, a.password);
  await page.waitForURL(/\/inicio/);
  await page.goto(`/questoes/${qid}`);
  await answer(page);
  const own = page.getByRole('article').filter({ hasText: tag });
  await expect(own.getByText('Em análise')).toHaveCount(0);
  await own.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Editar resolução').fill(`${body} (revisada)`);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(
    page.getByRole('article').filter({ hasText: tag }).getByText('Em análise'),
  ).toBeVisible();

  // perfil
  await page.goto('/conta');
  await expect(page.getByRole('heading', { name: 'Minhas resoluções' })).toBeVisible();
  await expect(page.getByText(/1 em análise/)).toBeVisible();
  await auditBothThemes(page, '/conta');
});
