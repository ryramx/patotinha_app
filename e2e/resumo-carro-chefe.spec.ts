import { expect, test } from '@playwright/test';
import { ADMIN } from './dados';

/**
 * Etapa 14: o Resumo mostra o carro-chefe (o produto que mais saiu) de cada categoria.
 * Roda depois do fluxo principal, que conta com o Resumo de hoje sem vendas.
 */

// Ids do cardápio semeado em e2e/preparar.ts. Outros testes já venderam pastel de carne e
// Coca-Cola hoje; as quantidades altas daqui garantem quem fica na frente.
const CARNE = 1;
const FRANGO = 3;
const GUARANA = 5;

test('o Resumo mostra o carro-chefe de cada categoria', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(ADMIN.login);
  await page.getByLabel('Senha', { exact: true }).fill(ADMIN.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);

  const pedidos = [
    [
      { produtoId: CARNE, quantidade: 1, precoExibido: '8.00' },
      { produtoId: GUARANA, quantidade: 30, precoExibido: '5.00' },
    ],
    [{ produtoId: FRANGO, quantidade: 20, precoExibido: '8.00' }],
  ];
  for (const itens of pedidos) {
    const r = await page.request.post('/api/pedidos', {
      data: {
        chaveIdempotencia: crypto.randomUUID(),
        cliente: 'Joana',
        formaPagamento: 'PIX',
        itens,
      },
    });
    expect(r.status()).toBe(201);
  }

  await page.goto('/resumo');
  const secao = page.getByRole('region', { name: 'Carro-chefe de cada categoria' });
  const cartoes = secao.getByTestId('carro-chefe');
  await expect(cartoes).toHaveCount(2);
  await expect(cartoes.nth(0)).toContainText('Pastéis');
  await expect(cartoes.nth(0)).toContainText('Pastel de Frango');
  await expect(cartoes.nth(0)).toContainText(/\d+ vendidos · R\$ [\d.]+,\d{2}/);
  await expect(cartoes.nth(1)).toContainText('Bebidas');
  await expect(cartoes.nth(1)).toContainText('Guaraná');
});
