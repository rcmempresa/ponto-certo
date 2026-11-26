# Chave do agente ponto-empregado

O pedido coloca a chave secreta do agente escrita diretamente no código como alternativa. Isto não é seguro: qualquer pessoa com acesso ao código passa a conseguir usar a função com poderes de administrador (criar pedidos, aprovar baixas, apagar tarefas). Por isso não vou escrever a chave no código.

## O que faço em vez disso
1. Guardar esse mesmo valor como segredo **AGENT_SECRET** do projeto (substituindo o atual), para que o sistema externo continue a funcionar com a chave que já usa.
2. Manter `getAgentSecret` a ler apenas o segredo; se faltar, a função recusa todos os pedidos (comportamento atual e seguro).
3. Reimplementar a função ponto-empregado e testar com uma chamada real usando a chave.

## Recomendação
Como a chave já foi partilhada nesta conversa, o ideal é gerar uma nova e atualizá-la também no sistema externo.
