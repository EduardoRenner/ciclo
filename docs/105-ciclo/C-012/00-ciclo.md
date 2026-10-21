# C-012 · Serviço como software: a mensagem do pet

**F1 · Objetivo:** o protocolo do C-010 sabe O QUE vence; falta o texto que o tutor recebe. Número:
mensagens de saúde por animal por ano (menos é melhor, sem deixar item sem lembrar).

**F2:** C-007 (mensagem do automotivo: motivo conferível, sem canal, sem pressão); C-010 (aproveitar o
banho); memória "copy PT-BR não supõe gênero". Achado de produto: muito pet shop NÃO aplica vacina
(é ato do veterinário). Oferecer vacina no banho seria promessa vazia.

**F3 · Plano:** `src/core/pet/mensagem.ts`: o que cabe no banho marcado vira "no banho de Thor dá pra
aproveitar e fazer"; vacina só é oferecida por quem aplica (`aplicaVacina`), senão "vale combinar com o
veterinário"; sem registro → "conferir a carteirinha"; até 3 motivos; "de Thor", nunca "do/da".

**F4:** 7 casos + placar. **F5 · Medida (200 cães, 2 anos, sintético):**

| Banho a cada | Um lembrete por item | Juntando (banho + semana) |
| --- | --- | --- |
| 7 dias | 15,4 / ano | 0,3 / ano |
| 14 dias | 14,7 | 4,1 |
| 21 dias | 14,3 | 8,0 |
| 30 dias | 14,5 | 9,6 |

Todo item segue lembrado; o tutor quinzenal recebe 4 mensagens de saúde por ano em vez de 15, e o
semanal praticamente nenhuma além da confirmação do banho. Guarda: quinzenal < 1/3 do "por item".

**Nota:** cliente 7 · segredo 7 · engenharia 8. **Próximo (C-013):** banco do automotivo se o Docker
voltar; senão trilha "dano vivo" (planos 98/103): varrer pendências de risco real na base antes de
seguir expandindo; algoritmo volta no C-014.
