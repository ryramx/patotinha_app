import { useState } from 'react';
import { diaEmSaoPaulo, somarDias } from '@patotinha/shared';
import { t } from '../textos';

export type AtalhoPeriodo = 'hoje' | 'ontem' | '7dias' | 'mes' | 'personalizado';

export interface Periodo {
  atalho: AtalhoPeriodo;
  de: string;
  ate: string;
}

export function periodoDoAtalho(atalho: Exclude<AtalhoPeriodo, 'personalizado'>): Periodo {
  const hoje = diaEmSaoPaulo();
  switch (atalho) {
    case 'hoje':
      return { atalho, de: hoje, ate: hoje };
    case 'ontem': {
      const ontem = somarDias(hoje, -1);
      return { atalho, de: ontem, ate: ontem };
    }
    case '7dias':
      return { atalho, de: somarDias(hoje, -6), ate: hoje };
    case 'mes':
      return { atalho, de: `${hoje.slice(0, 8)}01`, ate: hoje };
  }
}

/** Atalhos em etiquetas (Hoje, Ontem, Últimos 7 dias, Personalizado) e intervalo livre. */
export function SeletorPeriodo({
  valor,
  aoMudar,
  comMes = false,
}: {
  valor: Periodo;
  aoMudar: (p: Periodo) => void;
  comMes?: boolean;
}) {
  const [aberto, setAberto] = useState(valor.atalho === 'personalizado');
  const atalhos: [AtalhoPeriodo, string][] = [
    ['hoje', t('periodo.hoje')],
    ['ontem', t('periodo.ontem')],
    ['7dias', t('periodo.seteDias')],
    ...(comMes ? ([['mes', t('periodo.esteMes')]] as [AtalhoPeriodo, string][]) : []),
    ['personalizado', t('periodo.personalizado')],
  ];
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Período">
      {atalhos.map(([atalho, rotulo]) => {
        const ativo = valor.atalho === atalho;
        return (
          <button
            key={atalho}
            type="button"
            aria-pressed={ativo}
            onClick={() => {
              if (atalho === 'personalizado') {
                setAberto(true);
                aoMudar({ ...valor, atalho });
              } else {
                setAberto(false);
                aoMudar(periodoDoAtalho(atalho));
              }
            }}
            className={`h-10 rounded-full border px-4 font-bold transition-colors ${
              ativo
                ? 'border-moldura bg-moldura text-sobre-moldura'
                : 'border-borda bg-superficie hover:border-moldura'
            }`}
          >
            {rotulo}
          </button>
        );
      })}
      {aberto && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col">
            <span className="rotulo">{t('periodo.de')}</span>
            <input
              type="date"
              value={valor.de}
              max={valor.ate}
              onChange={(e) =>
                e.target.value && aoMudar({ ...valor, atalho: 'personalizado', de: e.target.value })
              }
              className="h-10 rounded-padrao border border-borda bg-superficie px-2"
            />
          </label>
          <label className="flex flex-col">
            <span className="rotulo">{t('periodo.ate')}</span>
            <input
              type="date"
              value={valor.ate}
              min={valor.de}
              onChange={(e) =>
                e.target.value &&
                aoMudar({ ...valor, atalho: 'personalizado', ate: e.target.value })
              }
              className="h-10 rounded-padrao border border-borda bg-superficie px-2"
            />
          </label>
        </div>
      )}
    </div>
  );
}
