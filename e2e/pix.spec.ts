import { expect, test, type Page } from '@playwright/test';
import { ADMIN, FUNCIONARIO } from './dados';

/** Etapa 13: Pix com o valor do pedido, com a chave cadastrada pelo administrador. */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function pedidoEmPix(page: Page) {
  await page.goto('/pedidos/novo');
  await page.getByRole('tab', { name: 'Pastéis' }).click();
  await page
    .getByRole('region', { name: 'Produtos' })
    .getByRole('button', { name: /Pastel de Carne/ })
    .click();
  await page.getByLabel('Nome do cliente').fill('Joana');
  await page.getByRole('radio', { name: 'PIX' }).click();
  await page.getByRole('button', { name: 'Mostrar QR Code do Pix' }).click();
  return page.getByRole('dialog', { name: 'Pagar com Pix' });
}

test('sem chave cadastrada avisa; o admin cadastra e o pedido mostra QR Code e copia e cola com o valor', async ({
  browser,
}) => {
  const contexto = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const balcao = await contexto.newPage();
  await entrar(balcao, FUNCIONARIO);
  await expect(balcao).toHaveURL(/\/pedidos\/novo$/);
  const aviso = await pedidoEmPix(balcao);
  await expect(aviso.getByText('O Pix da loja ainda não foi configurado.')).toBeVisible();
  await expect(aviso.getByText(/Peça ao administrador/)).toBeVisible();
  await aviso.getByRole('button', { name: 'Fechar' }).click();

  const admin = await browser.newPage();
  await entrar(admin, ADMIN);
  await admin.getByRole('button', { name: 'Cadastros' }).click();
  await admin.getByRole('menuitem', { name: 'Pix da loja' }).click();
  await expect(admin).toHaveURL(/\/pix$/);
  await admin.getByRole('radio', { name: 'CPF' }).click();
  await admin.getByLabel('Chave Pix').fill('111.111.111-11');
  await admin.getByLabel('Cidade').fill('São Paulo');
  await admin.getByRole('button', { name: 'Salvar Pix' }).click();
  await expect(admin.getByText('CPF inválido. Confira os 11 números')).toBeVisible();
  await admin.getByRole('radio', { name: 'Celular' }).click();
  await admin.getByLabel('Chave Pix').fill('(11) 98765-4321');
  await admin.getByRole('button', { name: 'Salvar Pix' }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Pix da loja salvo' })).toBeVisible();
  await admin.getByRole('button', { name: 'Testar com R$ 1,00' }).click();
  await expect(admin.getByTestId('valor-pix')).toHaveText('R$ 1,00');
  await admin.close();

  // O pedido continua na tela (rascunho); agora o Pix já tem chave.
  await balcao.reload();
  await balcao.getByRole('button', { name: 'Mostrar QR Code do Pix' }).click();
  const janela = balcao.getByRole('dialog', { name: 'Pagar com Pix' });
  await expect(janela.getByTestId('valor-pix')).toHaveText('R$ 8,00');
  await expect(janela.getByTestId('qr-pix')).toBeVisible();
  await expect(janela.getByText('Para Patotinha da Vovo · Celular +5511987654321')).toBeVisible();
  const codigo = await janela.getByLabel('Pix copia e cola').inputValue();
  expect(codigo).toMatch(
    /^000201.*br\.gov\.bcb\.pix0114\+5511987654321.*54048\.00.*6009Sao Paulo.*6304[0-9A-F]{4}$/,
  );
  await janela.getByRole('button', { name: 'Copiar Pix copia e cola' }).click();
  await expect(janela.getByRole('button', { name: 'Copiado! Cole no app do banco' })).toBeVisible();
  expect(await balcao.evaluate(() => navigator.clipboard.readText())).toBe(codigo);
  await contexto.close();
});
