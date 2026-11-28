# Registar as ações de todos os funcionários na Atividade

## Objetivo
A página Atividade passa a mostrar, além das ações do gerente, tudo o que cada funcionário faz na sua conta.

## O que passa a ser registado (funcionários)
- Picagens de ponto (entrada/saída), incluindo pela app e pelo agente externo
- Pedidos novos: férias, faltas, baixas médicas, horas extra, folgas trabalhadas
- Edição ou cancelamento dos próprios pedidos pendentes
- Conclusão de tarefas pelo responsável
- Alterações ao próprio perfil (nome, cargo)
- Abrir/descarregar documentos não é registado (só ações que alteram dados)

## Página Atividade
- Novo filtro "Quem": Todos / Gerente / Funcionários
- Novo filtro por funcionário (lista de nomes)
- Cada linha mostra um selo "Gerente" ou "Funcionário"
- Continua visível apenas para administradores; funcionários não veem o histórico

## Detalhes técnicos
- Alargar os gatilhos de auditoria existentes para registarem também quando o autor não é admin (hoje só registam admin), guardando autor e nome via perfil.
- Ações feitas pelo serviço (agente externo / funções) registadas pelo RPC `registar_atividade_admin` com o funcionário como autor.
- Adicionar coluna `actor_tipo` ('gerente' | 'funcionario', default 'gerente') em `admin_activity_logs`, com backfill para os registos existentes.
- Falhas de registo nunca bloqueiam a ação principal; sem anexos, passwords ou tokens nos detalhes.
- Atualizar `AdminAtividade.tsx` com os novos filtros e selo; verificar no browser com uma conta de funcionário.
