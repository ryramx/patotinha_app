import { expect, test, type Page } from '@playwright/test';
import { ADMIN, FUNCIONARIO } from './dados';

/**
 * Tela de Novo pedido no computador (1366 x 768) e no tablet na horizontal (tarefa 6.3),
 * mais RNF-04, RNF-09, rascunho, busca e o caso de preço alterado durante o pedido.
 */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** As abas vêm em ordem alfabética (Bebidas primeiro); abre a de Pastéis. */
async function abrirPasteis(page: Page) {
  await page.getByRole('tab', { name: 'Pastéis' }).click();
}

test('Novo pedido abre em até 2 s após o login e o rodapé do painel fica visível', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(FUNCIONARIO.login);
  await page.getByLabel('Senha', { exact: true }).fill(FUNCIONARIO.senha);
  // RNF-04: conta do clique em Entrar até os produtos aparecerem.
  const inicio = Date.now();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('region', { name: 'Produtos' }).getByRole('button').first(),
  ).toBeVisible();
  expect(Date.now() - inicio).toBeLessThan(2000);
  await abrirPasteis(page);
  const finalizar = page.getByRole('button', { name: 'Finalizar pedido' });
  await expect(finalizar).toBeInViewport();
  await expect(page.getByTestId('total')).toBeInViewport();
});

test('RNF-09: pedido de 3 itens em até 8 toques, e o rascunho sobrevive a recarregar', async ({
  page,
}) => {
  await entrar(page, FUNCIONARIO);
  await abrirPasteis(page);
  let toques = 0;
  const tocar = async (nome: RegExp | string, papel: 'button' | 'radio' | 'tab' = 'button') => {
    toques++;
    const area =
      papel === 'button' && nome instanceof RegExp
        ? page.getByRole('region', { name: 'Produtos' })
        : page;
    await area.getByRole(papel, { name: nome }).click();
  };
  await tocar(/Pastel de Carne/);
  await tocar(/Pastel de Queijo/);
  await tocar(/Pastel de Frango/);
  await expect(page.getByTestId('total')).toHaveText('R$ 23,00');

  // Recarregar não perde o pedido (H-22): o sistema oferece continuar.
  await page.reload();
  const janela = page.getByRole('dialog');
  if (await janela.isVisible().catch(() => false)) {
    await janela.getByRole('button', { name: 'Continuar pedido anterior' }).click();
  }
  await expect(page.getByTestId('total')).toHaveText('R$ 23,00');

  // Nome do cliente: um toque no campo e digitar (comanda).
  toques++;
  await page.getByLabel('Nome do cliente').fill('Rafa');
  await tocar(/PIX/, 'radio');
  await tocar('Finalizar pedido');
  await expect(page.getByRole('status').filter({ hasText: /registrado, R\$ 23,00/ })).toBeVisible();
  expect(toques).toBeLessThanOrEqual(8);
});

test('Busca sem acento, Enter adiciona o primeiro e remoção com Desfazer', async ({ page }) => {
  await entrar(page, FUNCIONARIO);
  await abrirPasteis(page);
  const busca = page.getByRole('searchbox', { name: 'Buscar produto' });
  await page.keyboard.press('/');
  await expect(busca).toBeFocused();
  await page.keyboard.type('guarana');
  await expect(
    page.getByRole('region', { name: 'Produtos' }).getByRole('button', { name: /Guaraná/ }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(busca).toHaveValue('');
  await expect(page.getByTestId('total')).toHaveText('R$ 5,00');

  await page.getByRole('button', { name: 'Remover Guaraná' }).click();
  await expect(page.getByTestId('total')).toHaveText('R$ 0,00');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByTestId('total')).toHaveText('R$ 5,00');

  await busca.fill('xyz');
  await expect(page.getByText('Nenhum produto com ‘xyz’')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar pedido' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Limpar pedido' }).click();
});

test('CA-04: preço alterado durante o pedido é recusado e a linha mostra o novo preço', async ({
  page,
  browser,
}) => {
  await entrar(page, FUNCIONARIO);
  await abrirPasteis(page);
  await page.getByRole('tab', { name: 'Doces' }).click();
  await page
    .getByRole('region', { name: 'Produtos' })
    .getByRole('button', { name: /Pastel de Chocolate/ })
    .click();
  await page.getByLabel('Nome do cliente').fill('Carla');
  await page.getByRole('radio', { name: /PIX/ }).click();

  // O administrador muda o preço em outra janela.
  const outra = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const admin = await outra.newPage();
  await entrar(admin, ADMIN);
  await expect(admin).toHaveURL(/\/$/);
  await admin.getByRole('link', { name: 'Produtos' }).click();
  await admin
    .getByRole('row', { name: /Pastel de Chocolate/ })
    .getByRole('button', { name: 'Editar' })
    .click();
  const preco = admin.getByLabel('Preço');
  await preco.click();
  await preco.press('Delete');
  await admin.keyboard.type('1000');
  await expect(admin.getByText('O novo preço vale para pedidos a partir de agora')).toBeVisible();
  await admin.getByRole('button', { name: 'Salvar' }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Produto salvo' })).toBeVisible();
  await outra.close();

  await page.getByRole('button', { name: 'Finalizar pedido' }).click();
  await expect(page.getByText('Preço mudou de R$ 9,00 para R$ 10,00')).toBeVisible();
  await expect(page.getByTestId('total')).toHaveText('R$ 10,00');
  // O funcionário confirma de novo e finaliza.
  await page.getByRole('button', { name: 'Finalizar pedido' }).click();
  await expect(page.getByRole('status').filter({ hasText: /registrado, R\$ 10,00/ })).toBeVisible();
});
