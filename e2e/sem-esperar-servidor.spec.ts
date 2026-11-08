import { expect, test, type Page } from '@playwright/test';
import { ADMIN, FUNCIONARIO, GERENTE } from './dados';

/**
 * Etapa 17 (docs/abrir-sem-esperar.md): o sistema abre na hora, sem esperar a API do Render
 * acordar. Simula a API dormindo: toda chamada a /api responde 503 com a página HTML do Render.
 *
 * Roda depois do fluxo-principal (os arquivos vão em ordem alfabética), que exige o Resumo de hoje
 * sem vendas nem cancelamentos.
 */

test.use({ serviceWorkers: 'block' });

async function dormirApi(page: Page) {
  const api = { dormindo: true };
  await page.route('**/api/**', async (rota) => {
    if (api.dormindo) {
      await rota.fulfill({ status: 503, contentType: 'text/html', body: '<html>acordando</html>' });
    } else {
      await rota.fallback();
    }
  });
  return api;
}

async function preencherLogin(page: Page, u: { login: string; senha: string }) {
  await page.getByLabel('Usuário').fill(u.login);
  await page.getByLabel('Senha', { exact: true }).fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function entrar(page: Page, u: { login: string; senha: string }) {
  await page.goto('/login');
  await preencherLogin(page, u);
  await expect(page).not.toHaveURL(/\/login$/);
}

test('com a API dormindo, o login abre na hora e a primeira entrada espera ela acordar', async ({
  page,
}) => {
  const api = await dormirApi(page);
  await page.goto('/');
  // Nada de tela "Carregando…": o login aparece direto.
  await expect(page.getByLabel('Usuário')).toBeVisible({ timeout: 3_000 });

  // O aparelho ainda não conhece esta senha: só o servidor pode conferir.
  await preencherLogin(page, FUNCIONARIO);
  await expect(page.getByText(/Conectando ao servidor… Na primeira entrada/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  api.dormindo = false;
  await expect(page).toHaveURL(/\/pedidos\/novo$/, { timeout: 20_000 });
});

test('com a sessão lembrada, abre na hora, guarda o pedido e envia quando a API acorda', async ({
  page,
  browser,
}) => {
  await entrar(page, FUNCIONARIO);
  await expect(page).toHaveURL(/\/pedidos\/novo$/);
  // Cardápio carregado uma vez: fica a cópia no aparelho.
  await expect(page.getByRole('tab', { name: 'Pastéis' })).toBeVisible();

  const api = await dormirApi(page);
  await page.reload();
  // Abre com a sessão lembrada e o cardápio da cópia, sem esperar o servidor.
  await expect(page.getByRole('tab', { name: 'Pastéis' })).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('faixa-conexao')).toContainText('Conectando ao servidor…');
  await expect(page.getByTestId('faixa-conexao')).toContainText('Pode registrar pedidos');

  await page.getByRole('tab', { name: 'Pastéis' }).click();
  const produtos = page.getByRole('region', { name: 'Produtos' });
  await produtos.getByRole('button', { name: /Pastel de Queijo/ }).click();
  await page.getByLabel('Nome do cliente').fill('Seu Tonho');
  await page.getByRole('button', { name: 'Pagar depois' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /Seu Tonho .* guardado neste aparelho/ }),
  ).toBeVisible();
  await expect(page.getByTestId('faixa-conexao')).toContainText('1 pedido guardado neste aparelho');
  // O caixa segue: a tela já está limpa para o próximo pedido.
  await expect(page.getByLabel('Nome do cliente')).toHaveValue('');

  api.dormindo = false;
  const chegou = page.getByRole('status').filter({ hasText: /de Seu Tonho chegou ao servidor/ });
  await expect(chegou).toBeVisible({ timeout: 20_000 });
  const numero = (await chegou.textContent())!.match(/nº (\d+)/)![1];
  await expect(page.getByTestId('faixa-conexao')).toHaveCount(0);

  // Chegou uma vez só, mesmo depois de recarregar.
  await page.reload();
  await page.getByRole('link', { name: 'A receber' }).first().click();
  await expect(page.getByRole('article', { name: /Seu Tonho/ })).toHaveCount(1);

  // Limpeza: os próximos testes contam a fila e o A receber do zero.
  const contexto = await browser.newContext({ serviceWorkers: 'block' });
  const admin = await contexto.newPage();
  await entrar(admin, ADMIN);
  const cancelado = await admin.request.patch(`/api/pedidos/${numero}/cancelar`, {
    data: { motivo: 'Teste de pedido guardado' },
  });
  expect(cancelado.status()).toBe(200);
  await contexto.close();
});

test('pedido guardado que o servidor recusa fica avisado e volta ao Novo pedido', async ({
  page,
}) => {
  await entrar(page, FUNCIONARIO);
  await expect(page.getByRole('tab', { name: 'Pastéis' })).toBeVisible();
  const api = await dormirApi(page);
  await page.reload();
  await expect(page.getByTestId('faixa-conexao')).toBeVisible();

  await page.getByRole('tab', { name: 'Pastéis' }).click();
  const produtos = page.getByRole('region', { name: 'Produtos' });
  await produtos.getByRole('button', { name: /Pastel de Queijo/ }).click();
  await page.getByLabel('Nome do cliente').fill('Dona Cida');
  await page.getByRole('button', { name: 'Pagar depois' }).click();
  await expect(page.getByLabel('Nome do cliente')).toHaveValue('');

  // Quando acorda, o servidor recusa (como se o produto tivesse sido desativado).
  await page.route('**/api/pedidos', async (rota) => {
    if (rota.request().method() !== 'POST') return rota.fallback();
    await rota.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        erro: { codigo: 'PRODUTO_INATIVO', mensagem: 'Pastel de Queijo não está mais disponível' },
      }),
    });
  });
  api.dormindo = false;

  const alerta = page.getByRole('alert').filter({ hasText: /O pedido de Dona Cida/ });
  await expect(alerta).toContainText('Pastel de Queijo não está mais disponível', {
    timeout: 20_000,
  });
  await alerta.getByRole('button', { name: 'Abrir no Novo pedido' }).click();
  await expect(page.getByLabel('Nome do cliente')).toHaveValue('Dona Cida');
  await expect(page.getByRole('list', { name: 'Itens do pedido' })).toContainText(
    'Pastel de Queijo',
  );
  await expect(alerta).toHaveCount(0);
});

