# C-009 · Algoritmo: o preço de cada lembrete (Motor v4 candidato)

**F1 · Objetivo:** antes de a faixa do C-008 mudar quem aparece como "atrasado", medir as duas
coisas que puxam em sentidos opostos. Lembrete desnecessário: o alerta sai antes de uma volta que ia
acontecer sozinha (custa mensagem e soa como cobrança). Dias até notar: para quem sumiu de vez,
quanto tempo até o alerta. Docker ainda fora do ar, então mostrar a faixa na tela (precisa de coluna)
espera.

**F2:** `estadoPorAtraso` marca `late` no dia seguinte ao previsto; é daí que sai a fila de
`Recuperar receita` (`v_quem_sumiu`: late, at_risk, lost). **Correção do C-008:** a régua de ±7 dias é
só a de acerto; a faixa não adianta lembrete, ela atrasa.

**F3 · Plano:** `estadoPelaFaixa(faixa, hoje, agendamento, alfa)`: atrasado depois de
`prevista + alfa × folga`. Placar com os cinco cenários e 25% de sumiço; varrer alfa; controle do arnês:
alfa 0 tem de reproduzir exatamente a régua de hoje (reproduz).

**F4 · Varredura (lembrete desnecessário · mediana de dias até notar quem sumiu):**

| alfa | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| 0 (hoje) | 24% · 22 d | 86% · 27 d | 31% · 23 d | 45% · 29,5 d | 40% · 71 d |
| 0,25 | 12% · 23 | 59% · 29,5 | 22% · 24 | 32% · 34 | 24% · 73 |
| **0,5 (escolhido)** | **6% · 24** | **34% · 31,5** | **19% · 25,5** | **20% · 37,5** | **16% · 75** |
| 0,75 | 3% · 24 | 21% · 33 | 17% · 27 | 13% · 41 | 9% · 76 |
| 1 | 2% · 25 | 16% · 35,5 | 16% · 28,5 | 9% · 45 | 6% · 78 |

**F5 · Medida:** com alfa 0,5, lembretes desnecessários caem em todo cenário (24 → 6%, 86 → 34%,
31 → 19%, 45 → 20%, 40 → 16%) e notar quem sumiu leva de 1 a 8 dias a mais. O "pela metade em todo
cenário" que eu ia afirmar era falso no pulo (31 → 19); a guarda usa tetos medidos por cenário. A
deriva segue ruim (34%): o Motor ainda chuta cedo para quem está espaçando, e é o próximo alvo do
algoritmo.

**Decisão para o Eduardo (registrada, não bloqueia):** alfa 0,5 é o equilíbrio; 1 corta mais
lembrete e demora até 15 dias a mais para notar. Nada disto está no ar: o estado gravado continua o
da v3 até a v4 subir com coluna da folga.

**Nota:** cliente 7 · segredo 8 · engenharia 8. **Próximo (C-010):** banco do automotivo se o Docker
voltar; senão trilha expansão (pet, core puro: sujeito animal com ciclos de vacina/vermífugo/banho, o
mesmo molde do automotivo), e o viés da deriva volta no C-011.
