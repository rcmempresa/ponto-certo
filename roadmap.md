# Documentos
- [x] Acrescentar quatro ações de baixas médicas no agente; 35 testes aprovados e submissão, consultas, aprovação/rejeição e erros 400/401/404 verificados com pedidos temporários removidos.
- [x] Simplificar o arquivo documental com navegação por pastas, pesquisa e lista legível no telemóvel; pastas, subpastas, pesquisa, paginação e diálogo de renomear verificados com documentos reais; dez testes aprovados.
- [x] Acrescentar seis ações de criação e consulta de pedidos ao agente; 22 testes aprovados, seis chamadas autenticadas verificadas e pedido de horas extra sem horário confirmado no painel.
- [x] Completar e verificar criação, consulta, edição e eliminação de categorias e subcategorias em Gerir pastas; fluxo autenticado e nove testes aprovados.
- [x] Adaptar ponto-empregado ao contrato pedido com AGENT_SECRET e user_id na presença da equipa.
- [x] Configurar AGENT_SECRET, disponibilizar a função e passar 11 testes; verificar consultas autenticadas com dados reais e rejeições de escrita sem alterar registos dos colaboradores.
- [x] Criar ponto-empregado com seis ações, autenticação PONTO_SECRET, validação e testes.
- [x] Configurar PONTO_SECRET no formulário seguro e verificar bloqueio de chamadas não autorizadas; execução autenticada externa não verificada.
- [x] Permitir renomear categorias e subcategorias existentes, preservando documentos, e verificar o fluxo.
- [x] Ajustar a gestão documental ao telemóvel.
- [x] Criar e gerir subcategorias e mover documentos.
- [x] Recolher validade opcional no carregamento e apresentar estados.
- [x] Mostrar documentos a expirar no painel do gerente.
- [x] Avisos por email (dias configuráveis por documento) para geral@nrtechsolucion.pt, página Avisos e paginação.
- [x] Testar regras de validade e verificar os fluxos no ecrã.

# Relatórios e tarefas
- [x] Incluir baixas aprovadas no resumo mensal, detalhe e exportações PDF/Excel; dados reais e ficheiros verificados.
- [x] Criar tarefas de gerente com início, lembretes de 2/7/15/30 dias e conclusão por email; criação, persistência, conclusão e eliminação verificadas.
- [x] Ativar verificação diária às 09:17 UTC; callback autenticado e 17 testes verificados.
- [ ] Confirmar envio dos emails de lembrete e conclusão: bloqueado por domínio remetente não verificado (NS ausentes); corrigir configuração em Mais → Emails.

# Tarefas atribuídas
- [x] Restringir criação ao gerente e consulta/conclusão ao responsável; criação recusada com 403 para funcionário.
- [x] Acrescentar seleção de responsável e acesso dos funcionários; criação pelo gerente e conclusão/persistência pelo Rodrigo Teste verificadas.
- [x] Preparar avisos separados e idempotentes para gerente e responsável; 12 testes aprovados.
- [ ] Confirmar entrega para ambos: domínio remetente continua sem verificação.
