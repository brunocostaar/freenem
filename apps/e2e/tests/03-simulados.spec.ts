import { test, expect, signUp, setTheme, shot, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';

const COUNT = 10;

async function startCustomMath(page: Page) {
  await page.goto('/simulados');
  await page.getByRole('button', { name: 'Novo simulado' }).first().click();
  await page.getByRole('tab', { name: 'Personalizado' }).click();
  await page.getByRole('group', { name: 'Áreas' }).getByRole('button', { name: /Matem/ }).click();
  await page.getByLabel(/Quantidade de questões/).fill(String(COUNT));
  await page
    .getByLabel('Tempo')
    .selectOption({ label: '1 h 30 min' })
    .catch(async () => {
      await page.getByLabel('Tempo').selectOption({ index: 3 });
    });
  await page.getByRole('button', { name: 'Criar e começar' }).click();
  await page.waitForURL(/\/simulados\/[0-9a-f-]+\/fazer/);
  await expect(page.getByText(new RegExp(`Questão 1 de ${COUNT}`))).toBeVisible();
}

const openGrid = async (page: Page) => {
  // no mobile a grade fica numa folha aberta pelo botão
  const btn = page.getByRole('button', { name: 'Abrir navegação de questões' });
  if (await btn.isVisible()) await btn.click();
};

test('simulado personalizado: responder, marcar, grade, retomar após reload, finalizar e ver resultado', async ({
  page,
}, info) => {
  await signUp(page);
  await startCustomMath(page);
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'simulado-runner-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'simulado-runner-dark');
  await setTheme(page, 'light');

  const radio = (l: string) => page.locator(`input[type=radio][value=${l}]`);
  const pick = (l: string) => radio(l).locator('xpath=..');
  const next = page.getByRole('button', { name: 'Próxima' });

  // responde as 8 primeiras com letras variadas
  const letters = ['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C'];
  for (let i = 0; i < letters.length; i++) {
    await pick(letters[i]!).click();
    await expect(radio(letters[i]!)).toBeChecked();
    if (i === 1) await page.getByRole('button', { name: 'Revisar depois' }).click();
    await next.click();
  }
  await expect(page.getByText(`Questão 9 de ${COUNT}`)).toBeVisible();
  await expect(page.getByText(/2 em branco/)).toBeVisible();

  // grade: volta para a questão 2 (marcada)
  await openGrid(page);
  await page.getByRole('button', { name: /^Questão 2, respondida, marcada para revisar/ }).click();
  await expect(page.getByText(`Questão 2 de ${COUNT}`)).toBeVisible();
  await expect(radio('B')).toBeChecked();

  // recarrega no meio da prova e retoma
  await page.waitForTimeout(1500); // autosave
  await page.reload();
  await expect(page.getByText(/Questão \d+ de 10/)).toBeVisible();
  await expect(page.getByText(/2 em branco/)).toBeVisible();
  await openGrid(page);
  await page.getByRole('button', { name: /^Questão 1, respondida/ }).click();
  await expect(radio('A')).toBeChecked();
  await openGrid(page);
  await expect(
    page.getByRole('button', { name: /^Questão 2, respondida, marcada para revisar/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // finalizar
  await page.getByRole('button', { name: 'Finalizar' }).first().click();
  await expect(page.getByText(/2 questões em branco/)).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar agora' }).click();
  await page.waitForURL(/\/resultado/);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resultado');
  await expect(page.locator('dt', { hasText: 'Acertos' })).toBeVisible();
  await expect(page.getByText('Nota TRI estimada')).toBeVisible();
  await expect(page.getByText('Sem nota TRI')).toHaveCount(0);
  await expect(page.getByText('Revisão questão a questão')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, info.project.name, 'resultado-light');
  await setTheme(page, 'dark');
  await shot(page, info.project.name, 'resultado-dark');
  await setTheme(page, 'light');

  // revisão por questão
  await page.getByRole('button', { name: /^Todas \(/ }).click();
  await page.getByText('Questão 1', { exact: true }).first().click();
  await expect(page.getByText(/Gabarito:/).first()).toBeVisible();

  // aparece na lista de simulados com a nota
  await page.goto('/simulados');
  await expect(page.getByText(/nota estimada/)).toBeVisible();
});

test('simulado oficial ENEM 2023 Dia 2 / Matemática e língua do Dia 1', async ({ page }, info) => {
  await signUp(page);
  await page.goto('/simulados');
  await page.getByRole('button', { name: 'Novo simulado' }).first().click();
  await page.getByLabel('Ano').selectOption('2023');
  const exam = page.getByLabel('Prova / dia');
  await exam.selectOption({
    label: (await exam.locator('option', { hasText: 'Dia 2' }).textContent())!,
  });
  await page.getByLabel('Área').selectOption({ index: 0 });
  const areaSel = page.getByLabel('Área');
  const mat = areaSel.locator('option', { hasText: /Matem/ });
  const matText = (await mat.textContent())!;
  const expected = Number(/\((\d+)\)/.exec(matText)![1]);
  await areaSel.selectOption({ label: matText });
  await expect(page.getByText(new RegExp(`^${expected} questões`))).toBeVisible();
  await shot(page, info.project.name, 'simulados-novo');
  await page.getByRole('button', { name: 'Criar e começar' }).click();
  await page.waitForURL(/\/fazer/);
  await expect(page.getByText(new RegExp(`Questão 1 de ${expected}\\b`))).toBeVisible();

  // Dia 1: oferece língua; a contagem muda ao trocar e não mistura inglês+espanhol
  await page.goto('/simulados');
  await page.getByRole('button', { name: 'Novo simulado' }).first().click();
  await page.getByLabel('Ano').selectOption('2023');
  const exam1 = page.getByLabel('Prova / dia');
  await exam1.selectOption({
    label: (await exam1.locator('option', { hasText: 'Dia 1' }).textContent())!,
  });
  const lang = page.getByLabel('Língua estrangeira');
  await expect(lang).toBeVisible();
  const countText = async () => (await page.getByText(/^\d+ questões ·/).textContent())!;
  const total = Number(/^(\d+)/.exec(await countText())![1]);
  await lang.selectOption('espanhol');
  const totalEs = Number(/^(\d+)/.exec(await countText())![1]);
  expect(total).toBeGreaterThan(5);
  expect(Math.abs(total - totalEs)).toBeLessThan(10);
  await page.getByRole('button', { name: 'Criar e começar' }).click();
  await page.waitForURL(/\/fazer/);
  await expect(page.getByText(new RegExp(`Questão 1 de ${totalEs}\\b`))).toBeVisible();
});
