# C-002 · Plano

| ID | Origem | Proposta | Arquivos | Aceite (MEDIDO) | Teste (guarda vista reprovando) | Migration | Dep. | Esforço |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOT-005 | C-002 | `relogios.ts`: ritmo de uso robusto, previsão por relógio, "o que vencer primeiro", qual relógio decidiu; tempo que segue o ritmo (beleza) ou limite fixo (oficina) | `src/core/cycle/relogios.ts` | invariante beleza = computeCycle; placar em 5 perfis | unitário + placar; mutações: filtro de leitura errada desligado; "primeiro a vencer" desligado | não | C-001 | P |
| MOT-006 | C-002 F5 | levar ao StarkOS: `previsto_em` = min(meses, km ao ritmo do veículo) e a mensagem dizendo o relógio | StarkOS (`recorrencia.sql`, função de recálculo) | o mesmo placar com os dados do StarkOS local | — | sim (StarkOS) | MOT-005 | M |
| MOT-007 | C-002 F5 | relógio de uso no CICLO (vertical automotiva): campo de leitura no atendimento e regra por serviço | CICLO schema + tela | — | — | aditiva | diagnóstico da vertical (degrau a) | M |

**Revisão adversarial:**
- Leitura errada: a que desce é pulada; a que sobe demais é cortada pelo teto de 1.000 km/dia. Uma
  leitura alta demais (digitou 120.000 em vez de 12.000) ainda distorce um intervalo — a mediana
  absorve com 3+ leituras; com 2 leituras não. Registrado como limite (aposta A-11).
- Carro parado (ritmo 0): o relógio de uso não dá data e o tempo decide. Coberto.
- MOT-006 e MOT-007 tocam outro repositório / schema: ficam para ciclos próprios (degrau a da
  expansão vem antes).
