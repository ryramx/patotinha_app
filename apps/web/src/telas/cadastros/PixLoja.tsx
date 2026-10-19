import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import {
  esquemaConfigPix,
  LIMITES_PIX,
  NOMES_TIPO_CHAVE_PIX,
  TIPOS_CHAVE_PIX,
  type ConfigPix,
  type TipoChavePix,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { CampoTexto } from '../../componentes/Campos';
import { LinhasEsqueleto } from '../../componentes/Diversos';
import { JanelaPix, usePixDaLoja } from '../../componentes/JanelaPix';
import { t } from '../../textos';

const EXEMPLO_CHAVE: Record<TipoChavePix, string> = {
  CPF: '000.000.000-00',
  CNPJ: '00.000.000/0000-00',
  TELEFONE: '(11) 98765-4321',
  EMAIL: 'patotinha@email.com',
  ALEATORIA: '123e4567-e89b-12d3-a456-426614174000',
};

/** Pix da loja (etapa 13): o administrador cadastra a chave usada no copia e cola dos pedidos. */
export function PixLoja() {
  const config = usePixDaLoja();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
      <p className="text-texto-suave">{t('pix.intro')}</p>
      {config.isPending ? (
        <div className="cartao p-4">
          <LinhasEsqueleto linhas={5} />
        </div>
      ) : config.isError ? (
        <p className="text-erro" role="alert">
          {config.error.message}
        </p>
      ) : (
        <Formulario key={config.data.atualizadoEm ?? 'novo'} atual={config.data} />
      )}
    </div>
  );
}

type Erros = Partial<Record<'chave' | 'nome' | 'cidade', string>>;

function Formulario({ atual }: { atual: ConfigPix }) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [tipoChave, setTipoChave] = useState<TipoChavePix>(atual.tipoChave ?? 'TELEFONE');
  const [chave, setChave] = useState(atual.chave ?? '');
  const [nome, setNome] = useState(atual.nome ?? 'Patotinha da Vovo');
  const [cidade, setCidade] = useState(atual.cidade ?? '');
  const [erros, setErros] = useState<Erros>({});
  const [testando, setTestando] = useState(false);

  const alterado =
    !atual.configurado ||
    tipoChave !== atual.tipoChave ||
    chave !== atual.chave ||
    nome !== atual.nome ||
    cidade !== atual.cidade;

  const salvar = useMutation({
    mutationFn: (corpo: { tipoChave: TipoChavePix; chave: string; nome: string; cidade: string }) =>
      api<ConfigPix>('/pix', { metodo: 'PUT', corpo }),
    onSuccess: (salvo) => {
      queryClient.setQueryData(['pix'], salvo);
      avisos.sucesso(t('pix.salvo'));
    },
    onError: (e: ErroDaApi) => {
      const detalhes = (e.detalhes as { campo: string; mensagem: string }[] | undefined) ?? [];
      if (detalhes.length) {
        setErros(Object.fromEntries(detalhes.map((d) => [d.campo, d.mensagem])));
      } else {
        avisos.erro(e.message);
      }
    },
  });

  const enviar = () => {
    const corpo = { tipoChave, chave, nome, cidade };
    const resultado = esquemaConfigPix.safeParse(corpo);
    if (!resultado.success) {
      setErros(
        Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setErros({});
    salvar.mutate(corpo);
  };

  return (
    <form
      className="cartao flex flex-col gap-4 p-4 md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      noValidate
    >
      <fieldset>
        <legend className="rotulo mb-1">{t('pix.tipo')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
          {TIPOS_CHAVE_PIX.map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={tipoChave === tipo}
              onClick={() => {
                setTipoChave(tipo);
                setErros((e) => ({ ...e, chave: undefined }));
              }}
              className={`h-12 rounded-padrao border font-bold ${
                tipoChave === tipo
                  ? 'border-moldura bg-moldura text-sobre-moldura'
                  : 'border-borda bg-superficie hover:border-moldura'
              }`}
            >
              {NOMES_TIPO_CHAVE_PIX[tipo]}
            </button>
          ))}
        </div>
      </fieldset>
      <CampoTexto
        rotulo={t('pix.chave')}
        value={chave}
        placeholder={EXEMPLO_CHAVE[tipoChave]}
        inputMode={tipoChave === 'EMAIL' ? 'email' : tipoChave === 'ALEATORIA' ? 'text' : 'tel'}
        autoComplete="off"
        maxLength={100}
        onChange={(e) => setChave(e.target.value)}
        erro={erros.chave}
        dica={t('pix.dicaChave')}
      />
      <CampoTexto
        rotulo={t('pix.nome')}
        value={nome}
        maxLength={LIMITES_PIX.nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
        dica={t('pix.dicaNome', { max: LIMITES_PIX.nome })}
      />
      <CampoTexto
        rotulo={t('pix.cidade')}
        value={cidade}
        maxLength={LIMITES_PIX.cidade}
        onChange={(e) => setCidade(e.target.value)}
        erro={erros.cidade}
        dica={t('pix.dicaCidade', { max: LIMITES_PIX.cidade })}
      />
      <div className="flex flex-wrap justify-end gap-3">
        {atual.configurado && (
          <Botao
            variante="secundario"
            icone={<QrCode size={20} aria-hidden />}
            disabled={alterado}
            title={alterado ? t('pix.salveAntes') : undefined}
            onClick={() => setTestando(true)}
          >
            {t('pix.testar')}
          </Botao>
        )}
        <Botao
          variante="principal"
          type="submit"
          disabled={!alterado}
          carregando={salvar.isPending}
          textoCarregando={t('pix.salvando')}
        >
          {t('pix.salvar')}
        </Botao>
      </div>
      {testando && (
        <JanelaPix
          totalCentavos={100}
          identificador="TESTE"
          descricao={t('pix.testeDescricao')}
          aoFechar={() => setTestando(false)}
        />
      )}
    </form>
  );
}
