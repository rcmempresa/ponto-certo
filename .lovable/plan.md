## Objetivo

Mostrar valores monetários em euros na página **Horas Extra** do utilizador, usando uma taxa única de **8,16 €/hora** aplicada a todas as horas extra (noturnas e fim de semana). Apenas registos com estado **Aprovado** somam ao total.

## Alterações

### `src/pages/HorasExtra.tsx`
1. Definir constante `RATE_PER_HOUR = 8.16` e helper `formatEuros(minutos)` → `(minutos/60 * 8.16).toFixed(2) + ' €'`.
2. Adicionar um 4º card nas estatísticas: **"Valor a Receber"** (total aprovado em €), com ícone Euro e estilo igual aos restantes. Grid passa de `md:grid-cols-3` para `md:grid-cols-2 lg:grid-cols-4` para manter responsividade no telemóvel.
3. Adicionar nova coluna **"Valor"** na tabela do histórico, à direita da coluna "Duração", mostrando o valor em € de cada registo (independentemente do estado, mas só os aprovados contam para o total no card).

### Sem alterações
- Base de dados, RLS, triggers — nada muda (cálculo feito no frontend a partir de `minutos_extra`).
- Página admin e relatórios — fora do âmbito (utilizador pediu só na página pessoal).
- Folgas/Feriados — não incluído.

## Notas técnicas
- Cálculo: `valor = (minutos_extra / 60) * 8.16`, formatado com 2 casas decimais e sufixo `€`.
- Cores: usar `text-success` para o card de valor a receber (consistente com "Total Aprovado").
