# C-007 · Serviço como software: a mensagem que diz o relógio (A-12)

**F1 · Objetivo:** o lembrete de volta do CICLO é genérico ("já faz um tempo, quer marcar?"). No
automotivo isso soa como venda. A mensagem tem que dizer o MOTIVO que o motorista confere no painel:
km que faltam, meses desde a troca, medida da última visita. Número: frases conferíveis por mensagem.
Docker local ainda fora do ar, então o banco do automotivo (AUT-101..105) segue esperando.

**F2:** docs/106 §2.2 passo 6 (a mensagem é o produto); regra do CLAUDE.md sobre prometer canal;
memória "copy PT-BR não supõe gênero"; `vencimentoDoItem` já devolve `relogio`, `kmDeVencimento` e a
origem do ritmo (medido × referência).

**F3 · Plano:** função pura em `src/core/manutencao/mensagem.ts`. Regras: km só com ritmo MEDIDO
(com ritmo de referência a frase não leva número); item sem histórico diz "vale conferir", nunca
"venceu"; crítico vencido primeiro; no máximo 3 motivos e o resto contado; sem promessa de envio ou
canal; mensagem vazia quando nada vence (quem chama não manda nada).

**F4:** 7 testes, incluindo a proibição de número inventado e de palavra de pressão de venda.

**F5 · Medida (cenário do teste, sintético):**

| | Texto genérico | Mensagem que diz o relógio |
| --- | --- | --- |
| frases conferíveis | 0 | 3 de 3 itens mostrados |
| número sem medida | n/a | 0 (ritmo de referência não gera km) |
| promete canal | depende de quem chama | nunca |

**Nota:** cliente 7 · segredo 7 · engenharia 8. **Próximo (C-008):** banco do automotivo se o
Docker voltar; senão trilha do algoritmo (A-09 regularidade: intervalo de confiança da previsão
mais largo para quem é errático, para o lembrete não chegar cedo demais).
