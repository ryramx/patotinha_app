import { expect, test, type Page } from '@playwright/test';
import { CHEF_NOVO, NOVATO } from './dados';

/** Etapa 12: tutorial em cards no primeiro acesso e lâmpada com a ajuda de cada tela. */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('primeiro acesso: os cards seguem o perfil, aparecem uma vez e voltam pelo menu', async ({
  page,
}) => {
  await entrar(page, NOVATO);
  const tutorial = page.getByRole('dialog');
  await expect(tutorial).toContainText('Olá, Nina!');
  await expect(tutorial).toContainText('perfil Funcionário');
  // Funcionário só registra pedidos: boas-vindas, Novo pedido, topo e lâmpada.
  await expect(tutorial).toContainText('1 de 4');
  await tutorial.getByRole('button', { name: 'Próximo' }).click();
  await expect(tutorial).toContainText('Novo pedido: a venda no balcão');
  await page.keyboard.press('ArrowRight');
  await expect(tutorial).toContainText('No alto da tela');
  await tutorial.getByRole('button', { name: 'Próximo' }).click();
  await expect(tutorial).toContainText('Toque na lâmpada');
  await tutorial.getByRole('button', { name: 'Começar a usar' }).click();
  await expect(tutorial).toHaveCount(0);

  // Guardado no servidor: recarregar ou entrar de novo não abre mais sozinho.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Finalizar pedido' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: /Nina/ }).click();
  await page.getByRole('menuitem', { name: 'Ver tutorial' }).click();
  await expect(page.getByRole('dialog')).toContainText('1 de 4');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a lâmpada explica a tela aberta, com os passos do perfil', async ({ page }) => {
  await entrar(page, CHEF_NOVO);
  const tutorial = page.getByRole('dialog');
  await tutorial.getByRole('button', { name: 'Próximo' }).click();
  // O Chef só abre a Fila: não vê os cards de Novo pedido, Histórico, Resumo nem cadastros.
  await expect(tutorial).toContainText('Fila de preparo: as comandas da cozinha');
  await tutorial.getByRole('button', { name: 'Pular' }).click();
  await expect(tutorial).toHaveCount(0);

  await page.getByRole('button', { name: 'Como funciona: Fila de preparo' }).click();
  const ajuda = page.getByRole('dialog', { name: 'Como funciona: Fila de preparo' });
  await expect(ajuda).toContainText('Começar preparo');
  await expect(page).toHaveURL(/\/fila$/);
  await ajuda.getByRole('button', { name: 'Entendi' }).click();
  await expect(ajuda).toHaveCount(0);

  // "Ver tutorial" da lâmpada reabre os cards.
  await page.getByRole('button', { name: 'Como funciona: Fila de preparo' }).click();
  await page.getByRole('button', { name: 'Ver tutorial' }).click();
  await expect(page.getByRole('dialog')).toContainText('Olá, Rui!');
});
