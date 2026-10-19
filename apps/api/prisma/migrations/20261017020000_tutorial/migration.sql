-- Tutorial de primeiro acesso (etapa 12): guarda quando o usuário viu os cards de boas-vindas,
-- para eles aparecerem uma vez só, em qualquer aparelho. Vazio = ainda não viu.
ALTER TABLE usuarios ADD COLUMN tutorial_visto_em TIMESTAMPTZ;
