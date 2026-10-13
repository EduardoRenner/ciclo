# Agente E · Dados e banco (Fase 0, subfase 0.9) — 13/10/2026

**Escopo.** Contrato `docs/97` (A3, A5 "Funcionalidade e dados", A8, 0.9, Fase 2 itens 5–7 e 11).

**Ambiente.** Banco **local** `supabase_db_ciclo` (PostgreSQL 17.6), acessado por `docker exec … psql -U postgres`.
- Só leitura e `explain`. Nenhuma escrita, nenhum `ANALYZE`, nenhum `pg_stat_statements_reset`.
- O papel `authenticated` foi emulado dentro de `begin read only` com `request.jwt.claims` do dono de `demo-dom-estilo`. A sessão sempre terminou em `rollback`.
- Produção e o banco de dev remoto **não** foram tocados.

**Números crus.** Estão em `docs/98-aprimoramento/medidas/E-dados.json`.

**Não repito o mapa de dinheiro.** O agente C já fez o mapa "número → fonte" por tela (`agentes/C-funcionalidade.md`, seção DINHEIRO; achados C-02, C-03, C-24 e C-38). Conferi esse mapa por amostragem e concordo.
- Aqui entra o que é de **banco**: RLS, truncamento, gravação que se perde, índices, seed e migrations.
- Entra também a comparação entre telas **medida no banco**.

## Resumo em uma tela

