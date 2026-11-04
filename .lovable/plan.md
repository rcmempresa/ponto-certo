# Baixas médicas

## O que o funcionário vê
- Nova página **Baixas médicas** no menu (ícone de estetoscópio/cruz).
- Formulário: data de início, data de fim, observações (opcional) e anexo do certificado de baixa (opcional, PDF/imagem).
- Lista das suas baixas com estado: Pendente / Aprovada / Rejeitada. Pode apagar enquanto estiver pendente.

## O que o admin vê
- Em **Aprovações**, novo separador **Baixas** igual ao das faltas: nome, período (de … a …, nº de dias), observações, link para o certificado, botões Aprovar / Rejeitar / Eliminar.
- O contador de pendentes e as notificações na app incluem as baixas.
- No painel, a pessoa de baixa aprovada aparece como ausente nesses dias (como as férias).
- Baixas não descontam saldo de férias.

## Email
- Ao enviar uma baixa, chega email a **geral@nrtechsolucion.pt** com nome, período, observações e link para o certificado (válido 7 dias), igual às faltas.
- O funcionário recebe notificação na app quando é aprovada/rejeitada.

## Detalhes técnicos
- Tabela `baixas_medicas` (user_id, data_inicio, data_fim, observacoes, comprovativo_url, status request_status, timestamps), CHECK data_fim >= data_inicio, GRANTs + RLS iguais a `faltas` (dono cria/vê/apaga pendente; admin vê/atualiza/apaga).
- Ficheiros no bucket privado existente `faltas_docs` numa pasta `baixas/`.
- Triggers `notify_admin_new_baixa` / `notify_user_baixa_status` como os existentes.
- `notify-request-submitted`: aceitar `tipo: 'baixa'` e template `request-submitted` com texto "Baixa médica"; redeploy.
- Nova página `src/pages/BaixasMedicas.tsx`, rota `/baixas`, entrada na sidebar; separador em `AdminAprovacoes.tsx`; incluir baixas nas ausências do dashboard admin.
- Teste: regra de período (fim >= início, contagem de dias).
