# Corrigir horas totais com muitas casas decimais

## Problema
Nos Relatórios, as horas trabalhadas (por funcionário e no total) são mostradas tal como calculadas, sem arredondar. Quando um dia tem minutos (ex.: 6h50), aparecem valores como `5.833333333h`. O mesmo acontece nas exportações PDF e Excel.

## O que muda
- As horas passam a aparecer no formato **horas e minutos**, ex.: `152h 30m` (ou `8h` quando não há minutos).
- Aplica-se em: cartão "Horas trabalhadas", tabela de resumo (linha de cada funcionário e linha total), e exportações PDF/Excel.
- Os cálculos não mudam — só a forma de mostrar.

## Detalhes técnicos
- Criar `formatHours(h)` em `src/lib/` (arredonda ao minuto; `152.5` → `152h 30m`; `8` → `8h`; `0` → `0h`) com teste.
- Usar em `AdminRelatorios.tsx` nas linhas 388/401/452/465/620/762/806 e também nas horas extra (620/662/776/812) por consistência.
- Rever `AdminPonto.tsx` (total e por dia) para usar o mesmo formato.
