# AUT-101 parte 2 · o ciclo por sujeito: plano em passos (C-022)

O job (`server/services/ciclo.ts`) agrupa por (cliente, serviço) e grava `client_cycles` com chave
primária `(tenant_id, client_id, service_id)`. Para o pet com 2 animais (ou o dono com 2 carros) virar
2 ciclos, a chave precisa do sujeito. Trocar chave com dado dentro e com o job gravando a cada rodada
pede ordem (memória "migration que tira privilégio inverte a ordem"): aditiva antes do deploy,
restritiva depois.

| Passo | O quê | Migration | Quando sobe | Prova |
| --- | --- | --- | --- | --- |
| 1 (C-022) | `client_cycles.subject_id` nulável + FK composta + índice ÚNICO `nulls not distinct` em (tenant, cliente, serviço, sujeito); as 3 portas gravam com `onConflict` de 4 colunas e sujeito nulo | 0134, aditiva | ANTES do deploy | integração inteira: beleza idêntica (sujeito nulo) |
| 2 (C-023) | o job agrupa por (cliente, serviço, sujeito) quando o agendamento tem sujeito; `cycle_predictions` ganha o sujeito; recálculo de um atendimento idem | aditiva para predictions | antes do deploy | integração: 2 animais do mesmo tutor no banho = 2 linhas; placar do C-003 com banco |
| 3 (C-023) | cai a PK antiga de 3 colunas (a única nova vira a chave) | 0135, RESTRITIVA | DEPOIS do código do passo 2 no ar | integração do passo 2 só passa com ela |
| 4 (C-024) | fila de recuperar e prestação de contas mostram o sujeito ("Mel, da Ana, sumiu") | não | — | integração + navegador 390 px |

Por que `nulls not distinct`: com sujeito NULO (toda a beleza), duas linhas (Ana, corte, nulo) têm que
colidir no upsert, senão o job duplicaria o ciclo a cada rodada. No Postgres padrão nulo nunca é igual
a nulo; a 0003 já usa `nulls not distinct` (Postgres 15+; local e produção em 17).
