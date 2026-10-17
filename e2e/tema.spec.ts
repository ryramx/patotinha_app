import { expect, test } from '@playwright/test';
import { FUNCIONARIO } from './dados';

/** Botão de Modo Escuro no cabeçalho: troca o tema e o aparelho lembra da escolha. */
test('Modo Escuro e Modo Claro pelo botão do cabeçalho, lembrado ao recarregar', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(FUNCIONARIO.login);
  await page.getByLabel('Senha', { exact: true }).fill(FUNCIONARIO.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-tema', 'claro');
  await page.getByRole('button', { name: 'Modo escuro' }).click();
  await expect(html).toHaveAttribute('data-tema', 'escuro');

  await page.reload();
  await expect(html).toHaveAttribute('data-tema', 'escuro');
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(html).toHaveAttribute('data-tema', 'claro');
});
