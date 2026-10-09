import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LIMITES } from '@patotinha/shared';
import { api, ErroDaApi } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { CampoSenha } from '../componentes/Campos';
import { Janela } from '../componentes/Janela';
import { useAvisos } from '../componentes/Avisos';
import { t } from '../textos';

/** "Trocar minha senha": senha atual, nova e confirmação (H-05). */
export function JanelaTrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const avisos = useAvisos();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  const trocar = useMutation({
    mutationFn: () =>
      api('/auth/senha', { metodo: 'PUT', corpo: { senhaAtual: atual, novaSenha: nova } }),
    onSuccess: () => {
      avisos.sucesso(t('sucesso.senhaTrocada'));
      aoFechar();
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'SENHA_ATUAL_INCORRETA') setErros({ atual: e.message });
      else if (e.codigo === 'SENHA_FRACA') setErros({ nova: e.message });
      else avisos.erro(e.message);
    },
  });

  const enviar = () => {
    const novosErros: Record<string, string> = {};
    if (!atual) novosErros.atual = 'Informe a senha atual';
    if (nova.length < LIMITES.senha.min)
      novosErros.nova = 'A senha precisa ter pelo menos 8 caracteres';
    if (nova !== confirmacao) novosErros.confirmacao = t('senha.naoConferem');
    setErros(novosErros);
    if (Object.keys(novosErros).length === 0) trocar.mutate();
  };

  return (
    <Janela
      titulo={t('menu.trocarSenha')}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            {t('cadastro.cancelar')}
          </Botao>
          <Botao variante="principal" carregando={trocar.isPending} onClick={enviar}>
            {t('cadastro.salvar')}
          </Botao>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <CampoSenha
          rotulo={t('senha.atual')}
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          erro={erros.atual}
          autoFocus
          autoComplete="current-password"
        />
        <CampoSenha
          rotulo={t('senha.nova')}
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          erro={erros.nova}
          autoComplete="new-password"
        />
        <CampoSenha
          rotulo={t('senha.confirmacao')}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          erro={erros.confirmacao}
          autoComplete="new-password"
        />
        <button type="submit" hidden />
      </form>
    </Janela>
  );
}
