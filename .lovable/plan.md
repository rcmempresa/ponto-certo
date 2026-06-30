# Painel Admin — Folgas/Feriados por colaborador + modo "Ver como"

## 1. Nova página admin: Folgas e Feriados

Criar `src/pages/admin/AdminFolgasTrabalhadas.tsx` (estrutura igual à `AdminHorasExtra`):

- Filtro por colaborador (dropdown com todos os profiles) + navegação por mês.
- Tabela com todos os registos de `folgas_trabalhadas` do colaborador escolhido (ou todos).
- 3 cards de resumo por colaborador selecionado:
  - **Total Aprovado** — soma acumulada de todos os registos aprovados.
  - **Pendente** — soma de todos os pendentes.
  - **Este Mês** — soma dos aprovados do mês atual.
- Quando "Todos" estiver selecionado, mostrar uma tabela-resumo por colaborador com as 3 colunas acima.
- Ações já existentes (aprovar/rejeitar) mantêm-se via página de Aprovações; aqui é só visualização e consulta.

Rota: `/admin/folgas-trabalhadas` em `src/App.tsx`, protegida por admin.
Sidebar (`AppSidebar.tsx`): adicionar entrada "Folgas/Feriados" na secção Admin.

## 2. Modo "Ver como colaborador"

Permite ao admin entrar no painel de um utilizador em **modo só-leitura** para confirmar o que ele vê.

- Novo contexto `ImpersonationContext` (`src/contexts/ImpersonationContext.tsx`):
  - Estado: `{ impersonatedUserId, impersonatedProfile, startImpersonation(userId), stopImpersonation() }`.
  - Persistido em `sessionStorage` (limpo ao terminar sessão).
- Hook utilitário `useEffectiveUserId()` que devolve `impersonatedUserId ?? auth.user.id`.
- Atualizar as páginas de utilizador (`Dashboard`, `HorasExtra`, `FolgasTrabalhadas`, `Ferias`, `Faltas`, `Documentos`) para usarem `useEffectiveUserId()` ao consultar dados próprios.
- Quando em modo impersonação: esconder/desativar botões de submissão (registar ponto, pedir férias, pedir horas extra, etc.). Banner fixo no topo: "A ver como **Nome do colaborador** · [Sair]".
- Botão "Ver painel" em `AdminEquipa` (lista de colaboradores) que chama `startImpersonation(id)` e navega para `/`.

## 3. Backend / RLS

Sem migrações novas. Admin já tem políticas SELECT em todas as tabelas relevantes (`folgas_trabalhadas`, `ferias`, `horas_extra`, `ponto`, `faltas`), portanto a impersonação no cliente apenas substitui o `user_id` nas queries — não precisa de privilégios extra.

A escrita continua a usar `auth.uid()` real; como bloqueamos os botões em modo impersonação, não há risco de o admin criar registos em nome do colaborador.

## Detalhes técnicos

- Ficheiros novos:
  - `src/pages/admin/AdminFolgasTrabalhadas.tsx`
  - `src/contexts/ImpersonationContext.tsx`
  - `src/components/layout/ImpersonationBanner.tsx`
- Ficheiros alterados:
  - `src/App.tsx` (rota + provider + banner)
  - `src/components/layout/AppSidebar.tsx` (entrada admin)
  - `src/pages/admin/AdminEquipa.tsx` (botão "Ver painel")
  - Páginas de utilizador para usar `useEffectiveUserId`

## Fora de âmbito

- Sem valores monetários (€) nesta página, conforme escolha.
- Sem alterar permissões de escrita no servidor (mantém-se `auth.uid()`).
