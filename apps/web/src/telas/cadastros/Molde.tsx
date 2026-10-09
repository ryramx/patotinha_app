import { useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { Botao } from '../../componentes/Botao';
import { Confirmacao, PainelLateral } from '../../componentes/Janela';
import { t } from '../../textos';

export type FiltroStatus = 'ativos' | 'inativos' | 'todos';

/** Barra superior comum: busca, filtro de status (ativos por padrão) e o botão dourado Novo… */
export function BarraCadastro({
  busca,
  aoBuscar,
  status,
  aoMudarStatus,
  rotuloNovo,
  aoNovo,
  filtrosExtras,
}: {
  busca: string;
  aoBuscar: (v: string) => void;
  status: FiltroStatus;
  aoMudarStatus: (s: FiltroStatus) => void;
  rotuloNovo: string;
  aoNovo: () => void;
  filtrosExtras?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative w-full sm:w-72">
        <Search
          size={20}
          className="pointer-events-none absolute left-3 top-3.5 text-texto-suave"
          aria-hidden
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
          placeholder={t('cadastro.buscar')}
          aria-label={t('cadastro.buscar')}
          className="h-12 w-full rounded-padrao border border-borda bg-superficie pl-10 pr-3 outline-none focus:border-2 focus:border-acao"
        />
      </div>
      <div role="group" aria-label="Status" className="flex gap-1">
        {(['ativos', 'inativos', 'todos'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => aoMudarStatus(s)}
            className={`h-12 rounded-full border px-4 font-bold ${
              status === s
                ? 'border-moldura bg-moldura text-sobre-moldura'
                : 'border-borda bg-superficie hover:border-moldura'
            }`}
          >
            {t(`cadastro.${s}`)}
          </button>
        ))}
      </div>
      {filtrosExtras}
      <Botao
        variante="principal"
        className="ml-auto"
        icone={<Plus size={20} aria-hidden />}
        onClick={aoNovo}
      >
        {rotuloNovo}
      </Botao>
    </div>
  );
}

export function passaStatus(ativo: boolean, filtro: FiltroStatus) {
  return filtro === 'todos' || (filtro === 'ativos' ? ativo : !ativo);
}

/** Painel lateral de formulário que pergunta "Descartar alterações?" se algo mudou. */
export function PainelFormulario({
  titulo,
  alterado,
  salvando,
  aoSalvar,
  aoFechar,
  children,
}: {
  titulo: string;
  alterado: boolean;
  salvando: boolean;
  aoSalvar: () => void;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const [perguntar, setPerguntar] = useState(false);
  const fechar = () => (alterado ? setPerguntar(true) : aoFechar());
  return (
    <>
      <PainelLateral
        titulo={titulo}
        aoFechar={fechar}
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar}>
              {t('cadastro.cancelar')}
            </Botao>
            <Botao variante="principal" carregando={salvando} onClick={aoSalvar}>
              {t('cadastro.salvar')}
            </Botao>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            aoSalvar();
          }}
        >
          {children}
          <button type="submit" hidden />
        </form>
      </PainelLateral>
      {perguntar && (
        <Confirmacao
          titulo={t('confirmacao.descartarTitulo')}
          texto={t('confirmacao.descartarTexto')}
          confirmar={t('confirmacao.descartar')}
          voltar={t('confirmacao.continuarEditando')}
          aoFechar={() => setPerguntar(false)}
          aoConfirmar={() => {
            setPerguntar(false);
            aoFechar();
          }}
        />
      )}
    </>
  );
}

/** Foca o primeiro campo com erro ao salvar (interface, "Validações de formulário"). */
export function focarPrimeiroErro() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus();
  });
}

export const classeTabela = 'w-full min-w-[640px] text-left';
export const classeCabecalho = 'legenda sticky top-0 bg-superficie';
export const classeLinha =
  'h-12 border-t border-borda even:bg-creme-escuro/50 hover:bg-creme-escuro';
