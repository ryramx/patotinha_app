import { expect, test, type Page } from '@playwright/test';
import { ADMIN, FUNCIONARIO } from './dados';

/**
 * Tarefa 6.1 (PRD 7.2): login; registrar o pedido do exemplo (R$ 33,00, troco de R$ 17,00
 * para R$ 50,00); ver no histórico; cancelar como admin e ver sair do resumo.
 */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe.configure({ mode: 'serial' });

let numeroPedido = '';

test('CA-01: senha errada mostra a mensagem única e não entra', async ({ page }) => {
  await entrar(page, { login: FUNCIONARIO.login, senha: 'errada-123' });
  await expect(page.getByRole('alert')).toHaveText('Usuário ou senha inválidos');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Usuário')).toHaveValue(FUNCIONARIO.login);
});

test('CA-05 a CA-07: funcionário registra o pedido do exemplo em dinheiro', async ({ page }) => {
  await entrar(page, FUNCIONARIO);
  // Funcionário cai direto em Novo pedido, com a primeira aba aberta.
  await expect(page).toHaveURL(/\/pedidos\/novo$/);
  await expect(page.getByRole('tab', { name: 'Bebidas' })).toBeVisible();
  // Sem menu de administrador (CA-11).
  await expect(page.getByRole('link', { name: 'Produtos' })).toHaveCount(0);

  const produto = (nome: RegExp) =>
    page.getByRole('region', { name: 'Produtos' }).getByRole('button', { name: nome });
  await page.getByRole('tab', { name: 'Pastéis' }).click();
  const carne = produto(/Pastel de Carne/);
  await carne.click();
  await carne.click();
  await produto(/Pastel de Queijo/).click();
  await page.getByRole('tab', { name: 'Bebidas' }).click();
  const coca = produto(/Coca-Cola/);
  await coca.click();
  await coca.click();

  const total = page.getByTestId('total');
  await expect(total).toHaveText('R$ 33,00');
  const itens = page.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem');
  await expect(itens).toHaveCount(3);
  await expect(itens.nth(0)).toContainText('R$ 16,00');
  await expect(itens.nth(1)).toContainText('R$ 7,00');
  await expect(itens.nth(2)).toContainText('R$ 10,00');

  // − na Coca-Cola: total R$ 28,00; + volta a R$ 33,00.
  await page.getByRole('button', { name: 'Diminuir Coca-Cola' }).click();
  await expect(total).toHaveText('R$ 28,00');
  await page.getByRole('button', { name: 'Aumentar Coca-Cola' }).click();
  await expect(total).toHaveText('R$ 33,00');

  // Sem forma de pagamento, Finalizar fica desabilitado com a dica.
  const finalizar = page.getByRole('button', { name: 'Finalizar pedido' });
  await expect(finalizar).toBeDisabled();
  await expect(page.getByText('Escolha a forma de pagamento')).toBeVisible();

  await page.getByRole('radio', { name: /Dinheiro/ }).click();
  const recebido = page.getByLabel('Valor recebido');
  await recebido.click();
  await page.keyboard.type('3000');
  await expect(page.getByRole('status').filter({ hasText: 'Faltam R$ 3,00' })).toBeVisible();
  await expect(finalizar).toBeDisabled();
  await recebido.press('Delete');
  await page.keyboard.type('5000');
  await expect(recebido).toHaveValue('50,00');
  await expect(page.getByText('Troco R$ 17,00')).toBeVisible();

  await finalizar.click();
  const aviso = page.getByRole('status').filter({ hasText: /Pedido nº \d+ registrado, R\$ 33,00/ });
  await expect(aviso).toBeVisible();
  numeroPedido = (await aviso.textContent())!.match(/nº (\d+)/)![1]!;
  await expect(total).toHaveText('R$ 0,00');
  await expect(page.getByText('Toque num produto para começar')).toBeVisible();
});

test('CA-08: o pedido aparece no histórico e no detalhe, como gravado', async ({ page }) => {
  await entrar(page, FUNCIONARIO);
  await page.getByRole('link', { name: 'Histórico' }).click();
  const linha = page.getByRole('row', { name: new RegExp(`^${numeroPedido} `) });
  await expect(linha).toContainText('R$ 33,00');
  await expect(linha).toContainText('Dinheiro');
  await expect(linha).toContainText('Finalizado');
  await expect(linha).toContainText('Maria');
  await expect(page.getByText('Total finalizado no filtro: R$ 33,00 · 1 pedidos')).toBeVisible();

  await linha.click();
  await expect(page.getByRole('heading', { name: `Pedido nº ${numeroPedido}` })).toBeVisible();
  await expect(page.getByText('Recebido R$ 50,00 · Troco R$ 17,00')).toBeVisible();
  // Funcionário não vê o botão de cancelar (CA-09).
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);

  // Tela de administrador pelo endereço direto (CA-01).
  await page.goto('/produtos');
  await expect(page.getByText('Esta área é só para administradores')).toBeVisible();
});

test('CA-09 e CA-10: admin cancela o pedido e ele sai do resumo', async ({ page }) => {
  await entrar(page, ADMIN);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Boa (noite|tarde)|Bom dia/)).toBeVisible();

  await page.goto(`/pedidos/${numeroPedido}`);
  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  const janela = page.getByRole('dialog');
  await expect(janela).toContainText(`Cancelar o pedido nº ${numeroPedido}?`);
  const confirmar = janela.getByRole('button', { name: 'Cancelar pedido' });
  await expect(confirmar).toBeDisabled();
  await janela.getByRole('button', { name: 'Cliente desistiu' }).click();
  await confirmar.click();

  await expect(
    page.getByRole('status').filter({ hasText: `Pedido nº ${numeroPedido} cancelado` }),
  ).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Cancelado por Ana Souza');
  await expect(page.getByRole('note')).toContainText('Motivo: Cliente desistiu');

  await page.getByRole('link', { name: 'Resumo' }).click();
  await expect(page.getByText('Nenhuma venda neste período')).toBeVisible();
  const cancelados = page.locator('.cartao').filter({ hasText: 'Pedidos cancelados' });
  await expect(cancelados).toContainText('1');
  await expect(cancelados).toContainText('R$ 33,00 fora do faturamento');
  const faturamento = page.locator('.cartao').filter({ hasText: 'Faturamento' }).first();
  await expect(faturamento).toContainText('R$ 0,00');
});

test('admin cadastra os ingredientes e eles aparecem no novo pedido', async ({ page }) => {
  await entrar(page, ADMIN);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/produtos');
  await page.getByRole('button', { name: 'Pastel de Carne', exact: true }).click();
  await page.getByLabel(/Ingredientes/).fill('Carne moída, azeitona e ovo');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'salvo' })).toBeVisible();

  await page.goto('/pedidos/novo');
  await page.getByRole('tab', { name: 'Pastéis' }).click();
  const cartao = page.locator('.botao-produto').filter({ hasText: 'Pastel de Carne' }).first();
  await expect(cartao).toContainText('Carne moída, azeitona e ovo');
});
