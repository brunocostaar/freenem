import { test, expect, signInAdmin, signUp, shot, expectNoHorizontalOverflow } from './fixtures';

test('usuário comum não vê o item Revisão no menu', async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole('link', { name: 'Revisão' })).toHaveCount(0);
});

test('admin: lista rascunhos, abre um, edita assunto e publica', async ({ page }, info) => {
  await signInAdmin(page);
  await page.getByRole('link', { name: 'Revisão' }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/admin\/revisao/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Revisão');

  await page.getByRole('tab', { name: 'Rascunhos' }).click();
  const queue = page.getByRole('region', { name: 'Fila de revisão' });
  await expect(queue.getByText(/\d+ na fila/)).toBeVisible();
  const first = queue.locator('ul li button').first();
  await expect(first).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'admin-revisao-fila');

  await first.click();
  const editor = page.getByRole('region', { name: 'Editor' });
  await expect(editor.getByLabel(/Enunciado/)).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Publicar' })).toBeVisible();

  // completa o que faltar para poder publicar
  const subject = editor.getByLabel('Matéria');
  if (!(await subject.inputValue())) await subject.selectOption({ label: 'Matemática' });
  const correct = editor.getByRole('radio', { name: /Alternativa [A-E] é a correta/ });
  if ((await correct.locator(':checked').count()) === 0) {
    await editor.getByRole('radio', { name: 'Alternativa A é a correta' }).check({ force: true });
  }
  const topics = editor.getByRole('group', { name: /Assuntos/ }).getByRole('checkbox');
  await expect(topics.first()).toBeVisible();
  const checked = await editor
    .getByRole('group', { name: /Assuntos/ })
    .locator(':checked')
    .count();
  if (checked === 0) await topics.first().check();
  else {
    // edita o assunto: troca o primeiro marcado por outro
    const other = topics.locator('xpath=self::*[not(@checked)]').first();
    await other.check();
  }
  await shot(page, info.project.name, 'admin-revisao-editor');
  await editor.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();

  const id = new URL(page.url()).searchParams.get('id')!;
  expect(id).toBeTruthy();
  await editor.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Questão publicada.')).toBeVisible();

  // aparece publicada; devolve para rascunho para manter o banco de dev estável
  await page.goto(`/admin/revisao?status=published&id=${id}`);
  const back = page.getByRole('region', { name: 'Editor' }).getByRole('button', {
    name: 'Voltar para rascunho',
  });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();
});
