import { test, expect, signUp, setTheme, shot, expectNoHorizontalOverflow } from './fixtures';

test('desempenho: vazio, depois números e gráficos após responder', async ({ page }, info) => {
  await signUp(page);
  await page.goto('/desempenho');
  await expect(page.getByText('Resolva sua primeira questão')).toBeVisible();
  await shot(page, info.project.name, 'desempenho-vazio');

  // responde algumas questões pela interface
  await page.goto('/questoes');
  for (let i = 0; i < 6; i++) {
    await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();
    await page.getByRole('radio', { name: /^Alternativa A/ }).click();
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.getByText(/Você (acertou|errou)/)).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText(new RegExp(`^${i + 2} de`))).toBeVisible();
  }

  await page.goto('/desempenho');
  const kpis = page.getByRole('region', { name: 'Resumo' });
  await expect(kpis).toContainText('Questões');
  await expect(kpis).toContainText('6');
  await expect(page.getByText('Atividade').first()).toBeVisible();
  await expect(page.getByText('Acerto por área')).toBeVisible();
  await expect(page.getByText('Por matéria')).toBeVisible();
  for (const r of ['7 dias', '30 dias', 'Tudo']) {
    const btn = page.getByRole('group', { name: 'Período' }).getByRole('button', { name: r });
    if (await btn.count()) await btn.click();
  }
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'desempenho-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'desempenho-dark');
  await setTheme(page, 'light');

  // início reflete as respostas
  await page.goto('/inicio');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, info.project.name, 'inicio-com-dados-light');
});

test('plano: wizard cria, semana lista itens, marca item e rebalanceia', async ({ page }, info) => {
  await signUp(page);
  await page.goto('/plano');
  await expect(page.getByText('Vamos montar seu plano')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'plano-wizard-light');

  await page.getByLabel(/Horas de estudo/).fill('10');
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await expect(page.getByText(/Faltam \d+ dias? para a prova|A prova é hoje/)).toBeVisible();
  await expect(page.getByText('Esta semana').first()).toBeVisible();

  const items = page.getByRole('checkbox');
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  await items.first().click();
  await expect(items.first()).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');

  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'plano-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'plano-dark');
  await setTheme(page, 'light');

  await page.getByRole('button', { name: 'Rebalancear' }).click();
  await expect(page.getByText(/Plano rebalanceado/)).toBeVisible();
});
