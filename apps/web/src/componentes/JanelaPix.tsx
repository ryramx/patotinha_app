import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Check, Copy, Share2, TriangleAlert } from 'lucide-react';
import {
  formatarReais,
  gerarPixCopiaECola,
  NOMES_TIPO_CHAVE_PIX,
  type ConfigPix,
} from '@patotinha/shared';
import { api } from '../api/cliente';
import { useSessao } from '../auth/sessao';
import { Botao } from './Botao';
import { Janela } from './Janela';
import { LinhasEsqueleto } from './Diversos';
import { t } from '../textos';

export function usePixDaLoja() {
  return useQuery({ queryKey: ['pix'], queryFn: () => api<ConfigPix>('/pix'), staleTime: 60_000 });
}

/** QR Code em SVG, sempre preto no branco para qualquer celular ler, nos dois modos. */
function QrCode({ texto }: { texto: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    void QRCode.toString(texto, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }).then(
      (s) => ativo && setSvg(s),
    );
    return () => {
      ativo = false;
    };
  }, [texto]);
  return (
    <div className="mx-auto aspect-square w-full max-w-[260px] rounded-padrao bg-white p-1">
      {svg && (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          alt={t('pix.qrAlt')}
          className="h-full w-full"
          data-testid="qr-pix"
        />
      )}
    </div>
  );
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Sem permissão (ou navegador antigo): copia pelo campo escondido.
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  }
}

interface Props {
  totalCentavos: number;
  /** Vai no Pix como identificador e aparece no extrato (ex.: PEDIDO42). */
  identificador: string;
  /** Linha sob o valor, ex.: "Pedido nº 42 · Joana". */
  descricao?: string;
  aoFechar: () => void;
}

/**
 * Pix com o valor do pedido (etapa 13): QR Code e "copia e cola" gerados no aparelho com a
 * chave da loja. Não há confirmação automática: o atendente confere no app do banco.
 */
export function JanelaPix({ totalCentavos, identificador, descricao, aoFechar }: Props) {
  const { eAdmin } = useSessao();
  const config = usePixDaLoja();
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const dados = config.data;
  const codigo =
    dados?.configurado && dados.chave && dados.nome && dados.cidade
      ? gerarPixCopiaECola({
          chave: dados.chave,
          nome: dados.nome,
          cidade: dados.cidade,
          valorCentavos: totalCentavos,
          identificador,
        })
      : null;
  const podeCompartilhar = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Janela
      titulo={t('pix.titulo')}
      aoFechar={aoFechar}
      largura={420}
      rodape={
        <Botao variante="secundario" autoFocus={!codigo} onClick={aoFechar}>
          {t('cadastro.fechar')}
        </Botao>
      }
    >
      {config.isPending ? (
        <LinhasEsqueleto linhas={4} />
      ) : config.isError ? (
        <p className="text-erro" role="alert">
          {config.error.message}
        </p>
      ) : !codigo ? (
        <div
          role="note"
          className="flex flex-col gap-3 rounded-padrao border-l-4 border-aviso bg-aviso-fundo px-4 py-3"
        >
          <p className="flex items-start gap-2 font-semibold text-aviso">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />
            {t('pix.naoConfigurado')}
          </p>
          <p className="text-[15px]">
            {eAdmin ? t('pix.configurarAdmin') : t('pix.configurarPeca')}
          </p>
          {eAdmin && (
            <Link to="/pix" className="font-bold text-moldura underline-offset-4 hover:underline">
              {t('pix.irConfigurar')}
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-center">
            <p
              className="font-titulo text-[40px] font-semibold leading-[48px] text-total tabular-nums"
              data-testid="valor-pix"
            >
              {formatarReais(totalCentavos)}
            </p>
            {descricao && <p className="legenda">{descricao}</p>}
          </div>
          <QrCode texto={codigo} />
          <p className="text-center text-[14px] text-texto-suave">
            {t('pix.recebedor', {
              nome: dados!.nome!,
              tipo: NOMES_TIPO_CHAVE_PIX[dados!.tipoChave!],
              chave: dados!.chave!,
            })}
          </p>
          <label className="sr-only" htmlFor="pix-copia-cola">
            {t('pix.copiaECola')}
          </label>
          <textarea
            id="pix-copia-cola"
            readOnly
            value={codigo}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-padrao border border-borda bg-superficie-campo p-2 font-mono text-[12px] leading-4 break-all text-texto-suave"
          />
          <Botao
            variante="principal"
            autoFocus
            icone={copiado ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
            onClick={async () => {
              const ok = await copiar(codigo);
              setCopiado(ok);
              setFalhou(!ok);
            }}
          >
            {copiado ? t('pix.copiado') : t('pix.copiar')}
          </Botao>
          {podeCompartilhar && (
            <Botao
              variante="secundario"
              icone={<Share2 size={20} aria-hidden />}
              onClick={() =>
                void navigator
                  .share({ title: t('pix.titulo'), text: codigo })
                  .catch(() => undefined)
              }
            >
              {t('pix.compartilhar')}
            </Botao>
          )}
          {falhou && (
            <p className="text-[14px] text-erro" role="alert">
              {t('pix.naoCopiou')}
            </p>
          )}
          <p className="legenda text-center">{t('pix.confira')}</p>
        </div>
      )}
    </Janela>
  );
}