test('senha que o aparelho já conhece entra na hora; o login de verdade vem quando a API acorda', async ({
  page,
}) => {
  await entrar(page, GERENTE);
  await page.getByRole('button', { name: /Gil/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByLabel('Usuário')).toBeVisible();

  const api = await dormirApi(page);
  // Senha errada: o aparelho não confirma, então espera o servidor, que recusa.
  await preencherLogin(page, { login: GERENTE.login, senha: 'senha-errada' });
  await expect(page.getByText(/Conectando ao servidor… Na primeira entrada/)).toBeVisible();
  api.dormindo = false;
  await expect(page.getByRole('alert')).toContainText('Usuário ou senha inválidos', {
    timeout: 20_000,
  });

  api.dormindo = true;
  await page.reload();
  await preencherLogin(page, GERENTE);
  // Entrou sem esperar: a tela já é a do sistema, com o aviso de conexão.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 3_000 });
  await expect(page.getByRole('status', { name: 'Conectando ao servidor' })).toBeVisible();

  api.dormindo = false;
  await expect(page.getByRole('status', { name: 'Conectado ao servidor' })).toBeVisible({
    timeout: 20_000,
  });
  // O cookie de sessão veio do login feito em segundo plano.
  await expect
    .poll(async () => (await page.request.get('/api/auth/me')).status(), { timeout: 10_000 })
    .toBe(200);
});
