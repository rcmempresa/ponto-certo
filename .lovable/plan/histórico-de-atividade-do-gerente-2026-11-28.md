# Histórico de atividade do gerente

## Objetivo
Criar uma página **Registos de atividade** no painel do gerente para saber quem fez cada alteração, quando e sobre que colaborador, pedido, documento ou tarefa.

## O que fica registado
- Criações, edições, aprovações, rejeições e eliminações feitas por administradores em ponto, férias, faltas, baixas, horas extra, folgas, equipa, documentos e pastas.
- Criação, conclusão e eliminação de tarefas feitas no painel.
- Exportações de relatórios e entrada no painel de um colaborador.
- Data e hora na Madeira, nome do administrador, ação, área afetada, identificação do registo e um resumo dos campos alterados.
- Não ficam registadas as simples aberturas de páginas ou consultas de listas.

## Página nova
- Entrada **Atividade** no menu Administração.
- Pesquisa e filtros por ação e área.
- Lista paginada, legível no telemóvel, com detalhes técnicos apenas quando necessários.
- Estado vazio, erro de carregamento e botão para atualizar.

## Implementação técnica
- Tabela `admin_activity_logs` apenas consultável por administradores e sem edição/remoção pela aplicação.
- Gatilhos na base de dados para registar automaticamente as alterações feitas pelo painel, incluindo cascatas, sem depender de cada botão.
- Função protegida para exportações e tarefas executadas com permissões de serviço; o autor é sempre validado como administrador.
- Resumos limitados e sem conteúdo de anexos, palavras-passe ou tokens.
- Regra de arquitetura documentada e testes das regras de apresentação/registo.
- Verificação autenticada no ecrã: criar/alterar um registo temporário, confirmar o evento no histórico e limpar o teste.
