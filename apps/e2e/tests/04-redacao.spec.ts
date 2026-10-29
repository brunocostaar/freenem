import { test, expect, signUp, setTheme, shot, expectNoHorizontalOverflow } from './fixtures';

const PARAGRAPH =
  'A democratização do acesso à educação de qualidade é um desafio histórico no Brasil, agravado pela desigualdade social e regional. Segundo o sociólogo Pierre Bourdieu, a escola tende a reproduzir as desigualdades culturais. Nesse sentido, é fundamental que o Estado, em parceria com a sociedade civil, amplie investimentos em infraestrutura e formação docente. Além disso, as mídias devem divulgar campanhas de valorização do ensino público, a fim de garantir uma sociedade mais justa. ';
const ESSAY = PARAGRAPH.repeat(2);

test('redação: tema, rascunho com autosave, correção mock e limite diário', async ({
  page,
}, info) => {
  await signUp(page);
  await page.goto('/redacao');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Redação');
  await expect(page.getByText('Sua correção de hoje está disponível')).toBeVisible();
  await expect(page.getByText('Nenhuma redação ainda')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'redacao-temas-light');

  // competências
  await page.getByRole('link', { name: /As 5 competências/ }).click();
  await expect(page.getByText(/Competência 5|C5/).first()).toBeVisible();
  await page.goBack();

  // escreve
  await page.getByRole('link', { name: 'Escrever' }).first().click();
  await expect(page).toHaveURL(/\/redacao\/nova/);
  const area = page.getByRole('textbox');
  await area.fill('Texto curto');
  await expect(page.getByText(/Mínimo de 500 caracteres/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar para correção' })).toBeDisabled();
  await shot(page, info.project.name, 'redacao-editor-light');

  await area.fill(ESSAY);
  await expect(page.getByText('Rascunho salvo')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/redacao\/[0-9a-f-]{36}$/);
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'redacao-editor-dark');
  await setTheme(page, 'light');
  await expectNoHorizontalOverflow(page);

  // rascunho persiste após recarregar
  await page.reload();
  await expect(page.getByRole('textbox')).toHaveValue(/democratização/);

  // enviar
  await page.getByRole('button', { name: 'Enviar para correção' }).click();
  await page.getByRole('button', { name: 'Enviar agora' }).click();
  for (const c of ['C1', 'C2', 'C3', 'C4', 'C5']) {
    await expect(page.getByText(new RegExp(`\\b${c}\\b`)).first()).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.getByText(/modo demonstra|estimativa/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'redacao-resultado-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'redacao-resultado-dark');
  await setTheme(page, 'light');

  // segunda correção no mesmo dia: mensagem de limite, envio bloqueado
  await page.goto('/redacao');
  await expect(page.getByText('Você já usou a correção de hoje')).toBeVisible();
  await expect(page.getByText(/Próxima disponível em/)).toBeVisible();
  await page.getByRole('link', { name: 'Escrever' }).nth(1).click();
  await page.getByRole('textbox').fill(ESSAY);
  await expect(page.getByText(/Você já usou sua correção de hoje/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar para correção' })).toBeDisabled();
  await shot(page, info.project.name, 'redacao-limite');
});
