# C-008 · Algoritmo: o Motor diz o quanto não sabe (A-09, regularidade)

**F1 · Objetivo:** todo cliente era julgado pela mesma régua de ±7 dias. Para quem volta como relógio
ela é larga (o lembrete sai tarde); para quem varia, estreita (volta normal parece atraso). Número:
% das voltas reais dentro da faixa (cobertura), por cenário, e a largura da faixa.

**F2:** C-001/C-006 (cinco cenários, origem móvel); estatística robusta: MAD × 1,4826 estima o
desvio-padrão sem ser puxado por um sumiço; intervalo de previsão inflado por √(1 + 1/n).

**F3 · Plano:** função pura `faixaDaPrevisao` (`src/core/cycle/incerteza.ts`), usando os MESMOS
intervalos do Motor (passos 1–2 extraídos para `intervalosDoRitmo`, sem mudar resultado: pisos do
backtest intactos, `VERSAO_DO_MOTOR` continua 3). Varrer variantes; escolher a que fica perto de 80% em
todos os cenários. Não muda o estado do cliente ainda (ver Próximo).

**F4 · Varredura (3+ intervalos, cobertura · folga mediana):**

| Variante | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| régua fixa ±7 | 100% · 7 | 92% · 7 | 74% · 7 | 44% · 7 | 82% · 7 |
| só MAD, z 1,28 | 79% · 2 | 52% · 4 | 66% · 2 | 58% · 9 | 65% · 5 |
| MAD + resíduos próprios, z 1,645 | 88% · 3 | 75% · 7 | 77% · 5 | 75% · 15 | 80% · 8 |
| **MAD + tendência, z 1,645 (escolhida)** | **90% · 3** | **80% · 8** | **77% · 7** | **78% · 16** | **83% · 8** |

Sem ritmo provado (1–2 intervalos), folga = 0,3 × ciclo: empata ou ganha da fixa em todo cenário;
no "padrão errado" nenhuma folga ajuda (48%), porque o erro é do padrão, não da dispersão. Registrado.

**F5 · Medida:** cobertura passa de 44–100% (fixa) para 77–90% (própria). O cliente regular ganha
folga de 3 dias em vez de 7: o lembrete pode sair 4 dias antes. O errático, de 44% para 78%: metade
dos "atrasos" que eram só o ritmo dele deixam de parecer atraso. Custo honesto: na deriva a cobertura
cai de 92% para 80% (a fixa é larga demais ali por sorte). Guarda: cobertura 77–95% (sem a inflação √(1 + 1/n) cai para 75%: a mutação reprova) em todo cenário e
folga do regular ≤ 3 d (`tests/unit/core/cycle/incerteza-placar.test.ts`). Arnês: os cenários saíram
do arquivo de teste para `tests/unit/core/cycle/cenarios.ts` (importar um `.test.ts` registrava os
testes dele de novo).

**Nota:** cliente 6 · segredo 8 · engenharia 8. **Próximo (C-009):** banco do automotivo se o Docker
voltar; senão levar a faixa para o produto: `Recuperar receita` passa a chamar de "atrasado" só quem
passou do `tarde` da própria faixa, com a data "deve voltar entre X e Y" na ficha. Muda o estado e
exige `VERSAO_DO_MOTOR` 4 + placar de lembretes falsos antes.
