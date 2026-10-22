# Documentos: telemóvel, subcategorias e validade

## O que será alterado
- Ajustar a página de documentos e as janelas de carregamento, categorias e permissões ao telemóvel, sem botões ou nomes cortados.
- Permitir criar e eliminar subcategorias dentro de cada categoria, escolhê-las ao carregar um documento e mover documentos entre elas. Eliminar uma subcategoria preserva os documentos na categoria principal.
- Perguntar **“O documento tem validade?”** ao carregar. Se sim, exigir uma data de validade; se não, não gerar avisos.
- Mostrar a subcategoria e a validade junto de cada documento, com indicação de documentos a expirar e já expirados.
- Acrescentar ao painel do gerente uma lista de documentos que expiram nos próximos **15 dias**, incluindo os já expirados, com acesso aos documentos.
- Enviar ao gerente um aviso por email por documento, 15 dias antes da validade, sem avisos duplicados. Documentos carregados dentro desse prazo recebem o aviso na próxima verificação.

## Email: ação necessária
O projeto ainda não tem um domínio de envio configurado. É necessário configurar um domínio próprio para ativar os emails; as restantes melhorias e os avisos no painel não dependem disso.

## Detalhes técnicos
- Manter os documentos e categorias existentes; adicionar subcategorias associadas à categoria principal e campos opcionais para subcategoria e validade, com permissões administrativas protegidas.
- Partilhar o cálculo do prazo de validade entre a lista de documentos e o painel. Cobrir o limite de 15 dias, documentos sem validade e documentos expirados com testes.
- Na ausência de um serviço de envio adiado já configurado, fazer uma verificação diária das datas. Esta verificação é necessária mesmo quando ninguém abre a aplicação; implica atividade diária no Cloud e até 24 horas de atraso no aviso.
- Usar o envio de emails da aplicação, com um destinatário gerente por aviso, ligado ao documento e à respetiva data de validade.
- Verificar o carregamento, a organização por subcategorias e os avisos com sessão administrativa, tanto no telemóvel como no computador.