| ID | Sev. | Área | Problema (uma linha) |
|---|---|---|---|
| E-01 | **S1** | RLS × velocidade | `can_see_appointment` custa **0,45 ms por linha**. Cada leitura de agendamento e de comanda paga isso. |
| E-02 | **S1** | Números | 7 consultas sem paginação nem ordem passam do teto de **1000 linhas** do PostgREST. Os números saem truncados, sem aviso. |
| E-03 | **S1** | Dado perdido | O cron `segments` grava `last_visit_at = null` em quem foi importado sem atendimento. A data informada some. |
| E-04 | **S1** | Segurança/dinheiro | Qualquer membro pode `DELETE` e `UPDATE` em `tickets`/`ticket_items` direto pelo REST. Nada congela a comanda fechada. |
| E-05 | **S1** | Mês trava | `margemDosServicos` manda os ids de 90 dias de comandas na URL (`.in`). Em salão movimentado a tela `/admin/mes` cai. |
| E-06 | S2 | Números | O "em risco" da Hoje (RPC) e o do Recuperar (view) contam populações diferentes. |
| E-07 | S2 | Seed | Demo absurda no agregado: 100% compareceu, 57% na terça, 81% às 9h. Faltam comanda, pagamento e Motor de Ciclo. |
| E-08 | S2 | Schema × código | Colunas e tabelas sem escritor ou sem leitor. `no_show_count` é zero para todos e vai para o assistente. |
| E-09 | S2 | Migrations | A 0101 da fila (PR #142) volta para trás da 0117. A 0118 do PR #149 vai colidir com a próxima. |
| E-10 | S3 | Privilégio | As 5 views têm GRANT ALL para `anon`. Funções `security definer` estão executáveis por `anon`. |
| E-11 | S3 | RLS | 3 políticas do pacote jurídico usam `auth.role()` sem initplan. |
| E-12 | S3 | Índices | Há um GIN de 5 MB sem leitor, um índice redundante e faltam 2 índices para consultas por janela. |
| E-13 | S3 | Fórmula duplicada | `clube.ts` recalcula comissão com o percentual de hoje. A comanda congela o percentual. |
| E-14 | S3 | Série mensal | `monthly_profit` não guarda aluguel nem gorjeta. O mês congelado não se explica. |

---

## ACHADOS

### E-01 · S1 · RLS × velocidade · `can_see_appointment` por linha

**Problema.** As políticas SELECT de `appointments`, `tickets` e `ticket_items` chamam funções `security definer` com argumento de **coluna**:
- `has_tenant(tenant_id)` e `can_see_appointment(tenant_id, professional_id)`;
- em `tickets`/`ticket_items`, `can_see_ticket`, que chama `can_see_appointment`.

Com argumento de coluna o Postgres não transforma em initplan. A função roda **uma vez por linha lida**. Dentro dela há mais chamadas: `has_tenant`, `tenant_role`, a leitura de `tenants.settings` e `my_professional_id`.

O app lê essas tabelas com o cliente do usuário (`criarClienteDoUsuario`), então paga a RLS em toda tela.

**Evidência (FATO, banco local, `authenticated` emulado):**

| Medida | Resultado |
|---|---|
| 1000 chamadas de `can_see_appointment` (arg. variável) | **450,9 ms** |
| 1000 chamadas de `has_tenant` | 16,5 ms |
| 1000 chamadas de `tenant_role` | 20,6 ms |
| 1000 chamadas de `auth.uid()` | 0,5 ms |
| `select count(*) from appointments` do tenant (105 linhas), 3× | 75,6 / 89,9 / 63,1 ms |
| Mesma contagem com semi-join em `memberships` (sem política) | **0,84 ms** |
| Hoje "comparação com o costume" (30 linhas): `authenticated` × `postgres` | 15,49 ms × 0,053 ms |
| Atribuição "o Motor trouxe" (105 linhas), `authenticated` | 42,4 ms |

O plano mostra a política como `Filter: (has_tenant(tenant_id) AND can_see_appointment(tenant_id, professional_id) …)`.

**`pg_stat_statements`** (chamadas que as sessões dos agentes A e B fizeram pelo app, FATO):
- atribuição (`atribuicao.ts:150`): média **173,7 ms**, máx 573 ms;
- comparação de 56 dias (`resumo-hoje.ts:127`): média **94,2 ms**, máx 461 ms;
- `resumo_central_de_acoes`: média 95,4 ms.

Tudo isso num tenant com ~105 agendamentos.

**[INFERÊNCIA] Projeção.** 0,45–0,7 ms × linhas (FATO acima) com 3 profissionais × 10 atendimentos/dia × 56 dias ≈ 1.680 linhas (hipótese de salão médio) → **~0,8–1,2 s só de RLS** na consulta da Hoje.
- Ela roda em paralelo com as outras, mas é a mais longa.
- Cresce com o histórico, não com o uso do dia.

**Correção.** Trocar o predicado por linha por conjuntos calculados uma vez (initplan):

```sql
-- funções security definer SEM argumento de coluna, avaliadas uma vez por consulta
--   meus_tenants()            -> uuid[] de memberships ativas de auth.uid()
--   tenants_onde_vejo_tudo()  -> uuid[] onde o papel é owner/manager/reception/finance
--                                ou restrict_professional_view está desligado
--   meus_profissionais()      -> uuid[] de professionals.user_id = auth.uid()
using (
  tenant_id = any ((select public.meus_tenants()))
  and (tenant_id = any ((select public.tenants_onde_vejo_tudo()))
       or professional_id = any ((select public.meus_profissionais())))
)
```

- A semântica não muda. `pnpm test:rls` prova o isolamento.
- Medir antes e depois com o mesmo script (`E-dados.json` → `rls_custo_*`).
- A migration troca política por equivalente. Não é restritiva, mas convém subir junto com o deploy e testar por papel.

### E-02 · S1 · Números truncados em 1000 linhas, sem aviso

**Problema.** `supabase/config.toml:18` tem `max_rows = 1000` (FATO). O PostgREST corta a resposta nesse teto e não devolve erro.

As consultas abaixo não usam `buscarTudoPaginado`, `.limit` nem agregação em SQL. Também não têm `order`, então o recorte é arbitrário. Varredura feita por script nas tabelas quentes; das 52 sem teto, estas alcançam mais de 1000 linhas por tenant:

| Arquivo:linha | O que lê | Efeito quando passa de 1000 |
|---|---|---|
| `atribuicao.ts:237` (`receitaPorCampanha`) | **todos** os `done` do tenant, sem data | "Agendou / R$" de cada campanha subconta |
| `atribuicao.ts:150` e `:142` | `done` e mensagens de campanha em mês + 30 dias | "O Motor trouxe R$ X" subconta |
| `resumo-hoje.ts:127` | `done` de 56 dias | "% acima/abaixo do costume" calculado sobre parte dos dias |
| `recuperar-receita.ts:63` | `v_recover_revenue` inteira | `count` e `totalValueCents` do Recuperar e da Hoje (`limit: 1` não limita a consulta, só a lista) |
| `recuperar-receita.ts:74` | `client_cycles` `on_track` (usado para **excluir**) | Quem está em dia num serviço volta à lista de sumidos |
| `crm.ts:475` | público "sumidos" da campanha | A campanha sai para no máximo 1000 sem dizer |
| `crm.ts:685` | `loyalty_entries` do tenant | Pontos de fidelidade somados pela metade |

**Evidência.** O tenant local `ciclo-328f57e3` tem **10.013** agendamentos `done` e **10.003** ciclos `on_track` (FATO, `select count(*)`). As consultas `recuperar-receita.ts:74` e `atribuicao.ts:237` devolveriam 1000 de 10.003 e de 10.013.

[NÃO VERIFICADO] pelo app: esse tenant não tem membro. Motivo: criar login é escrita. Quem destrava: rodar com um usuário de teste num banco descartável.

**Correção.**
- Agregados (`count`, `sum`) vão para RPC ou view com `group by`.
- Listas usam `buscarTudoPaginado` com `order`.
- O conjunto de exclusão (`on_track`) vira `not exists` na própria view. A `v_clientes_a_recuperar` já faz assim.
- Guarda de teste: lista de consultas sem teto em tabela que cresce, que só encolhe. Ver reprovar reintroduzindo uma.

### E-03 · S1 · O cron `segments` apaga a última visita informada

**Problema.** A importação por planilha e o "Quem você já atende" gravam `clients.last_visit_at` com a data informada:
- `importacao-clientes.ts:314,346`;
- `quem-ja-atendo.ts:152`;
- a migration 0096 existe só para isso.

O cron `segments` (`segmentos.ts:49-68`) relê **todos** os clientes e faz `upsert` com `last_visit_at: dados?.ultimaVisita ?? null` (linha 60). `dados` vem só de `appointments done`. Para quem foi importado e ainda não teve atendimento no CICLO, a data vira `null` e `visits_count` vira 0.

Quem lê essa coluna depois:
- a exportação "levo na hora" (`clientes.ts:193`);
- a ficha;
- `v_client_segments`;
- o contexto do assistente (`ferramentas.ts:240`).

O cron roda a cada 1 a 3 horas (pg_cron 0087 / cron-job.org, conforme C-23). É a lição "recálculo congela o que entrou por outra porta", agora no job irmão.

**Evidência.** FATO por código, com as linhas acima. `tests/integration/segmentos.test.ts:128-139` só monta cliente **com** atendimento: o caso importado não é testado. [NÃO VERIFICADO] por execução, porque exige escrita.

**Como validar.** Teste de integração:
1. importar um cliente com `lastVisitDate`, sem atendimento;
2. rodar `recalcularSegmentosDoTenant`;
3. afirmar que `last_visit_at` não mudou.

Ver o teste reprovar no código atual.

**Correção.**
- Não tocar `last_visit_at` quando não há atendimento.
- Quando há, gravar o maior dos dois (`greatest`).
- Melhor ainda: coluna própria `last_visit_informed_at`. A derivada nunca apaga a informada.
- Também tirar `name` do upsert (C-24).

### E-04 · S1 · Segurança/dinheiro · comanda fechada editável e apagável por qualquer membro

**Problema.** As políticas e os grants de `tickets` e `ticket_items` (FATO, `pg_policies` e `privilegios_report()`):
- `tickets_delete using has_tenant(tenant_id)`;
- `tickets_update` / `ticket_items_update` com `has_tenant(tenant_id)`;
- `ticket_items_delete` com `has_tenant`;
- `authenticated` tem DELETE em `tickets` e `ticket_items`.

**Não existe gatilho** em `tickets` nem em `ticket_items`. A consulta a `pg_trigger` só achou `appointments_touch`.

O "fechar congela" do TICKET-042 vale só dentro do app. Pelo REST, com a chave pública e o JWT da própria sessão, um profissional pode:
- `PATCH ticket_items.commission_cents` de comanda fechada. O extrato de comissão lê exatamente essa coluna (`comissao.ts:74-101`);
- mudar `tickets.total_cents` ou `profit_cents`;
- `DELETE` a comanda inteira. A regra 11 do `CLAUDE.md` diz para nunca apagar.

**Por que a capacidade ainda existe:**
- A 0073 justifica a política aberta com uma premissa falsa. Linha 54: "as rotas do app usam service_role". FATO: `src/app/api/v1/tickets/[id]/close/route.ts:22` usa `criarClienteDoUsuario()`. As outras 4 rotas de comanda também.
- Não há `.from('tickets').delete()` em `src/`. O DELETE de `tickets` é **capacidade morta**, pelo próprio critério da 0085.

[NÃO VERIFICADO] por execução, porque exige escrita. Como validar: num banco descartável, logar como profissional e mandar `PATCH /rest/v1/ticket_items?id=eq.<item fechado>`.

**Correção.** Não depende da matriz de papéis, que é decisão do dono (`docs/58`).
1. Migration **restritiva, depois do deploy**: `drop policy tickets_delete` e `revoke delete on tickets from authenticated`.
2. Gatilho `before update or delete` em `tickets`/`ticket_items`:
   - recusa mudança em colunas de dinheiro quando `status in ('closed','paid')`;
   - permite só a transição de status do cancelamento;
   - recusa DELETE de item de comanda não `open`.
3. Corrigir o comentário da 0073.

Teste de RLS: profissional → `PATCH commission_cents` → 42501. Ver reprovar antes do gatilho.

### E-05 · S1 · `/admin/mes` cai em salão movimentado

**Problema.**
- `margemDosServicos` (`caixa.ts:256-277`) busca as comandas de **90 dias** e depois `.in('ticket_id', tickets.map(t => t.id))`.
- O próprio arquivo, 60 linhas antes (`caixa.ts:198-208`), explica por que trocou esse padrão por join em `concentracaoDoMes`: ~800 ids viram uma URL de ~30 KB e o PostgREST recusa.
- A chamada está no `Promise.all` de `mes/page.tsx:95`, **sem `catch`**. Falhou, a tela vai para o error boundary.

**Evidência.**
- FATO por código.
- Limite medido na casa: `importacao-clientes.ts:15-24` registra `URI too long` com 200 itens de ~65 caracteres no gateway local, e 500 sem lote falhando.
- [HIPÓTESE] Limiar: 90 dias × ~9 comandas/dia ≈ 800 UUIDs × ~37 caracteres ≈ 30 KB. Como validar: num banco descartável, criar 900 comandas fechadas e abrir `/admin/mes`.

**Correção.** O mesmo `tickets!inner(status, closed_at)` de `concentracaoDoMes`, ou uma RPC que agregue por serviço. Mais um `catch` que conta e avisa, como os vizinhos.

### E-06 · S2 · Hoje e Recuperar contam "em risco" de jeitos diferentes

A `/admin/hoje` mostra os dois números.

| Onde | Fonte | Estados | Exclui cliente apagado | Exclui opt-out | Exclui quem tem ciclo em dia |
|---|---|---|---|---|---|
| Alarme da central de ações (`crm.ts:707`) | `resumo_central_de_acoes` → `v_clientes_a_recuperar.ja_atrasado` | late, at_risk, lost | **não** (a view não junta `clients`) | **não** | sim |
| Herói "em risco" e `/admin/recuperar` (`recuperar-receita.ts:63-110`) | `v_recover_revenue` + `quemRecuperar` | **due**, late, at_risk, lost | sim (`c.deleted_at is null`) | sim (em memória) | sim (em memória, truncado: E-02) |

**Evidência.** FATO pelas definições (`pg_get_viewdef`, `pg_get_functiondef`).

No banco local os dois dão 9 no tenant de 10k: não há caso divergente semeado. Como validar: um cliente com ciclo `late` e `deleted_at` preenchido, ou com `whatsapp_opt_out`. O alarme conta, o Recuperar não.

**Correção.** Uma view só, com as quatro regras. Os dois números saem dela, e um teste afirma que são iguais.

### E-07 · S2 · Seed: crível de longe, absurdo no agregado, e vazio onde mais importa

**Distribuições medidas** nos 6 negócios demo (FATO, SQL em `E-dados.json`):
- **Agendamentos por cliente:** média 4,8, mediana 5, mín 3, máx 6. Uniforme demais: não há cliente de uma vez só nem cliente fiel de 20 visitas.
- **Comparecimento: 100%.** Todo passado é `done`: 0 `no_show`, 0 `canceled`. O seed só escreve `status: 'done'` (`seed-demo-6-negocios.mjs:340`).
- **57,4% na terça** (364 de 634). O laço empurra domingo e segunda para o dia seguinte (`:330`).
- **80,8% começam às 9h.** O encadeamento começa às 9h e quase nunca enche.
- **Ocupação:** 1,2 a 1,6 atendimentos por profissional por dia.
- **`demo-dom-estilo`:** 3 profissionais, 12 atendimentos e R$ 745 em 30 dias (≈ R$ 248 por profissional no mês). Ticket médio R$ 66,35.
- **Conversão de campanha:** impossível medir. 0 campanhas e 1 mensagem no seed.

**Vazio onde a tela vive:**
- 0 comandas, 0 pagamentos e 0 `monthly_profit` nos 6 demo. O agente C fechou 1 comanda durante esta sessão.
- 0 `client_cycles` e 0 `cycle_predictions`: o Motor não rodou depois do seed.
- O comentário do seed diz que 1 em cada 4 fica atrasado "pro Motor de Ciclo ter o que acusar" (`:269`). Sem rodar `recompute-cycles`, o Recuperar abre vazio.

**Mesmo tenant, mesmo período, telas diferentes** (`demo-dom-estilo`, fuso SP, FATO):

| Número | Valor |
|---|---|
| Hoje "Atendido" em 10/10 (Σ `appointments.price_cents`) | R$ 70,00 |
| Caixa "Entrou no dia" 10/10 (Σ `tickets.total_cents`) | **R$ 0,00** |
| Atendido em outubro / Caixa "Entrou no mês" outubro | R$ 205,00 / **R$ 0,00** |
| Σ `clients.ltv_cents` / Σ `appointments.price_cents done` | R$ 6.900 / R$ 6.900 (o seed escreve LTV à mão, `:408`) |
| `v_recover_revenue` | 0 linhas (6 clientes sem vir há mais de 45 dias) |

**Ambiente diferente do que diz o `AMBIENTE.md`** (FATO):
- Há um 8º tenant, `ciclo-328f57e3` ("Salão do Ciclo"), criado em 13/10 às 04:18 UTC: 10.013 clientes, 10.014 agendamentos, nenhum membro.
- Outros agentes estão escrevendo no banco: `clients` passou de 10.176 para 10.182, e `demo-salao-encanto` ganhou 1 comanda e 1 ciclo durante esta sessão.

**Consequência.** Toda medida de Caixa, Mês, Comissão e Recuperar sobre a demo local mede **tela vazia**. Velocidade e conteúdo dessas telas não estão provados por esta base.

**Correção.**
- Seed com comandas fechadas (com desconto, gorjeta e 1 estorno).
- 10–15% de faltas e cancelamentos.
- Horário e dia espalhados pelo expediente.
- 1 pacote com sessões usadas.
- Rodar `recompute-cycles` e `segments` no fim.
- Uma guarda que mede as distribuições: comparecimento entre 80 e 95%, nenhum dia da semana acima de 30%.

### E-08 · S2 · Schema × código: sem escritor, sem leitor

Varredura das 344 colunas das 31 tabelas dos fluxos principais contra `src/` e `scripts/`. FATO por grep; script em `scratchpad/py/cols.py`, saída resumida.

| Coluna / tabela | Escritor | Leitor | Consequência |
|---|---|---|---|
| `clients.no_show_count` | só `scripts/seed-demo-barbearia.mjs` (nota do próprio `crm.ts:292`) | contexto do **assistente** (`ferramentas.ts:237`) e `clientes.ts:15` | O modelo recebe "0 faltas" para todos (0 de 10.182 clientes com valor > 0). Repete a lição "modelo confabula o que não vê". |
| `clients.ltv_cents` / `visits_count` | cron `segments`, por preço de tabela | lista, segmentos, campanha, assistente | Ignora desconto, pacote e estorno (ver tabela do C). Atraso de 1–3 h. |
| `messages.scheduled_for` | **nenhum** | **nenhum** | O índice `messages_status_scheduled_for_idx` tem `idx_scan = 0`. A fila "queued" não existe. |
| `client_cycles.sample_size` | SQL do Motor (0092/0093) | só a view; nada em `src/` | Peso morto na view |
| `services.canonical_key` (0097) | SQL | nada em `src/` | [NÃO VERIFICADO]: pode ser lido só por função SQL |
| `campaigns.booked_count` / `revenue_cents` | nenhum (de propósito, `atribuicao.ts:211`) | `crm.ts:540` devolve no `select` da criação | Inofensivo hoje; a tela já não lê (`campanhas/page.tsx:36`) |
| tabela `payments` | **nenhum** em `src/` | **nenhum** | Pacote e sinal nunca entram no caixa (C-02) |
| tabela `commissions` | nenhum | nenhum | A comissão vive em `ticket_items.commission_cents`. A tabela tem políticas de DELETE e UPDATE abertas: E-04 vale para ela quando ganhar uso. |
| `webhook_events`, `service_categories` | nenhum | nenhum | Capacidade morta |
| view `v_daily_cash` | n/a | nenhum (`caixa.ts:52` explica que está errada: trunca o dia no fuso da sessão) | Continua publicada e com GRANT para `anon` |

Também conferido no banco (FATO, sem divergência):
- Nenhuma tabela de `public` está sem `force row level security`.
- Nenhuma FK está sem índice (`fk_sem_indice_report()` vazio).
- Não há políticas permissivas múltiplas para o mesmo papel e comando (consulta em `pg_policies`: 0 linhas).
- `products.stock_qty` bate com Σ `stock_moves.qty` em todos os produtos.

**Correção.**
- Tirar `no_show_count` do contexto do modelo e calcular as faltas ao vivo, como a ficha já faz.
- Apagar ou arquivar `v_daily_cash`, `commissions`, `service_categories`, `webhook_events` e `messages.scheduled_for` com o índice dele. Antes, confirmar que nenhuma função SQL lê esses objetos.

### E-09 · S2 · Migrations: o número 0101 volta para trás, e a 0118 vai colidir

**FATO.**
- Banco local: 116 aplicadas, de 0001 a 0117, **sem a 0101**. Bate com o `main`, que tem 116 arquivos.
- `src/core/schema/versao.ts`: `MIGRATIONS_ESPERADAS = 116`, `ULTIMA_MIGRATION = '0117_privilegio_minimo'`.

**De onde vem a lacuna da 0101:**
- `0101_pacote_advocacia.sql` entrou no `main` em `fe59acd3` (07/10 23:48).
- Foi renomeada para `0102` em `768ec22a` (08/10 01:08). O motivo, registrado em `DECISOES.md:13752`: "a branch da fila já usa 0101".

**O que está fora do `main`:**
- `0101_chamada_guarda_o_texto_e_a_nota.sql` em `origin/feat/fila-e4-biblioteca`, **PR #142 aberto** ("NÃO MESCLAR antes da 0101"). Acrescenta `messages.variant_key`, `score_at_send` e `profile_at_send`. É aditiva. `docs/96` diz "0101 pendente em produção". As três colunas não existem no banco local e não aparecem no código do `main`.
- `0118_comissao_de_produto_por_profissional.sql` em `origin/simplifica/interface-2026-10-08`, **PR #149 aberto**. Acrescenta `professionals.product_commission_bps`.
- Nenhuma outra branch remota passa de 0117.

**Riscos:**
1. `supabase db push` recusa arquivo com número menor que o último aplicado no remoto (0101 < 0117) sem `--include-all`. Mesclar o #142 como está trava o próximo push. [INFERÊNCIA] pelo comportamento do CLI, que a própria `DECISOES.md:13752` registra.
2. A `0101_pacote_advocacia` viveu cerca de 1h20 no `main`. [NÃO VERIFICADO] se foi aplicada em produção ou no dev nessa janela. Se foi, a versão `0101` já está no histórico remoto e a 0101 da fila seria **pulada em silêncio**: mesma versão, outro conteúdo, e as três colunas nunca nascem. Quem destrava: o Eduardo, com `select version, name from supabase_migrations.schema_migrations where version = '0101'` em produção e no dev.
3. A próxima migration de qualquer branch nasce como 0118 e colide com o #149.
4. Não há `db push` em `.github/workflows/`. A aplicação em produção é manual, então vale a lição "produção atrás do código". Diferença repo × dev × produção: [NÃO VERIFICADO], fora do escopo autorizado.

**Correção.**
- Renumerar a migration da fila para o próximo número livre **no momento do merge** (ex.: 0119).
- Reservar 0118 para o #149.
- Conferir `schema_migrations` remoto antes de mesclar.
- Atualizar `versao.ts` (a contagem sobe para 117/118).

### E-10 · S3 · Privilégio: views com GRANT ALL para `anon`; funções definer abertas

**FATO.**
- As 5 views (`v_daily_cash`, `v_client_segments`, `v_carteira_resumo`, `v_clientes_a_recuperar`, `v_recover_revenue`) dão `INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` a `anon` e `authenticated`.
- Todas têm `security_invoker=true` e não são atualizáveis (`information_schema.views`). `anon` não tem grant em nenhuma tabela. Hoje não há vazamento.
- A 0117 ("privilégio mínimo") limpou as tabelas e não chegou às views.
- `has_tenant`, `tenant_role`, `can_see_appointment` e `my_professional_id` (`security definer`) são executáveis por `anon`. Sem `auth.uid()` devolvem falso ou nulo.

**Correção.** `revoke all on <views> from anon`; para `authenticated`, só `grant select`. Revogar `execute` de `anon` nas quatro funções, depois de confirmar com `pnpm test:rls` que nenhuma rota pública depende disso.

### E-11 · S3 · RLS: `auth.role()` fora de initplan

FATO: `legal_checklist_templates_select`, `legal_checklist_template_items_select` e `legal_holidays_select` chamam `auth.role()` sem `(select …)`. Isso dá uma chamada por linha. São tabelas pequenas, então o custo hoje é baixo.

Correção: `(select auth.role())`. É o mesmo ajuste que a 0042 fez nas outras.

### E-12 · S3 · Índices

**Índices que sobram (FATO, `pg_stat_user_indexes`):**
- `clients_name_trgm` (GIN): `idx_scan = 0`, **5.016 kB** com 10k clientes. Nenhum leitor desde a 0047, porque a busca usa `name_busca`. O que ele cobra é escrita em todo insert e update de cliente.
- `tickets_appointment_id_idx`: redundante com `tickets_um_por_agendamento` (mesma coluna, único parcial).

**Índices que faltam [INFERÊNCIA]:**
- Atribuição, `appointments` por `(tenant_id, created_at)`: Q04 e Q05 fazem Seq Scan.
- `messages` por `(tenant_id, kind, sent_at) where status = 'sent'`: Q06 faz Seq Scan. `messages` é a tabela que mais cresce (cada lembrete gera uma linha).
- No local o Seq Scan também acontece porque o tenant de 10k é 94% da tabela. Em produção [INFERÊNCIA] o plano seria `appointments_tenant_id_*` com filtro, lendo **todo o histórico do tenant** a cada abertura da Hoje.

**Os 20 planos medidos** estão em `E-dados.json` → `explain_resumo` e em EVIDÊNCIAS. Os de leitura por dia, por cliente e por busca usam índice e rodam em menos de 7 ms.

### E-13 · S3 · Fórmula de comissão em duas cópias

`clube.ts:77-118` recalcula a comissão de cada visita de assinante:
- usa `calcularComissaoItem` com o percentual **atual** de `professional_services` e `professionals`;
- a base é `appointments.price_cents`.

A comanda congela `commission_bps` no fechamento (`comanda.ts:286-290`). Quando o percentual muda, a "margem do clube" do Mês diverge da comissão paga de verdade. Repete a lição "duas cópias da mesma fórmula".

Correção: ler `ticket_items.commission_cents` quando houver comanda. Cair para o cálculo só para a visita sem comanda, e dizer isso na tela.

### E-14 · S3 · `monthly_profit` não se explica

FATO: as colunas são `revenue, material, fee, commission, profit, tickets_count, frozen_at`. Não há `fixed_cost_cents`, gorjeta nem desconto.
- `tickets.profit_cents` já desconta aluguel (0072) e gorjeta.
- Num mês congelado, `revenue − material − fee − commission ≠ profit`, e a diferença não tem nome. É a lição "lista fixa de parcelas" que o próprio `ResumoCaixa` cita (`caixa.ts:39-46`).
- Hoje a série só mostra receita e lucro, então o defeito ainda não aparece.

Correção, migration aditiva: `fixed_cost_cents` e `tip_cents` em `monthly_profit`, gravados por `congelarMesesFechados`.

---

## EVIDÊNCIAS

**Comandos (todos locais, só leitura):**
- `docker exec supabase_db_ciclo psql -U postgres -d postgres`. Os scripts SQL usados (`q1`–`q9.sql`) estão em `scratchpad`; o resultado está resumido em `E-dados.json`.
- Emulação de usuário:
  ```
  begin read only;
  set local role authenticated;
  select set_config('request.jwt.claims','{"sub":"<dono demo-dom-estilo>","role":"authenticated"}',true);
  … ;
  rollback;
  ```
- Relatórios do próprio banco: `tenant_rls_report()`, `privilegios_report()`, `fk_sem_indice_report()`. Os três são `STABLE`.
- `pg_stat_statements`: só leitura, sem reset (outros agentes dependem dele).
- Git: `git log --all --oneline --diff-filter=A -- 'supabase/migrations/0101*' '0118*'`, `git branch -r`, `gh pr list`.

**Planos (`explain (analyze, buffers)`; sem `authenticated`, para isolar índice de RLS):**

| # | Consulta (origem no código) | Plano | Tempo |
|---|---|---|---|
| Q01 | Hoje/Agenda do dia (`resumo-hoje.ts:116`) | Index Scan `appointments_tenant_id_starts_at_idx` | 0,60 ms |
| Q02 | Comparação 56 d (`resumo-hoje.ts:127`), tenant 10k | Seq Scan, 10.011 linhas | 49,98 ms |
| Q03 | Indicações do mês (`resumo-hoje.ts:119`) | Index Scan `clients_referred_by_idx` | 0,30 ms |
| Q04 | Atribuição por `created_at` (`atribuicao.ts:150`) | **Seq Scan** | 67,31 ms |
| Q05 | Atribuição por campanha, tudo (`atribuicao.ts:237`) | **Seq Scan** | 3,37 ms |
| Q06 | Mensagens de campanha por janela (`atribuicao.ts:142`) | **Seq Scan** | 0,06 ms (1 linha) |
| Q07 | Caixa do dia (`caixa.ts:74`) | Seq Scan (1 linha na tabela) | 0,06 ms |
| Q08 | Extrato de comissão (`comissao.ts:74`) | Seq Scan (0 linhas) | 0,05 ms |
| Q09 | `v_recover_revenue` (`recuperar-receita.ts:63`) | Index Scan `client_cycles_lucro_em_risco_idx` | 0,35 ms |
| Q10 | Ciclos `on_track` (`recuperar-receita.ts:74`) | Seq Scan, 10.003 linhas | 4,44 ms |
| Q11 | Lista de clientes, 10k (`clientes.ts:115`) | Index Scan Backward `clients_pkey` | 0,36 ms |
| Q12 | Busca por nome (`clientes.ts:140`) | Bitmap `clients_name_busca_trgm` | 6,28 ms |
| Q13 | Histórico na ficha | Index `appointments_tenant_id_client_id_starts_at_idx` | 0,09 ms |
| Q14 | Lembretes, 36 h, todos os tenants (`lembretes.ts:54`) | Bitmap `appointments_no_overlap` | 0,77 ms |
| Q15 | Ocupação do profissional (agendamento público) | Index `appointments_no_overlap` | 0,08 ms |
| Q16 | `resumo_central_de_acoes`, 10k | Seq Scan `appointments` + `clients` (contagens) | 8,79 ms |
| Q17 | `v_client_segments`, 10k | Seq Scan `clients` | 3,69 ms |
| Q18 | `v_carteira_resumo`, 10k | Seq Scan `clients` | 11,19 ms |
| Q19 | Público "sumidos" (`crm.ts:475`) | Index `client_cycles_lucro_em_risco_idx` | 0,05 ms |
| Q20 | Calibração do Motor (`previsao.ts:219`) | Index `cycle_predictions_calibracao_idx` | 0,04 ms |

**Leitura dos planos.** Sem RLS, nenhuma consulta quente passa de 70 ms, mesmo com 10k linhas. O custo real está na política por linha (E-01): 15,5 ms contra 0,05 ms na mesma consulta de 30 linhas.

## INCERTEZAS

- **E-02, E-03, E-04, E-05:** reprodução no app [NÃO VERIFICADO]. Todas exigem escrita (usuário, comandas, importação). Quem destrava: um banco descartável (worktree irmão com `supabase db reset` próprio), autorizado pelo orquestrador.
- **E-01, projeção para salão real:** [INFERÊNCIA] linear sobre 0,45–0,7 ms por linha medidos. O tempo absoluto local não inclui rede (`AMBIENTE.md`). O custo de CPU da política é o mesmo em produção.
- **Produção e dev:** não acessados. A presença de 0101/0102 no histórico remoto e a diferença repo × dev × produção estão [NÃO VERIFICADO]. Motivo: proibido nesta tarefa. Quem destrava: o Eduardo.
- **`get_advisors`:** a ferramenta do Supabase só fala com projeto remoto. As regras equivalentes foram emuladas por SQL: initplan, permissivas múltiplas, FK sem índice, índice duplicado. "unused_index" em banco de teste é ruído (A5). Só reportei índice sem leitor **no código**.
- **O banco mudou durante a medição** (outros agentes escrevendo, E-07). As contagens são do momento indicado.

## RECOMENDAÇÕES (ordem sugerida)

1. **E-04 primeiro.** É dinheiro e não depende de decisão de papel.
   - Gatilho que congela comanda fechada, mais a remoção do DELETE de `tickets` (restritiva, depois do deploy).
   - Teste de RLS por papel, visto reprovar.
2. **E-03.** Uma linha de código e um teste de integração. Evita perda diária de dado que entrou pela porta principal do onboarding.
3. **E-01.** Política em initplan para `appointments`, `tickets` e `ticket_items`.
   - Medir antes e depois com `authenticated` emulado.
   - É o maior ganho de velocidade por linha de código desta auditoria. Entregar ao agente B junto com as idas ao banco que ele mediu.
4. **E-02 + E-05 + E-06.** Agregar no banco, com uma view só para "em risco" e RPC para atribuição e margem.
   - Guarda: "consulta sem teto em tabela que cresce" só encolhe.
5. **E-07.** Seed com comandas, faltas, distribuição de horário e Motor rodado, **antes** de qualquer medida de Caixa, Mês, Comissão ou Recuperar valer como prova (lição "seed parece certo e é absurdo").
6. **E-09.** Decidir a numeração no merge e conferir `schema_migrations` remoto (Eduardo).
7. **Limpeza (E-08, E-10–E-14).** Junto num ticket só de "capacidade morta": views, funções, colunas e índices.
