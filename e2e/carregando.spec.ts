import { expect, test } from '@playwright/test';

/**
 * Etapa 9: enquanto a API acorda, aparece a tela "Carregando…" com a logo, e não a do Render.
 * Simula a API dormindo: as primeiras respostas de /api/vivo falham como no Render.
 */
test('mostra "Carregando…" enquanto a API acorda e depois abre o login', async ({ page }) => {
  let tentativas = 0;
  await page.route('**/api/vivo', async (rota) => {
    tentativas += 1;
    if (tentativas <= 3) {
      await rota.fulfill({ status: 503, contentType: 'text/html', body: '<html>acordando</html>' });
    } else {
      await rota.continue();
    }
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Carregando…');
  await expect(page.getByRole('img', { name: 'Patotinha da Vovó' })).toBeVisible();

  await expect(page.getByLabel('Usuário')).toBeVisible({ timeout: 20_000 });
  expect(tentativas).toBeGreaterThan(3);
});

test('resposta rápida da API não mostra a mensagem de espera', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Usuário')).toBeVisible();
  await expect(page.getByText('Carregando…')).toHaveCount(0);
  // O aviso de espera não pode aparecer depois que a tela já abriu.
  await page.waitForTimeout(3_500);
  await expect(page.getByLabel('Usuário')).toBeVisible();
  await expect(page.getByText('Carregando…')).toHaveCount(0);
});
