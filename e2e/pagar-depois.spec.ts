import { expect, test, type Page } from '@playwright/test';
import { CHEF, FUNCIONARIO } from './dados';

/** Etapa 15: o cliente come primeiro e paga no fim. */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('Pagar depois manda para a cozinha sem pagamento e o balcão recebe no fim', async ({
  browser,
}) => {
  const balcao = await browser.newPage();
  await entrar(balcao, FUNCIONARIO);
  await expect(balcao).toHaveURL(/\/pedidos\/novo$/);
  await balcao.getByRole('tab', { name: 'Pastéis' }).click();
  const produtos = balcao.getByRole('region', { name: 'Produtos' });
  await produtos.getByRole('button', { name: /Pastel de Queijo/ }).click();
  await produtos.getByRole('button', { name: /Pastel de Queijo/ }).click();
  await balcao.getByLabel('Nome do cliente').fill('Dona Lurdes');
  // Sem forma de pagamento: Finalizar fica travado, Pagar depois não.
  await expect(balcao.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
  await balcao.getByRole('button', { name: 'Pagar depois' }).click();
  await expect(
    balcao.getByRole('status').filter({ hasText: /de Dona Lurdes foi para a cozinha/ }),
  ).toBeVisible();

  const cozinha = await browser.newPage();
  await entrar(cozinha, CHEF);
  const cartao = cozinha.getByRole('article', { name: /Dona Lurdes/ });
  await expect(cartao.getByText('Paga no fim')).toBeVisible();

  await balcao.getByRole('link', { name: 'A receber' }).first().click();
  await expect(balcao).toHaveURL(/\/receber$/);
  const aReceber = balcao.getByRole('article', { name: /Dona Lurdes/ });
  await expect(aReceber).toContainText('R$ 14,00');
  await expect(balcao.getByText('1 a receber · R$ 14,00')).toBeVisible();
  await aReceber.getByRole('button', { name: 'Receber' }).click();
  const janela = balcao.getByRole('dialog', { name: /Receber pedido nº/ });
  await expect(janela.getByRole('button', { name: 'Confirmar pagamento' })).toBeDisabled();
  await janela.getByRole('radio', { name: 'Dinheiro' }).click();
  await janela.getByLabel('Valor recebido').click();
  await balcao.keyboard.type('2000');
  await expect(janela.getByRole('status').filter({ hasText: 'Troco R$ 6,00' })).toBeVisible();
  await janela.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(balcao.getByRole('status').filter({ hasText: /recebido, R\$ 14,00/ })).toBeVisible();
  await expect(balcao.getByText('Nenhum pedido esperando pagamento.')).toBeVisible();

  await cozinha.reload();
  await expect(cozinha.getByRole('article', { name: /Dona Lurdes/ })).toBeVisible();
  await expect(
    cozinha.getByRole('article', { name: /Dona Lurdes/ }).getByText('Paga no fim'),
  ).toHaveCount(0);
});
