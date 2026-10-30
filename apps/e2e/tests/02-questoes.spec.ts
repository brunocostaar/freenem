import { test, expect, signUp, setTheme, shot, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';

const filters = (page: Page) => page.locator('form[aria-label="Filtros de questões"]:visible');

/** No mobile os filtros ficam numa folha aberta pelo botão "Filtros". */
async function openFilters(page: Page) {
  if (!(await filters(page).count())) await page.getByRole('button', { name: 'Filtros' }).click();
  await expect(filters(page)).toBeVisible();
}
async function closeFilters(page: Page) {
  const done = page.getByRole('button', { name: /^Ver .* questões?$/ });
  if (await done.isVisible().catch(() => false)) await done.click();
}

async function answerCurrent(page: Page, letter = 'A') {
  await page.getByRole('radio', { name: new RegExp(`^Alternativa ${letter}`) }).click();
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByText(/Você (acertou|errou)/)).toBeVisible();
  await expect(page.getByText(/Gabarito: alternativa [A-E]/)).toBeVisible();
}

test('anônimo: lista carrega, filtros atualizam URL e resultados, responde e confere', async ({
  page,
}, info) => {
  await page.goto('/questoes');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Banco de questões');
  await expect(page.getByRole('button', { name: /Matemática/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'questoes-materias-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'questoes-materias-dark');
  await setTheme(page, 'light');
  await page.getByRole('button', { name: 'Misturar todas as matérias' }).click();
  await expect(page).toHaveURL(/all=true/);
  await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();
  await expect(page.getByText(/\d[\d.]* questões/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'questoes-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'questoes-dark');
  await setTheme(page, 'light');

  // filtros: matéria + ano + dificuldade + busca
  const total = async () =>
    Number(
      (
        (await page
          .getByText(/\d[\d.]* questões?/)
          .first()
          .textContent()) ?? ''
      ).replace(/\D/g, ''),
    );
  const t0 = await total();

  await openFilters(page);
  await filters(page).getByLabel('Matéria').selectOption({ label: 'Matemática' });
  await expect(page).toHaveURL(/subjectId=/);
  await filters(page).getByLabel('Ano').selectOption('2022');
  await expect(page).toHaveURL(/year=2022/);
  await closeFilters(page);
  await expect(
    page.locator('section[aria-label="Questões"]').getByText('Matemática').first(),
  ).toBeVisible();
  await expect.poll(total).toBeLessThan(t0);
  await expect(page.locator('main').getByText('ENEM 2022').first()).toBeVisible();

  await openFilters(page);
  await filters(page).getByRole('button', { name: 'Média' }).click();
  await expect(page).toHaveURL(/difficulty=medium/);
  await filters(page).getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page).not.toHaveURL(/subjectId|year|difficulty/);
  await closeFilters(page);

  await openFilters(page);
  await filters(page).getByLabel('Buscar no enunciado').fill('energia');
  await filters(page).getByLabel('Buscar no enunciado').press('Enter');
  await expect(page).toHaveURL(/q=energia/);
  await closeFilters(page);
  await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();

  // busca sem resultado -> estado vazio
  await openFilters(page);
  await filters(page).getByLabel('Buscar no enunciado').fill('zzqqxxnadaaqui');
  await filters(page).getByLabel('Buscar no enunciado').press('Enter');
  await closeFilters(page);
  await expect(page.getByText('Nenhuma questão encontrada')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();

  // anônimo consegue conferir resposta
  await expect(page.getByRole('radio', { name: /^Alternativa B/ })).toBeVisible();
  await answerCurrent(page, 'B');
  await expect(page.getByText(/Gostou\?/)).toBeVisible();
});

test('atalhos de teclado, eliminar alternativa, salvar e página da questão', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'atalhos de teclado são de desktop');
  await signUp(page);
  await page.goto('/questoes?all=true');
  await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();

  // teclado: C marca, Enter responde
  await page.keyboard.press('c');
  await expect(page.getByRole('radio', { name: /^Alternativa C, selecionada/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Gabarito: alternativa [A-E]/)).toBeVisible();
  await shot(page, info.project.name, 'questoes-feedback');

  // Enter avança; "1 de" -> "2 de"
  await expect(page.getByText(/^1 de/)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^2 de/)).toBeVisible();
  await page.keyboard.press('k');
  await expect(page.getByText(/^1 de/)).toBeVisible();
  await page.keyboard.press('j');
  await expect(page.getByText(/^2 de/)).toBeVisible();

  // eliminar alternativa
  await page.getByRole('button', { name: 'Eliminar alternativa D' }).click();
  await expect(page.getByRole('radio', { name: /^Alternativa D, eliminada/ })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar alternativa D' }).click();

  // salvar
  await page.getByRole('button', { name: 'Salvar questão' }).click();
  await expect(page.getByRole('button', { name: 'Remover dos salvos' })).toBeVisible();

  // página da questão
  await page.getByRole('link', { name: 'Abrir página da questão' }).click();
  await expect(page).toHaveURL(/\/questoes\/[0-9a-f-]{36}/);
  await expect(page.getByRole('radio', { name: /^Alternativa A/ })).toBeVisible();
  await answerCurrent(page, 'A');
  await expectNoHorizontalOverflow(page);
});

test('modo lista e salvar/filtrar salvas (mobile e desktop)', async ({ page }, info) => {
  await signUp(page);
  await page.goto('/questoes?all=true&view=list');
  await expect(page.getByRole('radio', { name: /^Alternativa A/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carregar mais questões' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar questão' }).first().click();
  await expect(page.getByRole('button', { name: 'Remover dos salvos' })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'questoes-lista');
  await page.goto('/questoes?onlySaved=true');
  await expect(page.getByText('1 questão')).toBeVisible();
});

test('grade de matérias: progresso por matéria e volta à grade', async ({ page }) => {
  await signUp(page);
  await page.goto('/questoes');
  const card = page.getByRole('button', { name: /^Matemática/ });
  await expect(card).toContainText(/0 de \d[\d.]* feitas/);
  await card.click();
  await expect(page).toHaveURL(/subjectId=/);
  await answerCurrent(page, 'A');
  await page.getByRole('button', { name: 'Matérias' }).click();
  await expect(page).not.toHaveURL(/subjectId/);
  await expect(page.getByRole('button', { name: /^Matemática/ })).toContainText(
    /1 de \d[\d.]* feitas/,
  );
  await expect(page.getByRole('progressbar', { name: 'Progresso em Matemática' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
});
