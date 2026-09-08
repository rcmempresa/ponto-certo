# Relatórios: escolher vários colaboradores

Hoje o filtro de colaborador só permite "Todos" ou um único nome. Passa a permitir selecionar vários.

## O que muda

- O campo "Colaborador" passa a ser uma lista com caixas de seleção (checkboxes) onde pode marcar quantos colaboradores quiser.
- Opção "Todos os colaboradores" no topo, que marca/desmarca todos de uma vez.
- O botão mostra um resumo: "Todos os colaboradores", "3 colaboradores selecionados" ou o nome quando só há um.
- Todas as tabelas, cartões de resumo, totais e as descargas em PDF e Excel passam a usar apenas os colaboradores marcados.
- Se nada estiver marcado, não são mostrados dados e os botões de descarga ficam inativos.
- Comportamento inicial: todos selecionados, como hoje.

## Detalhes técnicos

- `src/pages/admin/AdminRelatorios.tsx`: substituir o estado `selectedEmployee: string` por `selectedEmployees: string[]`.
- Trocar o `Select` de colaborador por um `Popover` + `Command`/checkboxes (componentes shadcn já presentes) com pesquisa por nome.
- Atualizar os filtros nas linhas ~184, ~296 e ~311 para `selectedEmployees.includes(id)`, e as dependências dos `useMemo`.
- Subtítulo dos ficheiros exportados passa a indicar o número de colaboradores (ou o nome, quando apenas um).
