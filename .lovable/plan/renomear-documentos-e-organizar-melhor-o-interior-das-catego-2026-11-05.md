# Renomear documentos e organizar melhor o interior das categorias

## O que muda para o utilizador
1. **Mudar o nome de um documento**: cada documento ganha um ícone de lápis ao lado do nome. Abre uma janela com o nome atual, escreve o novo e guarda. O ficheiro continua o mesmo, só muda o nome que aparece (também para os funcionários).
2. **Interior das categorias mais arrumado**:
   - Os documentos aparecem agrupados por subcategoria, cada uma como uma pequena pasta que se pode abrir/fechar, com o número de documentos. "Sem subcategoria" fica no fim.
   - Cada documento fica numa linha compacta: ícone, nome, validade e visibilidade, data.
   - As ações (Ver, mudar nome, mover de categoria/subcategoria, permissões, público/restrito, eliminar) passam para um menu de três pontos, em vez de muitos botões e duas caixas de escolha sempre visíveis. Fica só o botão "Ver" à vista.
   - "Mover" abre uma janela para escolher categoria e subcategoria juntas.
   - Remove-se o nome da subcategoria repetido debaixo de cada documento (já está no título do grupo).
   - Ordenação dentro de cada grupo por nome; paginação mantém-se (10 por página).
3. Funciona bem no telemóvel (linhas não transbordam, menu fácil de tocar).

## Detalhes técnicos
- Sem alterações à base de dados: admins já podem atualizar `documentos.titulo` (política existente).
- Novo `RenameDocumentDialog` (reutiliza padrão do `RenameFolderDialog`, validação 1–150 caracteres, `update({ titulo })`, atualiza estado local).
- Novo `DocumentActionsMenu` (DropdownMenu) e `MoveDocumentDialog` (categoria + `SubcategorySelect`, usa `documentCategoryChange` para limpar subcategoria).
- Em `AdminDocumentos.tsx`, agrupar `allDocs` por `subcategoria_id` dentro de cada categoria com `Collapsible` aninhado; extrair a linha num componente `DocumentRow` isolado.
- Teste curto para a validação do nome do documento em `documentRules.test.ts`; verificação Playwright: renomear um documento e confirmar após recarregar.
