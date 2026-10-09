import { Botao } from '../componentes/Botao';
import { Janela } from '../componentes/Janela';
import { t } from '../textos';

const ATALHOS: [string, string, string][] = [
  ['F1', 'Qualquer tela', 'Abrir Novo pedido'],
  ['/', 'Novo pedido', 'Ir para a busca de produtos'],
  ['Enter', 'Busca com texto', 'Adicionar o primeiro produto encontrado'],
  ['Esc', 'Busca', 'Limpar a busca'],
  ['Esc', 'Janela ou painel', 'Fechar sem salvar'],
  ['← →', 'Abas de categoria', 'Trocar de categoria'],
  ['F2 / F3 / F4 / F5', 'Novo pedido', 'Dinheiro / PIX / Débito / Crédito'],
  ['Ctrl+Enter', 'Novo pedido', 'Finalizar pedido'],
  ['Ctrl+Z', 'Novo pedido', 'Desfazer a remoção (até 5 s)'],
  ['?', 'Qualquer tela', 'Mostrar esta lista'],
];

export function JanelaAtalhos({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Janela
      titulo={t('menu.atalhos')}
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <Botao variante="secundario" autoFocus onClick={aoFechar}>
          {t('cadastro.fechar')}
        </Botao>
      }
    >
      <table className="w-full text-left">
        <thead className="legenda">
          <tr>
            <th className="py-1 pr-3 font-semibold">Tecla</th>
            <th className="py-1 pr-3 font-semibold">Onde</th>
            <th className="py-1 font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody>
          {ATALHOS.map(([tecla, onde, acao], i) => (
            <tr key={i} className="border-t border-borda">
              <td className="py-2 pr-3">
                <kbd className="rounded border border-borda bg-superficie px-1.5 py-0.5 font-bold">
                  {tecla}
                </kbd>
              </td>
              <td className="py-2 pr-3 text-texto-suave">{onde}</td>
              <td className="py-2">{acao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Janela>
  );
}
