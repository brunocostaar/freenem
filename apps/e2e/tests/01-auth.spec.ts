import {
  test,
  expect,
  signUp,
  signIn,
  setTheme,
  shot,
  expectNoHorizontalOverflow,
} from './fixtures';

test('landing renderiza, navega e alterna o tema', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'landing-light');

  // tema: alterna claro <-> escuro e persiste
  await setTheme(page, 'light');
  await page.getByRole('button', { name: 'Ativar tema escuro' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await shot(page, info.project.name, 'landing-dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Ativar tema claro' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // navegação
  await page.getByRole('link', { name: 'Criar conta' }).first().click();
  await expect(page).toHaveURL(/\/cadastro/);
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/entrar/);
});

test('cadastro -> /inicio -> sair -> entrar de novo', async ({ page }, info) => {
  const { email, password } = await signUp(page);
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Estudante');
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'inicio-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'inicio-dark');

  await page.getByRole('button', { name: 'Sair' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/$/);

  // rota protegida redireciona para login
  await page.goto('/desempenho');
  await expect(page).toHaveURL(/\/entrar/);

  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/desempenho|\/inicio/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('login com senha errada mostra erro em português', async ({ page, guard }) => {
  guard.allow(/\/api\/auth\/sign-in/, 401);
  await signIn(page, 'naoexiste@example.com', 'senha-errada-1');
  await expect(page.getByRole('alert')).toContainText('incorretos');
});
