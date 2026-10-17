# C-003 · Plano (o que este ciclo entrega e o desenho dos próximos)

| ID | Origem | Proposta | Arquivos | Aceite (MEDIDO) | Teste (guarda vista reprovando) | Migration | Dep. | Esforço |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOT-008 | C-003 | `core/cycle/sujeito.ts`: agrupar a série de um cliente por sujeito (ausente = o próprio cliente) | `src/core/cycle/sujeito.ts` | placar "dois sujeitos": perda vista 0% → 100% | unitário + placar; mutação: agrupar tudo numa série só | não | — | P |
| EXP-001 | C-003 | **Sujeito no banco** (próximo ciclo, com revisão adversarial própria): tabela `subjects` (tenant, client, tipo `animal`/`veiculo`, nome, identificador — placa ou nome —, atributos jsonb, ativo), `appointments.subject_id` e `ticket_items.subject_id` NULÁVEIS, e `client_cycles` ganha `subject_id` com chave nova `(tenant, client, service, coalesce(subject_id, zero))` | migration aditiva + RLS + teste de isolamento | beleza inalterada (sujeito nulo); pet com 2 animais: 2 ciclos | test:rls + integração | **aditiva** (nova tabela + colunas nulas), PK de `client_cycles` em migration própria **equivalente** | MOT-008 | M |
| EXP-002 | C-003 | leitura de uso (km) no atendimento e regra de manutenção por serviço (`usage_interval`, `months_interval`) | schema + comanda/agenda | relógio de km com dado real do local | integração | aditiva | EXP-001, C-002 | M |
| EXP-003 | C-003 | profissão "Oficina mecânica" no catálogo, com as 3 regras sementes do StarkOS e vocabulário (cliente, veículo, OS, mecânico) | migration de catálogo | onboarding cria a oficina com as regras | integração do onboarding | aditiva | EXP-001 | P |
| EXP-004 | C-003 | demo navegável da oficina (degrau b), no padrão do kit da Advocacia | seed + roteiro | roteiro Playwright: marcar, orçamento, OS, lembrete por km | roteiro | não | EXP-001..003 | M |

**Revisão adversarial do desenho do sujeito (EXP-001), antes de existir:**
- **Segunda FK quebra o embed do PostgREST** (armadilha já paga): `appointments` → `subjects` cria
  um caminho novo; todo `select('…, clients(…)')` continua com um caminho só só se `subjects` não
  apontar para `appointments`. Conferir os embeds antes.
- **PK de `client_cycles`**: trocar chave primária com dado dentro é migration restritiva; fazer com
  coluna nova + índice único novo, e a PK antiga só cai depois do código novo no ar.
- **Transferência de veículo** (StarkOS): o sujeito muda de cliente; o histórico vai junto. O ciclo
  não pode virar órfão — `client_id` do ciclo segue o sujeito.
- **LGPD**: placa identifica pessoa indiretamente; tratar como dado pessoal comum (não sensível).
- **Recuperar e prestação de contas** contam por (cliente, serviço) hoje — vão contar duas vezes o
  mesmo tutor? Decidir: a lista de recuperar mostra o sujeito ("Mel, da Ana, sumiu").
