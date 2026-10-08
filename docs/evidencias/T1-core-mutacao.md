# Domínio jurídico puro (portado do LUBI) · mutações

Commit sob teste: `e4d76c77`. Os módulos vieram do LUBI com a mutação feita lá; aqui só o que é novo
ou mudou no porte.

| # | Defeito | Resultado |
|---|---|---|
| S1 | regra do rito cível marcada `validada: true` sem gabarito | reprovou (2 em `prazo-sugestao`, a trava do modo "sem gabarito") |
| S2b | tolerância da soma de participações zerada | reprovou (1 em `participacao`) |
| S3 | `hojeNoFuso` sem o `timeZone` | **passou verde na primeira rodada**: a máquina roda em Brasília e o `Intl` sem fuso usa o da máquina. Teste novo `tests/unit/advocacia/datas.test.ts` com o mesmo instante em São Paulo e Tóquio; com ele, reprovou (2) |

S3 é o caso da memória `teste-de-fuso-em-maquina-de-brasilia`: o defeito só apareceria na Vercel (UTC).
