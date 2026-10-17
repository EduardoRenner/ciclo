# C-017 · Dano vivo: a rampa de aquecimento do WhatsApp volta para o código

**F1 · Objetivo:** o C-016 achou a rampa do docs/74 parada na branch local `loop/integracao-final`.
Sem ela, o único freio é o teto POR TENANT (`TETO_DIARIO_CAMPANHA = 100`, `mensageria.ts`), e quem a
Meta avalia é o NÚMERO, compartilhado por todos. Número: mensagens de campanha que o número pode
mandar no dia 1.

**F2:** `docs/74-AQUECIMENTO-WHATSAPP-PLANO.md` (já na main); memória "aquecimento do número de
WhatsApp" (não havia plano de rampa); a branch tem o núcleo, 31 testes e a ligação em `mensageria.ts`.

**F3 · Plano:** portar SÓ o núcleo puro e os testes, sem mudança. Não ligar: a rampa falha fechada
(sem `WHATSAPP_RAMPA_FASE` = fase 0 = nenhum envio automático). Ligada sem a variável configurada,
pararia toda confirmação e lembrete em produção, um dano maior que o que ela evita.

**F4:** `src/core/messaging/rampa-whatsapp.ts` + `tests/unit/core/rampa-whatsapp.test.ts` (31 casos:
fase inválida vira 0 e é sinalizada, lista de tenants nas fases 1–2, orçamento separado para
transacional, para a campanha não consumir a confirmação).

**F5 · Medida (campanha por dia no número, todos os tenants somados):**

| Tenants no ar | Hoje (só teto por tenant) | Rampa fase 1 | fase 2 | fase 3 |
| --- | --- | --- | --- | --- |
| 20 (alpha) | até 2.000 | 50 | 150 | 400 |
| 100 | até 10.000 | 50 | 150 | 400 |

O número parte de um teto que cresce em degraus, em vez de "liga tudo". Os orçamentos são estimativa
declarada (`[S]` no próprio arquivo), sem uso real para calibrar.

**Para ligar (decisão do Eduardo, registrada):** portar `whatsapp-config.ts` e a chamada em
`mensageria.ts` da mesma branch, com `WHATSAPP_RAMPA_FASE` e `WHATSAPP_RAMPA_TENANTS` definidos na
Vercel ANTES do deploy; revisão própria porque mexe no caminho de todo envio.

**Nota:** cliente 7 · segredo 6 · engenharia 8. **Próximo (C-018):** banco do automotivo se o Docker
voltar; senão algoritmo (3 ciclos desde o C-014): o viés da deriva por outro caminho, a recência no
estado (C-009 mostrou 34% de lembretes desnecessários na deriva).
