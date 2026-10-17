import { expect, test, type Page } from '@playwright/test';
import { ADMIN, CHEF } from './dados';

/** Etapa 10: o administrador muda as permissões de um perfil e vale na hora. */

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('admin libera "Ver pedidos" para o Chef e depois volta ao padrão', async ({ browser }) => {
  const admin = await browser.newPage();
  await entrar(admin, ADMIN);
  await expect(admin).toHaveURL(/\/$/);
  await admin.getByRole('button', { name: 'Cadastros' }).click();
  await admin.getByRole('menuitem', { name: 'Perfis e permissões' }).click();
  await expect(admin).toHaveURL(/\/perfis$/);

  const cartaoAdmin = admin.getByRole('region', { name: 'Administrador' });
  await expect(cartaoAdmin.getByRole('switch', { checked: true })).toHaveCount(7);
  await expect(cartaoAdmin.getByRole('switch').first()).toBeDisabled();

  const chef = admin.getByRole('region', { name: 'Chef' });
  await expect(chef.getByRole('switch', { name: /Fila de preparo/ })).toBeChecked();
  const ver = chef.getByRole('switch', { name: /Ver pedidos/ });
  await expect(ver).not.toBeChecked();
  await ver.click();
  await chef.getByRole('button', { name: 'Salvar permissões' }).click();
  await expect(
    admin.getByRole('status').filter({ hasText: 'Permissões do perfil Chef salvas' }),
  ).toBeVisible();

  const cozinha = await browser.newPage();
  await entrar(cozinha, CHEF);
  await expect(cozinha).toHaveURL(/\/fila$/);
  await expect(cozinha.getByRole('link', { name: 'Histórico', exact: true }).first()).toBeVisible();
  await cozinha.goto('/pedidos');
  await expect(cozinha.getByText('Seu perfil não tem acesso a esta tela')).toHaveCount(0);

  await admin
    .getByRole('region', { name: 'Chef' })
    .getByRole('button', { name: 'Voltar ao padrão' })
    .click();
  await admin
    .getByRole('region', { name: 'Chef' })
    .getByRole('button', { name: 'Salvar permissões' })
    .click();
  await expect(
    admin.getByRole('region', { name: 'Chef' }).getByRole('switch', { name: /Ver pedidos/ }),
  ).not.toBeChecked();

  // Sem sair: a próxima chamada já é recusada pela API.
  await cozinha.reload();
  await expect(cozinha.getByText('Seu perfil não tem acesso a esta tela')).toBeVisible();
});
