import { expect, test, type Page } from '@playwright/test';
import { FUNCIONARIO } from './dados';

/** Clientes (versão leve): quem já pediu aparece como sugestão no campo do nome. */

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(FUNCIONARIO.login);
  await page.getByLabel('Senha', { exact: true }).fill(FUNCIONARIO.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('tab', { name: 'Pastéis' }).click();
}

async function finalizarComPix(page: Page, cliente: string) {
  await page.getByRole('radio', { name: /PIX/ }).click();
  await page.getByRole('button', { name: 'Finalizar pedido' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: new RegExp(`de ${cliente} registrado`) })
      .last(),
  ).toBeVisible();
}

test('o segundo pedido do mesmo cliente sai escolhendo a sugestão, com o telefone', async ({
  page,
}) => {
  await entrar(page);
  const produtos = page.getByRole('region', { name: 'Produtos' });
  const nome = page.getByLabel('Nome do cliente');

  // Primeiro pedido: nome novo e telefone, que é opcional e fica escondido até pedir.
  await produtos.getByRole('button', { name: /Pastel de Carne/ }).click();
  await expect(page.getByLabel('Telefone (opcional)')).toHaveCount(0);
  await nome.fill('Seu Benedito');
  await page.getByRole('button', { name: 'Adicionar telefone (opcional)' }).click();
  const telefone = page.getByLabel('Telefone (opcional)');
  await telefone.fill('11987654');
  await expect(page.getByText('Telefone com DDD, como (11) 98765-4321').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
  await telefone.pressSequentially('321');
  await expect(telefone).toHaveValue('(11) 98765-4321');
  await finalizarComPix(page, 'Seu Benedito');
  await expect(nome).toHaveValue('');
  await expect(page.getByLabel('Telefone (opcional)')).toHaveCount(0);

  // Segundo pedido: três letras, sem acento, e a sugestão já aparece.
  await produtos.getByRole('button', { name: /Pastel de Queijo/ }).click();
  await nome.fill('bene');
  const sugestao = page.getByRole('option', { name: /Seu Benedito/ });
  await expect(sugestao).toBeVisible();
  await expect(sugestao).toContainText('(11) 98765-4321');
  await expect(sugestao).toContainText('1 pedido');

  // Pelo teclado: seta para baixo e Enter.
  await nome.press('ArrowDown');
  await nome.press('Enter');
  await expect(nome).toHaveValue('Seu Benedito');
  // O telefone do cadastro aparece numa linha só, com opção de trocar.
  await expect(page.getByTestId('telefone-cliente')).toHaveText('(11) 98765-4321');
  await expect(page.getByLabel('Telefone (opcional)')).toHaveCount(0);
  await expect(page.getByRole('listbox')).toHaveCount(0);

  // Trocar o nome depois de escolher tira o telefone que veio da sugestão.
  await nome.fill('Seu Benedito Filho');
  await expect(page.getByLabel('Telefone (opcional)')).toHaveCount(0);
  await expect(page.getByTestId('telefone-cliente')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar telefone (opcional)' })).toBeVisible();
  await nome.fill('Seu B');
  await page.getByRole('option', { name: /Seu Benedito/ }).click();
  await expect(nome).toHaveValue('Seu Benedito');
  await finalizarComPix(page, 'Seu Benedito');

  // Nome que ninguém usou: nenhuma sugestão, e o pedido sai normalmente.
  await produtos.getByRole('button', { name: /Pastel de Carne/ }).click();
  await nome.fill('Zuleide');
  await page.waitForTimeout(400);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await finalizarComPix(page, 'Zuleide');
});
