import {
  test,
  expect,
  signIn,
  signInAdmin,
  signUp,
  shot,
  expectNoHorizontalOverflow,
} from './fixtures';

test('reportar erro: aluno envia, admin vê agrupado e resolve', async ({ page, context }, info) => {
  const note = `e2e-reporte-${Date.now()}`;
  await signUp(page);
  await page.goto('/questoes?all=true');
  const report = page.getByRole('button', { name: 'Reportar erro na questão' }).first();
  await expect(report).toBeVisible();
  await report.click();

  const dialog = page.getByRole('dialog', { name: 'Reportar erro na questão' });
  await expect(dialog).toBeVisible();
  const send = dialog.getByRole('button', { name: 'Enviar reporte' });
  await expect(send).toBeDisabled();
  await shot(page, info.project.name, 'reportar-erro-dialog');
  await dialog.getByRole('radio', { name: 'Imagem quebrada ou ausente' }).check();
  await dialog.getByLabel(/Detalhes/).fill(note);
  await send.click();
  await expect(page.getByText(/Recebemos o seu reporte/)).toBeVisible();
  await expect(dialog).toBeHidden();

  // admin
  await context.clearCookies();
  await signInAdmin(page);
  await page.goto('/admin/revisao?tab=reportes');
  await expect(page.getByRole('tab', { name: /^Reportes/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const row = page.getByText(note);
  await expect(row).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'admin-revisao-reportes');
  await expect(page.getByRole('link', { name: 'Abrir no editor' }).first()).toBeVisible();

  const item = page.locator('li', { hasText: note }).last();
  await item.getByRole('button', { name: 'Resolver' }).click();
  await expect(page.getByText('Reporte resolvido.')).toBeVisible();
  await expect(page.getByText(note)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Resolvidos' }).click();
  await expect(page.getByText(note)).toBeVisible();
});

test('títulos por página e meta tags', async ({ page }) => {
  await page.goto('/questoes?all=true');
  await expect(page).toHaveTitle('Questões · freenem');
  await page.goto('/sobre');
  await expect(page).toHaveTitle('Sobre · freenem');
  await page.goto('/privacidade');
  await expect(page).toHaveTitle('Privacidade · freenem');
  await page.goto('/entrar');
  await expect(page).toHaveTitle('Entrar · freenem');
  await page.goto('/');
  await expect(page).toHaveTitle(/freenem/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', '/og.png');
  await expect(page.locator('meta[name="description"]').first()).toHaveAttribute('content', /ENEM/);
  expect(await page.locator('title').count()).toBe(1);

  await signUp(page);
  await expect(page).toHaveTitle('Início · freenem');
  // navegação no cliente também atualiza o título
  await page.goto('/inicio');
  await page.getByRole('link', { name: 'Desempenho' }).filter({ visible: true }).click();
  await expect(page).toHaveTitle('Desempenho · freenem');
});

test('/sobre e /privacidade: conteúdo, links no rodapé e sem overflow', async ({ page }, info) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Institucional' })
    .getByRole('link', { name: 'Sobre' })
    .click();
  await expect(page).toHaveURL(/\/sobre$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sobre o freenem');
  await expect(page.getByRole('heading', { name: 'Como a nota TRI é estimada' })).toBeVisible();
  await expect(page.getByText('enem-api')).toBeVisible();
  await expect(page.getByText('GPL-2.0')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'sobre');

  await page
    .getByRole('navigation', { name: 'Institucional' })
    .getByRole('link', { name: 'Privacidade' })
    .click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('privacidade');
  await expect(page.getByText(/enviado à Anthropic/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'privacidade');
});

test('onboarding: checklist em /inicio mostra progresso e pode ser dispensado', async ({
  page,
}, info) => {
  await signUp(page);
  const card = page.getByRole('heading', { name: 'Primeiros passos' });
  await expect(card).toBeVisible();
  await expect(page.getByText('Resolva 5 questões')).toBeVisible();
  await expect(page.getByText('Faça seu primeiro simulado')).toBeVisible();
  await expect(page.getByText('Crie seu plano de estudos')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Progresso/ })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'inicio-onboarding');
  await page.getByRole('button', { name: 'Dispensar primeiros passos' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primeiros passos' })).toHaveCount(0);
});

test('conta: altera nome e exclui a conta com confirmação', async ({ page, context, guard }) => {
  const { email, password } = await signUp(page);
  await page.goto('/conta');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Minha conta');
  await expectNoHorizontalOverflow(page);

  await page.getByLabel('Nome').fill('Nome Atualizado');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Nome atualizado.')).toBeVisible();

  const del = page.getByRole('button', { name: 'Excluir minha conta' });
  await expect(del).toBeDisabled();
  await page.getByLabel(/Digite EXCLUIR/).fill('excluir');
  await expect(del).toBeDisabled();
  await page.getByLabel(/Digite EXCLUIR/).fill('EXCLUIR');
  await expect(del).toBeEnabled();
  await del.click();
  await expect(page).toHaveURL(/\/$/);

  // a conta não existe mais: o login falha
  await context.clearCookies();
  guard.allow(/\/api\/auth\/sign-in/);
  await signIn(page, email, password);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});
